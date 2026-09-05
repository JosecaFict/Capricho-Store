from datetime import date
from math import ceil

from fastapi import HTTPException, status

from app.modules.audit.repository import AuditRepository
from app.modules.audit.schemas import AuditLogDetail, AuditLogItem, AuditLogPage
from app.modules.auth.models import Bitacora, Usuario


class AuditService:
    def __init__(self, repository: AuditRepository) -> None:
        self.repository = repository

    async def list_logs(
        self,
        *,
        page: int,
        page_size: int,
        modulo: str | None,
        accion: str | None,
        entidad: str | None,
        usuario_id: int | None,
        fecha_desde: date | None,
        fecha_hasta: date | None,
        buscar: str | None,
    ) -> AuditLogPage:
        if fecha_desde and fecha_hasta and fecha_desde > fecha_hasta:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="fecha_desde cannot be after fecha_hasta",
            )
        rows, total = await self.repository.list_logs(
            page=page,
            page_size=page_size,
            modulo=modulo,
            accion=accion,
            entidad=entidad,
            usuario_id=usuario_id,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            buscar=buscar,
        )
        return AuditLogPage(
            items=[self._item(log, user) for log, user in rows],
            page=page,
            page_size=page_size,
            total=total,
            pages=ceil(total / page_size) if total else 0,
        )

    async def get_log(self, audit_id: int) -> AuditLogDetail:
        row = await self.repository.get_log(audit_id)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Audit record not found",
            )
        log, user = row
        return AuditLogDetail(
            **self._item(log, user).model_dump(),
            id_sesion=log.id_sesion,
            user_agent=log.user_agent,
            datos_anteriores=log.datos_anteriores,
            datos_nuevos=log.datos_nuevos,
        )

    @staticmethod
    def _item(log: Bitacora, user: Usuario | None) -> AuditLogItem:
        full_name = f"{user.nombres} {user.apellidos}" if user else None
        return AuditLogItem(
            id_bitacora=log.id_bitacora,
            id_usuario=log.id_usuario,
            usuario=full_name,
            correo_usuario=user.correo if user else None,
            accion=log.accion,
            modulo=log.modulo,
            entidad=log.entidad,
            id_registro=log.id_registro,
            direccion_ip=str(log.direccion_ip) if log.direccion_ip is not None else None,
            origen=log.origen,
            request_id=log.request_id,
            fecha_hora=log.fecha_hora,
        )
