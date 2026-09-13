from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.modules.auth.dependencies import CurrentPrincipal, get_current_principal
from app.modules.auth.models import Usuario
from app.modules.commerce.dependencies import get_commerce_service
from app.modules.commerce.schemas import (
    AdminNotificationPage,
    AdminNotificationResponse,
    NotificationKpis,
)

NOW = datetime(2026, 9, 13, 15, 0, 0, tzinfo=UTC)

SAMPLE_NOTIF = AdminNotificationResponse(
    id_notificacion=1,
    id_usuario=10,
    destinatario_nombre="Carlos Cliente",
    destinatario_email="carlos@example.com",
    tipo="PEDIDO_EN_RUTA",
    canal="EMAIL",
    proveedor="BREVO",
    destinatario="carlos@example.com",
    titulo="Tu pedido está en camino",
    contenido="Tu pedido #5 se encuentra en camino.",
    estado="ENVIADO",
    external_message_id="msg-123",
    fecha_creacion=NOW,
    fecha_envio=NOW,
    fecha_entrega=NOW,
    error_mensaje=None,
)

SAMPLE_PAGE = AdminNotificationPage(
    items=[SAMPLE_NOTIF],
    total=1,
    kpis=NotificationKpis(total=1, enviadas=1, pendientes=0, fallidas=0),
    page=1,
    page_size=25,
)


def make_principal(permissions: list[str]) -> CurrentPrincipal:
    user = Usuario(
        id_usuario=1,
        nombres="Admin",
        apellidos="Ventas",
        correo="admin@capricho.com",
        password_hash="fake",
    )
    return CurrentPrincipal(
        user=user,
        roles=frozenset(["EMPLEADO"]),
        permissions=frozenset(permissions),
        session_id="test-session-123",
        id_sucursal=1,
        sucursal="Central",
    )


@pytest.mark.asyncio
async def test_admin_list_notifications_success():
    mock_service = AsyncMock()
    mock_service.admin_list_notifications.return_value = SAMPLE_PAGE

    app.dependency_overrides[get_commerce_service] = lambda: mock_service
    app.dependency_overrides[get_current_principal] = lambda: make_principal(["ventas.ver"])

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/v1/admin/notifications?estado=ENVIADO&page=1")
            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 1
            assert data["kpis"]["enviadas"] == 1
            assert len(data["items"]) == 1
            assert data["items"][0]["titulo"] == "Tu pedido está en camino"
            assert data["items"][0]["destinatario_nombre"] == "Carlos Cliente"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_admin_list_notifications_forbidden_without_permission():
    mock_service = AsyncMock()
    app.dependency_overrides[get_commerce_service] = lambda: mock_service
    app.dependency_overrides[get_current_principal] = lambda: make_principal([])

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/v1/admin/notifications")
            assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_send_manual_notification_success():
    mock_service = AsyncMock()
    created_notif = AdminNotificationResponse(
        id_notificacion=2,
        id_usuario=10,
        destinatario_nombre="Carlos Cliente",
        destinatario_email="carlos@example.com",
        tipo="AVISO_OPERATIVO",
        canal="SISTEMA",
        proveedor="SISTEMA",
        destinatario="carlos@example.com",
        titulo="Retraso en delivery",
        contenido="Tu pedido presenta una demora de 15 minutos.",
        estado="ENVIADO",
        fecha_creacion=NOW,
        fecha_envio=NOW,
        fecha_entrega=NOW,
    )
    mock_service.send_manual_notification.return_value = created_notif

    app.dependency_overrides[get_commerce_service] = lambda: mock_service
    app.dependency_overrides[get_current_principal] = lambda: make_principal(["ventas.ver"])

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/v1/admin/notifications",
                json={
                    "id_usuario": 10,
                    "titulo": "Retraso en delivery",
                    "contenido": "Tu pedido presenta una demora de 15 minutos.",
                    "canal": "SISTEMA",
                    "tipo": "AVISO_OPERATIVO",
                },
            )
            assert response.status_code == 201
            data = response.json()
            assert data["id_notificacion"] == 2
            assert data["titulo"] == "Retraso en delivery"
            assert data["estado"] == "ENVIADO"
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_resend_notification_success():
    mock_service = AsyncMock()
    resent_notif = AdminNotificationResponse(
        id_notificacion=1,
        id_usuario=10,
        destinatario_nombre="Carlos Cliente",
        destinatario_email="carlos@example.com",
        tipo="PEDIDO_EN_RUTA",
        canal="EMAIL",
        proveedor="BREVO",
        destinatario="carlos@example.com",
        titulo="Tu pedido está en camino",
        contenido="Tu pedido #5 se encuentra en camino.",
        estado="ENVIADO",
        fecha_creacion=NOW,
        fecha_envio=NOW,
        fecha_entrega=NOW,
    )
    mock_service.resend_notification.return_value = resent_notif

    app.dependency_overrides[get_commerce_service] = lambda: mock_service
    app.dependency_overrides[get_current_principal] = lambda: make_principal(["ventas.ver"])

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post("/api/v1/admin/notifications/1/resend")
            assert response.status_code == 200
            data = response.json()
            assert data["id_notificacion"] == 1
            assert data["estado"] == "ENVIADO"
    finally:
        app.dependency_overrides.clear()
