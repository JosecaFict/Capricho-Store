from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration loaded from environment variables or a local .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = Field(alias="DATABASE_URL")
    app_name: str = Field(default="Capricho Store API", alias="APP_NAME")
    app_env: Literal["development", "test", "staging", "production"] = Field(
        default="development",
        alias="APP_ENV",
    )
    debug: bool = Field(default=False, alias="DEBUG")
    secret_key: str = Field(alias="SECRET_KEY", min_length=32)
    jwt_algorithm: Literal["HS256", "HS384", "HS512"] = Field(
        default="HS256",
        alias="JWT_ALGORITHM",
    )
    access_token_expire_minutes: int = Field(
        default=30,
        alias="ACCESS_TOKEN_EXPIRE_MINUTES",
        ge=1,
        le=1440,
    )
    cors_origins: str = Field(default="", alias="CORS_ORIGINS")
    redis_url: str | None = Field(default=None, alias="REDIS_URL")
    cloudinary_url: str | None = Field(default=None, alias="CLOUDINARY_URL")
    brevo_api_key: str | None = Field(default=None, alias="BREVO_API_KEY")
    brevo_sender_email: str | None = Field(default=None, alias="BREVO_SENDER_EMAIL")
    brevo_sender_name: str = Field(default="Capricho Store", alias="BREVO_SENDER_NAME")
    password_reset_otp_expire_minutes: int = Field(
        default=10,
        alias="PASSWORD_RESET_OTP_EXPIRE_MINUTES",
        ge=5,
        le=30,
    )
    password_reset_otp_max_attempts: int = Field(
        default=5,
        alias="PASSWORD_RESET_OTP_MAX_ATTEMPTS",
        ge=3,
        le=10,
    )
    password_reset_request_cooldown_seconds: int = Field(
        default=60,
        alias="PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS",
        ge=30,
        le=600,
    )
    password_reset_token_expire_minutes: int = Field(
        default=10,
        alias="PASSWORD_RESET_TOKEN_EXPIRE_MINUTES",
        ge=5,
        le=30,
    )
    database_schema: Literal["capricho"] = "capricho"

    @field_validator("database_url")
    @classmethod
    def validate_async_database_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+asyncpg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+asyncpg://", 1)
        if not value.startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL must use the postgresql+asyncpg driver")
        return value

    @field_validator("cors_origins")
    @classmethod
    def validate_cors_origins(cls, value: str) -> str:
        origins = [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        if any(not origin.startswith(("http://", "https://")) for origin in origins):
            raise ValueError("CORS_ORIGINS must contain comma-separated HTTP(S) origins")
        return ",".join(origins)

    @property
    def cors_origin_list(self) -> list[str]:
        return self.cors_origins.split(",") if self.cors_origins else []


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
