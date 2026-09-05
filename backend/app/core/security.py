import hashlib
import hmac
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
from jwt import InvalidTokenError
from pwdlib import PasswordHash

from app.core.config import get_settings

password_hasher = PasswordHash.recommended()


@dataclass(frozen=True, slots=True)
class AccessTokenClaims:
    user_id: int
    session_id: str


@dataclass(frozen=True, slots=True)
class PasswordResetTokenClaims:
    user_id: int
    nonce: str


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_hasher.verify(password, password_hash)


def validate_password_strength(password: str) -> str:
    if len(password) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres")
    if len(password) > 128:
        raise ValueError("La contraseña no puede superar 128 caracteres")
    if not any(character.isupper() for character in password):
        raise ValueError("La contraseña debe incluir una letra mayúscula")
    if not any(character.islower() for character in password):
        raise ValueError("La contraseña debe incluir una letra minúscula")
    if not any(character.isdigit() for character in password):
        raise ValueError("La contraseña debe incluir un número")
    if not any(not character.isalnum() and not character.isspace() for character in password):
        raise ValueError("La contraseña debe incluir un carácter especial")
    return password


def create_otp_digest(email: str, nonce: str, otp: str) -> str:
    settings = get_settings()
    message = f"{email}:{nonce}:{otp}".encode()
    return hmac.new(settings.secret_key.encode(), message, hashlib.sha256).hexdigest()


def verify_otp_digest(email: str, nonce: str, otp: str, expected_digest: str) -> bool:
    return hmac.compare_digest(create_otp_digest(email, nonce, otp), expected_digest)


def create_access_token(user_id: int) -> tuple[str, int]:
    settings = get_settings()
    now = datetime.now(UTC)
    expires_in = settings.access_token_expire_minutes * 60
    payload = {
        "sub": str(user_id),
        "sid": str(uuid4()),
        "jti": str(uuid4()),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    return token, expires_in


def decode_access_token(token: str) -> AccessTokenClaims:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "sid", "jti", "type", "iat", "exp"]},
        )
        if payload["type"] != "access":
            raise InvalidTokenError("Unexpected token type")
        user_id = int(payload["sub"])
        session_id = str(payload["sid"])
    except (InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise ValueError("Invalid access token") from exc

    return AccessTokenClaims(user_id=user_id, session_id=session_id)


def create_password_reset_token(user_id: int, nonce: str) -> tuple[str, int]:
    settings = get_settings()
    now = datetime.now(UTC)
    expires_in = settings.password_reset_token_expire_minutes * 60
    payload = {
        "sub": str(user_id),
        "nonce": nonce,
        "jti": str(uuid4()),
        "type": "password_reset",
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    return token, expires_in


def decode_password_reset_token(token: str) -> PasswordResetTokenClaims:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "nonce", "jti", "type", "iat", "exp"]},
        )
        if payload["type"] != "password_reset":
            raise InvalidTokenError("Unexpected token type")
        user_id = int(payload["sub"])
        nonce = str(payload["nonce"])
    except (InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise ValueError("Invalid password reset token") from exc
    return PasswordResetTokenClaims(user_id=user_id, nonce=nonce)
