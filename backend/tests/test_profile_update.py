from collections.abc import AsyncIterator
from datetime import UTC, datetime
from unittest.mock import AsyncMock

from httpx import ASGITransport, AsyncClient
import pytest

from app.main import app
from app.modules.auth.dependencies import CurrentPrincipal, get_auth_service, get_current_principal
from app.modules.auth.models import Usuario


def make_user(
    *,
    id_usuario: int = 1,
    nombres: str = "Maria",
    apellidos: str = "Perez",
    correo: str = "maria@example.com",
    telefono: str | None = "70012345",
    ci: str | None = "9876543",
    estado: str = "ACTIVO",
) -> Usuario:
    return Usuario(
        id_usuario=id_usuario,
        nombres=nombres,
        apellidos=apellidos,
        correo=correo,
        telefono=telefono,
        ci=ci,
        estado=estado,
        created_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_update_profile_success() -> None:
    initial_user = make_user()
    updated_user = make_user(
        nombres="Maria Elena",
        apellidos="Perez Rojas",
        telefono="77889900",
        ci="1234567-SC",
    )

    principal = CurrentPrincipal(
        user=initial_user,
        roles=frozenset({"CLIENTE"}),
        permissions=frozenset(),
        session_id="session-1",
    )

    mock_service = AsyncMock()
    mock_service.update_profile.return_value = updated_user

    async def override_service() -> AsyncIterator[AsyncMock]:
        yield mock_service

    app.dependency_overrides[get_current_principal] = lambda: principal
    app.dependency_overrides[get_auth_service] = override_service

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.patch(
                "/api/v1/auth/me",
                json={
                    "nombres": "Maria Elena",
                    "apellidos": "Perez Rojas",
                    "telefono": "77889900",
                    "ci": "1234567-SC",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["nombres"] == "Maria Elena"
    assert data["apellidos"] == "Perez Rojas"
    assert data["telefono"] == "77889900"
    assert data["ci"] == "1234567-SC"
    assert data["correo"] == "maria@example.com"


@pytest.mark.asyncio
async def test_update_profile_without_token_returns_401() -> None:
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.patch(
            "/api/v1/auth/me",
            json={"nombres": "Ana", "apellidos": "Lopez"},
        )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_update_profile_empty_name_returns_422() -> None:
    principal = CurrentPrincipal(
        user=make_user(),
        roles=frozenset({"CLIENTE"}),
        permissions=frozenset(),
        session_id="session-1",
    )

    app.dependency_overrides[get_current_principal] = lambda: principal
    try:
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.patch(
                "/api/v1/auth/me",
                json={"nombres": "   ", "apellidos": "Lopez"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_change_password_success() -> None:
    principal = CurrentPrincipal(
        user=make_user(),
        roles=frozenset({"ADMIN"}),
        permissions=frozenset({"admin.total"}),
        session_id="session-1",
    )

    mock_service = AsyncMock()
    mock_service.change_password.return_value = None

    async def override_service() -> AsyncIterator[AsyncMock]:
        yield mock_service

    app.dependency_overrides[get_current_principal] = lambda: principal
    app.dependency_overrides[get_auth_service] = override_service

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/auth/change-password",
                json={
                    "current_password": "Password123!",
                    "new_password": "NewSecret456!",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"message": "Contraseña actualizada exitosamente"}


@pytest.mark.asyncio
async def test_change_password_invalid_current_returns_401() -> None:
    from app.modules.auth.exceptions import InvalidCredentialsError

    principal = CurrentPrincipal(
        user=make_user(),
        roles=frozenset({"ADMIN"}),
        permissions=frozenset({"admin.total"}),
        session_id="session-1",
    )

    mock_service = AsyncMock()
    mock_service.change_password.side_effect = InvalidCredentialsError("Current password is incorrect")

    async def override_service() -> AsyncIterator[AsyncMock]:
        yield mock_service

    app.dependency_overrides[get_current_principal] = lambda: principal
    app.dependency_overrides[get_auth_service] = override_service

    try:
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/auth/change-password",
                json={
                    "current_password": "WrongPassword123!",
                    "new_password": "NewSecret456!",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_change_password_weak_new_password_returns_422() -> None:
    principal = CurrentPrincipal(
        user=make_user(),
        roles=frozenset({"ADMIN"}),
        permissions=frozenset(),
        session_id="session-1",
    )

    app.dependency_overrides[get_current_principal] = lambda: principal
    try:
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/auth/change-password",
                json={
                    "current_password": "Password123!",
                    "new_password": "weak",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422

