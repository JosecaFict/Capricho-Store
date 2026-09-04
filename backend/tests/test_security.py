from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_argon2_password_hash_round_trip() -> None:
    password_hash = hash_password("StrongPassword123")

    assert password_hash.startswith("$argon2")
    assert verify_password("StrongPassword123", password_hash)
    assert not verify_password("IncorrectPassword", password_hash)


def test_access_token_round_trip() -> None:
    token, expires_in = create_access_token(42)
    claims = decode_access_token(token)

    assert claims.user_id == 42
    assert claims.session_id
    assert expires_in == 1800

