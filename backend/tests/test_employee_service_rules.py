from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from app.modules.auth.dependencies import CurrentPrincipal
from app.modules.auth.exceptions import PermissionDeniedError
from app.modules.auth.models import Rol, Usuario
from app.modules.employees.exceptions import InvalidEmployeeDataError
from app.modules.employees.service import EmployeeService


def make_principal(*permissions: str, roles: frozenset[str] = frozenset({"ADMIN"})):
    user = Usuario(
        id_usuario=99,
        nombres="Admin",
        apellidos="Principal",
        correo="admin@example.com",
        ci="ADMIN-001",
        password_hash="not-returned",
        estado="ACTIVO",
        created_at=datetime(2026, 8, 30, tzinfo=UTC),
        updated_at=datetime(2026, 8, 30, tzinfo=UTC),
    )
    return CurrentPrincipal(
        user=user,
        roles=roles,
        permissions=frozenset(permissions),
        session_id="test-session",
    )


async def test_service_accepts_operational_role() -> None:
    repository = AsyncMock()
    repository.get_role.return_value = Rol(
        id_rol=4,
        nombre="CAJERO",
        descripcion="Empleado de ventas",
        activo=True,
    )
    service = EmployeeService(session=AsyncMock(), repository=repository)

    role = await service._validate_assignable_role(4, make_principal("permisos.asignar"))

    assert role.nombre == "CAJERO"


async def test_service_rejects_client_role_for_employee() -> None:
    repository = AsyncMock()
    repository.get_role.return_value = Rol(
        id_rol=2,
        nombre="CLIENTE",
        descripcion="Cliente",
        activo=True,
    )
    service = EmployeeService(session=AsyncMock(), repository=repository)

    with pytest.raises(InvalidEmployeeDataError):
        await service._validate_assignable_role(2, make_principal("permisos.asignar"))


async def test_service_rejects_admin_assignment_by_non_admin() -> None:
    repository = AsyncMock()
    repository.get_role.return_value = Rol(
        id_rol=1,
        nombre="ADMIN",
        descripcion="Administrador",
        activo=True,
    )
    service = EmployeeService(session=AsyncMock(), repository=repository)
    actor = make_principal(
        "permisos.asignar",
        roles=frozenset({"ENCARGADO_SUCURSAL"}),
    )

    with pytest.raises(PermissionDeniedError):
        await service._validate_assignable_role(1, actor)
