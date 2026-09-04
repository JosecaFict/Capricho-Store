from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from app.modules.auth.dependencies import (
    CurrentPrincipal,
    build_request_audit_context,
    require_permission,
)
from app.modules.employees.dependencies import get_employee_service
from app.modules.employees.schemas import (
    EmployeeCreateRequest,
    EmployeePermissionSummary,
    EmployeeResponse,
    EmployeeUpdateRequest,
    PermissionOverrideRequest,
    PermissionResponse,
    RoleAssignmentRequest,
    RoleResponse,
)
from app.modules.employees.service import EmployeeService

router = APIRouter(tags=["employee administration"])


def audit_context_for(request: Request, principal: CurrentPrincipal):
    return build_request_audit_context(
        request,
        user_id=principal.user.id_usuario,
        session_id=principal.session_id,
    )


@router.get("/employees", response_model=list[EmployeeResponse])
async def list_employees(
    _: Annotated[CurrentPrincipal, Depends(require_permission("empleados.ver"))],
    service: Annotated[EmployeeService, Depends(get_employee_service)],
) -> list[EmployeeResponse]:
    return await service.list_employees()


@router.get("/employees/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: int,
    _: Annotated[CurrentPrincipal, Depends(require_permission("empleados.ver"))],
    service: Annotated[EmployeeService, Depends(get_employee_service)],
) -> EmployeeResponse:
    return await service.get_employee(employee_id)


@router.post(
    "/employees",
    response_model=EmployeeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_employee(
    payload: EmployeeCreateRequest,
    request: Request,
    principal: Annotated[
        CurrentPrincipal,
        Depends(require_permission("empleados.crear")),
    ],
    service: Annotated[EmployeeService, Depends(get_employee_service)],
) -> EmployeeResponse:
    return await service.create_employee(
        payload,
        actor=principal,
        audit_context=audit_context_for(request, principal),
    )


@router.patch("/employees/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    payload: EmployeeUpdateRequest,
    request: Request,
    principal: Annotated[
        CurrentPrincipal,
        Depends(require_permission("empleados.editar")),
    ],
    service: Annotated[EmployeeService, Depends(get_employee_service)],
) -> EmployeeResponse:
    return await service.update_employee(
        employee_id,
        payload,
        audit_context=audit_context_for(request, principal),
    )


@router.get("/roles", response_model=list[RoleResponse])
async def list_roles(
    _: Annotated[CurrentPrincipal, Depends(require_permission("permisos.asignar"))],
    service: Annotated[EmployeeService, Depends(get_employee_service)],
) -> list[RoleResponse]:
    return await service.list_roles()


@router.get("/permissions", response_model=list[PermissionResponse])
async def list_permissions(
    _: Annotated[CurrentPrincipal, Depends(require_permission("permisos.asignar"))],
    service: Annotated[EmployeeService, Depends(get_employee_service)],
) -> list[PermissionResponse]:
    return await service.list_permissions()


@router.get(
    "/employees/{employee_id}/permissions",
    response_model=EmployeePermissionSummary,
)
async def get_employee_permissions(
    employee_id: int,
    _: Annotated[CurrentPrincipal, Depends(require_permission("permisos.asignar"))],
    service: Annotated[EmployeeService, Depends(get_employee_service)],
) -> EmployeePermissionSummary:
    return await service.get_employee_permissions(employee_id)


@router.put(
    "/employees/{employee_id}/permissions/{permission_id}",
    response_model=EmployeePermissionSummary,
)
async def set_employee_permission(
    employee_id: int,
    permission_id: int,
    payload: PermissionOverrideRequest,
    request: Request,
    principal: Annotated[
        CurrentPrincipal,
        Depends(require_permission("permisos.asignar")),
    ],
    service: Annotated[EmployeeService, Depends(get_employee_service)],
) -> EmployeePermissionSummary:
    return await service.set_permission_override(
        employee_id,
        permission_id,
        granted=payload.otorgado,
        actor=principal,
        audit_context=audit_context_for(request, principal),
    )


@router.put("/employees/{employee_id}/role", response_model=EmployeeResponse)
async def change_employee_role(
    employee_id: int,
    payload: RoleAssignmentRequest,
    request: Request,
    principal: Annotated[
        CurrentPrincipal,
        Depends(require_permission("permisos.asignar")),
    ],
    service: Annotated[EmployeeService, Depends(get_employee_service)],
) -> EmployeeResponse:
    return await service.change_role(
        employee_id,
        payload.id_rol,
        actor=principal,
        audit_context=audit_context_for(request, principal),
    )

