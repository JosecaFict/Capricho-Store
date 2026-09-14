from collections.abc import AsyncIterator
from datetime import UTC, datetime
from unittest.mock import AsyncMock

from httpx import ASGITransport, AsyncClient
import pytest

from app.main import app
from app.modules.auth.dependencies import CurrentPrincipal, get_current_principal
from app.modules.auth.models import Usuario
from app.modules.commerce.dependencies import get_commerce_service
from app.modules.commerce.schemas import DeviceTokenResponse


def make_user(
    *,
    id_usuario: int = 1,
    nombres: str = "Carlos",
    apellidos: str = "Cliente",
    correo: str = "carlos@example.com",
) -> Usuario:
    return Usuario(
        id_usuario=id_usuario,
        nombres=nombres,
        apellidos=apellidos,
        correo=correo,
        estado="ACTIVO",
        created_at=datetime.now(UTC),
    )


@pytest.mark.asyncio
async def test_register_device_token_success() -> None:
    principal = CurrentPrincipal(
        user=make_user(id_usuario=10),
        roles=frozenset({"CLIENTE"}),
        permissions=frozenset(),
        session_id="session-push-1",
    )

    mock_service = AsyncMock()
    mock_service.register_device_token.return_value = DeviceTokenResponse(
        mensaje="Dispositivo registrado exitosamente para notificaciones push.",
        registrado=True,
    )

    async def override_service() -> AsyncIterator[AsyncMock]:
        yield mock_service

    app.dependency_overrides[get_current_principal] = lambda: principal
    app.dependency_overrides[get_commerce_service] = override_service

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/notifications/devices",
                json={
                    "token": "fcm-test-token-1234567890",
                    "plataforma": "ios",
                    "dispositivo_info": "iPhone 15 Pro",
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert data["registrado"] is True
    assert "Dispositivo registrado" in data["mensaje"]
    mock_service.register_device_token.assert_awaited_once()


@pytest.mark.asyncio
async def test_register_device_token_unauthenticated_returns_401() -> None:
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/notifications/devices",
            json={"token": "fcm-test-token-1234567890", "plataforma": "ios"},
        )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_register_device_token_short_token_returns_422() -> None:
    principal = CurrentPrincipal(
        user=make_user(id_usuario=10),
        roles=frozenset({"CLIENTE"}),
        permissions=frozenset(),
        session_id="session-push-2",
    )

    app.dependency_overrides[get_current_principal] = lambda: principal
    try:
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/notifications/devices",
                json={"token": "short", "plataforma": "ios"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
