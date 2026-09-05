from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import Bitacora, Usuario


class AuditRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def _filtered_statement(
        *,
        modulo: str | None,
        accion: str | None,
        entidad: str | None,
        usuario_id: int | None,
        fecha_desde: date | None,
        fecha_hasta: date | None,
        buscar: str | None,
    ) -> Select:
        statement = select(Bitacora).outerjoin(
            Usuario,
            Usuario.id_usuario == Bitacora.id_usuario,
        )
        if modulo:
            statement = statement.where(Bitacora.modulo == modulo.upper())
        if accion:
            statement = statement.where(Bitacora.accion == accion.upper())
        if entidad:
            statement = statement.where(Bitacora.entidad.ilike(f"%{entidad.strip()}%"))
        if usuario_id is not None:
            statement = statement.where(Bitacora.id_usuario == usuario_id)
        if fecha_desde:
            start = datetime.combine(fecha_desde, time.min, tzinfo=UTC)
            statement = statement.where(Bitacora.fecha_hora >= start)
        if fecha_hasta:
            end = datetime.combine(fecha_hasta + timedelta(days=1), time.min, tzinfo=UTC)
            statement = statement.where(Bitacora.fecha_hora < end)
        if buscar:
            pattern = f"%{buscar.strip()}%"
            statement = statement.where(
                or_(
                    Bitacora.entidad.ilike(pattern),
                    Bitacora.id_registro.ilike(pattern),
                    Bitacora.request_id.ilike(pattern),
                    Usuario.nombres.ilike(pattern),
                    Usuario.apellidos.ilike(pattern),
                    Usuario.correo.ilike(pattern),
                )
            )
        return statement

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
    ) -> tuple[list[tuple[Bitacora, Usuario | None]], int]:
        filtered = self._filtered_statement(
            modulo=modulo,
            accion=accion,
            entidad=entidad,
            usuario_id=usuario_id,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            buscar=buscar,
        )
        count_statement = select(func.count()).select_from(filtered.subquery())
        total = int((await self.session.scalar(count_statement)) or 0)
        statement = (
            filtered.add_columns(Usuario)
            .order_by(Bitacora.fecha_hora.desc(), Bitacora.id_bitacora.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = list((await self.session.execute(statement)).all())
        return rows, total

    async def get_log(self, audit_id: int) -> tuple[Bitacora, Usuario | None] | None:
        statement = (
            select(Bitacora, Usuario)
            .outerjoin(Usuario, Usuario.id_usuario == Bitacora.id_usuario)
            .where(Bitacora.id_bitacora == audit_id)
        )
        return (await self.session.execute(statement)).one_or_none()
