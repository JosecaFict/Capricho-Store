from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db_session
from app.integrations.openrouteservice import OpenRouteServiceClient
from app.integrations.stripe_checkout import StripeCheckoutGateway
from app.modules.commerce.repository import CommerceRepository
from app.modules.commerce.service import CommerceService


async def get_commerce_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AsyncIterator[CommerceService]:
    settings = get_settings()
    gateway = (
        StripeCheckoutGateway(settings.stripe_secret_key, settings.stripe_webhook_secret)
        if settings.stripe_secret_key
        else None
    )
    route_client = (
        OpenRouteServiceClient(api_key=settings.route_service_api_key)
        if settings.route_service_api_key
        else None
    )
    yield CommerceService(
        session,
        CommerceRepository(session),
        stripe_gateway=gateway,
        route_client=route_client,
        public_web_url=settings.public_web_url,
        checkout_expire_minutes=settings.stripe_checkout_expire_minutes,
    )
