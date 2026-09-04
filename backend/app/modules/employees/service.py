from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.audit_context import AuditContext, apply_audit_context
from app.modules.auth.dependencies import CurrentPrincipal
from app.modules.auth.exceptions import PermissionDeniedError
from app.modules.auth.models import Empleado, Rol, Usuario
from app.modules.auth.service import normalize_email
from app.modules.employees.exceptions import (
    InvalidEmployeeDataError,
    ResourceConflictError,
    ResourceNotFoundError,
)
from app.modules.employees.repository import (
    MANAGED_EMPLOYEE_ROLES,
    EmployeeRecord,
    EmployeeRepository,
)
from app.modules.employees.schemas import (
    EmployeeCreateRequest,
    EmployeePermissionSummary,
    EmployeeResponse,
    EmployeeUpdateRequest,
    PermissionResponse,
    RoleResponse,
)

OPERATIONAL_ROLES = frozenset(
    {"ENCARGADO_SUCURSAL", "CAJERO", "AUXILIAR_INVENTARIO"}
)


class EmployeeService:
    def __init__(self, session: AsyncSession, repository: EmployeeRepository) -> None:
        self.session = session
        self.repository = repository

    async def list_employees(self) -> list[EmployeeResponse]:
        records = await self.repository.list_employees()
        return [self._employee_response(record) for record in records]

    async def get_employee(self, employee_id: int) -> EmployeeResponse:
        return self._employee_response(await self._require_employee(employee_id))

    async def list_roles(self) -> list[RoleResponse]:
        return [
            RoleResponse(id_rol=role.id_rol, nombre=role.nombre, descripcion=role.descripcion)
            for role in await self.repository.list_active_roles()
        ]

    async def list_permissions(self) -> list[PermissionResponse]:
        return [
            PermissionResponse(
                id_permiso=permission.id_permiso,
                codigo=permission.codigo,
                nombre=permission.nombre,
                descripcion=permission.descripcion,
                modulo=permission.modulo,
            )
            for permission in await self.repository.list_active_permissions()
        ]

    async def create_employee(
        self,
        payload: EmployeeCreateRequest,
        *,
        actor: CurrentPrincipal,
        audit_context: AuditContext,
    ) -> EmployeeResponse:
        email = normalize_email(str(payload.correo))
        try:
            await apply_audit_context(self.session, audit_context)
            if await self.repository.get_user_by_email(email) is not None:
                raise ResourceConflictError("Email already registered")
            if await self.repository.get_user_by_ci(payload.ci) is not None:
                raise ResourceConflictError("CI already registered")

            branch = await self.repository.get_branch(payload.id_sucursal)
            if branch is None:
                raise ResourceNotFoundError("Branch not found")
            if not branch.activo:
                raise InvalidEmployeeDataError("Branch is inactive")

            role = await self._validate_assignable_role(payload.id_rol, actor)
            user = Usuario(
                nombres=payload.nombres,
                apellidos=payload.apellidos,
                correo=email,
                telefono=payload.telefono,
                ci=payload.ci,
                password_hash=hash_password(payload.password.get_secret_value()),
                estado="ACTIVO",
            )
            employee_values = {
                "id_sucursal": payload.id_sucursal,
                "cargo_descriptivo": payload.cargo_descriptivo,
                "estado_laboral": "ACTIVO",
            }
            if payload.fecha_contratacion is not None:
                employee_values["fecha_contratacion"] = payload.fecha_contratacion
            employee = Empleado(**employee_values)
            record = await self.repository.create_employee(
                user=user,
                employee=employee,
                role=role,
            )
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            self._raise_integrity_conflict(exc)
            raise
        except Exception:
            await self.session.rollback()
            raise

        return self._employee_response(record)

    async def update_employee(
        self,
        employee_id: int,
        payload: EmployeeUpdateRequest,
        *,
        audit_context: AuditContext,
    ) -> EmployeeResponse:
        try:
            await apply_audit_context(self.session, audit_context)
            record = await self._require_employee(employee_id)
            fields = payload.model_fields_set

            if "correo" in fields:
                if payload.correo is None:
                    raise InvalidEmployeeDataError("Email cannot be null")
                email = normalize_email(str(payload.correo))
                existing = await self.repository.get_user_by_email(email)
                if existing is not None and existing.id_usuario != record.user.id_usuario:
                    raise ResourceConflictError("Email already registered")
                record.user.correo = email

            if "ci" in fields:
                if payload.ci is None:
                    raise InvalidEmployeeDataError("CI is required for employees")
                existing = await self.repository.get_user_by_ci(payload.ci)
                if existing is not None and existing.id_usuario != record.user.id_usuario:
                    raise ResourceConflictError("CI already registered")
                record.user.ci = payload.ci

            if "id_sucursal" in fields:
                if payload.id_sucursal is None:
                    raise InvalidEmployeeDataError("Branch cannot be null")
                branch = await self.repository.get_branch(payload.id_sucursal)
                if branch is None:
                    raise ResourceNotFoundError("Branch not found")
                if not branch.activo:
                    raise InvalidEmployeeDataError("Branch is inactive")
                record.employee.id_sucursal = branch.id_sucursal
                record = EmployeeRecord(record.employee, record.user, branch, record.roles)

            self._apply_simple_updates(record, payload)
            # The existing database audits usuario, but not empleado. Touching the
            # associated user guarantees the official bitacora trigger records every
            # administrative employee update without writing bitacora manually.
            record.user.updated_at = datetime.now(UTC)
            await self.repository.flush_employee_update(record)
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            self._raise_integrity_conflict(exc)
            raise
        except Exception:
            await self.session.rollback()
            raise

        return self._employee_response(record)

    async def get_employee_permissions(self, employee_id: int) -> EmployeePermissionSummary:
        record = await self._require_employee(employee_id)
        return await self._permission_summary(record)

    async def set_permission_override(
        self,
        employee_id: int,
        permission_id: int,
        *,
        granted: bool,
        actor: CurrentPrincipal,
        audit_context: AuditContext,
    ) -> EmployeePermissionSummary:
        try:
            await apply_audit_context(self.session, audit_context)
            record = await self._require_employee(employee_id)
            permission = await self.repository.get_permission(permission_id)
            if permission is None:
                raise ResourceNotFoundError("Permission not found")
            if not permission.activo:
                raise InvalidEmployeeDataError("Permission is inactive")
            await self.repository.upsert_permission_override(
                user_id=record.user.id_usuario,
                permission_id=permission.id_permiso,
                granted=granted,
                assigned_by=actor.user.id_usuario,
            )
            summary = await self._permission_summary(record)
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise
        return summary

    async def change_role(
        self,
        employee_id: int,
        role_id: int,
        *,
        actor: CurrentPrincipal,
        audit_context: AuditContext,
    ) -> EmployeeResponse:
        try:
            await apply_audit_context(self.session, audit_context)
            record = await self._require_employee(employee_id)
            role = await self._validate_assignable_role(role_id, actor)
            await self.repository.assign_employee_role(
                user_id=record.user.id_usuario,
                role=role,
            )
            await self.session.commit()
            record = EmployeeRecord(
                record.employee,
                record.user,
                record.branch,
                frozenset((record.roles - MANAGED_EMPLOYEE_ROLES) | {role.nombre}),
            )
        except Exception:
            await self.session.rollback()
            raise
        return self._employee_response(record)

    async def _require_employee(self, employee_id: int) -> EmployeeRecord:
        record = await self.repository.get_employee(employee_id)
        if record is None:
            raise ResourceNotFoundError("Employee not found")
        return record

    async def _validate_assignable_role(
        self,
        role_id: int,
        actor: CurrentPrincipal,
    ) -> Rol:
        role = await self.repository.get_role(role_id)
        if role is None:
            raise ResourceNotFoundError("Role not found")
        if not role.activo:
            raise InvalidEmployeeDataError("Role is inactive")
        if role.nombre not in MANAGED_EMPLOYEE_ROLES:
            raise InvalidEmployeeDataError("Role is not valid for an employee")
        if role.nombre == "ADMIN" and "ADMIN" not in actor.roles:
            raise PermissionDeniedError
        if role.nombre != "ADMIN" and role.nombre not in OPERATIONAL_ROLES:
            raise InvalidEmployeeDataError("Role is not operational")
        return role

    @staticmethod
    def _apply_simple_updates(
        record: EmployeeRecord,
        payload: EmployeeUpdateRequest,
    ) -> None:
        fields = payload.model_fields_set
        if "nombres" in fields:
            if payload.nombres is None:
                raise InvalidEmployeeDataError("Names cannot be null")
            record.user.nombres = payload.nombres
        if "apellidos" in fields:
            if payload.apellidos is None:
                raise InvalidEmployeeDataError("Last names cannot be null")
            record.user.apellidos = payload.apellidos
        if "telefono" in fields:
            record.user.telefono = payload.telefono
        if "cargo_descriptivo" in fields:
            record.employee.cargo_descriptivo = payload.cargo_descriptivo
        if "fecha_contratacion" in fields:
            if payload.fecha_contratacion is None:
                raise InvalidEmployeeDataError("Hiring date cannot be null")
            record.employee.fecha_contratacion = payload.fecha_contratacion
        if "estado_laboral" in fields:
            if payload.estado_laboral is None:
                raise InvalidEmployeeDataError("Employment state cannot be null")
            record.employee.estado_laboral = payload.estado_laboral
            if payload.estado_laboral == "INACTIVO":
                record.user.estado = "INACTIVO"
            elif payload.estado_laboral == "ACTIVO":
                record.user.estado = "ACTIVO"

    async def _permission_summary(
        self,
        record: EmployeeRecord,
    ) -> EmployeePermissionSummary:
        roles, inherited, overrides, effective = await self.repository.get_employee_permissions(
            record.user.id_usuario
        )
        granted = {code for code, value in overrides.items() if value}
        revoked = {code for code, value in overrides.items() if not value}
        return EmployeePermissionSummary(
            id_empleado=record.employee.id_empleado,
            id_usuario=record.user.id_usuario,
            roles_asignados=sorted(roles),
            permisos_heredados=sorted(inherited),
            permisos_individuales_otorgados=sorted(granted),
            permisos_individuales_revocados=sorted(revoked),
            permisos_efectivos=sorted(effective),
        )

    @staticmethod
    def _employee_response(record: EmployeeRecord) -> EmployeeResponse:
        return EmployeeResponse(
            id_empleado=record.employee.id_empleado,
            id_usuario=record.user.id_usuario,
            nombres=record.user.nombres,
            apellidos=record.user.apellidos,
            correo=record.user.correo,
            telefono=record.user.telefono,
            ci=record.user.ci,
            estado_usuario=record.user.estado,
            id_sucursal=record.branch.id_sucursal,
            sucursal=record.branch.nombre,
            cargo_descriptivo=record.employee.cargo_descriptivo,
            fecha_contratacion=record.employee.fecha_contratacion,
            estado_laboral=record.employee.estado_laboral,
            roles=sorted(record.roles),
            created_at=record.employee.created_at,
            updated_at=record.employee.updated_at,
        )

    @staticmethod
    def _raise_integrity_conflict(exc: IntegrityError) -> None:
        message = str(exc).lower()
        if "correo" in message:
            raise ResourceConflictError("Email already registered") from exc
        if "ci" in message:
            raise ResourceConflictError("CI already registered") from exc
