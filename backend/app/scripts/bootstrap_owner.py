"""Crea el primer dueño/administrador de Capricho Store.

Uso interactivo:
    python -m app.scripts.bootstrap_owner
"""

import argparse
import asyncio
from dataclasses import dataclass
from getpass import getpass

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.audit_context import AuditContext, apply_audit_context
from app.db.session import async_session_factory, engine
from app.modules.auth.models import Empleado, Rol, Sucursal, Usuario, UsuarioRol
from app.modules.auth.service import normalize_email


class BootstrapError(RuntimeError):
    """Error esperado al preparar la primera cuenta administrativa."""


@dataclass(frozen=True, slots=True)
class OwnerData:
    nombres: str
    apellidos: str
    correo: str
    ci: str
    telefono: str | None
    password: str
    id_sucursal: int
    cargo_descriptivo: str


@dataclass(frozen=True, slots=True)
class InitialBranchData:
    ciudad: str
    departamento: str
    pais: str
    nombre: str
    direccion: str
    telefono: str | None


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Crea la primera cuenta de dueño con rol ADMIN.",
    )
    parser.add_argument("--nombres")
    parser.add_argument("--apellidos")
    parser.add_argument("--correo")
    parser.add_argument("--ci")
    parser.add_argument("--telefono")
    parser.add_argument("--id-sucursal", type=int)
    parser.add_argument("--cargo", default="Dueño / Administrador")
    parser.add_argument(
        "--list-branches",
        action="store_true",
        help="Muestra las sucursales disponibles y termina.",
    )
    return parser


async def _prompt(label: str, *, secret: bool = False) -> str:
    reader = getpass if secret else input
    return await asyncio.to_thread(reader, label)


async def _required(value: str | None, label: str) -> str:
    result = (
        value.strip()
        if value is not None
        else (await _prompt(f"{label}: ")).strip()
    )
    if not result:
        raise BootstrapError(f"{label} es obligatorio.")
    return result


async def _read_password() -> str:
    password = await _prompt("Contraseña (no se mostrará): ", secret=True)
    if not 8 <= len(password) <= 128:
        raise BootstrapError("La contraseña debe tener entre 8 y 128 caracteres.")
    confirmation = await _prompt("Repite la contraseña: ", secret=True)
    if password != confirmation:
        raise BootstrapError("Las contraseñas no coinciden.")
    return password


def _validate_email(value: str) -> str:
    try:
        validated = TypeAdapter(EmailStr).validate_python(value)
    except ValidationError as exc:
        raise BootstrapError("El correo no tiene un formato válido.") from exc
    return normalize_email(str(validated))


async def _list_branches(session: AsyncSession) -> list[Sucursal]:
    statement = select(Sucursal).order_by(Sucursal.id_sucursal)
    return list((await session.scalars(statement)).all())


def _print_branches(branches: list[Sucursal]) -> None:
    print("\nSucursales disponibles:")
    for branch in branches:
        state = "ACTIVA" if branch.activo else "INACTIVA"
        print(f"  {branch.id_sucursal}: {branch.nombre} — {state}")
    print()


async def _read_initial_branch() -> InitialBranchData:
    print("\nLa base todavía no tiene sucursales.")
    confirmation = (await _prompt("¿Crear ahora la sucursal inicial? Escribe SI: ")).strip()
    if confirmation != "SI":
        raise BootstrapError("Debes crear una sucursal antes de crear al dueño.")
    return InitialBranchData(
        ciudad=await _required(None, "Ciudad"),
        departamento=await _required(None, "Departamento"),
        pais=(await _prompt("País [Bolivia]: ")).strip() or "Bolivia",
        nombre=await _required(None, "Nombre de la sucursal"),
        direccion=await _required(None, "Dirección de la sucursal"),
        telefono=(await _prompt("Teléfono de sucursal (opcional): ")).strip() or None,
    )


async def create_initial_branch(
    session: AsyncSession,
    data: InitialBranchData,
) -> Sucursal:
    city_id = await session.scalar(
        text(
            """
            INSERT INTO capricho.ciudad (nombre, departamento, pais)
            VALUES (:nombre, :departamento, :pais)
            ON CONFLICT (nombre, departamento, pais)
            DO UPDATE SET updated_at = capricho.ciudad.updated_at
            RETURNING id_ciudad
            """
        ),
        {
            "nombre": data.ciudad,
            "departamento": data.departamento,
            "pais": data.pais,
        },
    )
    if city_id is None:
        raise BootstrapError("No se pudo obtener la ciudad de la sucursal.")
    branch_id = await session.scalar(
        text(
            """
            INSERT INTO capricho.sucursal (
                id_ciudad, nombre, direccion, telefono, activo
            )
            VALUES (:id_ciudad, :nombre, :direccion, :telefono, TRUE)
            RETURNING id_sucursal
            """
        ),
        {
            "id_ciudad": city_id,
            "nombre": data.nombre,
            "direccion": data.direccion,
            "telefono": data.telefono,
        },
    )
    if branch_id is None:
        raise BootstrapError("No se pudo crear la sucursal inicial.")
    branch = await session.get(Sucursal, branch_id)
    if branch is None:
        raise BootstrapError("No se pudo recuperar la sucursal inicial.")
    return branch


async def create_owner(session: AsyncSession, data: OwnerData) -> tuple[Usuario, Empleado]:
    admin_role = (
        await session.scalars(select(Rol).where(func.upper(Rol.nombre) == "ADMIN"))
    ).one_or_none()
    if admin_role is None or not admin_role.activo:
        raise BootstrapError("El rol ADMIN no existe o está inactivo.")

    existing_admin = await session.scalar(
        select(Usuario.id_usuario)
        .join(UsuarioRol, UsuarioRol.id_usuario == Usuario.id_usuario)
        .where(UsuarioRol.id_rol == admin_role.id_rol)
        .limit(1)
    )
    if existing_admin is not None:
        raise BootstrapError(
            "Ya existe una cuenta con rol ADMIN. Usa esa cuenta para crear más empleados."
        )

    branch = await session.get(Sucursal, data.id_sucursal)
    if branch is None:
        raise BootstrapError("La sucursal indicada no existe.")
    if not branch.activo:
        raise BootstrapError("La sucursal indicada está inactiva.")

    existing_email = await session.scalar(
        select(Usuario.id_usuario).where(func.lower(Usuario.correo) == data.correo)
    )
    if existing_email is not None:
        raise BootstrapError("El correo ya está registrado.")
    existing_ci = await session.scalar(
        select(Usuario.id_usuario).where(Usuario.ci == data.ci)
    )
    if existing_ci is not None:
        raise BootstrapError("El CI ya está registrado.")

    user = Usuario(
        nombres=data.nombres,
        apellidos=data.apellidos,
        correo=data.correo,
        telefono=data.telefono,
        ci=data.ci,
        password_hash=hash_password(data.password),
        estado="ACTIVO",
    )
    session.add(user)
    await session.flush()

    employee = Empleado(
        id_usuario=user.id_usuario,
        id_sucursal=branch.id_sucursal,
        cargo_descriptivo=data.cargo_descriptivo,
        estado_laboral="ACTIVO",
    )
    session.add_all(
        [
            employee,
            UsuarioRol(id_usuario=user.id_usuario, id_rol=admin_role.id_rol),
        ]
    )
    await session.flush()
    return user, employee


async def run(args: argparse.Namespace) -> None:
    async with async_session_factory() as session:
        branches = await _list_branches(session)
        if args.list_branches:
            if branches:
                _print_branches(branches)
            else:
                print("\nNo existen sucursales registradas.")
            return

        initial_branch: InitialBranchData | None = None
        branch_id = args.id_sucursal
        if not branches:
            if branch_id is not None:
                raise BootstrapError("No existe ninguna sucursal para el ID indicado.")
            initial_branch = await _read_initial_branch()
        else:
            _print_branches(branches)
        if branches and branch_id is None:
            raw_branch = (await _prompt("ID de sucursal para el dueño: ")).strip()
            try:
                branch_id = int(raw_branch)
            except ValueError as exc:
                raise BootstrapError("El ID de sucursal debe ser un número entero.") from exc

        names = await _required(args.nombres, "Nombres")
        surnames = await _required(args.apellidos, "Apellidos")
        email = _validate_email(await _required(args.correo, "Correo"))
        ci = await _required(args.ci, "CI")
        phone = args.telefono
        if phone is None:
            phone = (await _prompt("Teléfono personal (opcional): ")).strip() or None
        password = await _read_password()

        print("\nSe creará la primera cuenta ADMIN. La cuenta cliente existente no cambiará.")
        confirmation = (await _prompt("Escribe CREAR para confirmar: ")).strip()
        if confirmation != "CREAR":
            raise BootstrapError("Operación cancelada; no se guardó ningún cambio.")

        try:
            await apply_audit_context(
                session,
                AuditContext(
                    origen="SISTEMA",
                    user_agent="bootstrap_owner",
                    request_id="initial-owner-bootstrap",
                ),
            )
            if initial_branch is not None:
                branch = await create_initial_branch(session, initial_branch)
                branch_id = branch.id_sucursal
            if branch_id is None:  # Defensa para el verificador de tipos.
                raise BootstrapError("No se seleccionó una sucursal.")
            data = OwnerData(
                nombres=names,
                apellidos=surnames,
                correo=email,
                ci=ci,
                telefono=phone,
                password=password,
                id_sucursal=branch_id,
                cargo_descriptivo=args.cargo.strip() or "Dueño / Administrador",
            )
            user, employee = await create_owner(session, data)
            await session.commit()
        except Exception:
            await session.rollback()
            raise

        print("\nDueño creado correctamente.")
        print(f"  Usuario: {user.id_usuario}")
        print(f"  Empleado: {employee.id_empleado}")
        print(f"  Correo: {user.correo}")
        print("  Rol: ADMIN")


async def async_main() -> int:
    args = build_parser().parse_args()
    try:
        await run(args)
    except BootstrapError as exc:
        print(f"\nNo se creó la cuenta: {exc}")
        return 1
    except IntegrityError:
        print("\nNo se creó la cuenta: el correo, CI o rol ya está registrado.")
        return 1
    except SQLAlchemyError as exc:
        print(f"\nNo se creó la cuenta: PostgreSQL no está disponible ({type(exc).__name__}).")
        return 1
    finally:
        await engine.dispose()
    return 0


def main() -> None:
    try:
        raise SystemExit(asyncio.run(async_main()))
    except KeyboardInterrupt:
        print("\nOperación cancelada; no se guardó ningún cambio.")
        raise SystemExit(130) from None


if __name__ == "__main__":
    main()
