from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr, field_validator


class RegisterRequest(BaseModel):
    nombres: str = Field(min_length=1, max_length=100)
    apellidos: str = Field(min_length=1, max_length=100)
    correo: EmailStr
    telefono: str | None = Field(default=None, max_length=30)
    ci: str | None = Field(default=None, max_length=30)
    password: SecretStr = Field(min_length=8, max_length=128)

    @field_validator("nombres", "apellidos")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Value must not be blank")
        return stripped

    @field_validator("telefono", "ci")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class LoginRequest(BaseModel):
    correo: EmailStr
    password: SecretStr


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_usuario: int
    nombres: str
    apellidos: str
    correo: EmailStr
    telefono: str | None
    ci: str | None
    estado: Literal["ACTIVO", "INACTIVO", "BLOQUEADO"]
    created_at: datetime
    roles: list[str] = Field(default_factory=list)
    permisos: list[str] = Field(default_factory=list)


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
