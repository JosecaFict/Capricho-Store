from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from app.modules.auth.dependencies import (
    CurrentPrincipal,
    build_request_audit_context,
    get_auth_service,
    get_current_principal,
)
from app.modules.auth.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.modules.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register_customer(
    payload: RegisterRequest,
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> UserResponse:
    return await service.register_customer(payload, build_request_audit_context(request))


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    service: Annotated[AuthService, Depends(get_auth_service)],
) -> TokenResponse:
    return await service.login(payload, build_request_audit_context(request))


@router.get("/me", response_model=UserResponse)
async def me(
    principal: Annotated[CurrentPrincipal, Depends(get_current_principal)],
) -> UserResponse:
    user = principal.user
    return UserResponse(
        id_usuario=user.id_usuario,
        nombres=user.nombres,
        apellidos=user.apellidos,
        correo=user.correo,
        telefono=user.telefono,
        ci=user.ci,
        estado=user.estado,
        created_at=user.created_at,
        roles=sorted(principal.roles),
        permisos=sorted(principal.permissions),
    )

