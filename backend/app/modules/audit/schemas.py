from datetime import datetime

from pydantic import BaseModel, Field


class AuditLogItem(BaseModel):
    id_bitacora: int
    id_usuario: int | None
    usuario: str | None
    correo_usuario: str | None
    accion: str
    modulo: str
    entidad: str
    id_registro: str | None
    direccion_ip: str | None
    origen: str | None
    request_id: str | None
    fecha_hora: datetime


class AuditLogDetail(AuditLogItem):
    id_sesion: str | None
    user_agent: str | None
    datos_anteriores: dict | None
    datos_nuevos: dict | None


class AuditLogPage(BaseModel):
    items: list[AuditLogItem]
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total: int = Field(ge=0)
    pages: int = Field(ge=0)
