from collections.abc import AsyncIterator
from datetime import UTC, datetime
from unittest.mock import AsyncMock

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.modules.auth.dependencies import (
    CurrentPrincipal,
    get_auth_service,
    get_current_principal,
    get_password_recovery_service,
)
from app.modules.auth.exceptions import (
    EmailAlreadyRegisteredError,
    InactiveUserError,
    InvalidCredentialsError,
)
from app.modules.auth.models import Usuario
from app.modules.auth.schemas import (
    MessageResponse,
    PasswordRecoveryVerifyResponse,
    TokenResponse,
    UserResponse,
)

REGISTER_PAYLOAD = {
    "nombres": "Ana",
    "apellidos": "Pérez",
    "correo": "ana@example.com",
    "telefono": "70000000",
    "ci": "1234567",
    "password": "StrongPassword123!",
}


def make_user(state: str = "ACTIVO") -> Usuario:
    return Usuario(
        id_usuario=1,
        nombres="Ana",
        apellidos="Pérez",
        correo="ana@example.com",
        telefono="70000000",
        ci="1234567",
        password_hash="not-returned",
        estado=state,
        created_at=datetime(2026, 8, 30, tzinfo=UTC),
        updated_at=datetime(2026, 8, 30, tzinfo=UTC),
    )


def make_user_response() -> UserResponse:
    user = make_user()
    return UserResponse(
        id_usuario=user.id_usuario,
        nombres=user.nombres,
        apellidos=user.apellidos,
        correo=user.correo,
        telefono=user.telefono,
        ci=user.ci,
        estado="ACTIVO",
        created_at=user.created_at,
        roles=["CLIENTE"],
        permisos=[],
    )


async def request_with_service(
    method: str,
    path: str,
    service: AsyncMock,
    *,
    json: dict[str, str] | None = None,
) -> tuple[int, dict]:
    async def override_service() -> AsyncIterator[AsyncMock]:
        yield service

    app.dependency_overrides[get_auth_service] = override_service
    try:
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.request(method, path, json=json)
    finally:
        app.dependency_overrides.clear()
    return response.status_code, response.json()


async def test_register_customer_successfully() -> None:
    service = AsyncMock()
    service.register_customer.return_value = make_user_response()

    status_code, body = await request_with_service(
        "POST",
        "/api/v1/auth/register",
        service,
        json=REGISTER_PAYLOAD,
    )

    assert status_code == 201
    assert body["correo"] == "ana@example.com"
    assert body["roles"] == ["CLIENTE"]
    assert "password" not in body
    assert "password_hash" not in body
    service.register_customer.assert_awaited_once()


async def test_register_rejects_duplicate_email() -> None:
    service = AsyncMock()
    service.register_customer.side_effect = EmailAlreadyRegisteredError

    status_code, body = await request_with_service(
        "POST",
        "/api/v1/auth/register",
        service,
        json=REGISTER_PAYLOAD,
    )

    assert status_code == 409
    assert body == {"detail": "Email already registered"}


async def test_register_rejects_password_without_special_character() -> None:
    service = AsyncMock()
    payload = {**REGISTER_PAYLOAD, "password": "StrongPassword123"}

    status_code, body = await request_with_service(
        "POST",
        "/api/v1/auth/register",
        service,
        json=payload,
    )

    assert status_code == 422
    assert "carácter especial" in str(body)
    service.register_customer.assert_not_awaited()


async def test_login_successfully() -> None:
    service = AsyncMock()
    service.login.return_value = TokenResponse(
        access_token="signed.jwt.token",
        expires_in=1800,
    )

    status_code, body = await request_with_service(
        "POST",
        "/api/v1/auth/login",
        service,
        json={"correo": "ANA@EXAMPLE.COM", "password": "StrongPassword123"},
    )

    assert status_code == 200
    assert body == {
        "access_token": "signed.jwt.token",
        "token_type": "bearer",
        "expires_in": 1800,
    }


async def test_login_rejects_incorrect_password() -> None:
    service = AsyncMock()
    service.login.side_effect = InvalidCredentialsError

    status_code, body = await request_with_service(
        "POST",
        "/api/v1/auth/login",
        service,
        json={"correo": "ana@example.com", "password": "IncorrectPassword"},
    )

    assert status_code == 401
    assert body == {"detail": "Invalid credentials"}


async def test_login_rejects_blocked_user() -> None:
    service = AsyncMock()
    service.login.side_effect = InactiveUserError("BLOQUEADO")

    status_code, body = await request_with_service(
        "POST",
        "/api/v1/auth/login",
        service,
        json={"correo": "ana@example.com", "password": "StrongPassword123"},
    )

    assert status_code == 403
    assert body == {"detail": "User is bloqueado"}


async def test_login_rejects_inactive_user() -> None:
    service = AsyncMock()
    service.login.side_effect = InactiveUserError("INACTIVO")

    status_code, body = await request_with_service(
        "POST",
        "/api/v1/auth/login",
        service,
        json={"correo": "ana@example.com", "password": "StrongPassword123"},
    )

    assert status_code == 403
    assert body == {"detail": "User is inactivo"}


async def test_me_with_valid_token() -> None:
    principal = CurrentPrincipal(
        user=make_user(),
        roles=frozenset({"CLIENTE"}),
        permissions=frozenset({"productos.ver"}),
        session_id="session-id",
    )

    async def override_principal() -> CurrentPrincipal:
        return principal

    app.dependency_overrides[get_current_principal] = override_principal
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(
                "/api/v1/auth/me",
                headers={"Authorization": "Bearer signed.jwt.token"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["correo"] == "ana@example.com"
    assert response.json()["permisos"] == ["productos.ver"]
    assert "password_hash" not in response.json()


async def test_me_includes_employee_branch_context() -> None:
    principal = CurrentPrincipal(
        user=make_user(),
        roles=frozenset({"CAJERO"}),
        permissions=frozenset({"ventas.crear"}),
        session_id="session-id",
        id_sucursal=3,
        sucursal="Sucursal Norte",
    )
    app.dependency_overrides[get_current_principal] = lambda: principal
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/auth/me")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["id_sucursal"] == 3
    assert response.json()["sucursal"] == "Sucursal Norte"


async def test_me_without_token() -> None:
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid credentials"}


async def request_with_recovery_service(
    path: str,
    service: AsyncMock,
    payload: dict[str, str],
) -> tuple[int, dict]:
    async def override_service() -> AsyncIterator[AsyncMock]:
        yield service

    app.dependency_overrides[get_password_recovery_service] = override_service
    try:
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(path, json=payload)
    finally:
        app.dependency_overrides.clear()
    return response.status_code, response.json()


async def test_password_recovery_request_uses_generic_response() -> None:
    service = AsyncMock()
    service.request_code.return_value = MessageResponse(
        message="Si el correo está registrado, recibirás un código."
    )

    status_code, body = await request_with_recovery_service(
        "/api/v1/auth/password-recovery/request",
        service,
        {"correo": "ana@example.com"},
    )

    assert status_code == 200
    assert "correo" in body["message"]
    service.request_code.assert_awaited_once()


async def test_password_recovery_verifies_six_digit_code() -> None:
    service = AsyncMock()
    service.verify_code.return_value = PasswordRecoveryVerifyResponse(
        reset_token="temporary.jwt.token",
        expires_in=600,
    )

    status_code, body = await request_with_recovery_service(
        "/api/v1/auth/password-recovery/verify",
        service,
        {"correo": "ana@example.com", "codigo": "123456"},
    )

    assert status_code == 200
    assert body["reset_token"] == "temporary.jwt.token"


async def test_password_recovery_rejects_malformed_code() -> None:
    service = AsyncMock()

    status_code, _ = await request_with_recovery_service(
        "/api/v1/auth/password-recovery/verify",
        service,
        {"correo": "ana@example.com", "codigo": "12345a"},
    )

    assert status_code == 422
    service.verify_code.assert_not_awaited()


async def test_password_reset_rejects_weak_password() -> None:
    service = AsyncMock()

    status_code, body = await request_with_recovery_service(
        "/api/v1/auth/password-recovery/reset",
        service,
        {"reset_token": "temporary.jwt.token", "password": "weakpass"},
    )

    assert status_code == 422
    assert "mayúscula" in str(body)
    service.reset_password.assert_not_awaited()
