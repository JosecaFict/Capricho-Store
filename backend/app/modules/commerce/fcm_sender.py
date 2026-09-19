import logging
import os
from typing import Any

logger = logging.getLogger("capricho.fcm")


class FcmPushSender:
    """Service to dispatch Push Notifications to mobile devices via Firebase Cloud Messaging."""

    def __init__(self, service_account_path: str | None = None) -> None:
        self.service_account_path = service_account_path or os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
        self._initialized = False

    def _ensure_initialized(self) -> bool:
        if self._initialized:
            return True
        try:
            import firebase_admin
            from firebase_admin import credentials

            if self.service_account_path and os.path.exists(self.service_account_path):
                cred = credentials.Certificate(self.service_account_path)
                firebase_admin.initialize_app(cred)
                self._initialized = True
                logger.info("Firebase Admin inicializado con certificado: %s", self.service_account_path)
                return True
            elif os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON"):
                import json
                raw_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
                if raw_json:
                    cred_dict = json.loads(raw_json)
                    cred = credentials.Certificate(cred_dict)
                    firebase_admin.initialize_app(cred)
                    self._initialized = True
                    logger.info("Firebase Admin inicializado desde FIREBASE_SERVICE_ACCOUNT_JSON")
                    return True
            elif os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
                firebase_admin.initialize_app()
                self._initialized = True
                logger.info("Firebase Admin inicializado con GOOGLE_APPLICATION_CREDENTIALS")
                return True
            else:
                logger.debug("Sin credenciales de Firebase configuradas. Notificaciones registradas en modo dry-run.")
                return False
        except Exception as exc:
            logger.debug("Firebase Admin no inicializado (%s). Notificaciones en modo log.", exc)
            return False

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

        if self._ensure_initialized():
            try:
                from firebase_admin import messaging

                notification = messaging.Notification(title=title, body=body)
                apns = messaging.APNSConfig(
                    payload=messaging.APNSPayload(
                        aps=messaging.Aps(sound="default", badge=1)
                    )
                )
                android = messaging.AndroidConfig(
                    priority="high",
                    notification=messaging.AndroidNotification(sound="default"),
                )
                message = messaging.MulticastMessage(
                    tokens=tokens,
                    notification=notification,
                    data=clean_data,
                    apns=apns,
                    android=android,
                )
                response = messaging.send_each_for_multicast(message)
                logger.info(
                    "FCM multicast dispatch: %d exitosos, %d fallidos",
                    response.success_count,
                    response.failure_count,
                )
                return response.success_count
            except Exception as exc:
                logger.error("Error al enviar multicast FCM: %s", exc)
                return 0

        logger.warning(
            "FCM Push Sender no está inicializado (falta FIREBASE_SERVICE_ACCOUNT_JSON o firebase-admin). No se pudo despachar el push a %d dispositivo(s).",
            len(tokens),
        )
        return 0


_default_fcm_sender = FcmPushSender()


def get_fcm_sender() -> FcmPushSender:
    return _default_fcm_sender
