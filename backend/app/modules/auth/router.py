from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from app.modules.auth.dependencies import (
    CurrentPrincipal,
    build_request_audit_context,
    get_auth_service,
    get_current_principal,
    get_password_recovery_service,
)
from app.modules.auth.password_recovery_service import PasswordRecoveryService
from app.modules.auth.schemas import (
    LoginRequest,
    MessageResponse,
    PasswordRecoveryRequest,
    PasswordRecoveryVerifyRequest,
    PasswordRecoveryVerifyResponse,
    PasswordResetRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
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


@router.post("/password-recovery/request", response_model=MessageResponse)
async def request_password_recovery(
    payload: PasswordRecoveryRequest,
    service: Annotated[PasswordRecoveryService, Depends(get_password_recovery_service)],
) -> MessageResponse:
    return await service.request_code(payload)


@router.post(
    "/password-recovery/verify",
    response_model=PasswordRecoveryVerifyResponse,
)
async def verify_password_recovery_code(
    payload: PasswordRecoveryVerifyRequest,
    service: Annotated[PasswordRecoveryService, Depends(get_password_recovery_service)],
) -> PasswordRecoveryVerifyResponse:
    return await service.verify_code(payload)


@router.post("/password-recovery/reset", response_model=MessageResponse)
async def reset_password(
    payload: PasswordResetRequest,
    request: Request,
    service: Annotated[PasswordRecoveryService, Depends(get_password_recovery_service)],
) -> MessageResponse:
    return await service.reset_password(payload, build_request_audit_context(request))


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
