from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.modules.auth.dependencies import CurrentPrincipal, get_current_principal
from app.modules.auth.models import Usuario
from app.modules.commerce.dependencies import get_commerce_service
from app.modules.commerce.schemas import (
    AdminDashboardSummaryResponse,
    DashboardBranchShare,
    DashboardDailyRevenue,
    DashboardKpis,
    DashboardTopProduct,
    DashboardUrgentOrder,
)

NOW = datetime(2026, 9, 14, 12, 0, 0, tzinfo=UTC)

SAMPLE_SUMMARY = AdminDashboardSummaryResponse(
    kpis=DashboardKpis(
        ventas_mes_total=Decimal("42580.00"),
        ventas_crecimiento_pct=14.8,
        pedidos_pendientes=12,
        reservas_hoy=8,
        alertas_stock_critico=5,
    ),
    tendencia_semanal=[
        DashboardDailyRevenue(fecha="2026-09-08", dia_nombre="Lun", total=Decimal("4200.00")),
        DashboardDailyRevenue(fecha="2026-09-09", dia_nombre="Mar", total=Decimal("5100.00")),
        DashboardDailyRevenue(fecha="2026-09-10", dia_nombre="Mié", total=Decimal("6300.00")),
        DashboardDailyRevenue(fecha="2026-09-11", dia_nombre="Jue", total=Decimal("5800.00")),
        DashboardDailyRevenue(fecha="2026-09-12", dia_nombre="Vie", total=Decimal("8200.00")),
        DashboardDailyRevenue(fecha="2026-09-13", dia_nombre="Sáb", total=Decimal("9400.00")),
        DashboardDailyRevenue(fecha="2026-09-14", dia_nombre="Dom", total=Decimal("3580.00")),
    ],
    ventas_por_sucursal=[
        DashboardBranchShare(id_sucursal=1, nombre="Sucursal Central", total=Decimal("28400.00"), porcentaje=66.7),
        DashboardBranchShare(id_sucursal=2, nombre="Sucursal Banzer", total=Decimal("14180.00"), porcentaje=33.3),
    ],
    pedidos_urgentes=[
        DashboardUrgentOrder(
            id_pedido=101,
            id_venta=201,
            cliente_nombre="Carla Mendoza",
            tipo_entrega="ENVIO_DOMICILIO",
            estado="PREPARANDO",
            total=Decimal("380.00"),
            fecha_creacion=NOW,
        ),
        DashboardUrgentOrder(
            id_pedido=102,
            id_venta=202,
            cliente_nombre="Mariana Rojas",
            tipo_entrega="RETIRO_TIENDA",
            estado="PAGADO",
            total=Decimal("220.00"),
            fecha_creacion=NOW,
        ),
    ],
    top_productos=[
        DashboardTopProduct(
            id_producto=1,
            nombre="Vestido Seda Floral",
            categoria="Vestidos",
            marca="Zara",
            unidades_vendidas=34,
            total_recaudado=Decimal("12240.00"),
            imagen_url="https://res.cloudinary.com/demo/image/upload/v1/vestido.jpg",
        ),
    ],
)


def make_principal(permissions: list[str], roles: list[str] | None = None, id_sucursal: int | None = 1) -> CurrentPrincipal:
    user = Usuario(
        id_usuario=1,
        nombres="Admin",
        apellidos="Capricho",
        correo="admin@capricho.com",
        password_hash="fake",
    )
    return CurrentPrincipal(
        user=user,
        roles=frozenset(roles or ["ADMIN"]),
        permissions=frozenset(permissions),
        session_id="test-session-dashboard",
        id_sucursal=id_sucursal,
    )


@pytest.mark.asyncio
async def test_dashboard_summary_requires_permission() -> None:
    principal_no_perm = make_principal(["inventario.ver"])

    app.dependency_overrides[get_current_principal] = lambda: principal_no_perm

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/v1/admin/dashboard/summary")

    app.dependency_overrides.clear()
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_dashboard_summary_success_all_branches() -> None:
    principal = make_principal(["ventas.ver", "ventas.sucursales_todas"])
    mock_service = AsyncMock()
    mock_service.get_admin_dashboard_summary.return_value = SAMPLE_SUMMARY

    app.dependency_overrides[get_current_principal] = lambda: principal
    app.dependency_overrides[get_commerce_service] = lambda: mock_service

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/v1/admin/dashboard/summary")

    app.dependency_overrides.clear()
    assert response.status_code == 200
    data = response.json()
    assert data["kpis"]["ventas_mes_total"] == "42580.00"
    assert data["kpis"]["ventas_crecimiento_pct"] == 14.8
    assert data["kpis"]["pedidos_pendientes"] == 12
    assert data["kpis"]["reservas_hoy"] == 8
    assert data["kpis"]["alertas_stock_critico"] == 5
    assert len(data["tendencia_semanal"]) == 7
    assert len(data["ventas_por_sucursal"]) == 2
    assert len(data["pedidos_urgentes"]) == 2
    assert len(data["top_productos"]) == 1
    mock_service.get_admin_dashboard_summary.assert_awaited_once_with(id_sucursal=None)


@pytest.mark.asyncio
async def test_dashboard_summary_filter_by_branch() -> None:
    principal = make_principal(["ventas.ver", "ventas.sucursales_todas"])
    mock_service = AsyncMock()
    mock_service.get_admin_dashboard_summary.return_value = SAMPLE_SUMMARY

    app.dependency_overrides[get_current_principal] = lambda: principal
    app.dependency_overrides[get_commerce_service] = lambda: mock_service

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/v1/admin/dashboard/summary?id_sucursal=2")

    app.dependency_overrides.clear()
    assert response.status_code == 200
    mock_service.get_admin_dashboard_summary.assert_awaited_once_with(id_sucursal=2)
