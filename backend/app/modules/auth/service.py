from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.db.audit_context import AuditContext, apply_audit_context
from app.modules.auth.exceptions import (
    EmailAlreadyRegisteredError,
    InactiveUserError,
    InvalidCredentialsError,
    SecurityConfigurationError,
)
from app.modules.auth.models import Usuario
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
)


def normalize_email(email: str) -> str:
    return email.strip().lower()


class AuthService:
    def __init__(self, session: AsyncSession, repository: AuthRepository) -> None:
        self.session = session
        self.repository = repository

    async def register_customer(
        self,
        payload: RegisterRequest,
        audit_context: AuditContext,
    ) -> UserResponse:
        email = normalize_email(str(payload.correo))
        try:
            await apply_audit_context(self.session, audit_context)
            if await self.repository.get_user_by_email(email) is not None:
                raise EmailAlreadyRegisteredError

            client_role = await self.repository.get_active_role_by_name("CLIENTE")
            if client_role is None:
                raise SecurityConfigurationError("Active CLIENTE role is missing")

            user = Usuario(
                nombres=payload.nombres,
                apellidos=payload.apellidos,
                correo=email,
                telefono=payload.telefono,
                ci=payload.ci,
                password_hash=hash_password(payload.password.get_secret_value()),
                estado="ACTIVO",
            )
            await self.repository.create_customer_user(user=user, client_role=client_role)
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            if getattr(exc.orig, "sqlstate", None) == "23505" and "correo" in str(exc).lower():
                raise EmailAlreadyRegisteredError from exc
            raise
        except Exception:
            await self.session.rollback()
            raise

        return self._user_response(user, roles={"CLIENTE"}, permissions=set())

    async def login(
        self,
        payload: LoginRequest,
        audit_context: AuditContext,
    ) -> TokenResponse:
        email = normalize_email(str(payload.correo))
        try:
            user = await self.repository.get_user_by_email(email)
            if user is None or not verify_password(
                payload.password.get_secret_value(), user.password_hash
            ):
                raise InvalidCredentialsError
            if user.estado != "ACTIVO":
                raise InactiveUserError(user.estado)

            authenticated_context = AuditContext(
                usuario_id=user.id_usuario,
                sesion_id=audit_context.sesion_id,
                ip=audit_context.ip,
                user_agent=audit_context.user_agent,
                origen=audit_context.origen,
                request_id=audit_context.request_id,
            )
            await apply_audit_context(self.session, authenticated_context)
            user.ultimo_acceso = datetime.now(UTC)
            await self.repository.update_last_access(user)
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        token, expires_in = create_access_token(user.id_usuario)
        return TokenResponse(access_token=token, expires_in=expires_in)

    async def update_profile(
        self,
        user_id: int,
        payload: UpdateProfileRequest,
        audit_context: AuditContext,
    ) -> Usuario:
        try:
            await apply_audit_context(self.session, audit_context)
            user = await self.repository.update_profile(
                user_id,
                nombres=payload.nombres,
                apellidos=payload.apellidos,
                telefono=payload.telefono,
                ci=payload.ci,
            )
            await self.session.commit()
            return user
        except Exception:
            await self.session.rollback()
            raise

    async def change_password(
        self,
        user_id: int,
        payload: ChangePasswordRequest,
        audit_context: AuditContext,
    ) -> None:
        try:
            await apply_audit_context(self.session, audit_context)
            user = await self.repository.get_user_by_id(user_id)
            if user is None or user.estado != "ACTIVO":
                raise InactiveUserError("User not found or inactive")
            if not verify_password(payload.current_password.get_secret_value(), user.password_hash):
                raise InvalidCredentialsError("Current password is incorrect")
            new_hash = hash_password(payload.new_password.get_secret_value())
            await self.repository.update_password(user, new_hash)
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

    @staticmethod
    def _user_response(
        user: Usuario,
        *,
        roles: set[str],
        permissions: set[str],
    ) -> UserResponse:
        return UserResponse(
            id_usuario=user.id_usuario,
            nombres=user.nombres,
            apellidos=user.apellidos,
            correo=user.correo,
            telefono=user.telefono,
            ci=user.ci,
            estado=user.estado,
            created_at=user.created_at,
            roles=sorted(roles),
            permisos=sorted(permissions),
        )

