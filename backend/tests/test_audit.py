from collections.abc import AsyncIterator
from datetime import UTC, datetime
from unittest.mock import AsyncMock

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.modules.audit.dependencies import get_audit_service
from app.modules.audit.schemas import AuditLogDetail, AuditLogItem, AuditLogPage
from app.modules.auth.dependencies import CurrentPrincipal, get_current_principal
from app.modules.auth.models import Usuario


def principal(*permissions: str) -> CurrentPrincipal:
    user = Usuario(
        id_usuario=1,
        nombres="Admin",
        apellidos="Principal",
        correo="admin@example.com",
        ci="ADMIN-1",
        password_hash="never-returned",
        estado="ACTIVO",
        created_at=datetime(2026, 8, 30, tzinfo=UTC),
        updated_at=datetime(2026, 8, 30, tzinfo=UTC),
    )
    return CurrentPrincipal(
        user=user,
        roles=frozenset({"ADMIN"}),
        permissions=frozenset(permissions),
        session_id="test-session",
    )


def item() -> AuditLogItem:
    return AuditLogItem(
        id_bitacora=8,
        id_usuario=1,
        usuario="Admin Principal",
        correo_usuario="admin@example.com",
        accion="UPDATE",
        modulo="SEGURIDAD",
        entidad="usuario_permiso",
        id_registro="12",
        direccion_ip="127.0.0.1",
        origen="WEB",
        request_id="request-1",
        fecha_hora=datetime(2026, 9, 5, tzinfo=UTC),
    )


async def request_audit(path: str, *, user: CurrentPrincipal, service: AsyncMock):
    async def override_principal() -> CurrentPrincipal:
        return user

    async def override_service() -> AsyncIterator[AsyncMock]:
        yield service

    app.dependency_overrides[get_current_principal] = override_principal
    app.dependency_overrides[get_audit_service] = override_service
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False),
            base_url="http://test",
        ) as client:
            return await client.get(path)
    finally:
        app.dependency_overrides.clear()


async def test_list_audit_logs_with_filters() -> None:
    service = AsyncMock()
    service.list_logs.return_value = AuditLogPage(
        items=[item()], page=1, page_size=25, total=1, pages=1
    )

    response = await request_audit(
        "/api/v1/audit-logs?modulo=SEGURIDAD&accion=UPDATE&buscar=Admin",
        user=principal("permisos.asignar"),
        service=service,
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["entidad"] == "usuario_permiso"
    assert service.list_logs.await_args.kwargs["modulo"] == "SEGURIDAD"
    assert service.list_logs.await_args.kwargs["buscar"] == "Admin"


async def test_audit_logs_require_security_permission() -> None:
    response = await request_audit(
        "/api/v1/audit-logs",
        user=principal(),
        service=AsyncMock(),
    )

    assert response.status_code == 403


async def test_get_audit_log_detail() -> None:
    service = AsyncMock()
    service.get_log.return_value = AuditLogDetail(
        **item().model_dump(),
        id_sesion="session-1",
        user_agent="pytest",
        datos_anteriores={"estado": "ACTIVO"},
        datos_nuevos={"estado": "INACTIVO"},
    )

    response = await request_audit(
        "/api/v1/audit-logs/8",
        user=principal("permisos.asignar"),
        service=service,
    )

    assert response.status_code == 200
    assert response.json()["datos_nuevos"] == {"estado": "INACTIVO"}
