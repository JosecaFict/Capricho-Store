from datetime import UTC, datetime, timedelta
from decimal import Decimal
from math import asin, cos, radians, sin, sqrt
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.openrouteservice import OpenRouteServiceClient
from app.integrations.stripe_checkout import StripeCheckoutGateway
from app.modules.auth.models import Cliente, Sucursal, Usuario
from app.modules.catalog.models import InventarioSucursal
from app.modules.commerce.exceptions import (
    CommerceConflictError,
    CommerceNotFoundError,
    InvalidCommerceOperationError,
    PaymentGatewayError,
)
from app.modules.commerce.models import (
    Carrito,
    CotizacionEnvio,
    DetalleCarrito,
    DetalleDevolucion,
    DetalleReserva,
    DetalleVenta,
    Devolucion,
    DireccionCliente,
    Notificacion,
    Pago,
    Pedido,
    Reserva,
    TransaccionPasarela,
    Venta,
)
from app.modules.commerce.repository import CommerceRepository
from app.modules.commerce.schemas import (
    AddressCreate,
    AddressResponse,
    AddressUpdate,
    CartItemCreate,
    CartItemUpdate,
    CartResponse,
    CheckoutCreate,
    CommerceLineRequest,
    CommerceLineResponse,
    OrderResponse,
    OrderStatusUpdate,
    ReservationCreate,
    ReservationResponse,
    ReservationStatusUpdate,
    ReturnCreate,
    ReturnLineResponse,
    ReturnResponse,
    ReturnStatusUpdate,
    SaleCreate,
    SaleResponse,
    ShippingQuoteCreate,
    StripeCheckoutResponse,
    StripeCheckoutStatusResponse,
    SupplierPurchaseHistoryPage,
)
from app.modules.inventory.models import MovimientoInventario, MovimientoLote

RESERVATION_TRANSITIONS = {
    "PENDIENTE": {"CONFIRMADA", "CANCELADA", "EXPIRADA"},
    "CONFIRMADA": {"PREPARANDO", "CANCELADA", "EXPIRADA"},
    "PREPARANDO": {"LISTA", "CANCELADA"},
    "LISTA": {"CLIENTE_PRESENTE", "CONVERTIDA", "CANCELADA", "EXPIRADA"},
    "CLIENTE_PRESENTE": {"CONVERTIDA", "CANCELADA"},
}
ORDER_TRANSITIONS = {
    "PENDIENTE": {"PREPARANDO", "CANCELADO"},
    "PREPARANDO": {"LISTO_PARA_RETIRO", "LISTO_PARA_ENVIO", "CANCELADO"},
    "LISTO_PARA_RETIRO": {"RETIRADO", "RECOGIDO", "CANCELADO"},
    "LISTO_PARA_ENVIO": {"RECOGIDO", "EN_CAMINO", "CANCELADO"},
    "RECOGIDO": {"EN_CAMINO", "ENTREGADO"},
    "EN_CAMINO": {"ENTREGADO"},
}
RETURN_TRANSITIONS = {
    "PENDIENTE": {"APROBADA", "RECHAZADA"},
    "APROBADA": {"COMPLETADA", "RECHAZADA"},
}


class CommerceService:
    def __init__(
        self,
        session: AsyncSession,
        repository: CommerceRepository,
        *,
        stripe_gateway: StripeCheckoutGateway | None = None,
        route_client: OpenRouteServiceClient | None = None,
        public_web_url: str = "http://localhost:4200",
        checkout_expire_minutes: int = 30,
    ) -> None:
        self.session = session
        self.repository = repository
        self.stripe_gateway = stripe_gateway
        self.route_client = route_client
        self.public_web_url = public_web_url.rstrip("/")
        self.checkout_expire_minutes = checkout_expire_minutes

    async def _customer(self, user_id: int) -> Cliente:
        customer = await self.repository.customer_by_user(user_id)
        if customer is None or customer.estado != "ACTIVO":
            raise CommerceNotFoundError("El usuario no tiene un perfil de cliente activo")
        return customer

    async def _employee(self, user_id: int):
        employee = await self.repository.employee_by_user(user_id)
        if employee is None or employee.estado_laboral != "ACTIVO":
            raise CommerceNotFoundError("El usuario no tiene un perfil de empleado activo")
        return employee

    @staticmethod
    def _validate_unique_lines(lines: list[CommerceLineRequest]) -> None:
        identifiers = [item.id_variante for item in lines]
        if len(identifiers) != len(set(identifiers)):
            raise InvalidCommerceOperationError("No repita una variante en la misma operación")

    @staticmethod
    def _validate_transition(current: str, target: str, transitions: dict[str, set[str]]) -> None:
        if target == current:
            return
        if target not in transitions.get(current, set()):
            raise InvalidCommerceOperationError(
                f"No se puede cambiar el estado de {current} a {target}"
            )

    async def _active_cart(
        self, customer_id: int, *, create: bool = True, lock: bool = False
    ) -> Carrito:
        cart = await self.repository.active_cart(customer_id, lock=lock)
        if cart is None and create:
            cart = await self.repository.add(Carrito(id_cliente=customer_id, estado="ACTIVO"))
        if cart is None:
            raise CommerceNotFoundError("No existe un carrito activo")
        return cart

    async def _line(
        self, detail_id: int, variant_id: int, quantity: int, branch_id: int | None = None
    ) -> CommerceLineResponse:
        row = await self.repository.variant_row(variant_id, branch_id=branch_id)
        if row is None:
            raise CommerceNotFoundError("La variante no existe")
        price = Decimal(row["precio"] or 0)
        return CommerceLineResponse(
            id_detalle=detail_id,
            id_variante=variant_id,
            sku=row["sku"],
            producto=row["producto"],
            talla=row["talla"],
            color=row["color"],
            cantidad=quantity,
            precio_unitario=price,
            subtotal=price * quantity,
            stock_disponible=int(row["stock_disponible"] or 0),
            activo=bool(row["activo"]),
            imagen_url=row["imagen_url"],
        )

    async def _cart_response(self, cart: Carrito) -> CartResponse:
        branch_name = None
        if cart.id_sucursal:
            branch = await self.repository.get(Sucursal, cart.id_sucursal)
            if branch:
                branch_name = branch.nombre
        items = [
            await self._line(
                item.id_detalle_carrito,
                item.id_variante,
                item.cantidad,
                branch_id=cart.id_sucursal,
            )
            for item in await self.repository.cart_details(cart.id_carrito)
        ]
        return CartResponse(
            id_carrito=cart.id_carrito,
            estado=cart.estado,
            id_sucursal=cart.id_sucursal,
            sucursal=branch_name,
            items=items,
            total=sum((item.subtotal for item in items), Decimal(0)),
        )

    async def get_cart(self, user_id: int) -> CartResponse:
        customer = await self._customer(user_id)
        cart = await self._active_cart(customer.id_cliente)
        await self.session.commit()
        return await self._cart_response(cart)

    async def add_cart_item(self, user_id: int, payload: CartItemCreate) -> CartResponse:
        customer = await self._customer(user_id)
        cart = await self._active_cart(customer.id_cliente, lock=True)
        cart_items = await self.repository.cart_details(cart.id_carrito)

        # Regla 1 Carrito = 1 Sucursal: validar conflicto si ya hay prendas de otra sucursal
        if (
            cart_items
            and cart.id_sucursal
            and payload.id_sucursal
            and cart.id_sucursal != payload.id_sucursal
        ):
            current_branch = await self.repository.get(Sucursal, cart.id_sucursal)
            branch_label = current_branch.nombre if current_branch else f"Sucursal #{cart.id_sucursal}"
            raise CommerceConflictError(
                f"Tu carrito contiene prendas de {branch_label}. Para comprar en otra sucursal, debes vaciar el carrito actual."
            )

        target_branch_id = payload.id_sucursal or cart.id_sucursal
        if not cart_items:
            cart.id_sucursal = payload.id_sucursal
            target_branch_id = payload.id_sucursal
        elif not cart.id_sucursal and payload.id_sucursal:
            cart.id_sucursal = payload.id_sucursal
            target_branch_id = payload.id_sucursal

        row = await self.repository.variant_row(payload.id_variante, branch_id=target_branch_id)
        if row is None or not row["activo"]:
            raise InvalidCommerceOperationError("La variante no está disponible")

        current = await self.repository.cart_item_by_variant(cart.id_carrito, payload.id_variante)
        new_quantity = payload.cantidad + (current.cantidad if current else 0)
        stock_available = int(row["stock_disponible"] or 0)
        if new_quantity > stock_available:
            raise CommerceConflictError("La cantidad solicitada supera el stock disponible en la sucursal")

        if current:
            current.cantidad = new_quantity
        else:
            await self.repository.add(
                DetalleCarrito(
                    id_carrito=cart.id_carrito,
                    id_variante=payload.id_variante,
                    cantidad=payload.cantidad,
                )
            )
        await self.session.commit()
        return await self._cart_response(cart)

    async def update_cart_item(
        self, user_id: int, item_id: int, payload: CartItemUpdate
    ) -> CartResponse:
        customer = await self._customer(user_id)
        cart = await self._active_cart(customer.id_cliente, lock=True)
        item = await self.repository.cart_item(cart.id_carrito, item_id)
        if item is None:
            raise CommerceNotFoundError("El artículo no pertenece al carrito")
        row = await self.repository.variant_row(item.id_variante, branch_id=cart.id_sucursal)
        if row is None or not row["activo"] or payload.cantidad > int(row["stock_disponible"] or 0):
            raise CommerceConflictError("La cantidad solicitada no está disponible")
        item.cantidad = payload.cantidad
        await self.session.commit()
        return await self._cart_response(cart)

    async def remove_cart_item(self, user_id: int, item_id: int) -> CartResponse:
        customer = await self._customer(user_id)
        cart = await self._active_cart(customer.id_cliente, lock=True)
        item = await self.repository.cart_item(cart.id_carrito, item_id)
        if item is None:
            raise CommerceNotFoundError("El artículo no pertenece al carrito")
        await self.repository.delete(item)
        remaining = await self.repository.cart_details(cart.id_carrito)
        if not remaining:
            cart.id_sucursal = None
        await self.session.commit()
        return await self._cart_response(cart)

    async def clear_cart(self, user_id: int) -> CartResponse:
        customer = await self._customer(user_id)
        cart = await self._active_cart(customer.id_cliente, lock=True)
        await self.repository.clear_cart_items(cart.id_carrito)
        cart.id_sucursal = None
        await self.session.commit()
        return await self._cart_response(cart)

    @staticmethod
    def _address_response(address: DireccionCliente, city: str) -> AddressResponse:
        return AddressResponse(
            id_direccion=address.id_direccion,
            id_ciudad=address.id_ciudad,
            ciudad=city,
            alias=address.alias,
            zona=address.zona,
            direccion=address.direccion,
            referencia=address.referencia,
            latitud=address.latitud,
            longitud=address.longitud,
            es_principal=address.es_principal,
            activo=address.activo,
        )

    async def list_addresses(self, user_id: int) -> list[AddressResponse]:
        customer = await self._customer(user_id)
        return [
            self._address_response(address, city)
            for address, city in await self.repository.address_rows(customer.id_cliente)
        ]

    async def create_address(self, user_id: int, payload: AddressCreate) -> AddressResponse:
        customer = await self._customer(user_id)
        if payload.es_principal:
            await self.repository.unset_primary_addresses(customer.id_cliente)
        address = await self.repository.add(
            DireccionCliente(id_cliente=customer.id_cliente, **payload.model_dump())
        )
        await self.session.commit()
        rows = await self.repository.address_rows(customer.id_cliente, active_only=False)
        city = next(city for item, city in rows if item.id_direccion == address.id_direccion)
        return self._address_response(address, city)

    async def update_address(
        self, user_id: int, address_id: int, payload: AddressUpdate
    ) -> AddressResponse:
        customer = await self._customer(user_id)
        address = await self.repository.get(DireccionCliente, address_id)
        if address is None or address.id_cliente != customer.id_cliente:
            raise CommerceNotFoundError("La dirección no existe")
        if payload.es_principal:
            await self.repository.unset_primary_addresses(customer.id_cliente, address_id)
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(address, field, value)
        await self.session.commit()
        rows = await self.repository.address_rows(customer.id_cliente, active_only=False)
        city = next(city for item, city in rows if item.id_direccion == address.id_direccion)
        return self._address_response(address, city)

    async def _reserve_stock(
        self,
        branch_id: int,
        reservation_id: int,
        lines: list[CommerceLineRequest],
        employee_id: int | None = None,
    ) -> None:
        for line in lines:
            row = await self.repository.variant_row(line.id_variante)
            inventory = await self.repository.inventory_for_update(branch_id, line.id_variante)
            if row is None or not row["activo"] or inventory is None:
                raise CommerceConflictError("Una variante no está disponible en la sucursal")
            if inventory.stock_fisico - inventory.stock_reservado < line.cantidad:
                raise CommerceConflictError(
                    f"Stock insuficiente para {row['producto']} {row['talla']} {row['color']}"
                )
            await self.repository.add(
                DetalleReserva(
                    id_reserva=reservation_id, id_variante=line.id_variante, cantidad=line.cantidad
                )
            )
            await self.repository.add(
                MovimientoInventario(
                    id_inventario=inventory.id_inventario,
                    id_empleado=employee_id,
                    tipo_movimiento="RESERVA",
                    cantidad=line.cantidad,
                    referencia_tipo="RESERVA",
                    referencia_id=reservation_id,
                    motivo="Reserva web",
                )
            )

    async def create_reservation(
        self, user_id: int, payload: ReservationCreate
    ) -> ReservationResponse:
        customer = await self._customer(user_id)
        self._validate_unique_lines(payload.items)
        branch = await self.repository.get(Sucursal, payload.id_sucursal)
        if branch is None or not branch.activo:
            raise CommerceNotFoundError("La sucursal no está disponible")
        now = datetime.now(UTC)
        expiration: datetime
        if payload.fecha_cita:
            appointment = (
                payload.fecha_cita
                if payload.fecha_cita.tzinfo
                else payload.fecha_cita.replace(tzinfo=UTC)
            )
            if appointment <= now:
                raise InvalidCommerceOperationError("La fecha de cita debe ser futura")
            if (
                branch.hora_apertura
                and branch.hora_cierre
                and not (
                    branch.hora_apertura
                    <= appointment.timetz().replace(tzinfo=None)
                    <= branch.hora_cierre
                )
            ):
                raise InvalidCommerceOperationError(
                    "La cita debe estar dentro del horario de la sucursal"
                )
            expiration = appointment + timedelta(hours=2)
        else:
            expiration = now + timedelta(hours=48)
        try:
            reservation = await self.repository.add(
                Reserva(
                    id_cliente=customer.id_cliente,
                    id_sucursal=payload.id_sucursal,
                    fecha_cita=payload.fecha_cita,
                    fecha_expiracion=expiration,
                    observacion=payload.observacion,
                    estado="PENDIENTE",
                )
            )
            await self._reserve_stock(payload.id_sucursal, reservation.id_reserva, payload.items)
            active_cart = await self.repository.active_cart(customer.id_cliente, lock=True)
            if active_cart:
                await self.repository.clear_cart_items(active_cart.id_carrito)
                active_cart.id_sucursal = None
            await self._notify(
                user_id,
                "RESERVA_CREADA",
                "Reserva recibida",
                f"Tu reserva #{reservation.id_reserva} fue registrada.",
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise
        return await self._reservation_response(reservation)

    async def _reservation_response(self, reservation: Reserva) -> ReservationResponse:
        branch = await self.repository.get(Sucursal, reservation.id_sucursal)
        details = await self.repository.reservation_details(reservation.id_reserva)
        items = [
            await self._line(item.id_detalle_reserva, item.id_variante, item.cantidad)
            for item in details
        ]
        return ReservationResponse(
            id_reserva=reservation.id_reserva,
            id_sucursal=reservation.id_sucursal,
            sucursal=branch.nombre,
            direccion_sucursal=branch.direccion,
            fecha_reserva=reservation.fecha_reserva,
            fecha_cita=reservation.fecha_cita,
            fecha_expiracion=reservation.fecha_expiracion,
            estado=reservation.estado,
            observacion=reservation.observacion,
            items=items,
        )

    async def list_reservations(
        self,
        user_id: int,
        *,
        operational: bool,
        state: str | None = None,
        branch_id: int | None = None,
        all_branches: bool = False,
    ) -> list[ReservationResponse]:
        if operational:
            if not all_branches:
                branch_id = (await self._employee(user_id)).id_sucursal
            rows = await self.repository.all_reservations(state=state, branch_id=branch_id)
        else:
            customer = await self._customer(user_id)
            rows = await self.repository.customer_reservations(customer.id_cliente)
        return [await self._reservation_response(item) for item in rows]

    async def get_reservation(
        self, user_id: int, reservation_id: int, *, operational: bool
    ) -> ReservationResponse:
        reservation = await self.repository.get(Reserva, reservation_id)
        if reservation is None:
            raise CommerceNotFoundError("La reserva no existe")
        if not operational:
            customer = await self._customer(user_id)
            if reservation.id_cliente != customer.id_cliente:
                raise CommerceNotFoundError("La reserva no existe")
        return await self._reservation_response(reservation)

    async def _release_reservation(
        self, reservation: Reserva, employee_id: int | None = None
    ) -> None:
        for detail in await self.repository.reservation_details(reservation.id_reserva):
            inventory = await self.repository.inventory_for_update(
                reservation.id_sucursal, detail.id_variante
            )
            if inventory is None:
                raise CommerceConflictError("No existe inventario para liberar la reserva")
            await self.repository.add(
                MovimientoInventario(
                    id_inventario=inventory.id_inventario,
                    id_empleado=employee_id,
                    tipo_movimiento="LIBERACION_RESERVA",
                    cantidad=detail.cantidad,
                    referencia_tipo="RESERVA",
                    referencia_id=reservation.id_reserva,
                    motivo="Cancelación o expiración",
                )
            )

    async def cancel_reservation(self, user_id: int, reservation_id: int) -> ReservationResponse:
        customer = await self._customer(user_id)
        reservation = await self.repository.get(Reserva, reservation_id)
        if reservation is None or reservation.id_cliente != customer.id_cliente:
            raise CommerceNotFoundError("La reserva no existe")
        self._validate_transition(reservation.estado, "CANCELADA", RESERVATION_TRANSITIONS)
        try:
            await self._release_reservation(reservation)
            reservation.estado = "CANCELADA"
            await self._notify(
                user_id,
                "RESERVA_CANCELADA",
                "Reserva cancelada",
                f"La reserva #{reservation.id_reserva} fue cancelada.",
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise
        return await self._reservation_response(reservation)

    async def expire_stale_reservations(self) -> int:
        stale = await self.repository.stale_reservations()
        count = 0
        for reservation in stale:
            try:
                await self._release_reservation(reservation)
                reservation.estado = "EXPIRADA"
                count += 1
            except Exception:
                continue
        if count > 0:
            await self.session.commit()
        return count

    async def update_reservation_status(
        self,
        user_id: int,
        reservation_id: int,
        payload: ReservationStatusUpdate,
        *,
        all_branches: bool = False,
    ) -> ReservationResponse:
        employee = await self._employee(user_id)
        reservation = await self.repository.get(Reserva, reservation_id)
        if reservation is None:
            raise CommerceNotFoundError("La reserva no existe")
        if not all_branches and reservation.id_sucursal != employee.id_sucursal:
            raise CommerceNotFoundError("La reserva no existe")
        self._validate_transition(reservation.estado, payload.estado, RESERVATION_TRANSITIONS)
        if payload.estado in {"CANCELADA", "EXPIRADA"}:
            await self._release_reservation(reservation, employee.id_empleado)
        reservation.estado = payload.estado
        customer = await self.repository.get(Cliente, reservation.id_cliente)
        await self._notify(
            customer.id_usuario,
            f"RESERVA_{payload.estado}",
            "Estado de reserva actualizado",
            f"Tu reserva #{reservation.id_reserva} ahora está {payload.estado.lower()}.",
        )
        await self.session.commit()
        return await self._reservation_response(reservation)

    async def _consume_fifo(
        self, inventory: InventarioSucursal, quantity: int, movement_id: int
    ) -> None:
        remaining = quantity
        for lot in await self.repository.fifo_lots(inventory.id_sucursal, inventory.id_variante):
            used = min(remaining, lot.cantidad_disponible)
            if used:
                lot.cantidad_disponible -= used
                await self.repository.add(
                    MovimientoLote(
                        id_movimiento=movement_id,
                        id_lote=lot.id_lote,
                        cantidad=used,
                        costo_unitario=lot.costo_unitario,
                    )
                )
                remaining -= used
            if remaining == 0:
                break
        if remaining:
            raise CommerceConflictError("Los lotes FIFO no cubren la cantidad disponible")

    async def _create_sale(
        self,
        *,
        customer_id: int | None,
        employee_id: int | None,
        branch_id: int,
        channel: str,
        mode: str,
        lines: list[CommerceLineRequest],
        reservation_id: int | None = None,
        shipping_cost: Decimal = Decimal(0),
        cash: bool = False,
        state: str | None = None,
    ) -> Venta:
        self._validate_unique_lines(lines)
        priced: list[tuple[CommerceLineRequest, Decimal, InventarioSucursal]] = []
        for line in lines:
            row = await self.repository.variant_row(line.id_variante)
            inventory = await self.repository.inventory_for_update(branch_id, line.id_variante)
            if (
                row is None
                or not row["activo"]
                or Decimal(row["precio"] or 0) <= 0
                or inventory is None
            ):
                raise CommerceConflictError("Una variante no puede venderse en esta sucursal")
            available = (
                inventory.stock_reservado
                if reservation_id
                else inventory.stock_fisico - inventory.stock_reservado
            )
            if available < line.cantidad:
                raise CommerceConflictError("Stock insuficiente para completar la venta")
            priced.append((line, Decimal(row["precio"]), inventory))
        subtotal = sum((price * line.cantidad for line, price, _ in priced), Decimal(0))
        sale = await self.repository.add(
            Venta(
                id_cliente=customer_id,
                id_sucursal=branch_id,
                id_empleado=employee_id,
                id_reserva=reservation_id,
                canal_venta=channel,
                modalidad_entrega=mode,
                estado="PAGADA" if cash else (state or "CONFIRMADA"),
                subtotal=subtotal,
                descuento_total=0,
                costo_envio=shipping_cost,
                total=subtotal + shipping_cost,
            )
        )
        for line, price, inventory in priced:
            await self.repository.add(
                DetalleVenta(
                    id_venta=sale.id_venta,
                    id_variante=line.id_variante,
                    cantidad=line.cantidad,
                    precio_unitario=price,
                    descuento=0,
                    subtotal=price * line.cantidad,
                )
            )
            movement = await self.repository.add(
                MovimientoInventario(
                    id_inventario=inventory.id_inventario,
                    id_empleado=employee_id,
                    tipo_movimiento="VENTA_RESERVA" if reservation_id else "VENTA",
                    cantidad=line.cantidad,
                    referencia_tipo="VENTA",
                    referencia_id=sale.id_venta,
                    motivo="Venta presencial" if channel == "PRESENCIAL" else "Compra web",
                )
            )
            await self._consume_fifo(inventory, line.cantidad, movement.id_movimiento)
        if cash:
            method = await self.repository.payment_method("EFECTIVO")
            if method is None:
                raise InvalidCommerceOperationError("El método EFECTIVO no está configurado")
            await self.repository.add(
                Pago(
                    id_venta=sale.id_venta,
                    id_metodo_pago=method.id_metodo_pago,
                    monto=sale.total,
                    estado="PAGADO",
                    fecha_confirmacion=datetime.now(UTC),
                )
            )
        return sale

    async def create_pos_sale(self, user_id: int, payload: SaleCreate) -> SaleResponse:
        employee = await self._employee(user_id)
        if employee.id_sucursal != payload.id_sucursal:
            raise InvalidCommerceOperationError("El cajero solo puede vender en su sucursal")
        customer_id = payload.id_cliente
        reservation = None
        if payload.id_reserva:
            reservation = await self.repository.get(Reserva, payload.id_reserva)
            if reservation is None or reservation.id_sucursal != payload.id_sucursal:
                raise InvalidCommerceOperationError("La reserva no corresponde a la sucursal")
            if reservation.estado not in {"LISTA", "CLIENTE_PRESENTE"}:
                raise InvalidCommerceOperationError("La reserva todavía no está lista")
            reserved_lines = {
                item.id_variante: item.cantidad
                for item in await self.repository.reservation_details(reservation.id_reserva)
            }
            requested_lines = {item.id_variante: item.cantidad for item in payload.items}
            if requested_lines != reserved_lines:
                raise InvalidCommerceOperationError(
                    "La venta debe contener exactamente las prendas reservadas"
                )
            if customer_id is not None and customer_id != reservation.id_cliente:
                raise InvalidCommerceOperationError("El cliente no corresponde a la reserva")
            customer_id = reservation.id_cliente
        try:
            sale = await self._create_sale(
                customer_id=customer_id,
                employee_id=employee.id_empleado,
                branch_id=payload.id_sucursal,
                channel="PRESENCIAL",
                mode=payload.modalidad_entrega,
                lines=payload.items,
                reservation_id=payload.id_reserva,
                cash=payload.registrar_efectivo,
            )
            if reservation:
                reservation.estado = "CONVERTIDA"
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise
        return await self._sale_response(sale)

    @staticmethod
    def _stripe_amount(amount: Decimal) -> int:
        return int((amount * 100).quantize(Decimal("1")))

    def _resolve_client_origin(self, origin_candidate: str | None) -> str:
        if not origin_candidate:
            return self.public_web_url
        parsed = urlparse(origin_candidate.strip())
        if parsed.scheme in {"http", "https"} and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
        return self.public_web_url

    async def checkout(
        self, user_id: int, payload: CheckoutCreate, client_origin: str | None = None
    ) -> StripeCheckoutResponse:
        if self.stripe_gateway is None:
            raise PaymentGatewayError("Stripe todavía no está configurado en el servidor")
        customer = await self._customer(user_id)
        cart = await self._active_cart(customer.id_cliente, create=False, lock=True)
        details = await self.repository.cart_details(cart.id_carrito)
        if not details:
            raise InvalidCommerceOperationError("El carrito está vacío")
        if cart.id_sucursal and payload.id_sucursal != cart.id_sucursal:
            current_branch = await self.repository.get(Sucursal, cart.id_sucursal)
            branch_label = (
                current_branch.nombre if current_branch else f"Sucursal #{cart.id_sucursal}"
            )
            raise InvalidCommerceOperationError(
                f"La sucursal seleccionada no coincide con la sucursal asignada a los productos de tu carrito ({branch_label})"
            )
        if not cart.id_sucursal:
            cart.id_sucursal = payload.id_sucursal
        address = None
        quote = None
        shipping_cost = Decimal(0)
        if payload.modalidad_entrega == "DELIVERY":
            address = await self.repository.get(DireccionCliente, payload.id_direccion)
            if address is None or address.id_cliente != customer.id_cliente or not address.activo:
                raise InvalidCommerceOperationError("La dirección de entrega no es válida")
            quote = await self.repository.get(CotizacionEnvio, payload.id_cotizacion)
            if (
                quote is None
                or quote.id_direccion != address.id_direccion
                or quote.id_sucursal != payload.id_sucursal
            ):
                raise InvalidCommerceOperationError("La cotización de envío no corresponde al pedido")
            if quote.expira_en and quote.expira_en < datetime.now(UTC):
                raise InvalidCommerceOperationError("La cotización de envío ha expirado")
            shipping_cost = quote.costo_estimado

        base_web_url = self._resolve_client_origin(payload.return_url or client_origin)
        customer_user = await self.repository.get(Usuario, customer.id_usuario)
        customer_email = customer_user.correo if customer_user else None

        lines = [CommerceLineRequest(id_variante=i.id_variante, cantidad=i.cantidad) for i in details]
        stripe_session = None
        try:
            sale = await self._create_sale(
                customer_id=customer.id_cliente,
                employee_id=None,
                branch_id=payload.id_sucursal,
                channel="WEB",
                mode=payload.modalidad_entrega,
                lines=lines,
                shipping_cost=shipping_cost,
                state="PENDIENTE",
            )
            order = await self.repository.add(
                Pedido(
                    id_venta=sale.id_venta,
                    id_direccion=address.id_direccion if address else None,
                    id_cotizacion=quote.id_cotizacion if quote else None,
                    estado="PENDIENTE",
                )
            )
            method = await self.repository.payment_method("STRIPE")
            if method is None:
                raise InvalidCommerceOperationError("El método STRIPE no está configurado")
            payment = await self.repository.add(
                Pago(
                    id_venta=sale.id_venta,
                    id_metodo_pago=method.id_metodo_pago,
                    monto=sale.total,
                    moneda="BOB",
                    estado="PROCESANDO",
                )
            )
            transaction = await self.repository.add(
                TransaccionPasarela(
                    id_pago=payment.id_pago,
                    proveedor="STRIPE",
                    estado="CREANDO",
                    monto=sale.total,
                    moneda="BOB",
                    respuesta_resumen={
                        "cart_id": cart.id_carrito,
                        "order_id": order.id_pedido,
                    },
                )
            )
            sale_response = await self._sale_response(sale)
            line_items = [
                {
                    "price_data": {
                        "currency": "bob",
                        "product_data": {
                            "name": f"{item.producto} · {item.color} · {item.talla}",
                        },
                        "unit_amount": self._stripe_amount(item.precio_unitario),
                    },
                    "quantity": item.cantidad,
                }
                for item in sale_response.items
            ]
            if shipping_cost > 0:
                line_items.append(
                    {
                        "price_data": {
                            "currency": "bob",
                            "product_data": {"name": "Envío"},
                            "unit_amount": self._stripe_amount(shipping_cost),
                        },
                        "quantity": 1,
                    }
                )
            expires_at = datetime.now(UTC) + timedelta(
                minutes=self.checkout_expire_minutes,
                seconds=60,
            )
            payment_intent_data: dict = {
                "metadata": {
                    "payment_id": str(payment.id_pago),
                    "sale_id": str(sale.id_venta),
                    "order_id": str(order.id_pedido),
                }
            }
            if customer_email:
                payment_intent_data["receipt_email"] = customer_email

            try:
                stripe_session = await self.stripe_gateway.create_session(
                    mode="payment",
                    payment_method_types=["card"],
                    line_items=line_items,
                    customer_email=customer_email,
                    client_reference_id=str(order.id_pedido),
                    metadata={
                        "payment_id": str(payment.id_pago),
                        "sale_id": str(sale.id_venta),
                        "order_id": str(order.id_pedido),
                    },
                    payment_intent_data=payment_intent_data,
                    success_url=(
                        f"{base_web_url}/checkout?session_id={{CHECKOUT_SESSION_ID}}"
                    ),
                    cancel_url=f"{base_web_url}/checkout?pago_cancelado=1",
                    expires_at=int(expires_at.timestamp()),
                    locale="es",
                    idempotency_key=f"capricho-checkout-{payment.id_pago}",
                )
            except Exception as exc:
                raise PaymentGatewayError("No pudimos iniciar el pago seguro con Stripe") from exc
            session_id = str(stripe_session["id"])
            checkout_url = str(stripe_session["url"])
            transaction.external_session_id = session_id
            transaction.estado = str(stripe_session.get("status") or "open").upper()
            cart.estado = "CONVERTIDO"
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            if stripe_session and stripe_session.get("id"):
                try:
                    await self.stripe_gateway.expire_session(str(stripe_session["id"]))
                except Exception:
                    pass
            raise
        return StripeCheckoutResponse(
            session_id=session_id,
            checkout_url=checkout_url,
            expires_at=expires_at,
        )

    def construct_stripe_event(self, payload: bytes, signature: str) -> dict:
        if self.stripe_gateway is None:
            raise PaymentGatewayError("Stripe todavía no está configurado en el servidor")
        return self.stripe_gateway.construct_event(payload, signature)

    async def _stripe_transaction(self, session_id: str, *, lock: bool = False):
        transaction = await self.repository.gateway_transaction_by_session(session_id, lock=lock)
        if transaction is None:
            raise CommerceNotFoundError("La sesión de pago no pertenece a Capricho Store")
        payment = await self.repository.payment(transaction.id_pago, lock=lock)
        if payment is None:
            raise CommerceNotFoundError("El pago asociado no existe")
        sale = await self.repository.get(Venta, payment.id_venta)
        if sale is None:
            raise CommerceNotFoundError("La venta asociada no existe")
        order = await self.repository.order_by_sale(sale.id_venta)
        if order is None:
            raise CommerceNotFoundError("El pedido asociado no existe")
        return transaction, payment, sale, order

    async def _complete_stripe_checkout(self, stripe_session: dict) -> None:
        session_id = str(stripe_session.get("id") or "")
        transaction, payment, sale, order = await self._stripe_transaction(session_id, lock=True)
        if payment.estado == "PAGADO":
            return
        amount_total = int(stripe_session.get("amount_total") or 0)
        currency = str(stripe_session.get("currency") or "").upper()
        if stripe_session.get("payment_status") != "paid":
            raise InvalidCommerceOperationError("Stripe todavía no confirmó el pago")
        if amount_total != self._stripe_amount(payment.monto) or currency != payment.moneda:
            raise CommerceConflictError("El monto confirmado por Stripe no coincide con la venta")
        payment_intent = stripe_session.get("payment_intent")
        pi_id = (
            payment_intent.get("id")
            if isinstance(payment_intent, dict)
            else (str(payment_intent or "") or None)
        )
        latest_charge = (
            payment_intent.get("latest_charge")
            if isinstance(payment_intent, dict) and isinstance(payment_intent.get("latest_charge"), dict)
            else {}
        )
        receipt_url = latest_charge.get("receipt_url") if isinstance(latest_charge, dict) else None
        now = datetime.now(UTC)
        payment.estado = "PAGADO"
        payment.fecha_confirmacion = now
        sale.estado = "PAGADA"
        transaction.estado = "PAGADO"
        transaction.external_payment_id = pi_id
        transaction.external_customer_id = str(stripe_session.get("customer") or "") or None
        transaction.fecha_confirmacion = now
        transaction.respuesta_resumen = {
            **(transaction.respuesta_resumen or {}),
            "payment_status": stripe_session.get("payment_status"),
            "status": stripe_session.get("status"),
            **({"receipt_url": receipt_url} if receipt_url else {}),
        }
        cart_id = (transaction.respuesta_resumen or {}).get("cart_id")
        if cart_id:
            cart = await self.repository.get(Carrito, int(cart_id))
            if cart:
                cart.estado = "CONVERTIDO"
                cart.id_sucursal = None
                await self.repository.clear_cart_items(cart.id_carrito)
        customer = await self.repository.get(Cliente, sale.id_cliente)
        await self._notify(
            customer.id_usuario,
            "PAGO_CONFIRMADO",
            "Compra confirmada",
            f"Stripe confirmó el pago de tu pedido #{order.id_pedido}.",
        )
        await self.session.commit()

    async def _restore_checkout_cart(self, transaction: TransaccionPasarela) -> None:
        summary = transaction.respuesta_resumen or {}
        cart_id = summary.get("cart_id")
        if not cart_id:
            return
        old_cart = await self.repository.get(Carrito, int(cart_id))
        if old_cart is None:
            return
        active = await self.repository.active_cart(old_cart.id_cliente, lock=True)
        if active is None:
            old_cart.estado = "ACTIVO"
            return
        if active.id_carrito == old_cart.id_carrito:
            return
        for item in await self.repository.cart_details(old_cart.id_carrito):
            current = await self.repository.cart_item_by_variant(
                active.id_carrito, item.id_variante
            )
            if current:
                current.cantidad += item.cantidad
            else:
                await self.repository.add(
                    DetalleCarrito(
                        id_carrito=active.id_carrito,
                        id_variante=item.id_variante,
                        cantidad=item.cantidad,
                    )
                )

    async def _cancel_stripe_checkout(self, session_id: str, *, rejected: bool = False) -> None:
        transaction, payment, sale, order = await self._stripe_transaction(session_id, lock=True)
        if payment.estado == "PAGADO" or sale.estado == "PAGADA":
            return
        if payment.estado in {"CANCELADO", "RECHAZADO"}:
            return
        if sale.estado != "ANULADA":
            await self._restore_sale_stock(
                sale,
                employee_id=None,
                reference_type="PAGO_STRIPE",
                reference_id=payment.id_pago,
            )
        payment.estado = "RECHAZADO" if rejected else "CANCELADO"
        sale.estado = "ANULADA"
        order.estado = "CANCELADO"
        transaction.estado = payment.estado
        await self._restore_checkout_cart(transaction)
        await self.session.commit()

    async def process_stripe_event(self, event: dict) -> None:
        event_type = str(event.get("type") or "")
        stripe_session = dict(event.get("data", {}).get("object", {}))
        if event_type in {"checkout.session.completed", "checkout.session.async_payment_succeeded"}:
            await self._complete_stripe_checkout(stripe_session)
        elif event_type == "checkout.session.async_payment_failed":
            await self._cancel_stripe_checkout(str(stripe_session.get("id") or ""), rejected=True)
        elif event_type == "checkout.session.expired":
            await self._cancel_stripe_checkout(str(stripe_session.get("id") or ""))

    async def stripe_checkout_status(
        self, session_id: str, user_id: int | None = None
    ) -> StripeCheckoutStatusResponse:
        if self.stripe_gateway is None:
            raise PaymentGatewayError("Stripe todavía no está configurado en el servidor")
        transaction, payment, sale, order = await self._stripe_transaction(session_id)
        if user_id is not None:
            customer = await self._customer(user_id)
            if sale.id_cliente != customer.id_cliente:
                raise CommerceNotFoundError("La sesión de pago no existe")
        try:
            remote = await self.stripe_gateway.retrieve_session(
                session_id, expand=["payment_intent.latest_charge"]
            )
        except Exception as exc:
            raise PaymentGatewayError("No pudimos consultar el estado del pago en Stripe") from exc
        if remote.get("payment_status") == "paid":
            await self._complete_stripe_checkout(remote)
        elif remote.get("status") == "expired":
            await self._cancel_stripe_checkout(session_id)
        transaction, payment, sale, order = await self._stripe_transaction(session_id)
        receipt_url = (transaction.respuesta_resumen or {}).get("receipt_url")
        if payment.estado == "PAGADO":
            return StripeCheckoutStatusResponse(
                status="PAGADO",
                message="Stripe confirmó el pago y la compra quedó registrada.",
                order=await self._order_response(order),
                receipt_url=receipt_url,
            )
        if payment.estado in {"CANCELADO", "RECHAZADO"}:
            return StripeCheckoutStatusResponse(
                status=payment.estado,
                message="El pago no se completó y las prendas volvieron a tu carrito.",
                receipt_url=receipt_url,
            )
        return StripeCheckoutStatusResponse(
            status="PROCESANDO",
            message="Stripe está terminando de confirmar el pago.",
            receipt_url=receipt_url,
        )

    async def cancel_stripe_checkout(self, user_id: int, session_id: str) -> None:
        if self.stripe_gateway is None:
            raise PaymentGatewayError("Stripe todavía no está configurado en el servidor")
        customer = await self._customer(user_id)
        _, payment, sale, _ = await self._stripe_transaction(session_id)
        if sale.id_cliente != customer.id_cliente:
            raise CommerceNotFoundError("La sesión de pago no existe")
        if payment.estado == "PAGADO":
            return
        try:
            remote = await self.stripe_gateway.retrieve_session(session_id)
            if remote.get("payment_status") == "paid":
                await self._complete_stripe_checkout(remote)
                return
            if remote.get("status") == "open":
                await self.stripe_gateway.expire_session(session_id)
        except Exception as exc:
            raise PaymentGatewayError("No pudimos cancelar la sesión de Stripe") from exc
        await self._cancel_stripe_checkout(session_id)

    async def _sale_response(self, sale: Venta) -> SaleResponse:
        branch = await self.repository.get(Sucursal, sale.id_sucursal)
        details = await self.repository.sale_details(sale.id_venta)
        items = [
            await self._line(item.id_detalle_venta, item.id_variante, item.cantidad)
            for item in details
        ]
        for response, detail in zip(items, details, strict=True):
            response.precio_unitario = detail.precio_unitario
            response.subtotal = detail.subtotal
        return SaleResponse(
            id_venta=sale.id_venta,
            id_cliente=sale.id_cliente,
            id_sucursal=sale.id_sucursal,
            sucursal=branch.nombre,
            id_empleado=sale.id_empleado,
            id_reserva=sale.id_reserva,
            canal_venta=sale.canal_venta,
            modalidad_entrega=sale.modalidad_entrega,
            estado=sale.estado,
            subtotal=sale.subtotal,
            costo_envio=sale.costo_envio,
            total=sale.total,
            fecha_venta=sale.fecha_venta,
            items=items,
        )

    async def list_sales(
        self, user_id: int, *, branch_id: int | None = None, all_branches: bool = False
    ) -> list[SaleResponse]:
        if not all_branches:
            branch_id = (await self._employee(user_id)).id_sucursal
        return [
            await self._sale_response(item)
            for item in await self.repository.sales(branch_id=branch_id)
        ]

    async def list_customer_sales(self, user_id: int) -> list[SaleResponse]:
        customer = await self._customer(user_id)
        return [
            await self._sale_response(item)
            for item in await self.repository.customer_sales(customer.id_cliente)
        ]

    async def _restore_sale_stock(
        self,
        sale: Venta,
        *,
        employee_id: int | None,
        reference_type: str,
        reference_id: int,
    ) -> None:
        for detail in await self.repository.sale_details(sale.id_venta):
            inventory = await self.repository.inventory_for_update(
                sale.id_sucursal, detail.id_variante
            )
            if inventory is None:
                raise CommerceConflictError("No existe inventario para revertir la venta")
            movement = await self.repository.add(
                MovimientoInventario(
                    id_inventario=inventory.id_inventario,
                    id_empleado=employee_id,
                    tipo_movimiento="DEVOLUCION",
                    cantidad=detail.cantidad,
                    referencia_tipo=reference_type,
                    referencia_id=reference_id,
                    motivo="Cancelación de pedido",
                )
            )
            remaining = detail.cantidad
            allocations = await self.repository.sale_lot_allocations(
                sale.id_venta, detail.id_variante
            )
            for allocation, lot in allocations:
                restored = min(remaining, allocation.cantidad)
                lot.cantidad_disponible += restored
                await self.repository.add(
                    MovimientoLote(
                        id_movimiento=movement.id_movimiento,
                        id_lote=lot.id_lote,
                        cantidad=restored,
                        costo_unitario=allocation.costo_unitario,
                    )
                )
                remaining -= restored
                if not remaining:
                    break
            if remaining:
                raise CommerceConflictError("No fue posible restaurar las capas FIFO de la venta")

    async def _order_response(self, order: Pedido) -> OrderResponse:
        sale = await self.repository.get(Venta, order.id_venta)
        branch = await self.repository.get(Sucursal, sale.id_sucursal)
        address = (
            await self.repository.get(DireccionCliente, order.id_direccion)
            if order.id_direccion
            else None
        )
        sale_response = await self._sale_response(sale)
        payment = await self.repository.payment_by_sale(order.id_venta)
        receipt_url = None
        if payment:
            tx = await self.repository.gateway_transaction_by_payment(payment.id_pago)
            if tx and tx.respuesta_resumen:
                receipt_url = tx.respuesta_resumen.get("receipt_url")
        return OrderResponse(
            id_pedido=order.id_pedido,
            id_venta=order.id_venta,
            estado=order.estado,
            modalidad_entrega=sale.modalidad_entrega,
            id_sucursal=sale.id_sucursal,
            sucursal=branch.nombre,
            direccion_sucursal=branch.direccion,
            id_direccion=order.id_direccion,
            direccion_entrega=address.direccion if address else None,
            total=sale.total,
            fecha_creacion=order.fecha_creacion,
            fecha_preparacion=order.fecha_preparacion,
            fecha_finalizacion=order.fecha_finalizacion,
            items=sale_response.items,
            receipt_url=receipt_url,
        )

    async def list_orders(
        self,
        user_id: int,
        *,
        operational: bool,
        state: str | None = None,
        branch_id: int | None = None,
        all_branches: bool = False,
    ) -> list[OrderResponse]:
        if operational:
            if not all_branches:
                branch_id = (await self._employee(user_id)).id_sucursal
            rows = await self.repository.orders(state=state, branch_id=branch_id)
        else:
            customer = await self._customer(user_id)
            rows = await self.repository.customer_orders(customer.id_cliente)
        return [await self._order_response(item) for item in rows]

    async def get_order(self, user_id: int, order_id: int, *, operational: bool) -> OrderResponse:
        order = await self.repository.get(Pedido, order_id)
        if order is None:
            raise CommerceNotFoundError("El pedido no existe")
        sale = await self.repository.get(Venta, order.id_venta)
        if sale is None or sale.estado != "PAGADA":
            raise CommerceNotFoundError("El pedido no existe")
        if not operational:
            customer = await self._customer(user_id)
            if sale.id_cliente != customer.id_cliente:
                raise CommerceNotFoundError("El pedido no existe")
        return await self._order_response(order)

    async def update_order_status(
        self,
        user_id: int,
        order_id: int,
        payload: OrderStatusUpdate,
        *,
        all_branches: bool = False,
    ) -> OrderResponse:
        employee = await self._employee(user_id)
        order = await self.repository.get(Pedido, order_id)
        if order is None:
            raise CommerceNotFoundError("El pedido no existe")
        sale = await self.repository.get(Venta, order.id_venta)
        if not all_branches and sale.id_sucursal != employee.id_sucursal:
            raise CommerceNotFoundError("El pedido no existe")
        self._validate_transition(order.estado, payload.estado, ORDER_TRANSITIONS)
        if sale.modalidad_entrega == "RETIRO_SUCURSAL" and payload.estado in {
            "LISTO_PARA_ENVIO",
            "EN_CAMINO",
            "ENTREGADO",
        }:
            raise InvalidCommerceOperationError("Ese estado corresponde a un pedido con delivery")
        if sale.modalidad_entrega == "DELIVERY" and payload.estado in {
            "LISTO_PARA_RETIRO",
            "RETIRADO",
        }:
            raise InvalidCommerceOperationError("Ese estado corresponde a retiro en sucursal")
        order.estado = payload.estado
        if payload.estado == "PREPARANDO":
            order.fecha_preparacion = datetime.now(UTC)
        if payload.estado in {"ENTREGADO", "RETIRADO", "CANCELADO"}:
            order.fecha_finalizacion = datetime.now(UTC)
        if payload.estado == "CANCELADO":
            await self._restore_sale_stock(
                sale,
                employee_id=employee.id_empleado,
                reference_type="PEDIDO_CANCELADO",
                reference_id=order.id_pedido,
            )
            sale.estado = "ANULADA"
        customer = await self.repository.get(Cliente, sale.id_cliente) if sale.id_cliente else None
        if customer:
            await self._notify(
                customer.id_usuario,
                f"PEDIDO_{payload.estado}",
                "Estado de pedido actualizado",
                (
                    f"Tu pedido #{order.id_pedido} ahora está "
                    f"{payload.estado.lower().replace('_', ' ')}."
                ),
            )
        await self.session.commit()
        return await self._order_response(order)

    @staticmethod
    def _distance_km(branch: Sucursal, address: DireccionCliente) -> Decimal:
        if None in {branch.latitud, branch.longitud, address.latitud, address.longitud}:
            raise InvalidCommerceOperationError(
                "La sucursal y la dirección necesitan coordenadas para cotizar"
            )
        lat1, lon1, lat2, lon2 = map(
            radians,
            map(float, (branch.latitud, branch.longitud, address.latitud, address.longitud)),
        )
        value = (
            2
            * 6371
            * asin(
                sqrt(
                    sin((lat2 - lat1) / 2) ** 2
                    + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
                )
            )
        )
        return Decimal(str(round(value, 2)))

    async def quote_shipping(self, user_id: int, payload: ShippingQuoteCreate):
        customer = await self._customer(user_id)
        branch = await self.repository.get(Sucursal, payload.id_sucursal)
        address = await self.repository.get(DireccionCliente, payload.id_direccion)
        rate = await self.repository.active_rate()
        if (
            branch is None
            or not branch.activo
            or address is None
            or address.id_cliente != customer.id_cliente
            or not address.activo
        ):
            raise CommerceNotFoundError("No se pudo encontrar la sucursal o dirección")
        if rate is None:
            raise InvalidCommerceOperationError("No existe una tarifa de envío activa")

        route_estimate = None
        if (
            self.route_client
            and branch.latitud is not None
            and branch.longitud is not None
            and address.latitud is not None
            and address.longitud is not None
        ):
            route_estimate = await self.route_client.calculate_route(
                start_lat=float(branch.latitud),
                start_lng=float(branch.longitud),
                end_lat=float(address.latitud),
                end_lng=float(address.longitud),
            )

        if route_estimate:
            distance = route_estimate.distance_km
            duration = route_estimate.duration_min
            provider = route_estimate.provider
        else:
            distance = self._distance_km(branch, address)
            duration = None
            provider = "HAVERSINE"

        cost = (
            rate.tarifa_base
            if distance <= rate.distancia_base_km
            else rate.tarifa_base + (distance - rate.distancia_base_km) * rate.costo_km_adicional
        )
        quote = await self.repository.add(
            CotizacionEnvio(
                id_cliente=customer.id_cliente,
                id_sucursal=branch.id_sucursal,
                id_direccion=address.id_direccion,
                id_tarifa=rate.id_tarifa,
                distancia_km=distance,
                duracion_estimada_min=duration,
                costo_estimado=cost.quantize(Decimal("0.01")),
                proveedor_rutas=provider,
                expira_en=datetime.now(UTC) + timedelta(minutes=30),
            )
        )
        await self.session.commit()
        return quote

    async def create_return(self, user_id: int, payload: ReturnCreate) -> ReturnResponse:
        customer = await self._customer(user_id)
        sale = await self.repository.get(Venta, payload.id_venta)
        if sale is None or sale.id_cliente != customer.id_cliente:
            raise CommerceNotFoundError("La compra no existe")
        if sale.estado not in {"PAGADA", "CONFIRMADA"}:
            raise InvalidCommerceOperationError("La compra no admite devolución")
        sale_details = {
            item.id_detalle_venta: item
            for item in await self.repository.sale_details(sale.id_venta)
        }
        identifiers = [item.id_detalle_venta for item in payload.items]
        if len(identifiers) != len(set(identifiers)):
            raise InvalidCommerceOperationError("No repita un artículo en la devolución")
        for item in payload.items:
            detail = sale_details.get(item.id_detalle_venta)
            if detail is None:
                raise InvalidCommerceOperationError("Un artículo no pertenece a la compra")
            if (
                item.cantidad + await self.repository.returned_quantity(item.id_detalle_venta)
                > detail.cantidad
            ):
                raise CommerceConflictError("La cantidad a devolver supera la cantidad comprada")
        returned = await self.repository.add(
            Devolucion(
                id_venta=sale.id_venta,
                id_cliente=customer.id_cliente,
                motivo=payload.motivo,
                estado="PENDIENTE",
            )
        )
        for item in payload.items:
            await self.repository.add(
                DetalleDevolucion(id_devolucion=returned.id_devolucion, **item.model_dump())
            )
        await self.session.commit()
        return await self._return_response(returned)

    async def _return_response(self, returned: Devolucion) -> ReturnResponse:
        items = []
        for detail in await self.repository.return_details(returned.id_devolucion):
            sale_detail = await self.repository.get(DetalleVenta, detail.id_detalle_venta)
            line = await self._line(
                detail.id_detalle_devolucion, sale_detail.id_variante, detail.cantidad
            )
            items.append(
                ReturnLineResponse(
                    id_detalle_devolucion=detail.id_detalle_devolucion,
                    id_detalle_venta=detail.id_detalle_venta,
                    id_variante=sale_detail.id_variante,
                    producto=line.producto,
                    talla=line.talla,
                    color=line.color,
                    cantidad=detail.cantidad,
                    estado_prenda=detail.estado_prenda,
                )
            )
        return ReturnResponse(
            id_devolucion=returned.id_devolucion,
            id_venta=returned.id_venta,
            motivo=returned.motivo,
            estado=returned.estado,
            fecha_solicitud=returned.fecha_solicitud,
            fecha_resolucion=returned.fecha_resolucion,
            items=items,
        )

    async def list_returns(
        self, user_id: int, *, operational: bool, all_branches: bool = False
    ) -> list[ReturnResponse]:
        if operational:
            branch_id = None if all_branches else (await self._employee(user_id)).id_sucursal
            rows = await self.repository.returns(branch_id=branch_id)
        else:
            rows = await self.repository.customer_returns(
                (await self._customer(user_id)).id_cliente
            )
        return [await self._return_response(item) for item in rows]

    async def update_return_status(
        self,
        user_id: int,
        return_id: int,
        payload: ReturnStatusUpdate,
        *,
        all_branches: bool = False,
    ) -> ReturnResponse:
        employee = await self._employee(user_id)
        returned = await self.repository.get(Devolucion, return_id)
        if returned is None:
            raise CommerceNotFoundError("La devolución no existe")
        sale = await self.repository.get(Venta, returned.id_venta)
        if not all_branches and sale.id_sucursal != employee.id_sucursal:
            raise CommerceNotFoundError("La devolución no existe")
        self._validate_transition(returned.estado, payload.estado, RETURN_TRANSITIONS)
        try:
            if payload.estado == "COMPLETADA":
                for detail in await self.repository.return_details(returned.id_devolucion):
                    if detail.estado_prenda != "APTA_REINGRESO":
                        continue
                    sale_detail = await self.repository.get(DetalleVenta, detail.id_detalle_venta)
                    inventory = await self.repository.inventory_for_update(
                        sale.id_sucursal, sale_detail.id_variante
                    )
                    movement = await self.repository.add(
                        MovimientoInventario(
                            id_inventario=inventory.id_inventario,
                            id_empleado=employee.id_empleado,
                            tipo_movimiento="DEVOLUCION",
                            cantidad=detail.cantidad,
                            referencia_tipo="DEVOLUCION",
                            referencia_id=returned.id_devolucion,
                            motivo=returned.motivo,
                        )
                    )
                    remaining = detail.cantidad
                    restored_before = await self.repository.restored_sale_lots(
                        sale.id_venta, sale_detail.id_variante
                    )
                    for allocation, lot in await self.repository.sale_lot_allocations(
                        sale.id_venta, sale_detail.id_variante
                    ):
                        capacity = max(
                            0,
                            allocation.cantidad - restored_before.get(lot.id_lote, 0),
                        )
                        restored = min(remaining, capacity)
                        if not restored:
                            continue
                        lot.cantidad_disponible += restored
                        await self.repository.add(
                            MovimientoLote(
                                id_movimiento=movement.id_movimiento,
                                id_lote=lot.id_lote,
                                cantidad=restored,
                                costo_unitario=allocation.costo_unitario,
                            )
                        )
                        remaining -= restored
                        if not remaining:
                            break
                    if remaining:
                        raise CommerceConflictError(
                            "No fue posible restaurar las capas FIFO de la venta"
                        )
                returned.fecha_resolucion = datetime.now(UTC)
            elif payload.estado == "RECHAZADA":
                returned.fecha_resolucion = datetime.now(UTC)
            returned.id_empleado = employee.id_empleado
            returned.estado = payload.estado
            customer = (
                await self.repository.get(Cliente, returned.id_cliente)
                if returned.id_cliente
                else None
            )
            if customer:
                await self._notify(
                    customer.id_usuario,
                    f"DEVOLUCION_{payload.estado}",
                    "Estado de devolución actualizado",
                    f"Tu devolución #{returned.id_devolucion} ahora está {payload.estado.lower()}.",
                )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise
        return await self._return_response(returned)

    async def _notify(self, user_id: int, kind: str, title: str, content: str) -> None:
        await self.repository.add(
            Notificacion(
                id_usuario=user_id,
                id_campania=None,
                tipo=kind,
                canal="EMAIL",
                proveedor="SISTEMA",
                titulo=title,
                contenido=content,
                estado="PENDIENTE",
            )
        )

    async def list_notifications(self, user_id: int):
        return await self.repository.notifications(user_id)

    async def supplier_purchase_history(
        self, user_id: int, *, all_branches: bool = False, **filters
    ) -> SupplierPurchaseHistoryPage:
        if not all_branches:
            filters["branch_id"] = (await self._employee(user_id)).id_sucursal
        rows, total = await self.repository.supplier_history(**filters)
        return SupplierPurchaseHistoryPage(
            items=list(rows), total=total, page=filters["page"], page_size=filters["page_size"]
        )
