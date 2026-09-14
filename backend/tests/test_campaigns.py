from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.modules.auth.dependencies import CurrentPrincipal, get_current_principal
from app.modules.auth.models import Usuario
from app.modules.commerce.dependencies import get_commerce_service
from app.modules.commerce.exceptions import CommerceNotFoundError
from app.modules.commerce.schemas import (
    CampaignLaunchResponse,
    CampaignResponse,
)

NOW = datetime(2026, 9, 14, 12, 0, 0, tzinfo=UTC)

SAMPLE_CAMPAIGN = CampaignResponse(
    id_campania=1,
    nombre="Liquidación Primavera",
    descripcion="20% de descuento en camisas y poleras.",
    asunto_email="¡Aprovecha 20% off en Capricho Store!",
    segmento_objetivo="TODOS",
    fecha_inicio=NOW,
    fecha_fin=None,
    estado="BORRADOR",
    created_at=NOW,
    updated_at=NOW,
    total_notificaciones=0,
)


def make_principal(permissions: list[str]) -> CurrentPrincipal:
    user = Usuario(
        id_usuario=1,
        nombres="Marketing",
        apellidos="Capricho",
        correo="marketing@capricho.com",
        password_hash="fake",
    )
    return CurrentPrincipal(
        user=user,
        roles=frozenset(["ADMIN"]),
        permissions=frozenset(permissions),
        session_id="test-session-campaigns",
        id_sucursal=1,
    )


@pytest.mark.asyncio
async def test_list_campaigns_requires_permission() -> None:
    principal_no_perm = make_principal(["ventas.ver"])

    app.dependency_overrides[get_current_principal] = lambda: principal_no_perm

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/v1/admin/campaigns")

    app.dependency_overrides.clear()
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_list_campaigns_success() -> None:
    principal = make_principal(["promociones.gestionar"])
    mock_service = AsyncMock()
    mock_service.list_campaigns.return_value = [SAMPLE_CAMPAIGN]

    app.dependency_overrides[get_current_principal] = lambda: principal
    app.dependency_overrides[get_commerce_service] = lambda: mock_service

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/v1/admin/campaigns")

    app.dependency_overrides.clear()
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["nombre"] == "Liquidación Primavera"
    assert data[0]["estado"] == "BORRADOR"


@pytest.mark.asyncio
async def test_create_campaign_success() -> None:
    principal = make_principal(["promociones.gestionar"])
    mock_service = AsyncMock()
    mock_service.create_campaign.return_value = SAMPLE_CAMPAIGN

    app.dependency_overrides[get_current_principal] = lambda: principal
    app.dependency_overrides[get_commerce_service] = lambda: mock_service

    payload = {
        "nombre": "Liquidación Primavera",
        "descripcion": "20% de descuento en camisas y poleras.",
        "asunto_email": "¡Aprovecha 20% off en Capricho Store!",
        "segmento_objetivo": "TODOS",
    }

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/v1/admin/campaigns", json=payload)

    app.dependency_overrides.clear()
    assert response.status_code == 201
    assert response.json()["nombre"] == "Liquidación Primavera"


@pytest.mark.asyncio
async def test_launch_campaign_success() -> None:
    principal = make_principal(["promociones.gestionar"])
    mock_service = AsyncMock()
    mock_service.launch_campaign.return_value = CampaignLaunchResponse(
        id_campania=1,
        nombre="Liquidación Primavera",
        estado="FINALIZADA",
        destinatarios_notificados=15,
        mensaje="Campaña 'Liquidación Primavera' difundida con éxito a 15 cliente(s).",
    )

    app.dependency_overrides[get_current_principal] = lambda: principal
    app.dependency_overrides[get_commerce_service] = lambda: mock_service

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/v1/admin/campaigns/1/send")

    app.dependency_overrides.clear()
    assert response.status_code == 200
    data = response.json()
    assert data["estado"] == "FINALIZADA"
    assert data["destinatarios_notificados"] == 15


@pytest.mark.asyncio
async def test_launch_campaign_not_found() -> None:
    principal = make_principal(["promociones.gestionar"])
    mock_service = AsyncMock()
    mock_service.launch_campaign.side_effect = CommerceNotFoundError(
        "Campaña con ID 999 no encontrada."
    )

    app.dependency_overrides[get_current_principal] = lambda: principal
    app.dependency_overrides[get_commerce_service] = lambda: mock_service

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/v1/admin/campaigns/999/send")

    app.dependency_overrides.clear()
    assert response.status_code == 404
