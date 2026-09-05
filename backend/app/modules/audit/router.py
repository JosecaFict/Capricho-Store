from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query

from app.modules.audit.dependencies import get_audit_service
from app.modules.audit.schemas import AuditLogDetail, AuditLogPage
from app.modules.audit.service import AuditService
from app.modules.auth.dependencies import CurrentPrincipal, require_permission

router = APIRouter(prefix="/audit-logs", tags=["security audit"])


@router.get("", response_model=AuditLogPage)
async def list_audit_logs(
    _: Annotated[CurrentPrincipal, Depends(require_permission("permisos.asignar"))],
    service: Annotated[AuditService, Depends(get_audit_service)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
    modulo: str | None = None,
    accion: str | None = None,
    entidad: str | None = None,
    usuario_id: Annotated[int | None, Query(gt=0)] = None,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    buscar: Annotated[str | None, Query(max_length=120)] = None,
) -> AuditLogPage:
    return await service.list_logs(
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


@router.get("/{audit_id}", response_model=AuditLogDetail)
async def get_audit_log(
    audit_id: Annotated[int, Path(gt=0)],
    _: Annotated[CurrentPrincipal, Depends(require_permission("permisos.asignar"))],
    service: Annotated[AuditService, Depends(get_audit_service)],
) -> AuditLogDetail:
    return await service.get_log(audit_id)
