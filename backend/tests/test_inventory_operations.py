from collections.abc import AsyncIterator
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, Mock

import pytest
from httpx import ASGITransport, AsyncClient, Response

from app.db.audit_context import AuditContext
from app.main import app
from app.modules.auth.dependencies import CurrentPrincipal, get_current_principal
from app.modules.auth.models import Sucursal, Usuario
from app.modules.catalog.models import InventarioSucursal, VarianteProducto
from app.modules.inventory.dependencies import get_inventory_service
from app.modules.inventory.exceptions import (
    InvalidInventoryOperationError,
    InventoryConflictError,
)
from app.modules.inventory.models import (
    DetalleOrdenCompra,
    DetalleRecepcion,
    LoteInventario,
    MovimientoInventario,
    MovimientoLote,
    OrdenCompra,
    Proveedor,
    RecepcionMercaderia,
    TransferenciaInventario,
)
from app.modules.inventory.repository import InventoryRepository
from app.modules.inventory.schemas import ReceiptCreate, ReceiptDetailCreate
from app.modules.inventory.service import (
    PURCHASE_TRANSITIONS,
    TRANSFER_TRANSITIONS,
    InventoryService,
)

NOW = "2026-08-30T20:00:00Z"
SUPPLIER = {
    "id_proveedor": 1,
    "id_ciudad": 1,
    "razon_social": "Textiles Bolivia SRL",
    "nombre_comercial": "Textiles Bolivia",
    "nit": "123456789",
    "telefono": "70000000",
    "correo": "ventas@example.com",
    "direccion": "Av. Central 10",
    "nombre_contacto": "Ana",
    "telefono_contacto": "71111111",
    "correo_contacto": "ana@example.com",
    "activo": True,
    "created_at": NOW,
    "updated_at": NOW,
}
ORDER = {
    "id_orden_compra": 1,
    "id_proveedor": 1,
    "id_sucursal": 1,
    "id_empleado": 1,
    "estado": "SOLICITADA",
    "fecha_orden": NOW,
    "fecha_estimada": "2026-09-10",
    "observacion": None,
    "detalles": [
        {
            "id_detalle_orden": 1,
            "id_variante": 1,
            "cantidad": 10,
            "costo_unitario_estimado": "70.00",
        }
    ],
}
MOVEMENT = {
    "id_movimiento": 1,
    "id_inventario": 1,
    "id_empleado": 1,
    "tipo_movimiento": "AJUSTE_NEGATIVO",
    "cantidad": 2,
    "referencia_tipo": "AJUSTE",
    "referencia_id": None,
    "motivo": "Prendas dañadas",
    "fecha_hora": NOW,
    "costo_fifo_consumido": "140.00",
    "lotes": [{"id_lote": 1, "cantidad": 2, "costo_unitario": "70.00"}],
}
TRANSFER = {
    "id_transferencia": 1,
    "id_sucursal_origen": 1,
    "id_sucursal_destino": 2,
    "id_empleado": 1,
    "estado": "SOLICITADA",
    "fecha_solicitud": NOW,
    "fecha_recepcion": None,
    "detalles": [{"id_variante": 1, "cantidad": 6}],
}


def principal(*permissions: str) -> CurrentPrincipal:
    user = Usuario(
        id_usuario=99,
        nombres="Admin",
        apellidos="Inventario",
        correo="inventory@example.com",
        ci="INV-99",
        password_hash="not-returned",
        estado="ACTIVO",
        created_at=datetime(2026, 8, 30, tzinfo=UTC),
        updated_at=datetime(2026, 8, 30, tzinfo=UTC),
    )
    return CurrentPrincipal(
        user=user,
        roles=frozenset({"ADMIN"}),
        permissions=frozenset(permissions),
        session_id="inventory-test",
    )


async def call(
    method: str,
    path: str,
    *,
    service: AsyncMock,
    actor: CurrentPrincipal,
    json: dict | None = None,
) -> Response:
    async def override_service() -> AsyncIterator[AsyncMock]:
        yield service

    app.dependency_overrides[get_inventory_service] = override_service
    app.dependency_overrides[get_current_principal] = lambda: actor
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
        ) as client:
            return await client.request(method, path, json=json)
    finally:
        app.dependency_overrides.clear()


async def test_create_supplier() -> None:
    service = AsyncMock()
    service.create_supplier.return_value = SUPPLIER
    response = await call(
        "POST",
        "/api/v1/suppliers",
        service=service,
        actor=principal("proveedores.gestionar"),
        json={"razon_social": "Textiles Bolivia SRL", "nit": "123456789"},
    )
    assert response.status_code == 201


async def test_duplicate_supplier_nit() -> None:
    service = AsyncMock()
    service.create_supplier.side_effect = InventoryConflictError("NIT is already registered")
    response = await call(
        "POST",
        "/api/v1/suppliers",
        service=service,
        actor=principal("proveedores.gestionar"),
        json={"razon_social": "Duplicado", "nit": "123456789"},
    )
    assert response.status_code == 409


async def test_associate_supplier_product() -> None:
    service = AsyncMock()
    service.add_supplier_product.return_value = {
        "id_producto_proveedor": 1,
        "id_producto": 2,
        "producto": "Polera",
        "codigo_proveedor": "P-10",
        "activo": True,
    }
    response = await call(
        "POST",
        "/api/v1/suppliers/1/products/2",
        service=service,
        actor=principal("proveedores.gestionar"),
        json={"codigo_proveedor": "P-10"},
    )
    assert response.status_code == 201


async def test_reject_duplicate_supplier_product() -> None:
    service = AsyncMock()
    service.add_supplier_product.side_effect = InventoryConflictError("Relation exists")
    response = await call(
        "POST",
        "/api/v1/suppliers/1/products/2",
        service=service,
        actor=principal("proveedores.gestionar"),
        json={},
    )
    assert response.status_code == 409


async def test_deactivate_supplier() -> None:
    service = AsyncMock()
    service.update_supplier.return_value = {**SUPPLIER, "activo": False}
    response = await call(
        "PATCH",
        "/api/v1/suppliers/1",
        service=service,
        actor=principal("proveedores.gestionar"),
        json={"activo": False},
    )
    assert response.status_code == 200
    assert response.json()["activo"] is False


async def test_create_purchase_order_with_variants() -> None:
    service = AsyncMock()
    service.create_purchase_order.return_value = ORDER
    response = await call(
        "POST",
        "/api/v1/purchase-orders",
        service=service,
        actor=principal("proveedores.gestionar"),
        json={
            "id_proveedor": 1,
            "id_sucursal": 1,
            "detalles": [
                {"id_variante": 1, "cantidad": 10, "costo_unitario_estimado": 70}
            ],
        },
    )
    assert response.status_code == 201
    assert response.json()["detalles"][0]["cantidad"] == 10


def test_valid_purchase_state_transition() -> None:
    InventoryService.validate_transition("SOLICITADA", "CONFIRMADA", PURCHASE_TRANSITIONS)


def test_invalid_purchase_state_transition() -> None:
    with pytest.raises(InvalidInventoryOperationError):
        InventoryService.validate_transition("SOLICITADA", "RECIBIDA", PURCHASE_TRANSITIONS)


def test_received_order_is_terminal() -> None:
    with pytest.raises(InvalidInventoryOperationError):
        InventoryService.validate_transition("RECIBIDA", "CONFIRMADA", PURCHASE_TRANSITIONS)


async def test_register_receipt() -> None:
    service = AsyncMock()
    service.create_receipt.return_value = {
        "id_recepcion": 1,
        "id_orden_compra": 1,
        "id_sucursal": 1,
        "id_empleado": 1,
        "fecha_recepcion": NOW,
        "estado": "CONFIRMADA",
        "observacion": None,
        "detalles": [
            {
                "id_detalle_recepcion": 1,
                "id_variante": 1,
                "cantidad_recibida": 10,
                "costo_unitario": "70.00",
                "id_lote": 1,
            }
        ],
    }
    response = await call(
        "POST",
        "/api/v1/receipts",
        service=service,
        actor=principal("recepcion.registrar"),
        json={
            "id_orden_compra": 1,
            "detalles": [
                {"id_variante": 1, "cantidad_recibida": 10, "costo_unitario": 70}
            ],
        },
    )
    assert response.status_code == 201


def inventory_row(physical: int, reserved: int, minimum: int):
    item = InventarioSucursal(
        id_inventario=1,
        id_sucursal=1,
        id_variante=1,
        stock_fisico=physical,
        stock_reservado=reserved,
        stock_minimo=minimum,
    )
    return (item, "Central", "SKU-1", "Polera", "M", "Negro", "POLERA", Decimal("70"))


@pytest.mark.parametrize(
    "physical,reserved,minimum,available,state",
    [
        (10, 2, 3, 8, "DISPONIBLE"),
        (2, 2, 3, 0, "AGOTADO"),
        (5, 2, 3, 3, "STOCK_BAJO"),
    ],
)
def test_derived_inventory_stock(
    physical: int, reserved: int, minimum: int, available: int, state: str
) -> None:
    response = InventoryService._inventory_response(inventory_row(physical, reserved, minimum))
    assert response.stock_disponible == available
    assert response.estado_stock == state


async def test_update_minimum_stock() -> None:
    service = AsyncMock()
    service.update_minimum_stock.return_value = InventoryService._inventory_response(
        inventory_row(10, 0, 5)
    )
    response = await call(
        "PATCH",
        "/api/v1/inventory/1/minimum-stock",
        service=service,
        actor=principal("inventario.movimiento"),
        json={"stock_minimo": 5},
    )
    assert response.status_code == 200
    assert response.json()["stock_minimo"] == 5


def test_inventory_movements_have_no_update_or_delete() -> None:
    operations = app.openapi()["paths"]["/api/v1/inventory/movements/{movement_id}"]
    assert "patch" not in operations
    assert "put" not in operations
    assert "delete" not in operations


async def test_positive_adjustment() -> None:
    service = AsyncMock()
    service.repository.employee_by_user.return_value = None
    service.adjust_inventory.return_value = {**MOVEMENT, "tipo_movimiento": "AJUSTE_POSITIVO"}
    response = await call(
        "POST",
        "/api/v1/inventory/1/adjustments",
        service=service,
        actor=principal("inventario.movimiento"),
        json={"tipo": "AJUSTE_POSITIVO", "cantidad": 2, "motivo": "Conteo físico"},
    )
    assert response.status_code == 200


async def test_negative_adjustment() -> None:
    service = AsyncMock()
    service.repository.employee_by_user.return_value = None
    service.adjust_inventory.return_value = MOVEMENT
    response = await call(
        "POST",
        "/api/v1/inventory/1/adjustments",
        service=service,
        actor=principal("inventario.movimiento"),
        json={"tipo": "AJUSTE_NEGATIVO", "cantidad": 2, "motivo": "Prendas dañadas"},
    )
    assert response.status_code == 200


def lot(lot_id: int, available: int, cost: str) -> LoteInventario:
    return LoteInventario(
        id_lote=lot_id,
        id_detalle_recepcion=lot_id,
        id_sucursal=1,
        id_variante=1,
        cantidad_inicial=available,
        cantidad_disponible=available,
        costo_unitario=Decimal(cost),
        fecha_ingreso=datetime(2026, 8, lot_id, tzinfo=UTC),
        activo=True,
    )


async def test_fifo_consumes_oldest_lot_first() -> None:
    repository = AsyncMock()
    repository.fifo_lots.return_value = [lot(1, 3, "70"), lot(2, 5, "80")]
    allocations = await InventoryService(AsyncMock(), repository)._fifo_allocations(1, 1, 2)
    assert [(item.id_lote, quantity) for item, quantity in allocations] == [(1, 2)]


async def test_fifo_consumes_multiple_lots() -> None:
    repository = AsyncMock()
    repository.fifo_lots.return_value = [lot(1, 3, "70"), lot(2, 5, "80")]
    allocations = await InventoryService(AsyncMock(), repository)._fifo_allocations(1, 1, 6)
    assert [(item.id_lote, quantity) for item, quantity in allocations] == [(1, 3), (2, 3)]


async def test_fifo_rejects_insufficient_stock() -> None:
    repository = AsyncMock()
    repository.fifo_lots.return_value = [lot(1, 3, "70")]
    with pytest.raises(InvalidInventoryOperationError):
        await InventoryService(AsyncMock(), repository)._fifo_allocations(1, 1, 4)


async def test_fifo_query_locks_selected_lots() -> None:
    session = AsyncMock()
    scalar_result = Mock()
    scalar_result.all.return_value = []
    session.scalars.return_value = scalar_result
    await InventoryRepository(session).fifo_lots(1, 1)
    statement = session.scalars.await_args.args[0]
    assert "FOR UPDATE" in str(statement)


def test_movement_lot_cost_consistency() -> None:
    total = sum(
        (Decimal(item["costo_unitario"]) * item["cantidad"] for item in MOVEMENT["lotes"]),
        Decimal(0),
    )
    assert total == Decimal(MOVEMENT["costo_fifo_consumido"])


async def test_transfer_requires_different_branches() -> None:
    response = await call(
        "POST",
        "/api/v1/inventory/transfers",
        service=AsyncMock(),
        actor=principal("inventario.movimiento"),
        json={
            "id_sucursal_origen": 1,
            "id_sucursal_destino": 1,
            "detalles": [{"id_variante": 1, "cantidad": 2}],
        },
    )
    assert response.status_code == 422


async def test_create_transfer_with_sufficient_stock() -> None:
    service = AsyncMock()
    service.create_transfer.return_value = TRANSFER
    response = await call(
        "POST",
        "/api/v1/inventory/transfers",
        service=service,
        actor=principal("inventario.movimiento"),
        json={
            "id_sucursal_origen": 1,
            "id_sucursal_destino": 2,
            "detalles": [{"id_variante": 1, "cantidad": 6}],
        },
    )
    assert response.status_code == 201


async def test_transfer_rejects_insufficient_stock() -> None:
    service = AsyncMock()
    service.create_transfer.side_effect = InvalidInventoryOperationError(
        "Insufficient origin stock"
    )
    response = await call(
        "POST",
        "/api/v1/inventory/transfers",
        service=service,
        actor=principal("inventario.movimiento"),
        json={
            "id_sucursal_origen": 1,
            "id_sucursal_destino": 2,
            "detalles": [{"id_variante": 1, "cantidad": 100}],
        },
    )
    assert response.status_code == 400


def test_transfer_dispatch_transition() -> None:
    InventoryService.validate_transition("APROBADA", "EN_TRANSITO", TRANSFER_TRANSITIONS)


def test_transfer_receipt_transition() -> None:
    InventoryService.validate_transition("EN_TRANSITO", "RECIBIDA", TRANSFER_TRANSITIONS)


def test_transfer_cannot_cancel_after_dispatch() -> None:
    with pytest.raises(InvalidInventoryOperationError):
        InventoryService.validate_transition("EN_TRANSITO", "CANCELADA", TRANSFER_TRANSITIONS)


def test_destination_lots_keep_distinct_fifo_costs() -> None:
    source = [(lot(1, 3, "70"), 3), (lot(2, 5, "80"), 3)]
    destination = [
        (item.id_detalle_recepcion, quantity, item.costo_unitario)
        for item, quantity in source
    ]
    assert destination == [(1, 3, Decimal("70")), (2, 3, Decimal("80"))]


async def test_authorized_inventory_access() -> None:
    service = AsyncMock()
    service.list_inventory.return_value = []
    response = await call(
        "GET",
        "/api/v1/inventory",
        service=service,
        actor=principal("inventario.ver"),
    )
    assert response.status_code == 200


async def test_inventory_access_without_permission() -> None:
    response = await call(
        "GET", "/api/v1/inventory", service=AsyncMock(), actor=principal()
    )
    assert response.status_code == 403


async def test_audit_context_is_forwarded() -> None:
    service = AsyncMock()
    service.update_supplier.return_value = {**SUPPLIER, "activo": False}
    actor = principal("proveedores.gestionar")
    await call(
        "PATCH",
        "/api/v1/suppliers/1",
        service=service,
        actor=actor,
        json={"activo": False},
    )
    audit = service.update_supplier.await_args.args[2]
    assert audit.usuario_id == actor.user.id_usuario
    assert audit.sesion_id == actor.session_id


def configured_receipt_service(fail_on_lot: bool = False):
    session = AsyncMock()
    repository = AsyncMock()
    order = OrdenCompra(
        id_orden_compra=1,
        id_proveedor=1,
        id_sucursal=1,
        id_empleado=None,
        estado="EN_TRANSITO",
    )
    repository.purchase_order_for_update.return_value = order
    repository.purchase_details.return_value = [
        DetalleOrdenCompra(
            id_detalle_orden=1,
            id_orden_compra=1,
            id_variante=1,
            cantidad=10,
            costo_unitario_estimado=Decimal("70"),
        )
    ]
    repository.received_quantities.return_value = {}
    repository.get_or_create_inventory.return_value = InventarioSucursal(
        id_inventario=1, id_sucursal=1, id_variante=1
    )
    supplier = Proveedor(id_proveedor=1, razon_social="Proveedor", activo=True)
    branch = Sucursal(id_sucursal=1, id_ciudad=1, nombre="Central", direccion="Centro", activo=True)
    variant = VarianteProducto(
        id_variante=1,
        id_producto=1,
        id_talla=1,
        id_color=1,
        sku="SKU-1",
        activo=True,
    )

    async def get_entity(model, identity):
        return {Proveedor: supplier, Sucursal: branch, VarianteProducto: variant}.get(model)

    repository.get.side_effect = get_entity
    created = []

    async def add_entity(entity):
        if fail_on_lot and isinstance(entity, LoteInventario):
            raise RuntimeError("lot failure")
        created.append(entity)
        identifiers = {
            RecepcionMercaderia: ("id_recepcion", 1),
            DetalleRecepcion: ("id_detalle_recepcion", 1),
            LoteInventario: ("id_lote", 1),
            MovimientoInventario: ("id_movimiento", 1),
            MovimientoLote: ("id_movimiento_lote", 1),
        }
        key = identifiers.get(type(entity))
        if key:
            setattr(entity, key[0], key[1])
        return entity

    repository.add.side_effect = add_entity
    service = InventoryService(session, repository)
    service._receipt_response = AsyncMock(return_value={"id_recepcion": 1})
    return service, session, created


async def test_receipt_creates_lot_inventory_entry_and_movement_breakdown() -> None:
    service, session, created = configured_receipt_service()
    payload = ReceiptCreate(
        id_orden_compra=1,
        detalles=[
            ReceiptDetailCreate(
                id_variante=1,
                cantidad_recibida=10,
                costo_unitario=Decimal("70"),
            )
        ],
    )
    await service.create_receipt(payload, AuditContext(usuario_id=99))
    lot_item = next(item for item in created if isinstance(item, LoteInventario))
    movement = next(item for item in created if isinstance(item, MovimientoInventario))
    breakdown = next(item for item in created if isinstance(item, MovimientoLote))
    assert lot_item.cantidad_inicial == 10
    assert lot_item.cantidad_disponible == 0
    assert movement.tipo_movimiento == "ENTRADA_PROVEEDOR"
    assert breakdown.cantidad == movement.cantidad
    assert session.execute.await_count == 6
    session.commit.assert_awaited_once()


async def test_receipt_rolls_back_everything_on_error() -> None:
    service, session, _ = configured_receipt_service(fail_on_lot=True)
    payload = ReceiptCreate(
        id_orden_compra=1,
        detalles=[
            ReceiptDetailCreate(
                id_variante=1,
                cantidad_recibida=10,
                costo_unitario=Decimal("70"),
            )
        ],
    )
    with pytest.raises(RuntimeError, match="lot failure"):
        await service.create_receipt(payload, AuditContext(usuario_id=99))
    session.rollback.assert_awaited_once()
    session.commit.assert_not_awaited()


async def test_transfer_dispatch_creates_fifo_exit_and_breakdown() -> None:
    repository = AsyncMock()
    transfer = TransferenciaInventario(
        id_transferencia=1,
        id_sucursal_origen=1,
        id_sucursal_destino=2,
        id_empleado=1,
        estado="APROBADA",
    )
    repository.movement_exists.return_value = False
    repository.transfer_details.return_value = [
        SimpleTransferDetail(id_variante=1, cantidad=6)
    ]
    repository.get_or_create_inventory.return_value = InventarioSucursal(
        id_inventario=1, id_sucursal=1, id_variante=1
    )
    created = []

    async def add_entity(entity):
        created.append(entity)
        if isinstance(entity, MovimientoInventario):
            entity.id_movimiento = 1
        return entity

    repository.add.side_effect = add_entity
    service = InventoryService(AsyncMock(), repository)
    service._fifo_allocations = AsyncMock(
        return_value=[(lot(1, 3, "70"), 3), (lot(2, 5, "80"), 3)]
    )
    await service._dispatch_transfer(transfer)
    movement = next(item for item in created if isinstance(item, MovimientoInventario))
    breakdowns = [item for item in created if isinstance(item, MovimientoLote)]
    assert movement.tipo_movimiento == "TRANSFERENCIA_SALIDA"
    assert movement.referencia_tipo == "TRANSFERENCIA"
    assert [item.cantidad for item in breakdowns] == [3, 3]


class SimpleTransferDetail:
    def __init__(self, id_variante: int, cantidad: int) -> None:
        self.id_variante = id_variante
        self.cantidad = cantidad


async def test_transfer_receipt_clones_cost_layers_without_fake_receipt() -> None:
    repository = AsyncMock()
    transfer = TransferenciaInventario(
        id_transferencia=1,
        id_sucursal_origen=1,
        id_sucursal_destino=2,
        id_empleado=1,
        estado="EN_TRANSITO",
    )
    repository.movement_exists.return_value = False
    repository.transfer_details.return_value = [SimpleTransferDetail(1, 6)]
    origin_inventory = InventarioSucursal(id_inventario=1, id_sucursal=1, id_variante=1)
    destination_inventory = InventarioSucursal(
        id_inventario=2, id_sucursal=2, id_variante=1
    )
    repository.get_or_create_inventory.side_effect = [origin_inventory, destination_inventory]
    repository.referenced_movement.return_value = MovimientoInventario(
        id_movimiento=10,
        id_inventario=1,
        tipo_movimiento="TRANSFERENCIA_SALIDA",
        cantidad=6,
    )
    repository.movement_lots.return_value = [
        MovimientoLote(id_movimiento=10, id_lote=1, cantidad=3, costo_unitario=Decimal("70")),
        MovimientoLote(id_movimiento=10, id_lote=2, cantidad=3, costo_unitario=Decimal("80")),
    ]
    source_lots = {1: lot(1, 3, "70"), 2: lot(2, 5, "80")}

    async def get_entity(model, identity):
        return source_lots.get(identity) if model is LoteInventario else None

    repository.get.side_effect = get_entity
    created = []

    async def add_entity(entity):
        created.append(entity)
        if isinstance(entity, MovimientoInventario):
            entity.id_movimiento = 20
        if isinstance(entity, LoteInventario):
            entity.id_lote = 100 + len([x for x in created if isinstance(x, LoteInventario)])
        return entity

    repository.add.side_effect = add_entity
    await InventoryService(AsyncMock(), repository)._receive_transfer(transfer)
    destination_lots = [item for item in created if isinstance(item, LoteInventario)]
    entry = next(item for item in created if isinstance(item, MovimientoInventario))
    assert [(item.cantidad_inicial, item.costo_unitario) for item in destination_lots] == [
        (3, Decimal("70")),
        (3, Decimal("80")),
    ]
    assert [item.id_detalle_recepcion for item in destination_lots] == [1, 2]
    assert all(item.id_sucursal == 2 and item.cantidad_disponible == 0 for item in destination_lots)
    assert entry.tipo_movimiento == "TRANSFERENCIA_ENTRADA"
    assert entry.referencia_id == transfer.id_transferencia
