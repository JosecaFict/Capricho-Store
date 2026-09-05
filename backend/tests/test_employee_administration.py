from collections.abc import AsyncIterator
from datetime import UTC, date, datetime
from unittest.mock import AsyncMock

from httpx import ASGITransport, AsyncClient, Response

from app.main import app
from app.modules.auth.dependencies import CurrentPrincipal, get_current_principal
from app.modules.auth.exceptions import PermissionDeniedError
from app.modules.auth.models import Usuario
from app.modules.employees.dependencies import get_employee_service
from app.modules.employees.exceptions import (
    InvalidEmployeeDataError,
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.modules.employees.schemas import (
    EmployeePermissionSummary,
    EmployeeResponse,
    RolePermissionSummary,
)

EMPLOYEE_PAYLOAD = {
    "nombres": "Carlos",
    "apellidos": "Rojas",
    "correo": "carlos.rojas@example.com",
    "telefono": "70000001",
    "ci": "EMP-001",
    "password": "StrongPassword123",
    "id_sucursal": 1,
    "id_rol": 4,
    "cargo_descriptivo": "Cajero",
    "fecha_contratacion": "2026-08-30",
}


def make_principal(
    *permissions: str,
    roles: frozenset[str] = frozenset({"ADMIN"}),
) -> CurrentPrincipal:
    user = Usuario(
        id_usuario=99,
        nombres="Admin",
        apellidos="Principal",
        correo="admin@example.com",
        telefono=None,
        ci="ADMIN-001",
        password_hash="never-returned",
        estado="ACTIVO",
        created_at=datetime(2026, 8, 30, tzinfo=UTC),
        updated_at=datetime(2026, 8, 30, tzinfo=UTC),
    )
    return CurrentPrincipal(
        user=user,
        roles=roles,
        permissions=frozenset(permissions),
        session_id="test-session-id",
    )


def make_employee_response(
    *,
    user_state: str = "ACTIVO",
    employment_state: str = "ACTIVO",
    roles: list[str] | None = None,
) -> EmployeeResponse:
    return EmployeeResponse(
        id_empleado=7,
        id_usuario=10,
        nombres="Carlos",
        apellidos="Rojas",
        correo="carlos.rojas@example.com",
        telefono="70000001",
        ci="EMP-001",
        estado_usuario=user_state,
        id_sucursal=1,
        sucursal="Sucursal Central",
        cargo_descriptivo="Cajero",
        fecha_contratacion=date(2026, 8, 30),
        estado_laboral=employment_state,
        roles=roles or ["CAJERO"],
        created_at=datetime(2026, 8, 30, tzinfo=UTC),
        updated_at=datetime(2026, 8, 30, tzinfo=UTC),
    )


def make_permission_summary(*, revoked: bool = False) -> EmployeePermissionSummary:
    return EmployeePermissionSummary(
        id_empleado=7,
        id_usuario=10,
        roles_asignados=["CAJERO"],
        permisos_heredados=["productos.ver", "ventas.crear"],
        permisos_individuales_otorgados=[] if revoked else ["empleados.ver"],
        permisos_individuales_revocados=["ventas.crear"] if revoked else [],
        permisos_efectivos=["productos.ver"] if revoked else [
            "empleados.ver",
            "productos.ver",
            "ventas.crear",
        ],
    )


async def call_employee_endpoint(
    method: str,
    path: str,
    *,
    principal: CurrentPrincipal,
    service: AsyncMock,
    json: dict | None = None,
) -> Response:
    async def override_principal() -> CurrentPrincipal:
        return principal

    async def override_service() -> AsyncIterator[AsyncMock]:
        yield service

    app.dependency_overrides[get_current_principal] = override_principal
    app.dependency_overrides[get_employee_service] = override_service
    try:
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.request(method, path, json=json)
    finally:
        app.dependency_overrides.clear()


async def test_list_employees_with_permission() -> None:
    service = AsyncMock()
    service.list_employees.return_value = [make_employee_response()]

    response = await call_employee_endpoint(
        "GET",
        "/api/v1/employees",
        principal=make_principal("empleados.ver"),
        service=service,
    )

    assert response.status_code == 200
    assert response.json()[0]["id_empleado"] == 7
    service.list_employees.assert_awaited_once()


async def test_list_employees_without_permission() -> None:
    response = await call_employee_endpoint(
        "GET",
        "/api/v1/employees",
        principal=make_principal(),
        service=AsyncMock(),
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Permission denied"}


async def test_create_employee_successfully_and_sets_audit_context() -> None:
    service = AsyncMock()
    service.create_employee.return_value = make_employee_response()
    principal = make_principal("empleados.crear")

    response = await call_employee_endpoint(
        "POST",
        "/api/v1/employees",
        principal=principal,
        service=service,
        json=EMPLOYEE_PAYLOAD,
    )

    assert response.status_code == 201
    call = service.create_employee.await_args
    assert call.kwargs["actor"] is principal
    audit_context = call.kwargs["audit_context"]
    assert audit_context.usuario_id == principal.user.id_usuario
    assert audit_context.sesion_id == principal.session_id
    assert audit_context.origen == "API"


async def test_employee_ci_is_required() -> None:
    payload = EMPLOYEE_PAYLOAD.copy()
    payload.pop("ci")

    response = await call_employee_endpoint(
        "POST",
        "/api/v1/employees",
        principal=make_principal("empleados.crear"),
        service=AsyncMock(),
        json=payload,
    )

    assert response.status_code == 422


async def test_create_employee_rejects_duplicate_ci() -> None:
    service = AsyncMock()
    service.create_employee.side_effect = ResourceConflictError("CI already registered")

    response = await call_employee_endpoint(
        "POST",
        "/api/v1/employees",
        principal=make_principal("empleados.crear"),
        service=service,
        json=EMPLOYEE_PAYLOAD,
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "CI already registered"}


async def test_create_employee_rejects_duplicate_email() -> None:
    service = AsyncMock()
    service.create_employee.side_effect = ResourceConflictError("Email already registered")

    response = await call_employee_endpoint(
        "POST",
        "/api/v1/employees",
        principal=make_principal("empleados.crear"),
        service=service,
        json=EMPLOYEE_PAYLOAD,
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Email already registered"}


async def test_create_employee_rejects_missing_branch() -> None:
    service = AsyncMock()
    service.create_employee.side_effect = ResourceNotFoundError("Branch not found")

    response = await call_employee_endpoint(
        "POST",
        "/api/v1/employees",
        principal=make_principal("empleados.crear"),
        service=service,
        json=EMPLOYEE_PAYLOAD,
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Branch not found"}


async def test_assign_operational_role() -> None:
    service = AsyncMock()
    service.change_role.return_value = make_employee_response(roles=["AUXILIAR_INVENTARIO"])

    response = await call_employee_endpoint(
        "PUT",
        "/api/v1/employees/7/role",
        principal=make_principal("permisos.asignar"),
        service=service,
        json={"id_rol": 5},
    )

    assert response.status_code == 200
    assert response.json()["roles"] == ["AUXILIAR_INVENTARIO"]


async def test_reject_invalid_employee_role() -> None:
    service = AsyncMock()
    service.change_role.side_effect = InvalidEmployeeDataError(
        "Role is not valid for an employee"
    )

    response = await call_employee_endpoint(
        "PUT",
        "/api/v1/employees/7/role",
        principal=make_principal("permisos.asignar"),
        service=service,
        json={"id_rol": 2},
    )

    assert response.status_code == 400


async def test_reject_admin_assignment_by_non_admin() -> None:
    service = AsyncMock()
    service.change_role.side_effect = PermissionDeniedError

    response = await call_employee_endpoint(
        "PUT",
        "/api/v1/employees/7/role",
        principal=make_principal(
            "permisos.asignar",
            roles=frozenset({"ENCARGADO_SUCURSAL"}),
        ),
        service=service,
        json={"id_rol": 1},
    )

    assert response.status_code == 403


async def test_get_employee_permissions() -> None:
    service = AsyncMock()
    service.get_employee_permissions.return_value = make_permission_summary()

    response = await call_employee_endpoint(
        "GET",
        "/api/v1/employees/7/permissions",
        principal=make_principal("permisos.asignar"),
        service=service,
    )

    assert response.status_code == 200
    assert response.json()["roles_asignados"] == ["CAJERO"]
    assert "permisos_efectivos" in response.json()


async def test_grant_individual_permission() -> None:
    service = AsyncMock()
    service.set_permission_override.return_value = make_permission_summary()

    response = await call_employee_endpoint(
        "PUT",
        "/api/v1/employees/7/permissions/2",
        principal=make_principal("permisos.asignar"),
        service=service,
        json={"otorgado": True},
    )

    assert response.status_code == 200
    assert "empleados.ver" in response.json()["permisos_individuales_otorgados"]
    assert service.set_permission_override.await_args.kwargs["granted"] is True


async def test_revoke_inherited_permission() -> None:
    service = AsyncMock()
    service.set_permission_override.return_value = make_permission_summary(revoked=True)

    response = await call_employee_endpoint(
        "PUT",
        "/api/v1/employees/7/permissions/2",
        principal=make_principal("permisos.asignar"),
        service=service,
        json={"otorgado": False},
    )

    assert response.status_code == 200
    body = response.json()
    assert "ventas.crear" in body["permisos_heredados"]
    assert "ventas.crear" in body["permisos_individuales_revocados"]
    assert "ventas.crear" not in body["permisos_efectivos"]


async def test_clear_individual_permission_override() -> None:
    service = AsyncMock()
    service.clear_permission_override.return_value = make_permission_summary()

    response = await call_employee_endpoint(
        "DELETE",
        "/api/v1/employees/7/permissions/2",
        principal=make_principal("permisos.asignar"),
        service=service,
    )

    assert response.status_code == 200
    service.clear_permission_override.assert_awaited_once()
    assert service.clear_permission_override.await_args.args[:2] == (7, 2)


async def test_deactivate_employee_without_deleting_history() -> None:
    service = AsyncMock()
    service.update_employee.return_value = make_employee_response(
        user_state="INACTIVO",
        employment_state="INACTIVO",
    )

    response = await call_employee_endpoint(
        "PATCH",
        "/api/v1/employees/7",
        principal=make_principal("empleados.editar"),
        service=service,
        json={"estado_laboral": "INACTIVO"},
    )

    assert response.status_code == 200
    assert response.json()["estado_usuario"] == "INACTIVO"
    assert response.json()["estado_laboral"] == "INACTIVO"


def test_employee_api_has_no_physical_employee_delete() -> None:
    employee_item = app.openapi()["paths"]["/api/v1/employees/{employee_id}"]

    assert "delete" not in employee_item


async def test_password_hash_never_appears_in_employee_response() -> None:
    service = AsyncMock()
    service.get_employee.return_value = make_employee_response()

    response = await call_employee_endpoint(
        "GET",
        "/api/v1/employees/7",
        principal=make_principal("empleados.ver"),
        service=service,
    )

    assert response.status_code == 200
    assert "password" not in response.json()
    assert "password_hash" not in response.json()


async def test_get_role_permissions() -> None:
    service = AsyncMock()
    service.get_role_permissions.return_value = RolePermissionSummary(
        id_rol=4,
        nombre="CAJERO",
        permisos=["productos.ver", "ventas.crear"],
    )
    response = await call_employee_endpoint(
        "GET",
        "/api/v1/roles/4/permissions",
        principal=make_principal("permisos.asignar"),
        service=service,
    )
    assert response.status_code == 200
    assert response.json()["permisos"] == ["productos.ver", "ventas.crear"]


async def test_update_role_permission() -> None:
    service = AsyncMock()
    service.set_role_permission.return_value = RolePermissionSummary(
        id_rol=4,
        nombre="CAJERO",
        permisos=["productos.ver"],
    )
    response = await call_employee_endpoint(
        "PUT",
        "/api/v1/roles/4/permissions/2",
        principal=make_principal("permisos.asignar"),
        service=service,
        json={"habilitado": True},
    )
    assert response.status_code == 200
    assert service.set_role_permission.await_args.kwargs["enabled"] is True
