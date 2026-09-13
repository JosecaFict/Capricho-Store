from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

CustomerState = Literal["ACTIVO", "INACTIVO"]


class CustomerAddressItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_direccion: int
    id_ciudad: int
    ciudad: str
    departamento: str
    alias: str | None = None
    zona: str | None = None
    direccion: str
    referencia: str | None = None
    es_principal: bool
    activo: bool


class CustomerAdminSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_cliente: int
    id_usuario: int
    nombres: str
    apellidos: str
    nombre_completo: str
    correo: str
    ci: str | None = None
    telefono: str | None = None
    fecha_nacimiento: date | None = None
    estado: str
    total_pedidos: int = 0
    total_reservas: int = 0
    total_ventas: int = 0
    created_at: datetime
    updated_at: datetime


class CustomerAdminDetail(CustomerAdminSummary):
    direcciones: list[CustomerAddressItem] = Field(default_factory=list)


class CustomerAdminUpdateRequest(BaseModel):
    nombres: str | None = Field(default=None, min_length=1, max_length=100)
    apellidos: str | None = Field(default=None, min_length=1, max_length=100)
    correo: EmailStr | None = None
    telefono: str | None = Field(default=None, max_length=30)
    ci: str | None = Field(default=None, max_length=30)
    fecha_nacimiento: date | None = None
    estado: CustomerState | None = None
    nuevo_password: str | None = Field(default=None, min_length=8, max_length=128)

    @field_validator("nombres", "apellidos")
    @classmethod
    def strip_required_strings(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Value must not be blank")
        return stripped

    @field_validator("telefono", "ci")
    @classmethod
    def strip_optional_strings(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "CustomerAdminUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("At least one field is required to update")
        return self


class CustomerQuickCreateRequest(BaseModel):
    nombres: str = Field(min_length=1, max_length=100)
    apellidos: str = Field(default="", max_length=100)
    ci: str | None = Field(default=None, max_length=30)
    correo: EmailStr | None = None
    telefono: str | None = Field(default=None, max_length=30)

    @field_validator("nombres")
    @classmethod
    def strip_nombres(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("El nombre no puede estar vacío")
        return stripped

    @field_validator("apellidos", "telefono", "ci")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

