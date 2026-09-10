from datetime import UTC, date, datetime, time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from app.modules.auth.dependencies import (
    CurrentPrincipal,
    get_current_principal,
    require_permission,
)
from app.modules.auth.exceptions import PermissionDeniedError
from app.modules.commerce.dependencies import get_commerce_service
from app.modules.commerce.exceptions import PaymentGatewayError
from app.modules.commerce.schemas import (
    AddressCreate,
    AddressResponse,
    AddressUpdate,
    CartItemCreate,
    CartItemUpdate,
    CartResponse,
    CheckoutCreate,
    NotificationResponse,
    OrderResponse,
    OrderStatusUpdate,
    ReservationCreate,
    ReservationResponse,
    ReservationStatusUpdate,
    ReturnCreate,
    ReturnResponse,
    ReturnStatusUpdate,
    SaleCreate,
    SaleResponse,
    ShippingQuoteCreate,
    ShippingQuoteResponse,
    StripeCheckoutResponse,
    StripeCheckoutStatusResponse,
    SupplierPurchaseHistoryPage,
)
from app.modules.commerce.service import CommerceService

router = APIRouter(tags=["cycle ii commerce"])
Authenticated = Annotated[CurrentPrincipal, Depends(get_current_principal)]
Service = Annotated[CommerceService, Depends(get_commerce_service)]


@router.get("/cart", response_model=CartResponse)
async def get_cart(principal: Authenticated, service: Service):
    return await service.get_cart(principal.user.id_usuario)


@router.post("/cart/items", response_model=CartResponse, status_code=status.HTTP_201_CREATED)
async def add_cart_item(payload: CartItemCreate, principal: Authenticated, service: Service):
    return await service.add_cart_item(principal.user.id_usuario, payload)


@router.patch("/cart/items/{item_id}", response_model=CartResponse)
async def update_cart_item(
    item_id: int, payload: CartItemUpdate, principal: Authenticated, service: Service
):
    return await service.update_cart_item(principal.user.id_usuario, item_id, payload)


@router.post("/cart/items/{item_id}/remove", response_model=CartResponse)
async def remove_cart_item(item_id: int, principal: Authenticated, service: Service):
    return await service.remove_cart_item(principal.user.id_usuario, item_id)


@router.post("/cart/clear", response_model=CartResponse)
async def clear_cart(principal: Authenticated, service: Service):
    return await service.clear_cart(principal.user.id_usuario)


@router.get("/addresses", response_model=list[AddressResponse])
async def list_addresses(principal: Authenticated, service: Service):
    return await service.list_addresses(principal.user.id_usuario)


@router.post("/addresses", response_model=AddressResponse, status_code=status.HTTP_201_CREATED)
async def create_address(payload: AddressCreate, principal: Authenticated, service: Service):
    return await service.create_address(principal.user.id_usuario, payload)


@router.patch("/addresses/{address_id}", response_model=AddressResponse)
async def update_address(
    address_id: int, payload: AddressUpdate, principal: Authenticated, service: Service
):
    return await service.update_address(principal.user.id_usuario, address_id, payload)


@router.get("/reservations", response_model=list[ReservationResponse])
async def list_customer_reservations(principal: Authenticated, service: Service):
    return await service.list_reservations(principal.user.id_usuario, operational=False)


@router.post(
    "/reservations", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED
)
async def create_reservation(
    payload: ReservationCreate, principal: Authenticated, service: Service
):
    return await service.create_reservation(principal.user.id_usuario, payload)


@router.get("/reservations/{reservation_id}", response_model=ReservationResponse)
async def get_customer_reservation(reservation_id: int, principal: Authenticated, service: Service):
    return await service.get_reservation(
        principal.user.id_usuario, reservation_id, operational=False
    )


@router.post("/reservations/{reservation_id}/cancel", response_model=ReservationResponse)
async def cancel_reservation(reservation_id: int, principal: Authenticated, service: Service):
    return await service.cancel_reservation(principal.user.id_usuario, reservation_id)


@router.get("/admin/reservations", response_model=list[ReservationResponse])
async def list_operational_reservations(
    principal: Annotated[CurrentPrincipal, Depends(require_permission("reservas.ver"))],
    service: Service,
    estado: str | None = None,
    sucursal: int | None = Query(default=None, gt=0),
):
    return await service.list_reservations(
        principal.user.id_usuario,
        operational=True,
        state=estado,
        branch_id=sucursal,
        all_branches="ADMIN" in principal.roles,
    )


@router.patch("/admin/reservations/{reservation_id}/status", response_model=ReservationResponse)
async def update_reservation_status(
    reservation_id: int,
    payload: ReservationStatusUpdate,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("reservas.gestionar"))],
    service: Service,
):
    return await service.update_reservation_status(
        principal.user.id_usuario,
        reservation_id,
        payload,
        all_branches="ADMIN" in principal.roles,
    )


@router.post("/sales/pos", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def create_pos_sale(
    payload: SaleCreate,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("ventas.crear"))],
    service: Service,
):
    if payload.registrar_efectivo and "pagos.registrar" not in principal.permissions:
        raise PermissionDeniedError
    return await service.create_pos_sale(principal.user.id_usuario, payload)


@router.get("/sales", response_model=list[SaleResponse])
async def list_sales(
    principal: Annotated[CurrentPrincipal, Depends(require_permission("ventas.ver"))],
    service: Service,
    sucursal: int | None = Query(default=None, gt=0),
):
    return await service.list_sales(
        principal.user.id_usuario,
        branch_id=sucursal,
        all_branches="ADMIN" in principal.roles,
    )


@router.get("/history/purchases", response_model=list[SaleResponse])
async def customer_purchase_history(principal: Authenticated, service: Service):
    return await service.list_customer_sales(principal.user.id_usuario)


@router.get("/history/reservations", response_model=list[ReservationResponse])
async def customer_reservation_history(principal: Authenticated, service: Service):
    return await service.list_reservations(principal.user.id_usuario, operational=False)


@router.post(
    "/checkout", response_model=StripeCheckoutResponse, status_code=status.HTTP_201_CREATED
)
async def checkout(payload: CheckoutCreate, principal: Authenticated, service: Service):
    return await service.checkout(principal.user.id_usuario, payload)


@router.get("/checkout/{session_id}/status", response_model=StripeCheckoutStatusResponse)
async def stripe_checkout_status(session_id: str, principal: Authenticated, service: Service):
    return await service.stripe_checkout_status(principal.user.id_usuario, session_id)


@router.post("/checkout/{session_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_stripe_checkout(
    session_id: str, principal: Authenticated, service: Service
) -> Response:
    await service.cancel_stripe_checkout(principal.user.id_usuario, session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/payments/stripe/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, service: Service) -> dict[str, bool]:
    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    if not signature:
        raise HTTPException(status_code=400, detail="Falta la firma de Stripe")
    try:
        event = service.construct_stripe_event(payload, signature)
    except PaymentGatewayError:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="La firma de Stripe no es válida") from exc
    await service.process_stripe_event(event)
    return {"received": True}


@router.get("/orders", response_model=list[OrderResponse])
async def list_customer_orders(principal: Authenticated, service: Service):
    return await service.list_orders(principal.user.id_usuario, operational=False)


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_customer_order(order_id: int, principal: Authenticated, service: Service):
    return await service.get_order(principal.user.id_usuario, order_id, operational=False)


@router.get("/admin/orders", response_model=list[OrderResponse])
async def list_operational_orders(
    principal: Annotated[CurrentPrincipal, Depends(require_permission("ventas.ver"))],
    service: Service,
    estado: str | None = None,
    sucursal: int | None = Query(default=None, gt=0),
):
    return await service.list_orders(
        principal.user.id_usuario,
        operational=True,
        state=estado,
        branch_id=sucursal,
        all_branches="ADMIN" in principal.roles,
    )


@router.patch("/admin/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: int,
    payload: OrderStatusUpdate,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("ventas.crear"))],
    service: Service,
):
    return await service.update_order_status(
        principal.user.id_usuario,
        order_id,
        payload,
        all_branches="ADMIN" in principal.roles,
    )


@router.post(
    "/shipping-quotes", response_model=ShippingQuoteResponse, status_code=status.HTTP_201_CREATED
)
async def quote_shipping(payload: ShippingQuoteCreate, principal: Authenticated, service: Service):
    return await service.quote_shipping(principal.user.id_usuario, payload)


@router.get("/returns", response_model=list[ReturnResponse])
async def list_customer_returns(principal: Authenticated, service: Service):
    return await service.list_returns(principal.user.id_usuario, operational=False)


@router.post("/returns", response_model=ReturnResponse, status_code=status.HTTP_201_CREATED)
async def create_return(payload: ReturnCreate, principal: Authenticated, service: Service):
    return await service.create_return(principal.user.id_usuario, payload)


@router.get("/admin/returns", response_model=list[ReturnResponse])
async def list_operational_returns(
    principal: Annotated[CurrentPrincipal, Depends(require_permission("ventas.ver"))],
    service: Service,
):
    return await service.list_returns(
        principal.user.id_usuario,
        operational=True,
        all_branches="ADMIN" in principal.roles,
    )


@router.patch("/admin/returns/{return_id}/status", response_model=ReturnResponse)
async def update_return_status(
    return_id: int,
    payload: ReturnStatusUpdate,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("ventas.crear"))],
    service: Service,
):
    return await service.update_return_status(
        principal.user.id_usuario,
        return_id,
        payload,
        all_branches="ADMIN" in principal.roles,
    )


@router.get("/notifications", response_model=list[NotificationResponse])
async def list_notifications(principal: Authenticated, service: Service):
    return await service.list_notifications(principal.user.id_usuario)


@router.get("/supplier-purchase-history", response_model=SupplierPurchaseHistoryPage)
async def supplier_purchase_history(
    principal: Annotated[CurrentPrincipal, Depends(require_permission("proveedores.ver"))],
    service: Service,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    proveedor: int | None = Query(default=None, gt=0),
    producto: int | None = Query(default=None, gt=0),
    sucursal: int | None = Query(default=None, gt=0),
    estado: str | None = None,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
):
    return await service.supplier_purchase_history(
        principal.user.id_usuario,
        all_branches="ADMIN" in principal.roles,
        page=page,
        page_size=page_size,
        supplier_id=proveedor,
        product_id=producto,
        branch_id=sucursal,
        state=estado,
        date_from=(datetime.combine(fecha_desde, time.min, tzinfo=UTC) if fecha_desde else None),
        date_to=(datetime.combine(fecha_hasta, time.max, tzinfo=UTC) if fecha_hasta else None),
    )
