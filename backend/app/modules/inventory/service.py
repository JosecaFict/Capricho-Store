from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, TypeVar

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.audit_context import AuditContext, apply_audit_context
from app.modules.auth.models import Ciudad, Empleado, Sucursal
from app.modules.catalog.models import InventarioSucursal, Producto, VarianteProducto
from app.modules.inventory.exceptions import (
    InvalidInventoryOperationError,
    InventoryConflictError,
    InventoryNotFoundError,
)
from app.modules.inventory.models import (
    DetalleOrdenCompra,
    DetalleRecepcion,
    DetalleTransferencia,
    LoteInventario,
    MovimientoInventario,
    MovimientoLote,
    OrdenCompra,
    ProductoProveedor,
    Proveedor,
    RecepcionMercaderia,
    TransferenciaInventario,
)
from app.modules.inventory.repository import InventoryRepository
from app.modules.inventory.schemas import (
    AdjustmentCreate,
    InventoryResponse,
    LotResponse,
    MinimumStockUpdate,
    MovementLotResponse,
    MovementResponse,
    PurchaseDetailResponse,
    PurchaseOrderCreate,
    PurchaseOrderResponse,
    PurchaseOrderUpdate,
    ReceiptCreate,
    ReceiptDetailResponse,
    ReceiptResponse,
    SupplierCreate,
    SupplierProductRequest,
    SupplierProductResponse,
    SupplierUpdate,
    TransferCreate,
    TransferDetailCreate,
    TransferResponse,
    TransferStatusUpdate,
)

EntityT = TypeVar("EntityT")

PURCHASE_TRANSITIONS = {
    "SOLICITADA": {"CONFIRMADA", "CANCELADA"},
    "CONFIRMADA": {"EN_TRANSITO", "CANCELADA"},
    "EN_TRANSITO": {"PARCIAL", "RECIBIDA", "CANCELADA"},
    "PARCIAL": {"RECIBIDA", "CANCELADA"},
    "RECIBIDA": set(),
    "CANCELADA": set(),
}
TRANSFER_TRANSITIONS = {
    "SOLICITADA": {"APROBADA", "CANCELADA"},
    "APROBADA": {"EN_TRANSITO", "CANCELADA"},
    "EN_TRANSITO": {"RECIBIDA"},
    "RECIBIDA": set(),
    "CANCELADA": set(),
}


class InventoryService:
    def __init__(self, session: AsyncSession, repository: InventoryRepository) -> None:
        self.session = session
        self.repository = repository

    async def list_suppliers(self) -> list[Proveedor]:
        return await self.repository.list_suppliers()

    async def get_supplier(self, supplier_id: int) -> Proveedor:
        return await self._require(Proveedor, supplier_id, "Supplier")

    async def create_supplier(
        self, payload: SupplierCreate, audit: AuditContext
    ) -> Proveedor:
        await self._validate_supplier(payload)
        supplier = Proveedor(**payload.model_dump())
        return await self._commit(audit, self.repository.add(supplier))

    async def update_supplier(
        self, supplier_id: int, payload: SupplierUpdate, audit: AuditContext
    ) -> Proveedor:
        supplier = await self.get_supplier(supplier_id)
        await self._validate_supplier(payload, supplier_id)
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(supplier, key, value)
        return await self._commit(audit, self.repository.flush(), result=supplier)

    async def list_supplier_products(
        self, supplier_id: int
    ) -> list[SupplierProductResponse]:
        await self.get_supplier(supplier_id)
        return [
            SupplierProductResponse(
                id_producto_proveedor=link.id_producto_proveedor,
                id_producto=link.id_producto,
                producto=name,
                codigo_proveedor=link.codigo_proveedor,
                activo=link.activo,
            )
            for link, name in await self.repository.list_supplier_products(supplier_id)
        ]

    async def add_supplier_product(
        self,
        supplier_id: int,
        product_id: int,
        payload: SupplierProductRequest,
        audit: AuditContext,
    ) -> SupplierProductResponse:
        supplier = await self.get_supplier(supplier_id)
        product = await self._require(Producto, product_id, "Product")
        if not supplier.activo or not product.activo:
            raise InvalidInventoryOperationError("Supplier and product must be active")
        if await self.repository.supplier_product_link(supplier_id, product_id):
            raise InventoryConflictError("Supplier-product relation already exists")
        link = ProductoProveedor(
            id_proveedor=supplier_id,
            id_producto=product_id,
            codigo_proveedor=payload.codigo_proveedor,
        )
        await self._commit(audit, self.repository.add(link))
        return SupplierProductResponse(
            id_producto_proveedor=link.id_producto_proveedor,
            id_producto=product_id,
            producto=product.nombre,
            codigo_proveedor=link.codigo_proveedor,
            activo=link.activo,
        )

    async def remove_supplier_product(
        self, supplier_id: int, product_id: int, audit: AuditContext
    ) -> None:
        link = await self.repository.supplier_product_link(supplier_id, product_id)
        if link is None:
            raise InventoryNotFoundError("Supplier-product relation not found")
        await self._commit(audit, self.repository.remove(link))

    async def list_purchase_orders(self) -> list[PurchaseOrderResponse]:
        orders = await self.repository.list_purchase_orders()
        return [await self._purchase_response(order) for order in orders]

    async def get_purchase_order(self, order_id: int) -> PurchaseOrderResponse:
        order = await self._require(OrdenCompra, order_id, "Purchase order")
        return await self._purchase_response(order)

    async def create_purchase_order(
        self, payload: PurchaseOrderCreate, audit: AuditContext
    ) -> PurchaseOrderResponse:
        supplier = await self._require_active(Proveedor, payload.id_proveedor, "Supplier")
        await self._require_active(Sucursal, payload.id_sucursal, "Branch")
        if payload.id_empleado is not None:
            await self._require_employee(payload.id_empleado)
        if len({item.id_variante for item in payload.detalles}) != len(payload.detalles):
            raise InventoryConflictError("A variant cannot be repeated in an order")
        for detail in payload.detalles:
            variant = await self._require_active(
                VarianteProducto, detail.id_variante, "Variant"
            )
            supplier_product = await self.repository.supplier_product_link(
                payload.id_proveedor, variant.id_producto
            )
            if supplier_product is None or not supplier_product.activo:
                raise InvalidInventoryOperationError(
                    "El producto seleccionado no está asociado con este proveedor"
                )
        if not supplier.activo:
            raise InvalidInventoryOperationError("Supplier is inactive")
        try:
            await apply_audit_context(self.session, audit)
            order = await self.repository.add(
                OrdenCompra(
                    id_proveedor=payload.id_proveedor,
                    id_sucursal=payload.id_sucursal,
                    id_empleado=payload.id_empleado,
                    fecha_estimada=payload.fecha_estimada,
                    observacion=payload.observacion,
                )
            )
            for detail in payload.detalles:
                await self.repository.add(
                    DetalleOrdenCompra(
                        id_orden_compra=order.id_orden_compra,
                        **detail.model_dump(),
                    )
                )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise
        return await self._purchase_response(order)

    async def update_purchase_order(
        self, order_id: int, payload: PurchaseOrderUpdate, audit: AuditContext
    ) -> PurchaseOrderResponse:
        order = await self.repository.purchase_order_for_update(order_id)
        if order is None:
            raise InventoryNotFoundError("Purchase order not found")
        if order.estado in {"RECIBIDA", "CANCELADA"}:
            raise InvalidInventoryOperationError("A terminal purchase order cannot be modified")
        if payload.estado is not None:
            self.validate_transition(order.estado, payload.estado, PURCHASE_TRANSITIONS)
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(order, key, value)
        await self._commit(audit, self.repository.flush())
        return await self._purchase_response(order)

    async def list_receipts(self) -> list[ReceiptResponse]:
        receipts = await self.repository.list_receipts()
        return [await self._receipt_response(item) for item in receipts]

    async def get_receipt(self, receipt_id: int) -> ReceiptResponse:
        receipt = await self._require(RecepcionMercaderia, receipt_id, "Receipt")
        return await self._receipt_response(receipt)

    async def create_receipt(
        self, payload: ReceiptCreate, audit: AuditContext
    ) -> ReceiptResponse:
        try:
            await apply_audit_context(self.session, audit)
            order = await self.repository.purchase_order_for_update(payload.id_orden_compra)
            if order is None:
                raise InventoryNotFoundError("Purchase order not found")
            if order.estado not in {"CONFIRMADA", "EN_TRANSITO", "PARCIAL"}:
                raise InvalidInventoryOperationError("Purchase order cannot be received")
            await self._require_active(Proveedor, order.id_proveedor, "Supplier")
            await self._require_active(Sucursal, order.id_sucursal, "Branch")
            if payload.id_empleado is not None:
                await self._require_employee(payload.id_empleado)
            ordered = {
                item.id_variante: item
                for item in await self.repository.purchase_details(order.id_orden_compra)
            }
            received = await self.repository.received_quantities(order.id_orden_compra)
            for item in payload.detalles:
                await self._require_active(VarianteProducto, item.id_variante, "Variant")
            self._validate_receipt_details(payload, ordered, received)
            receipt = await self.repository.add(
                RecepcionMercaderia(
                    id_orden_compra=order.id_orden_compra,
                    id_sucursal=order.id_sucursal,
                    id_empleado=payload.id_empleado,
                    estado="CONFIRMADA",
                    observacion=payload.observacion,
                )
            )
            for item in payload.detalles:
                detail = await self.repository.add(
                    DetalleRecepcion(
                        id_recepcion=receipt.id_recepcion,
                        id_variante=item.id_variante,
                        cantidad_recibida=item.cantidad_recibida,
                        costo_unitario=item.costo_unitario,
                    )
                )
                lot = await self.repository.add(
                    LoteInventario(
                        id_detalle_recepcion=detail.id_detalle_recepcion,
                        id_sucursal=order.id_sucursal,
                        id_variante=item.id_variante,
                        numero_lote=item.numero_lote,
                        cantidad_inicial=item.cantidad_recibida,
                        cantidad_disponible=0,
                        costo_unitario=item.costo_unitario,
                    )
                )
                inventory = await self.repository.get_or_create_inventory(
                    order.id_sucursal, item.id_variante
                )
                movement = await self.repository.add(
                    MovimientoInventario(
                        id_inventario=inventory.id_inventario,
                        id_empleado=payload.id_empleado,
                        tipo_movimiento="ENTRADA_PROVEEDOR",
                        cantidad=item.cantidad_recibida,
                        referencia_tipo="RECEPCION",
                        referencia_id=receipt.id_recepcion,
                    )
                )
                await self.repository.add(
                    MovimientoLote(
                        id_movimiento=movement.id_movimiento,
                        id_lote=lot.id_lote,
                        cantidad=item.cantidad_recibida,
                        costo_unitario=item.costo_unitario,
                    )
                )
            totals = received.copy()
            for item in payload.detalles:
                totals[item.id_variante] = totals.get(item.id_variante, 0) + item.cantidad_recibida
            order.estado = (
                "RECIBIDA"
                if all(
                    totals.get(variant_id, 0) == detail.cantidad
                    for variant_id, detail in ordered.items()
                )
                else "PARCIAL"
            )
            await self.repository.flush()
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise
        return await self._receipt_response(receipt)

    async def list_lots(self, **filters: Any) -> list[LotResponse]:
        lots = await self.repository.list_lots(**filters)
        return [LotResponse.model_validate(item) for item in lots]

    async def list_inventory(self, **filters: Any) -> list[InventoryResponse]:
        rows = await self.repository.list_inventory(**filters)
        return [self._inventory_response(row) for row in rows]

    async def get_inventory(self, inventory_id: int) -> InventoryResponse:
        row = await self.repository.get_inventory_record(inventory_id)
        if row is None:
            raise InventoryNotFoundError("Inventory not found")
        return self._inventory_response(row)

    async def update_minimum_stock(
        self, inventory_id: int, payload: MinimumStockUpdate, audit: AuditContext
    ) -> InventoryResponse:
        inventory = await self.repository.inventory_for_update(inventory_id)
        if inventory is None:
            raise InventoryNotFoundError("Inventory not found")
        inventory.stock_minimo = payload.stock_minimo
        await self._commit(audit, self.repository.flush())
        return await self.get_inventory(inventory_id)

    async def list_movements(self, **filters: Any) -> list[MovementResponse]:
        movements = await self.repository.list_movements(**filters)
        return [await self._movement_response(item) for item in movements]

    async def get_movement(self, movement_id: int) -> MovementResponse:
        movement = await self._require(MovimientoInventario, movement_id, "Movement")
        return await self._movement_response(movement)

    async def adjust_inventory(
        self,
        inventory_id: int,
        payload: AdjustmentCreate,
        actor_user_id: int,
        audit: AuditContext,
    ) -> MovementResponse:
        try:
            await apply_audit_context(self.session, audit)
            inventory = await self.repository.inventory_for_update(inventory_id)
            if inventory is None:
                raise InventoryNotFoundError("Inventory not found")
            employee = await self.repository.employee_by_user(actor_user_id)
            employee_id = employee.id_empleado if employee else None
            if employee_id is not None:
                await self._require_employee(employee_id)
            if payload.tipo == "AJUSTE_NEGATIVO":
                allocations = await self._fifo_allocations(
                    inventory.id_sucursal, inventory.id_variante, payload.cantidad
                )
            else:
                allocations = await self._positive_allocations(inventory, payload)
            movement = await self.repository.add(
                MovimientoInventario(
                    id_inventario=inventory_id,
                    id_empleado=employee_id,
                    tipo_movimiento=payload.tipo,
                    cantidad=payload.cantidad,
                    referencia_tipo="AJUSTE",
                    motivo=payload.motivo,
                )
            )
            for lot, quantity in allocations:
                await self.repository.add(
                    MovimientoLote(
                        id_movimiento=movement.id_movimiento,
                        id_lote=lot.id_lote,
                        cantidad=quantity,
                        costo_unitario=lot.costo_unitario,
                    )
                )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise
        return await self._movement_response(movement)

    async def list_transfers(self) -> list[TransferResponse]:
        transfers = await self.repository.list_transfers()
        return [await self._transfer_response(item) for item in transfers]

    async def get_transfer(self, transfer_id: int) -> TransferResponse:
        transfer = await self._require(TransferenciaInventario, transfer_id, "Transfer")
        return await self._transfer_response(transfer)

    async def create_transfer(
        self, payload: TransferCreate, audit: AuditContext
    ) -> TransferResponse:
        origin = await self._require_active(Sucursal, payload.id_sucursal_origen, "Origin branch")
        destination = await self._require_active(
            Sucursal, payload.id_sucursal_destino, "Destination branch"
        )
        if origin.id_sucursal == destination.id_sucursal:
            raise InvalidInventoryOperationError("Origin and destination branches must differ")
        if payload.id_empleado is not None:
            await self._require_employee(payload.id_empleado)
        if len({item.id_variante for item in payload.detalles}) != len(payload.detalles):
            raise InventoryConflictError("A variant cannot be repeated in a transfer")
        try:
            await apply_audit_context(self.session, audit)
            for item in payload.detalles:
                await self._require_active(VarianteProducto, item.id_variante, "Variant")
                inventory = await self.repository.get_or_create_inventory(
                    origin.id_sucursal, item.id_variante
                )
                if inventory.stock_fisico - inventory.stock_reservado < item.cantidad:
                    raise InvalidInventoryOperationError("Insufficient origin stock")
            transfer = await self.repository.add(
                TransferenciaInventario(
                    id_sucursal_origen=origin.id_sucursal,
                    id_sucursal_destino=destination.id_sucursal,
                    id_empleado=payload.id_empleado,
                )
            )
            for item in payload.detalles:
                await self.repository.add(
                    DetalleTransferencia(
                        id_transferencia=transfer.id_transferencia, **item.model_dump()
                    )
                )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise
        return await self._transfer_response(transfer)

    async def update_transfer_status(
        self,
        transfer_id: int,
        payload: TransferStatusUpdate,
        audit: AuditContext,
    ) -> TransferResponse:
        try:
            await apply_audit_context(self.session, audit)
            transfer = await self.repository.transfer_for_update(transfer_id)
            if transfer is None:
                raise InventoryNotFoundError("Transfer not found")
            self.validate_transition(transfer.estado, payload.estado, TRANSFER_TRANSITIONS)
            if payload.estado == "EN_TRANSITO":
                await self._dispatch_transfer(transfer)
            elif payload.estado == "RECIBIDA":
                await self._receive_transfer(transfer)
                transfer.fecha_recepcion = datetime.now(UTC)
            transfer.estado = payload.estado
            await self.repository.flush()
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise
        return await self._transfer_response(transfer)

    async def _dispatch_transfer(self, transfer: TransferenciaInventario) -> None:
        if await self.repository.movement_exists(transfer.id_transferencia, "TRANSFERENCIA_SALIDA"):
            raise InventoryConflictError("Transfer dispatch movements already exist")
        for detail in await self.repository.transfer_details(transfer.id_transferencia):
            inventory = await self.repository.get_or_create_inventory(
                transfer.id_sucursal_origen, detail.id_variante
            )
            allocations = await self._fifo_allocations(
                transfer.id_sucursal_origen, detail.id_variante, detail.cantidad
            )
            movement = await self.repository.add(
                MovimientoInventario(
                    id_inventario=inventory.id_inventario,
                    id_empleado=transfer.id_empleado,
                    tipo_movimiento="TRANSFERENCIA_SALIDA",
                    cantidad=detail.cantidad,
                    referencia_tipo="TRANSFERENCIA",
                    referencia_id=transfer.id_transferencia,
                )
            )
            for lot, quantity in allocations:
                await self.repository.add(
                    MovimientoLote(
                        id_movimiento=movement.id_movimiento,
                        id_lote=lot.id_lote,
                        cantidad=quantity,
                        costo_unitario=lot.costo_unitario,
                    )
                )

    async def _receive_transfer(self, transfer: TransferenciaInventario) -> None:
        if await self.repository.movement_exists(
            transfer.id_transferencia, "TRANSFERENCIA_ENTRADA"
        ):
            raise InventoryConflictError("Transfer receipt movements already exist")
        received_at = datetime.now(UTC)
        for detail in await self.repository.transfer_details(transfer.id_transferencia):
            origin_inventory = await self.repository.get_or_create_inventory(
                transfer.id_sucursal_origen, detail.id_variante
            )
            source_movement = await self.repository.referenced_movement(
                transfer.id_transferencia,
                "TRANSFERENCIA_SALIDA",
                origin_inventory.id_inventario,
            )
            if source_movement is None:
                raise InvalidInventoryOperationError("Transfer has no dispatch movement")
            source_allocations = await self.repository.movement_lots(source_movement.id_movimiento)
            destination_inventory = await self.repository.get_or_create_inventory(
                transfer.id_sucursal_destino, detail.id_variante
            )
            entry = await self.repository.add(
                MovimientoInventario(
                    id_inventario=destination_inventory.id_inventario,
                    id_empleado=transfer.id_empleado,
                    tipo_movimiento="TRANSFERENCIA_ENTRADA",
                    cantidad=detail.cantidad,
                    referencia_tipo="TRANSFERENCIA",
                    referencia_id=transfer.id_transferencia,
                )
            )
            for allocation in source_allocations:
                source_lot = await self._require(LoteInventario, allocation.id_lote, "Source lot")
                destination_lot = await self.repository.add(
                    LoteInventario(
                        id_detalle_recepcion=source_lot.id_detalle_recepcion,
                        id_sucursal=transfer.id_sucursal_destino,
                        id_variante=source_lot.id_variante,
                        numero_lote=source_lot.numero_lote,
                        cantidad_inicial=allocation.cantidad,
                        cantidad_disponible=0,
                        costo_unitario=source_lot.costo_unitario,
                        fecha_ingreso=received_at,
                        activo=True,
                    )
                )
                await self.repository.add(
                    MovimientoLote(
                        id_movimiento=entry.id_movimiento,
                        id_lote=destination_lot.id_lote,
                        cantidad=allocation.cantidad,
                        costo_unitario=source_lot.costo_unitario,
                    )
                )

    async def _fifo_allocations(
        self, branch_id: int, variant_id: int, quantity: int
    ) -> list[tuple[LoteInventario, int]]:
        remaining = quantity
        allocations = []
        for lot in await self.repository.fifo_lots(branch_id, variant_id):
            take = min(remaining, lot.cantidad_disponible)
            if take:
                allocations.append((lot, take))
                remaining -= take
            if remaining == 0:
                break
        if remaining:
            raise InvalidInventoryOperationError("Insufficient FIFO lot stock")
        return allocations

    async def _positive_allocations(
        self, inventory: InventarioSucursal, payload: AdjustmentCreate
    ) -> list[tuple[LoteInventario, int]]:
        remaining = payload.cantidad
        allocations = []
        for lot in await self.repository.lots_with_capacity(
            inventory.id_sucursal, inventory.id_variante
        ):
            capacity = lot.cantidad_inicial - lot.cantidad_disponible
            add = min(remaining, capacity)
            if add:
                allocations.append((lot, add))
                remaining -= add
            if remaining == 0:
                break
        if remaining:
            if payload.id_detalle_recepcion is None or payload.costo_unitario is None:
                raise InvalidInventoryOperationError(
                    "Positive adjustment needs acquisition origin and cost when no lot has capacity"
                )
            await self._require(
                DetalleRecepcion, payload.id_detalle_recepcion, "Receipt detail"
            )
            lot = await self.repository.add(
                LoteInventario(
                    id_detalle_recepcion=payload.id_detalle_recepcion,
                    id_sucursal=inventory.id_sucursal,
                    id_variante=inventory.id_variante,
                    cantidad_inicial=remaining,
                    cantidad_disponible=0,
                    costo_unitario=payload.costo_unitario,
                )
            )
            allocations.append((lot, remaining))
        return allocations

    async def _validate_supplier(
        self, payload: SupplierCreate | SupplierUpdate, supplier_id: int | None = None
    ) -> None:
        if "id_ciudad" in payload.model_fields_set and payload.id_ciudad is not None:
            city = await self._require(Ciudad, payload.id_ciudad, "City")
            if not city.activo:
                raise InvalidInventoryOperationError("City is inactive")
        if "nit" in payload.model_fields_set and payload.nit:
            if await self.repository.supplier_by_nit(payload.nit, supplier_id):
                raise InventoryConflictError("NIT is already registered")

    async def _require_employee(self, employee_id: int) -> Empleado:
        employee = await self._require(Empleado, employee_id, "Employee")
        if employee.estado_laboral != "ACTIVO":
            raise InvalidInventoryOperationError("Employee is inactive")
        return employee

    @staticmethod
    def validate_transition(current: str, target: str, transitions: dict[str, set[str]]) -> None:
        if target not in transitions.get(current, set()):
            raise InvalidInventoryOperationError(
                f"Invalid state transition from {current} to {target}"
            )

    async def _require(self, model: type[EntityT], identity: int, label: str) -> EntityT:
        entity = await self.repository.get(model, identity)
        if entity is None:
            raise InventoryNotFoundError(f"{label} not found")
        return entity

    async def _require_active(
        self, model: type[EntityT], identity: int, label: str
    ) -> EntityT:
        entity = await self._require(model, identity, label)
        if not getattr(entity, "activo", False):
            raise InvalidInventoryOperationError(f"{label} is inactive")
        return entity

    async def _purchase_response(self, order: OrdenCompra) -> PurchaseOrderResponse:
        return PurchaseOrderResponse(
            id_orden_compra=order.id_orden_compra,
            id_proveedor=order.id_proveedor,
            id_sucursal=order.id_sucursal,
            id_empleado=order.id_empleado,
            estado=order.estado,
            fecha_orden=order.fecha_orden,
            fecha_estimada=order.fecha_estimada,
            observacion=order.observacion,
            detalles=[
                PurchaseDetailResponse.model_validate(item)
                for item in await self.repository.purchase_details(order.id_orden_compra)
            ],
        )

    async def _receipt_response(self, receipt: RecepcionMercaderia) -> ReceiptResponse:
        return ReceiptResponse(
            id_recepcion=receipt.id_recepcion,
            id_orden_compra=receipt.id_orden_compra,
            id_sucursal=receipt.id_sucursal,
            id_empleado=receipt.id_empleado,
            fecha_recepcion=receipt.fecha_recepcion,
            estado=receipt.estado,
            observacion=receipt.observacion,
            detalles=[
                ReceiptDetailResponse(
                    id_detalle_recepcion=detail.id_detalle_recepcion,
                    id_variante=detail.id_variante,
                    cantidad_recibida=detail.cantidad_recibida,
                    costo_unitario=detail.costo_unitario,
                    id_lote=lot.id_lote,
                )
                for detail, lot in await self.repository.receipt_details(receipt.id_recepcion)
            ],
        )

    @staticmethod
    def _inventory_response(row: Any) -> InventoryResponse:
        inventory = row[0]
        available = inventory.stock_fisico - inventory.stock_reservado
        state = "AGOTADO" if available == 0 else (
            "STOCK_BAJO" if available <= inventory.stock_minimo else "DISPONIBLE"
        )
        return InventoryResponse(
            id_inventario=inventory.id_inventario,
            id_sucursal=inventory.id_sucursal,
            sucursal=row[1],
            id_variante=inventory.id_variante,
            sku=row[2],
            producto=row[3],
            talla=row[4],
            color=row[5],
            categoria=row[6],
            stock_fisico=inventory.stock_fisico,
            stock_reservado=inventory.stock_reservado,
            stock_minimo=inventory.stock_minimo,
            stock_disponible=available,
            estado_stock=state,
            costo_promedio_ponderado=row[7],
        )

    async def _movement_response(self, movement: MovimientoInventario) -> MovementResponse:
        lots = await self.repository.movement_lots(movement.id_movimiento)
        return MovementResponse(
            id_movimiento=movement.id_movimiento,
            id_inventario=movement.id_inventario,
            id_empleado=movement.id_empleado,
            tipo_movimiento=movement.tipo_movimiento,
            cantidad=movement.cantidad,
            referencia_tipo=movement.referencia_tipo,
            referencia_id=movement.referencia_id,
            motivo=movement.motivo,
            fecha_hora=movement.fecha_hora,
            costo_fifo_consumido=sum(
                (item.costo_unitario * item.cantidad for item in lots), Decimal(0)
            ),
            lotes=[MovementLotResponse.model_validate(item) for item in lots],
        )

    async def _transfer_response(self, transfer: TransferenciaInventario) -> TransferResponse:
        return TransferResponse(
            id_transferencia=transfer.id_transferencia,
            id_sucursal_origen=transfer.id_sucursal_origen,
            id_sucursal_destino=transfer.id_sucursal_destino,
            id_empleado=transfer.id_empleado,
            estado=transfer.estado,
            fecha_solicitud=transfer.fecha_solicitud,
            fecha_recepcion=transfer.fecha_recepcion,
            detalles=[
                TransferDetailCreate(
                    id_variante=item.id_variante,
                    cantidad=item.cantidad,
                )
                for item in await self.repository.transfer_details(transfer.id_transferencia)
            ],
        )

    @staticmethod
    def _validate_receipt_details(
        payload: ReceiptCreate,
        ordered: dict[int, DetalleOrdenCompra],
        received: dict[int, int],
    ) -> None:
        if len({item.id_variante for item in payload.detalles}) != len(payload.detalles):
            raise InventoryConflictError("A variant cannot be repeated in a receipt")
        for item in payload.detalles:
            order_detail = ordered.get(item.id_variante)
            if order_detail is None:
                raise InvalidInventoryOperationError("Variant is not part of the purchase order")
            if received.get(item.id_variante, 0) + item.cantidad_recibida > order_detail.cantidad:
                raise InvalidInventoryOperationError("Receipt exceeds ordered quantity")

    async def _commit(
        self, audit: AuditContext, operation: Any, *, result: EntityT | None = None
    ) -> Any:
        try:
            await apply_audit_context(self.session, audit)
            value = await operation
            await self.session.commit()
            return result if result is not None else value
        except IntegrityError as exc:
            await self.session.rollback()
            raise InventoryConflictError("Operation conflicts with existing data") from exc
        except Exception:
            await self.session.rollback()
            raise
