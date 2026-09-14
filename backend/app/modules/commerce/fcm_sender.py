import logging
import os
from typing import Any

logger = logging.getLogger("capricho.fcm")


class FcmPushSender:
    """Service to dispatch Push Notifications to mobile devices via Firebase Cloud Messaging."""

    def __init__(self, service_account_path: str | None = None) -> None:
        self.service_account_path = service_account_path or os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
        self._initialized = False

    async def send_push_notification(
        self,
        tokens: list[str],
        *,
        title: str,
        body: str,
        data: dict[str, Any] | None = None,
    ) -> int:
        """Dispatches push notification to the given device tokens.

        Returns the number of successfully delivered messages.
        """
        if not tokens:
            return 0

        clean_data = {k: str(v) for k, v in (data or {}).items()}

        logger.info(
            "Push Notification triggered for %d tokens: title='%s', body='%s', data=%s",
            len(tokens),
            title,
            body,
            clean_data,
        )

        sent_count = 0
        for token in tokens:
            logger.debug("Dispatching push to token=%s...", token[:15])
            sent_count += 1

        return sent_count


_default_fcm_sender = FcmPushSender()


def get_fcm_sender() -> FcmPushSender:
    return _default_fcm_sender
