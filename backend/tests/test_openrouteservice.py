from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest

from app.integrations.openrouteservice import OpenRouteServiceClient, RouteEstimate
from app.modules.auth.models import Cliente, Sucursal
from app.modules.commerce.models import CotizacionEnvio, DireccionCliente, TarifaEnvio
from app.modules.commerce.schemas import ShippingQuoteCreate
from app.modules.commerce.service import CommerceService


async def test_openrouteservice_client_returns_estimate_on_success() -> None:
    client = OpenRouteServiceClient(api_key="fake-jwt-token")

    fake_response = {
        "routes": [
            {
                "summary": {
                    "distance": 8450.5,
                    "duration": 1140.2,
                }
            }
        ]
    }

    from unittest.mock import MagicMock

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = fake_response
        mock_post.return_value = mock_resp

        estimate = await client.calculate_route(
            start_lat=-17.7654,
            start_lng=-63.1812,
            end_lat=-17.7921,
            end_lng=-63.1650,
        )

    assert estimate is not None
    assert estimate.distance_km == Decimal("8.45")
    assert estimate.duration_min == 19
    assert estimate.provider == "OPEN_ROUTE_SERVICE"


async def test_openrouteservice_client_returns_none_when_unconfigured() -> None:
    client = OpenRouteServiceClient(api_key=None)
    assert not client.is_configured
    assert await client.calculate_route(0, 0, 1, 1) is None


async def test_quote_shipping_uses_openrouteservice_when_available() -> None:
    session = AsyncMock()
    repository = AsyncMock()
    route_client = AsyncMock()

    customer = Cliente(id_cliente=4, id_usuario=9, estado="ACTIVO")
    branch = Sucursal(
        id_sucursal=1,
        nombre="Central",
        activo=True,
        latitud=Decimal("-17.765400"),
        longitud=Decimal("-63.181200"),
    )
    address = DireccionCliente(
        id_direccion=2,
        id_cliente=4,
        activo=True,
        latitud=Decimal("-17.792100"),
        longitud=Decimal("-63.165000"),
    )
    rate = TarifaEnvio(
        id_tarifa=1,
        tarifa_base=Decimal("15.00"),
        distancia_base_km=Decimal("5.00"),
        costo_km_adicional=Decimal("2.50"),
        activo=True,
    )

    repository.customer_by_user.return_value = customer
    repository.get.side_effect = lambda model, identity: branch if model is Sucursal else address
    repository.active_rate.return_value = rate

    route_client.calculate_route.return_value = RouteEstimate(
        distance_km=Decimal("8.00"),
        duration_min=18,
        provider="OPEN_ROUTE_SERVICE",
    )

    async def add(entity):
        if isinstance(entity, CotizacionEnvio):
            entity.id_cotizacion = 10
        return entity

    repository.add.side_effect = add

    service = CommerceService(session, repository, route_client=route_client)
    quote = await service.quote_shipping(9, ShippingQuoteCreate(id_sucursal=1, id_direccion=2))

    assert quote.distancia_km == Decimal("8.00")
    assert quote.duracion_estimada_min == 18
    assert quote.proveedor_rutas == "OPEN_ROUTE_SERVICE"
    # cost = 15.00 + (8.00 - 5.00) * 2.50 = 15 + 7.50 = 22.50
    assert quote.costo_estimado == Decimal("22.50")
    session.commit.assert_awaited_once()
