from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import Rol, Sucursal
from app.scripts.bootstrap_owner import (
    BootstrapError,
    OwnerData,
    _validate_email,
    create_owner,
)


def owner_data() -> OwnerData:
    return OwnerData(
        nombres="Jose",
        apellidos="Perez",
        correo="dueno@example.com",
        ci="OWNER-001",
        telefono=None,
        password="UnaClaveSegura123",
        id_sucursal=1,
        cargo_descriptivo="Dueño / Administrador",
    )


def admin_role() -> Rol:
    return Rol(
        id_rol=1,
        nombre="ADMIN",
        descripcion="Dueño/Administrador",
        activo=True,
    )


def branch() -> Sucursal:
    return Sucursal(
        id_sucursal=1,
        id_ciudad=1,
        nombre="Sucursal Central",
        direccion="Dirección de prueba",
        activo=True,
    )


def test_bootstrap_normalizes_email() -> None:
    assert _validate_email("  DUENO@Example.COM ") == "dueno@example.com"


@pytest.mark.asyncio
async def test_bootstrap_rejects_second_admin() -> None:
    session = AsyncMock(spec=AsyncSession)
    role_result = MagicMock()
    role_result.one_or_none.return_value = admin_role()
    session.scalars.return_value = role_result
    session.scalar.return_value = 10

    with pytest.raises(BootstrapError, match="Ya existe una cuenta"):
        await create_owner(session, owner_data())


@pytest.mark.asyncio
async def test_bootstrap_creates_user_employee_and_admin_assignment() -> None:
    session = AsyncMock(spec=AsyncSession)
    role_result = MagicMock()
    role_result.one_or_none.return_value = admin_role()
    session.scalars.return_value = role_result
    session.scalar.side_effect = [None, None, None]
    session.get.return_value = branch()

    user, employee = await create_owner(session, owner_data())

    assert user.correo == "dueno@example.com"
    assert user.password_hash.startswith("$argon2")
    assert employee.id_sucursal == 1
    assert session.add.call_count == 1
    assert session.add_all.call_count == 1
    assert session.flush.await_count == 2
