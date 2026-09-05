from app.core.security import (
    create_access_token,
    create_otp_digest,
    create_password_reset_token,
    decode_access_token,
    decode_password_reset_token,
    hash_password,
    verify_otp_digest,
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


def test_otp_digest_never_contains_the_code() -> None:
    digest = create_otp_digest("ana@example.com", "nonce-1", "123456")

    assert "123456" not in digest
    assert verify_otp_digest("ana@example.com", "nonce-1", "123456", digest)
    assert not verify_otp_digest("ana@example.com", "nonce-1", "654321", digest)


def test_password_reset_token_round_trip() -> None:
    token, expires_in = create_password_reset_token(42, "nonce-1")
    claims = decode_password_reset_token(token)

    assert claims.user_id == 42
    assert claims.nonce == "nonce-1"
    assert expires_in == 600
