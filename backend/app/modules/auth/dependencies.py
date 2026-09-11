from collections.abc import AsyncIterator, Callable, Coroutine
from dataclasses import dataclass
from typing import Annotated, Any
from uuid import uuid4

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import decode_access_token
from app.db.audit_context import AuditContext, apply_audit_context
from app.db.session import get_db_session
from app.modules.auth.exceptions import (
    InactiveUserError,
    InvalidCredentialsError,
    PermissionDeniedError,
)
from app.modules.auth.models import Usuario
from app.modules.auth.password_recovery import BrevoEmailClient, RedisPasswordResetStore
from app.modules.auth.password_recovery_service import PasswordRecoveryService
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import AuthService

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True, slots=True)
class CurrentPrincipal:
    user: Usuario
    roles: frozenset[str]
    permissions: frozenset[str]
    session_id: str
    id_sucursal: int | None = None
    sucursal: str | None = None


def build_request_audit_context(
    request: Request,
    *,
    user_id: int | None = None,
    session_id: str | None = None,
) -> AuditContext:
    forwarded_for = request.headers.get("x-forwarded-for")
    ip = forwarded_for.split(",", maxsplit=1)[0].strip() if forwarded_for else None
    if ip is None and request.client is not None:
        ip = request.client.host

    return AuditContext(
        usuario_id=user_id,
        sesion_id=session_id or request.headers.get("x-session-id") or str(uuid4()),
        ip=ip,
        user_agent=request.headers.get("user-agent"),
        origen="API",
        request_id=request.headers.get("x-request-id") or str(uuid4()),
    )


async def get_auth_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AsyncIterator[AuthService]:
    yield AuthService(session=session, repository=AuthRepository(session))


async def get_password_recovery_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AsyncIterator[PasswordRecoveryService]:
    settings = get_settings()
    if not settings.redis_url:
        from app.modules.auth.exceptions import SecurityConfigurationError

        raise SecurityConfigurationError("REDIS_URL is missing")
    if not settings.brevo_api_key or not settings.brevo_sender_email:
        from app.modules.auth.exceptions import SecurityConfigurationError

        raise SecurityConfigurationError("Brevo configuration is missing")

    redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        yield PasswordRecoveryService(
            session=session,
            repository=AuthRepository(session),
            store=RedisPasswordResetStore(redis_client),
            email_client=BrevoEmailClient(
                api_key=settings.brevo_api_key,
                sender_email=settings.brevo_sender_email,
                sender_name=settings.brevo_sender_name,
            ),
            settings=settings,
        )
    finally:
        await redis_client.aclose()


async def get_current_principal(
    request: Request,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> CurrentPrincipal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise InvalidCredentialsError

    try:
        claims = decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise InvalidCredentialsError from exc

    repository = AuthRepository(session)
    user = await repository.get_user_by_id(claims.user_id)
    if user is None:
        raise InvalidCredentialsError
    if user.estado != "ACTIVO":
        raise InactiveUserError(user.estado)

    roles = await repository.get_role_names(user.id_usuario)
    permissions = await repository.get_effective_permissions(user.id_usuario)
    employee_branch = await repository.get_employee_branch(user.id_usuario)
    await apply_audit_context(
        session,
        build_request_audit_context(
            request,
            user_id=user.id_usuario,
            session_id=claims.session_id,
        ),
    )
    return CurrentPrincipal(
        user=user,
        roles=frozenset(roles),
        permissions=frozenset(permissions),
        session_id=claims.session_id,
        id_sucursal=employee_branch[0] if employee_branch else None,
        sucursal=employee_branch[1] if employee_branch else None,
    )


async def get_optional_principal(
    request: Request,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> CurrentPrincipal | None:
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None

    try:
        claims = decode_access_token(credentials.credentials)
    except ValueError:
        return None

    repository = AuthRepository(session)
    user = await repository.get_user_by_id(claims.user_id)
    if user is None or user.estado != "ACTIVO":
        return None

    roles = await repository.get_role_names(user.id_usuario)
    permissions = await repository.get_effective_permissions(user.id_usuario)
    employee_branch = await repository.get_employee_branch(user.id_usuario)
    await apply_audit_context(
        session,
        build_request_audit_context(
            request,
            user_id=user.id_usuario,
            session_id=claims.session_id,
        ),
    )
    return CurrentPrincipal(
        user=user,
        roles=frozenset(roles),
        permissions=frozenset(permissions),
        session_id=claims.session_id,
        id_sucursal=employee_branch[0] if employee_branch else None,
        sucursal=employee_branch[1] if employee_branch else None,
    )


PermissionDependency = Callable[
    [CurrentPrincipal],
    Coroutine[Any, Any, CurrentPrincipal],
]


def require_permission(permission_code: str) -> PermissionDependency:
    async def dependency(
        principal: Annotated[CurrentPrincipal, Depends(get_current_principal)],
    ) -> CurrentPrincipal:
        if permission_code not in principal.permissions:
            raise PermissionDeniedError
        return principal

    return dependency
