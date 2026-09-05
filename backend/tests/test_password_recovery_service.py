from contextlib import AbstractAsyncContextManager

import pytest

from app.core.config import Settings
from app.core.security import verify_password
from app.db.audit_context import AuditContext
from app.modules.auth.exceptions import InvalidPasswordRecoveryCodeError
from app.modules.auth.models import Usuario
from app.modules.auth.password_recovery import OtpRecord
from app.modules.auth.password_recovery_service import PasswordRecoveryService
from app.modules.auth.schemas import (
    PasswordRecoveryRequest,
    PasswordRecoveryVerifyRequest,
    PasswordResetRequest,
)


class Transaction(AbstractAsyncContextManager[None]):
    async def __aenter__(self) -> None:
        return None

    async def __aexit__(self, *_: object) -> None:
        return None


class Session:
    def begin(self) -> Transaction:
        return Transaction()

    async def execute(self, *_: object, **__: object) -> None:
        return None


class Repository:
    def __init__(self, user: Usuario | None) -> None:
        self.user = user

    async def get_user_by_email(self, _: str) -> Usuario | None:
        return self.user

    async def get_user_by_id(self, _: int) -> Usuario | None:
        return self.user

    async def update_password(self, user: Usuario, password_hash: str) -> None:
        user.password_hash = password_hash


class Store:
    def __init__(self) -> None:
        self.record: OtpRecord | None = None
        self.verified: dict[str, int] = {}

    async def reserve_request(self, _: str, __: int) -> bool:
        return True

    async def save_otp(self, _: str, record: OtpRecord, __: int) -> None:
        self.record = record

    async def take_attempt(self, _: str, __: int) -> OtpRecord | None:
        return self.record

    async def delete_otp(self, _: str) -> None:
        self.record = None

    async def save_verified(self, nonce: str, user_id: int, _: int) -> None:
        self.verified[nonce] = user_id

    async def consume_verified(self, nonce: str) -> int | None:
        return self.verified.pop(nonce, None)


class EmailClient:
    def __init__(self) -> None:
        self.otp = ""

    async def send_password_reset_otp(self, *, otp: str, **_: object) -> None:
        self.otp = otp


def make_service(user: Usuario | None) -> tuple[PasswordRecoveryService, Store, EmailClient]:
    settings = Settings(
        DATABASE_URL="postgresql+asyncpg://user:password@localhost/database",
        SECRET_KEY="test-secret-key-not-for-production",
        REDIS_URL="redis://localhost:6379/0",
        BREVO_API_KEY="test-key",
        BREVO_SENDER_EMAIL="sender@example.com",
    )
    store = Store()
    email = EmailClient()
    service = PasswordRecoveryService(
        session=Session(),  # type: ignore[arg-type]
        repository=Repository(user),  # type: ignore[arg-type]
        store=store,  # type: ignore[arg-type]
        email_client=email,  # type: ignore[arg-type]
        settings=settings,
    )
    return service, store, email


def make_user() -> Usuario:
    return Usuario(
        id_usuario=7,
        nombres="Ana",
        apellidos="Pérez",
        correo="ana@example.com",
        password_hash="old-hash",
        estado="ACTIVO",
    )


async def test_password_recovery_full_flow_updates_argon2_hash() -> None:
    user = make_user()
    service, _, email = make_service(user)

    response = await service.request_code(PasswordRecoveryRequest(correo="ANA@example.com"))
    verified = await service.verify_code(
        PasswordRecoveryVerifyRequest(correo="ana@example.com", codigo=email.otp)
    )
    completed = await service.reset_password(
        PasswordResetRequest(reset_token=verified.reset_token, password="NuevaClave123!"),
        AuditContext(origen="API"),
    )

    assert "correo" in response.message
    assert email.otp.isdigit() and len(email.otp) == 6
    assert verify_password("NuevaClave123!", user.password_hash)
    assert "actualizada" in completed.message


async def test_password_recovery_rejects_wrong_code() -> None:
    service, _, _ = make_service(make_user())
    await service.request_code(PasswordRecoveryRequest(correo="ana@example.com"))

    with pytest.raises(InvalidPasswordRecoveryCodeError):
        await service.verify_code(
            PasswordRecoveryVerifyRequest(correo="ana@example.com", codigo="000000")
        )


async def test_password_recovery_does_not_reveal_unknown_email() -> None:
    service, store, email = make_service(None)

    response = await service.request_code(PasswordRecoveryRequest(correo="missing@example.com"))

    assert "correo" in response.message
    assert store.record is None
    assert email.otp == ""
