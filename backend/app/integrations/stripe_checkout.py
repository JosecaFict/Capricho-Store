from typing import Any

import stripe


class StripeCheckoutGateway:
    """Small async boundary around Stripe Checkout for easy testing."""

    def __init__(self, secret_key: str, webhook_secret: str | None = None) -> None:
        self.secret_key = secret_key
        self.webhook_secret = webhook_secret

    async def create_session(self, **params: Any) -> dict[str, Any]:
        session = await stripe.checkout.Session.create_async(
            api_key=self.secret_key,
            **params,
        )
        return session.to_dict()

    async def retrieve_session(self, session_id: str) -> dict[str, Any]:
        session = await stripe.checkout.Session.retrieve_async(
            session_id,
            api_key=self.secret_key,
        )
        return session.to_dict()

    async def expire_session(self, session_id: str) -> dict[str, Any]:
        session = await stripe.checkout.Session.expire_async(
            session_id,
            api_key=self.secret_key,
        )
        return session.to_dict()

    def construct_event(self, payload: bytes, signature: str) -> dict[str, Any]:
        if not self.webhook_secret:
            raise ValueError("STRIPE_WEBHOOK_SECRET no está configurado")
        event = stripe.Webhook.construct_event(payload, signature, self.webhook_secret)
        return event.to_dict()
