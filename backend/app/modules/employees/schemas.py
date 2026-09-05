from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, SecretStr, field_validator, model_validator

EmployeeState = Literal["ACTIVO", "INACTIVO", "SUSPENDIDO"]
UserState = Literal["ACTIVO", "INACTIVO", "BLOQUEADO"]


class EmployeeCreateRequest(BaseModel):
    nombres: str = Field(min_length=1, max_length=100)
    apellidos: str = Field(min_length=1, max_length=100)
    correo: EmailStr
    telefono: str | None = Field(default=None, max_length=30)
    ci: str = Field(min_length=1, max_length=30)
    password: SecretStr = Field(min_length=8, max_length=128)
    id_sucursal: int = Field(gt=0)
    id_rol: int = Field(gt=0)
    cargo_descriptivo: str | None = Field(default=None, max_length=100)
    fecha_contratacion: date | None = None

    @field_validator("nombres", "apellidos", "ci")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Value must not be blank")
        return stripped

    @field_validator("telefono", "cargo_descriptivo")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class EmployeeUpdateRequest(BaseModel):
    nombres: str | None = Field(default=None, min_length=1, max_length=100)
    apellidos: str | None = Field(default=None, min_length=1, max_length=100)
    correo: EmailStr | None = None
    telefono: str | None = Field(default=None, max_length=30)
    ci: str | None = Field(default=None, min_length=1, max_length=30)
    id_sucursal: int | None = Field(default=None, gt=0)
    cargo_descriptivo: str | None = Field(default=None, max_length=100)
    fecha_contratacion: date | None = None
    estado_laboral: EmployeeState | None = None

    @field_validator("nombres", "apellidos", "ci")
    @classmethod
    def strip_present_required_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Value must not be blank")
        return stripped

    @field_validator("telefono", "cargo_descriptivo")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "EmployeeUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("At least one field is required")
        return self


class EmployeeResponse(BaseModel):
    id_empleado: int
    id_usuario: int
    nombres: str
    apellidos: str
    correo: EmailStr
    telefono: str | None
    ci: str
    estado_usuario: UserState
    id_sucursal: int
    sucursal: str
    cargo_descriptivo: str | None
    fecha_contratacion: date
    estado_laboral: EmployeeState
    roles: list[str]
    created_at: datetime
    updated_at: datetime


class RoleResponse(BaseModel):
    id_rol: int
    nombre: str
    descripcion: str | None


class PermissionResponse(BaseModel):
    id_permiso: int
    codigo: str
    nombre: str
    descripcion: str | None
    modulo: str


class RoleAssignmentRequest(BaseModel):
    id_rol: int = Field(gt=0)


class PermissionOverrideRequest(BaseModel):
    otorgado: bool


class RolePermissionUpdate(BaseModel):
    habilitado: bool


class RolePermissionSummary(BaseModel):
    id_rol: int
    nombre: str
    permisos: list[str]


class EmployeePermissionSummary(BaseModel):
    id_empleado: int
    id_usuario: int
    roles_asignados: list[str]
    permisos_heredados: list[str]
    permisos_individuales_otorgados: list[str]
    permisos_individuales_revocados: list[str]
    permisos_efectivos: list[str]
