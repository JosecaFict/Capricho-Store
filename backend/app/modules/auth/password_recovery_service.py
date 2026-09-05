import hashlib

import httpx
from redis.exceptions import RedisError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.security import (
    create_otp_digest,
    create_password_reset_token,
    decode_password_reset_token,
    hash_password,
    verify_otp_digest,
)
from app.db.audit_context import AuditContext, apply_audit_context
from app.modules.auth.exceptions import (
    EmailDeliveryError,
    InvalidPasswordRecoveryCodeError,
    InvalidPasswordResetTokenError,
    SecurityConfigurationError,
)
from app.modules.auth.password_recovery import (
    BrevoEmailClient,
    OtpRecord,
    RedisPasswordResetStore,
    generate_nonce,
    generate_otp,
)
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import (
    MessageResponse,
    PasswordRecoveryRequest,
    PasswordRecoveryVerifyRequest,
    PasswordRecoveryVerifyResponse,
    PasswordResetRequest,
)
from app.modules.auth.service import normalize_email

RECOVERY_MESSAGE = (
    "Si el correo está registrado, recibirás un código para recuperar tu contraseña."
)


def email_storage_key(email: str) -> str:
    return hashlib.sha256(email.encode()).hexdigest()


class PasswordRecoveryService:
    def __init__(
        self,
        *,
        session: AsyncSession,
        repository: AuthRepository,
        store: RedisPasswordResetStore,
        email_client: BrevoEmailClient,
        settings: Settings,
    ) -> None:
        self.session = session
        self.repository = repository
        self.store = store
        self.email_client = email_client
        self.settings = settings

    async def request_code(self, payload: PasswordRecoveryRequest) -> MessageResponse:
        email = normalize_email(str(payload.correo))
        email_key = email_storage_key(email)
        try:
            reserved = await self.store.reserve_request(
                email_key,
                self.settings.password_reset_request_cooldown_seconds,
            )
            if not reserved:
                return MessageResponse(message=RECOVERY_MESSAGE)

            user = await self.repository.get_user_by_email(email)
            if user is None or user.estado != "ACTIVO":
                return MessageResponse(message=RECOVERY_MESSAGE)

            otp = generate_otp()
            nonce = generate_nonce()
            record = OtpRecord(
                user_id=user.id_usuario,
                nonce=nonce,
                digest=create_otp_digest(email, nonce, otp),
            )
            ttl_seconds = self.settings.password_reset_otp_expire_minutes * 60
            await self.store.save_otp(email_key, record, ttl_seconds)
            try:
                await self.email_client.send_password_reset_otp(
                    recipient_email=email,
                    recipient_name=user.nombres,
                    otp=otp,
                    expires_minutes=self.settings.password_reset_otp_expire_minutes,
                )
            except (httpx.HTTPError, OSError) as exc:
                await self.store.delete_otp(email_key)
                raise EmailDeliveryError from exc
        except RedisError as exc:
            raise SecurityConfigurationError("Password recovery storage unavailable") from exc
        return MessageResponse(message=RECOVERY_MESSAGE)

    async def verify_code(
        self,
        payload: PasswordRecoveryVerifyRequest,
    ) -> PasswordRecoveryVerifyResponse:
        email = normalize_email(str(payload.correo))
        email_key = email_storage_key(email)
        try:
            record = await self.store.take_attempt(
                email_key,
                self.settings.password_reset_otp_max_attempts,
            )
            if record is None or not verify_otp_digest(
                email,
                record.nonce,
                payload.codigo,
                record.digest,
            ):
                raise InvalidPasswordRecoveryCodeError

            await self.store.delete_otp(email_key)
            ttl_seconds = self.settings.password_reset_token_expire_minutes * 60
            await self.store.save_verified(record.nonce, record.user_id, ttl_seconds)
        except RedisError as exc:
            raise SecurityConfigurationError("Password recovery storage unavailable") from exc

        token, expires_in = create_password_reset_token(record.user_id, record.nonce)
        return PasswordRecoveryVerifyResponse(reset_token=token, expires_in=expires_in)

    async def reset_password(
        self,
        payload: PasswordResetRequest,
        audit_context: AuditContext,
    ) -> MessageResponse:
        try:
            claims = decode_password_reset_token(payload.reset_token)
        except ValueError as exc:
            raise InvalidPasswordResetTokenError from exc

        try:
            verified_user_id = await self.store.consume_verified(claims.nonce)
        except RedisError as exc:
            raise SecurityConfigurationError("Password recovery storage unavailable") from exc
        if verified_user_id != claims.user_id:
            raise InvalidPasswordResetTokenError

        async with self.session.begin():
            user = await self.repository.get_user_by_id(claims.user_id)
            if user is None or user.estado != "ACTIVO":
                raise InvalidPasswordResetTokenError
            await apply_audit_context(
                self.session,
                AuditContext(
                    usuario_id=user.id_usuario,
                    sesion_id=claims.nonce,
                    ip=audit_context.ip,
                    user_agent=audit_context.user_agent,
                    origen=audit_context.origen,
                    request_id=audit_context.request_id,
                ),
            )
            await self.repository.update_password(
                user,
                hash_password(payload.password.get_secret_value()),
            )
        return MessageResponse(message="Tu contraseña fue actualizada correctamente.")
