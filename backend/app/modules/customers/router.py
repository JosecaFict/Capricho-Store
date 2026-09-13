from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from app.modules.auth.dependencies import (
    CurrentPrincipal,
    build_request_audit_context,
    require_permission,
)
from app.modules.customers.dependencies import get_customer_admin_service
from app.modules.customers.schemas import (
    CustomerAdminDetail,
    CustomerAdminSummary,
    CustomerAdminUpdateRequest,
)
from app.modules.customers.service import CustomerAdminService

router = APIRouter(tags=["customer administration"])


@router.get("/customers", response_model=list[CustomerAdminSummary])
async def list_customers(
    _: Annotated[CurrentPrincipal, Depends(require_permission("ventas.ver"))],
    service: Annotated[CustomerAdminService, Depends(get_customer_admin_service)],
    q: str | None = Query(default=None),
    estado: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[CustomerAdminSummary]:
    return await service.list_customers(q=q, estado=estado, limit=limit, offset=offset)


@router.get("/customers/{customer_id}", response_model=CustomerAdminDetail)
async def get_customer(
    customer_id: int,
    _: Annotated[CurrentPrincipal, Depends(require_permission("ventas.ver"))],
    service: Annotated[CustomerAdminService, Depends(get_customer_admin_service)],
) -> CustomerAdminDetail:
    return await service.get_customer(customer_id)


@router.patch("/customers/{customer_id}", response_model=CustomerAdminDetail)
async def update_customer(
    customer_id: int,
    payload: CustomerAdminUpdateRequest,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("ventas.ver"))],
    service: Annotated[CustomerAdminService, Depends(get_customer_admin_service)],
) -> CustomerAdminDetail:
    audit_context = build_request_audit_context(
        request,
        user_id=principal.user.id_usuario,
        session_id=principal.session_id,
    )
    return await service.update_customer(
        customer_id=customer_id,
        payload=payload,
        actor=principal,
        audit_context=audit_context,
    )
