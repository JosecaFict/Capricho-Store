from datetime import UTC, datetime

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import Ciudad, Cliente, Empleado, Sucursal, Usuario
from app.modules.catalog.models import (
    Color,
    HistorialPrecio,
    ImagenProducto,
    InventarioSucursal,
    Producto,
    Talla,
    VarianteProducto,
)
from app.modules.commerce.models import (
    Carrito,
    DetalleCarrito,
    DetalleDevolucion,
    DetalleReserva,
    DetalleVenta,
    Devolucion,
    DireccionCliente,
    MetodoPago,
    Notificacion,
    Pago,
    Pedido,
    Reserva,
    TarifaEnvio,
    TransaccionPasarela,
    Venta,
)
from app.modules.inventory.models import (
    DetalleRecepcion,
    LoteInventario,
    MovimientoInventario,
    MovimientoLote,
    OrdenCompra,
    Proveedor,
    RecepcionMercaderia,
)


class CommerceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, model, identity: int):
        return await self.session.get(model, identity)

    async def add(self, entity):
        self.session.add(entity)
        await self.session.flush()
        return entity

    async def delete(self, entity) -> None:
        await self.session.delete(entity)
        await self.session.flush()

    async def customer_by_user(self, user_id: int) -> Cliente | None:
        return await self.session.scalar(select(Cliente).where(Cliente.id_usuario == user_id))

    async def employee_by_user(self, user_id: int) -> Empleado | None:
        return await self.session.scalar(select(Empleado).where(Empleado.id_usuario == user_id))

    async def active_cart(self, customer_id: int, *, lock: bool = False) -> Carrito | None:
        statement = select(Carrito).where(
            Carrito.id_cliente == customer_id, Carrito.estado == "ACTIVO"
        )
        if lock:
            statement = statement.with_for_update()
        return await self.session.scalar(statement)

    async def cart_item(self, cart_id: int, item_id: int) -> DetalleCarrito | None:
        return await self.session.scalar(
            select(DetalleCarrito).where(
                DetalleCarrito.id_carrito == cart_id,
                DetalleCarrito.id_detalle_carrito == item_id,
            )
        )

    async def cart_item_by_variant(self, cart_id: int, variant_id: int) -> DetalleCarrito | None:
        return await self.session.scalar(
            select(DetalleCarrito).where(
                DetalleCarrito.id_carrito == cart_id,
                DetalleCarrito.id_variante == variant_id,
            )
        )

    async def cart_details(self, cart_id: int) -> list[DetalleCarrito]:
        return list(
            (
                await self.session.scalars(
                    select(DetalleCarrito)
                    .where(DetalleCarrito.id_carrito == cart_id)
                    .order_by(DetalleCarrito.id_detalle_carrito)
                )
            ).all()
        )

    async def clear_cart_items(self, cart_id: int) -> None:
        await self.session.execute(
            delete(DetalleCarrito).where(DetalleCarrito.id_carrito == cart_id)
        )

    async def variant_row(self, variant_id: int, branch_id: int | None = None):
        price = (
            select(HistorialPrecio.precio)
            .where(
                HistorialPrecio.id_producto == Producto.id_producto,
                HistorialPrecio.fecha_fin.is_(None),
            )
            .order_by(HistorialPrecio.fecha_inicio.desc())
            .limit(1)
            .scalar_subquery()
        )
        image = (
            select(ImagenProducto.secure_url)
            .where(
                ImagenProducto.id_producto == Producto.id_producto,
                or_(
                    ImagenProducto.id_color == VarianteProducto.id_color,
                    ImagenProducto.id_color.is_(None),
                ),
            )
            .order_by(ImagenProducto.es_principal.desc(), ImagenProducto.orden)
            .limit(1)
            .scalar_subquery()
        )
        conditions = [InventarioSucursal.id_variante == VarianteProducto.id_variante]
        if branch_id is not None:
            conditions.append(InventarioSucursal.id_sucursal == branch_id)

        available = (
            select(
                func.coalesce(
                    func.sum(InventarioSucursal.stock_fisico - InventarioSucursal.stock_reservado),
                    0,
                )
            )
            .where(*conditions)
            .scalar_subquery()
        )
        statement = (
            select(
                VarianteProducto.id_variante,
                VarianteProducto.sku,
                Producto.id_producto,
                Producto.nombre.label("producto"),
                Talla.codigo.label("talla"),
                Color.nombre.label("color"),
                (VarianteProducto.activo & Producto.activo).label("activo"),
                func.coalesce(price, 0).label("precio"),
                available.label("stock_disponible"),
                image.label("imagen_url"),
            )
            .join(Producto, Producto.id_producto == VarianteProducto.id_producto)
            .join(Talla, Talla.id_talla == VarianteProducto.id_talla)
            .join(Color, Color.id_color == VarianteProducto.id_color)
            .where(VarianteProducto.id_variante == variant_id)
        )
        return (await self.session.execute(statement)).mappings().one_or_none()

    async def inventory_for_update(
        self, branch_id: int, variant_id: int
    ) -> InventarioSucursal | None:
        return await self.session.scalar(
            select(InventarioSucursal)
            .where(
                InventarioSucursal.id_sucursal == branch_id,
                InventarioSucursal.id_variante == variant_id,
            )
            .with_for_update()
        )

    async def reservation_details(self, reservation_id: int) -> list[DetalleReserva]:
        return list(
            (
                await self.session.scalars(
                    select(DetalleReserva).where(DetalleReserva.id_reserva == reservation_id)
                )
            ).all()
        )

    async def customer_reservations(self, customer_id: int) -> list[Reserva]:
        return list(
            (
                await self.session.scalars(
                    select(Reserva)
                    .where(Reserva.id_cliente == customer_id)
                    .order_by(Reserva.fecha_reserva.desc())
                )
            ).all()
        )

    async def all_reservations(
        self, *, state: str | None = None, branch_id: int | None = None
    ) -> list[Reserva]:
        statement = select(Reserva)
        if state:
            statement = statement.where(Reserva.estado == state)
        if branch_id:
            statement = statement.where(Reserva.id_sucursal == branch_id)
        return list(
            (await self.session.scalars(statement.order_by(Reserva.fecha_reserva.desc()))).all()
        )

    async def sale_details(self, sale_id: int) -> list[DetalleVenta]:
        return list(
            (
                await self.session.scalars(
                    select(DetalleVenta).where(DetalleVenta.id_venta == sale_id)
                )
            ).all()
        )

    async def customer_sales(self, customer_id: int) -> list[Venta]:
        return list(
            (
                await self.session.scalars(
                    select(Venta)
                    .where(Venta.id_cliente == customer_id, Venta.estado == "PAGADA")
                    .order_by(Venta.fecha_venta.desc())
                )
            ).all()
        )

    async def sales(self, *, branch_id: int | None = None) -> list[Venta]:
        statement = select(Venta)
        if branch_id:
            statement = statement.where(Venta.id_sucursal == branch_id)
        return list(
            (await self.session.scalars(statement.order_by(Venta.fecha_venta.desc()))).all()
        )

    async def customer_orders(self, customer_id: int) -> list[Pedido]:
        statement = (
            select(Pedido)
            .join(Venta, Venta.id_venta == Pedido.id_venta)
            .where(Venta.id_cliente == customer_id, Venta.estado == "PAGADA")
            .order_by(Pedido.fecha_creacion.desc())
        )
        return list((await self.session.scalars(statement)).all())

    async def orders(
        self, *, state: str | None = None, branch_id: int | None = None
    ) -> list[Pedido]:
        statement = (
            select(Pedido)
            .join(Venta, Venta.id_venta == Pedido.id_venta)
            .where(Venta.estado == "PAGADA")
        )
        if state:
            statement = statement.where(Pedido.estado == state)
        if branch_id:
            statement = statement.where(Venta.id_sucursal == branch_id)
        return list(
            (await self.session.scalars(statement.order_by(Pedido.fecha_creacion.desc()))).all()
        )

    async def address_rows(self, customer_id: int, *, active_only: bool = True):
        statement = (
            select(DireccionCliente, Ciudad.nombre.label("ciudad"))
            .join(Ciudad, Ciudad.id_ciudad == DireccionCliente.id_ciudad)
            .where(DireccionCliente.id_cliente == customer_id)
        )
        if active_only:
            statement = statement.where(DireccionCliente.activo.is_(True))
        return (
            await self.session.execute(
                statement.order_by(
                    DireccionCliente.es_principal.desc(), DireccionCliente.created_at.desc()
                )
            )
        ).all()

    async def unset_primary_addresses(self, customer_id: int, except_id: int | None = None) -> None:
        addresses = await self.session.scalars(
            select(DireccionCliente).where(
                DireccionCliente.id_cliente == customer_id, DireccionCliente.es_principal.is_(True)
            )
        )
        for address in addresses:
            if except_id is None or address.id_direccion != except_id:
                address.es_principal = False

    async def active_rate(self) -> TarifaEnvio | None:
        now = func.now()
        return await self.session.scalar(
            select(TarifaEnvio)
            .where(
                TarifaEnvio.activo.is_(True),
                TarifaEnvio.vigente_desde <= now,
                or_(TarifaEnvio.vigente_hasta.is_(None), TarifaEnvio.vigente_hasta > now),
            )
            .order_by(TarifaEnvio.vigente_desde.desc())
            .limit(1)
        )

    async def returned_quantity(self, sale_detail_id: int) -> int:
        value = await self.session.scalar(
            select(func.coalesce(func.sum(DetalleDevolucion.cantidad), 0))
            .join(Devolucion, Devolucion.id_devolucion == DetalleDevolucion.id_devolucion)
            .where(
                DetalleDevolucion.id_detalle_venta == sale_detail_id,
                Devolucion.estado.in_(["PENDIENTE", "APROBADA", "COMPLETADA"]),
            )
        )
        return int(value or 0)

    async def customer_returns(self, customer_id: int) -> list[Devolucion]:
        return list(
            (
                await self.session.scalars(
                    select(Devolucion)
                    .where(Devolucion.id_cliente == customer_id)
                    .order_by(Devolucion.fecha_solicitud.desc())
                )
            ).all()
        )

    async def returns(self, *, branch_id: int | None = None) -> list[Devolucion]:
        statement = select(Devolucion).join(Venta, Venta.id_venta == Devolucion.id_venta)
        if branch_id:
            statement = statement.where(Venta.id_sucursal == branch_id)
        return list(
            (
                await self.session.scalars(statement.order_by(Devolucion.fecha_solicitud.desc()))
            ).all()
        )

    async def return_details(self, return_id: int) -> list[DetalleDevolucion]:
        return list(
            (
                await self.session.scalars(
                    select(DetalleDevolucion).where(DetalleDevolucion.id_devolucion == return_id)
                )
            ).all()
        )

    async def fifo_lots(self, branch_id: int, variant_id: int) -> list[LoteInventario]:
        return list(
            (
                await self.session.scalars(
                    select(LoteInventario)
                    .where(
                        LoteInventario.id_sucursal == branch_id,
                        LoteInventario.id_variante == variant_id,
                        LoteInventario.activo.is_(True),
                        LoteInventario.cantidad_disponible > 0,
                    )
                    .order_by(LoteInventario.fecha_ingreso, LoteInventario.id_lote)
                    .with_for_update()
                )
            ).all()
        )

    async def sale_lot_allocations(self, sale_id: int, variant_id: int):
        statement = (
            select(MovimientoLote, LoteInventario)
            .join(
                MovimientoInventario,
                MovimientoInventario.id_movimiento == MovimientoLote.id_movimiento,
            )
            .join(LoteInventario, LoteInventario.id_lote == MovimientoLote.id_lote)
            .where(
                MovimientoInventario.referencia_tipo == "VENTA",
                MovimientoInventario.referencia_id == sale_id,
                LoteInventario.id_variante == variant_id,
            )
            .order_by(LoteInventario.fecha_ingreso.desc(), LoteInventario.id_lote.desc())
            .with_for_update()
        )
        return (await self.session.execute(statement)).all()

    async def restored_sale_lots(self, sale_id: int, variant_id: int) -> dict[int, int]:
        statement = (
            select(
                MovimientoLote.id_lote,
                func.sum(MovimientoLote.cantidad).label("cantidad"),
            )
            .join(
                MovimientoInventario,
                MovimientoInventario.id_movimiento == MovimientoLote.id_movimiento,
            )
            .join(
                Devolucion,
                Devolucion.id_devolucion == MovimientoInventario.referencia_id,
            )
            .join(LoteInventario, LoteInventario.id_lote == MovimientoLote.id_lote)
            .where(
                MovimientoInventario.referencia_tipo == "DEVOLUCION",
                Devolucion.id_venta == sale_id,
                LoteInventario.id_variante == variant_id,
            )
            .group_by(MovimientoLote.id_lote)
        )
        return {
            int(lot_id): int(quantity)
            for lot_id, quantity in (await self.session.execute(statement)).all()
        }

    async def notifications(self, user_id: int) -> list[Notificacion]:
        return list(
            (
                await self.session.scalars(
                    select(Notificacion)
                    .where(Notificacion.id_usuario == user_id, Notificacion.id_campania.is_(None))
                    .order_by(Notificacion.fecha_creacion.desc())
                    .limit(100)
                )
            ).all()
        )

    async def payment_method(self, code: str) -> MetodoPago | None:
        return await self.session.scalar(
            select(MetodoPago).where(MetodoPago.codigo == code, MetodoPago.activo.is_(True))
        )

    async def payment(self, payment_id: int, *, lock: bool = False) -> Pago | None:
        statement = select(Pago).where(Pago.id_pago == payment_id)
        if lock:
            statement = statement.with_for_update()
        return await self.session.scalar(statement)

    async def gateway_transaction_by_session(
        self, session_id: str, *, lock: bool = False
    ) -> TransaccionPasarela | None:
        statement = select(TransaccionPasarela).where(
            TransaccionPasarela.proveedor == "STRIPE",
            TransaccionPasarela.external_session_id == session_id,
        )
        if lock:
            statement = statement.with_for_update()
        return await self.session.scalar(statement)

    async def order_by_sale(self, sale_id: int) -> Pedido | None:
        return await self.session.scalar(select(Pedido).where(Pedido.id_venta == sale_id))

    async def payment_by_sale(self, sale_id: int) -> Pago | None:
        return await self.session.scalar(
            select(Pago).where(Pago.id_venta == sale_id).order_by(Pago.id_pago.desc())
        )

    async def gateway_transaction_by_payment(
        self, payment_id: int
    ) -> TransaccionPasarela | None:
        return await self.session.scalar(
            select(TransaccionPasarela).where(TransaccionPasarela.id_pago == payment_id)
        )

    async def supplier_history(
        self,
        *,
        page: int,
        page_size: int,
        supplier_id: int | None,
        product_id: int | None,
        branch_id: int | None,
        state: str | None,
        date_from: datetime | None,
        date_to: datetime | None,
    ):
        total_purchase = func.sum(
            DetalleRecepcion.cantidad_recibida * DetalleRecepcion.costo_unitario
        ).over(partition_by=RecepcionMercaderia.id_recepcion)
        statement = (
            select(
                RecepcionMercaderia.fecha_recepcion,
                Proveedor.razon_social.label("proveedor"),
                RecepcionMercaderia.id_orden_compra,
                RecepcionMercaderia.id_recepcion,
                Producto.nombre.label("producto"),
                VarianteProducto.id_variante,
                VarianteProducto.sku,
                Talla.codigo.label("talla"),
                Color.nombre.label("color"),
                DetalleRecepcion.cantidad_recibida.label("cantidad"),
                DetalleRecepcion.costo_unitario.label("precio_unitario"),
                (DetalleRecepcion.cantidad_recibida * DetalleRecepcion.costo_unitario).label(
                    "subtotal"
                ),
                total_purchase.label("total_compra"),
                Sucursal.nombre.label("sucursal"),
                RecepcionMercaderia.estado,
                func.concat(Usuario.nombres, " ", Usuario.apellidos).label("usuario_responsable"),
            )
            .join(
                DetalleRecepcion, DetalleRecepcion.id_recepcion == RecepcionMercaderia.id_recepcion
            )
            .join(VarianteProducto, VarianteProducto.id_variante == DetalleRecepcion.id_variante)
            .join(Producto, Producto.id_producto == VarianteProducto.id_producto)
            .join(Talla, Talla.id_talla == VarianteProducto.id_talla)
            .join(Color, Color.id_color == VarianteProducto.id_color)
            .join(Sucursal, Sucursal.id_sucursal == RecepcionMercaderia.id_sucursal)
            .outerjoin(
                OrdenCompra, OrdenCompra.id_orden_compra == RecepcionMercaderia.id_orden_compra
            )
            .outerjoin(Proveedor, Proveedor.id_proveedor == OrdenCompra.id_proveedor)
            .outerjoin(Empleado, Empleado.id_empleado == RecepcionMercaderia.id_empleado)
            .outerjoin(Usuario, Usuario.id_usuario == Empleado.id_usuario)
        )
        filters = []
        if supplier_id:
            filters.append(Proveedor.id_proveedor == supplier_id)
        if product_id:
            filters.append(Producto.id_producto == product_id)
        if branch_id:
            filters.append(Sucursal.id_sucursal == branch_id)
        if state:
            filters.append(RecepcionMercaderia.estado == state)
        if date_from:
            filters.append(RecepcionMercaderia.fecha_recepcion >= date_from)
        if date_to:
            filters.append(RecepcionMercaderia.fecha_recepcion <= date_to)
        if filters:
            statement = statement.where(and_(*filters))
        count_statement = select(func.count()).select_from(statement.order_by(None).subquery())
        total = int(await self.session.scalar(count_statement) or 0)
        rows = (
            (
                await self.session.execute(
                    statement.order_by(
                        RecepcionMercaderia.fecha_recepcion.desc(),
                        RecepcionMercaderia.id_recepcion.desc(),
                    )
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
            )
            .mappings()
            .all()
        )
        return rows, total

    async def stale_reservations(self) -> list[Reserva]:
        now = datetime.now(UTC)
        statement = (
            select(Reserva)
            .where(
                Reserva.estado.in_(["PENDIENTE", "CONFIRMADA"]),
                Reserva.fecha_expiracion.is_not(None),
                Reserva.fecha_expiracion < now,
            )
            .with_for_update()
        )
        return list((await self.session.scalars(statement)).all())

