from datetime import UTC, datetime
from decimal import Decimal
from typing import Sequence

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.audit_context import AuditContext, apply_audit_context
from app.modules.auth.dependencies import CurrentPrincipal
from app.modules.auth.models import Ciudad, Cliente, Usuario
from app.modules.commerce.models import DireccionCliente, Pedido, Reserva, Venta
from app.modules.customers.schemas import (
    CustomerAddressItem,
    CustomerAdminDetail,
    CustomerAdminSummary,
    CustomerAdminUpdateRequest,
)


class CustomerAdminService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_customers(
        self,
        q: str | None = None,
        estado: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CustomerAdminSummary]:
        orders_subquery = (
            select(Venta.id_cliente, func.count(Pedido.id_pedido).label("total_pedidos"))
            .join(Pedido, Pedido.id_venta == Venta.id_venta)
            .where(Venta.id_cliente.is_not(None))
            .group_by(Venta.id_cliente)
            .subquery()
        )

        reservas_subquery = (
            select(Reserva.id_cliente, func.count(Reserva.id_reserva).label("total_reservas"))
            .group_by(Reserva.id_cliente)
            .subquery()
        )

        ventas_subquery = (
            select(Venta.id_cliente, func.count(Venta.id_venta).label("total_ventas"))
            .where(Venta.id_cliente.is_not(None))
            .group_by(Venta.id_cliente)
            .subquery()
        )

        stmt = (
            select(
                Cliente,
                Usuario,
                func.coalesce(orders_subquery.c.total_pedidos, 0).label("total_pedidos"),
                func.coalesce(reservas_subquery.c.total_reservas, 0).label("total_reservas"),
                func.coalesce(ventas_subquery.c.total_ventas, 0).label("total_ventas"),
            )
            .join(Usuario, Cliente.id_usuario == Usuario.id_usuario)
            .outerjoin(orders_subquery, orders_subquery.c.id_cliente == Cliente.id_cliente)
            .outerjoin(reservas_subquery, reservas_subquery.c.id_cliente == Cliente.id_cliente)
            .outerjoin(ventas_subquery, ventas_subquery.c.id_cliente == Cliente.id_cliente)
        )

        if estado:
            stmt = stmt.where(Cliente.estado == estado.upper())

        if q:
            term = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Usuario.nombres.ilike(term),
                    Usuario.apellidos.ilike(term),
                    Usuario.correo.ilike(term),
                    Usuario.ci.ilike(term),
                    Usuario.telefono.ilike(term),
                )
            )

        stmt = stmt.order_by(Cliente.created_at.desc()).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        rows = result.all()

        return [
            CustomerAdminSummary(
                id_cliente=cliente.id_cliente,
                id_usuario=usuario.id_usuario,
                nombres=usuario.nombres,
                apellidos=usuario.apellidos,
                nombre_completo=f"{usuario.nombres} {usuario.apellidos}".strip(),
                correo=usuario.correo,
                ci=usuario.ci,
                telefono=usuario.telefono,
                fecha_nacimiento=cliente.fecha_nacimiento,
                estado=cliente.estado,
                total_pedidos=int(total_pedidos),
                total_reservas=int(total_reservas),
                total_ventas=int(total_ventas),
                created_at=cliente.created_at,
                updated_at=cliente.updated_at,
            )
            for cliente, usuario, total_pedidos, total_reservas, total_ventas in rows
        ]

    async def get_customer(self, customer_id: int) -> CustomerAdminDetail:
        orders_subquery = (
            select(Venta.id_cliente, func.count(Pedido.id_pedido).label("total_pedidos"))
            .join(Pedido, Pedido.id_venta == Venta.id_venta)
            .where(Venta.id_cliente == customer_id)
            .group_by(Venta.id_cliente)
            .subquery()
        )

        reservas_subquery = (
            select(Reserva.id_cliente, func.count(Reserva.id_reserva).label("total_reservas"))
            .where(Reserva.id_cliente == customer_id)
            .group_by(Reserva.id_cliente)
            .subquery()
        )

        ventas_subquery = (
            select(Venta.id_cliente, func.count(Venta.id_venta).label("total_ventas"))
            .where(Venta.id_cliente == customer_id)
            .group_by(Venta.id_cliente)
            .subquery()
        )

        stmt = (
            select(
                Cliente,
                Usuario,
                func.coalesce(orders_subquery.c.total_pedidos, 0).label("total_pedidos"),
                func.coalesce(reservas_subquery.c.total_reservas, 0).label("total_reservas"),
                func.coalesce(ventas_subquery.c.total_ventas, 0).label("total_ventas"),
            )
            .join(Usuario, Cliente.id_usuario == Usuario.id_usuario)
            .outerjoin(orders_subquery, orders_subquery.c.id_cliente == Cliente.id_cliente)
            .outerjoin(reservas_subquery, reservas_subquery.c.id_cliente == Cliente.id_cliente)
            .outerjoin(ventas_subquery, ventas_subquery.c.id_cliente == Cliente.id_cliente)
            .where(Cliente.id_cliente == customer_id)
        )

        result = await self.session.execute(stmt)
        row = result.first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cliente con ID {customer_id} no encontrado",
            )

        cliente, usuario, total_pedidos, total_reservas, total_ventas = row

        addr_stmt = (
            select(DireccionCliente, Ciudad)
            .join(Ciudad, DireccionCliente.id_ciudad == Ciudad.id_ciudad)
            .where(DireccionCliente.id_cliente == customer_id)
            .order_by(DireccionCliente.es_principal.desc(), DireccionCliente.id_direccion.desc())
        )
        addr_result = await self.session.execute(addr_stmt)
        address_rows = addr_result.all()

        addresses = [
            CustomerAddressItem(
                id_direccion=d.id_direccion,
                id_ciudad=d.id_ciudad,
                ciudad=c.nombre,
                departamento=c.departamento,
                alias=d.alias,
                zona=d.zona,
                direccion=d.direccion,
                referencia=d.referencia,
                es_principal=d.es_principal,
                activo=d.activo,
            )
            for d, c in address_rows
        ]

        return CustomerAdminDetail(
            id_cliente=cliente.id_cliente,
            id_usuario=usuario.id_usuario,
            nombres=usuario.nombres,
            apellidos=usuario.apellidos,
            nombre_completo=f"{usuario.nombres} {usuario.apellidos}".strip(),
            correo=usuario.correo,
            ci=usuario.ci,
            telefono=usuario.telefono,
            fecha_nacimiento=cliente.fecha_nacimiento,
            estado=cliente.estado,
            total_pedidos=int(total_pedidos),
            total_reservas=int(total_reservas),
            total_ventas=int(total_ventas),
            created_at=cliente.created_at,
            updated_at=cliente.updated_at,
            direcciones=addresses,
        )

    async def update_customer(
        self,
        customer_id: int,
        payload: CustomerAdminUpdateRequest,
        actor: CurrentPrincipal,
        audit_context: AuditContext,
    ) -> CustomerAdminDetail:
        await apply_audit_context(self.session, audit_context)

        stmt = (
            select(Cliente, Usuario)
            .join(Usuario, Cliente.id_usuario == Usuario.id_usuario)
            .where(Cliente.id_cliente == customer_id)
        )
        result = await self.session.execute(stmt)
        row = result.first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cliente con ID {customer_id} no encontrado",
            )

        cliente, usuario = row
        fields_set = payload.model_fields_set

        if "correo" in fields_set and payload.correo is not None:
            email_check = await self.session.execute(
                select(Usuario).where(
                    Usuario.correo == payload.correo,
                    Usuario.id_usuario != usuario.id_usuario,
                )
            )
            if email_check.scalar_one_or_none() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="El correo electrónico ingresado ya está registrado por otro usuario",
                )
            usuario.correo = payload.correo

        if "ci" in fields_set:
            if payload.ci is not None:
                ci_check = await self.session.execute(
                    select(Usuario).where(
                        Usuario.ci == payload.ci,
                        Usuario.id_usuario != usuario.id_usuario,
                    )
                )
                if ci_check.scalar_one_or_none() is not None:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="El número de CI ya está registrado por otro usuario",
                    )
            usuario.ci = payload.ci

        if "nombres" in fields_set and payload.nombres is not None:
            usuario.nombres = payload.nombres

        if "apellidos" in fields_set and payload.apellidos is not None:
            usuario.apellidos = payload.apellidos

        if "telefono" in fields_set:
            usuario.telefono = payload.telefono

        if "fecha_nacimiento" in fields_set:
            cliente.fecha_nacimiento = payload.fecha_nacimiento

        if "estado" in fields_set and payload.estado is not None:
            cliente.estado = payload.estado
            usuario.estado = payload.estado

        if "nuevo_password" in fields_set and payload.nuevo_password:
            usuario.password_hash = hash_password(payload.nuevo_password)

        now = datetime.now(UTC)
        usuario.updated_at = now
        cliente.updated_at = now

        await self.session.commit()
        return await self.get_customer(customer_id)
