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


@pytest.mark.asyncio
async def test_fcm_push_sender_dry_run() -> None:
    from app.modules.commerce.fcm_sender import FcmPushSender

    sender = FcmPushSender()
    # Empty tokens should return 0 immediately
    delivered = await sender.send_push_notification([], title="Test", body="Body")
    assert delivered == 0

    # With tokens and deep link data, returns 0 gracefully when credentials not present (dry-run)
    delivered = await sender.send_push_notification(
        ["token-1", "token-2"],
        title="Alerta de Stock Crítico",
        body="Vestido Floral alcanzó el stock mínimo",
        data={"type": "STOCK_CRITICO", "id": "42", "route": "/admin/inventario"},
    )
    assert delivered == 2


@pytest.mark.asyncio
async def test_notify_branch_staff_stock_alert() -> None:
    from app.modules.commerce.service import CommerceService

    mock_session = AsyncMock()
    mock_repo = AsyncMock()
    mock_fcm = AsyncMock()

    from unittest.mock import MagicMock

    # Mock execute returning an active employee in branch 1
    mock_result = MagicMock()
    mock_result.all.return_value = [(20,)]  # id_usuario = 20
    mock_session.execute.return_value = mock_result

    # Mock user device tokens
    mock_repo.get_user_device_tokens.return_value = ["device-token-emp-1"]
    mock_repo.add.return_value = None

    service = CommerceService(mock_session, mock_repo, fcm_sender=mock_fcm)

    await service._notify_branch_staff(
        branch_id=1,
        title="Alerta de Stock Crítico",
        content="Blusa Seda roja alcanzó stock mínimo.",
        data={"type": "STOCK_CRITICO", "id": "99", "route": "/admin/inventario"},
    )

    # Repository must have added a notification for employee (user_id=20)
    mock_repo.add.assert_awaited()
    # FCM push sender must have been called with the device token and deep link
    mock_fcm.send_push_notification.assert_awaited_once()
    call_kwargs = mock_fcm.send_push_notification.await_args.kwargs
    assert call_kwargs["tokens"] == ["device-token-emp-1"]
    assert call_kwargs["title"] == "Alerta de Stock Crítico"
    assert call_kwargs["data"]["route"] == "/admin/inventario"

