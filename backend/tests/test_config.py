import pytest
from pydantic import ValidationError

from app.core.config import Settings


def make_settings(database_url: str, cors_origins: str = "") -> Settings:
    return Settings(
        DATABASE_URL=database_url,
        SECRET_KEY="test-secret-key-not-for-production",
        CORS_ORIGINS=cors_origins,
    )


@pytest.mark.parametrize("scheme", ["postgres://", "postgresql://"])
def test_railway_database_url_uses_asyncpg(scheme: str) -> None:
    settings = make_settings(f"{scheme}user:password@postgres.railway.internal:5432/railway")
    assert settings.database_url.startswith("postgresql+asyncpg://")


def test_asyncpg_database_url_is_preserved() -> None:
    url = "postgresql+asyncpg://user:password@localhost:5433/Capricho-Store"
    assert make_settings(url).database_url == url


def test_cors_origins_are_cleaned() -> None:
    settings = make_settings(
        "postgresql://user:password@localhost/database",
        " https://web.example.com/, http://localhost:4200 ",
    )
    assert settings.cors_origin_list == [
        "https://web.example.com",
        "http://localhost:4200",
    ]


def test_invalid_cors_origin_is_rejected() -> None:
    with pytest.raises(ValidationError):
        make_settings(
            "postgresql://user:password@localhost/database",
            "web.example.com",
        )
