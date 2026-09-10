from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ReservationState = Literal[
    "PENDIENTE",
    "CONFIRMADA",
    "PREPARANDO",
    "LISTA",
    "CLIENTE_PRESENTE",
    "CONVERTIDA",
    "CANCELADA",
    "EXPIRADA",
]
OrderState = Literal[
    "PENDIENTE",
    "PREPARANDO",
    "LISTO_PARA_RETIRO",
    "LISTO_PARA_ENVIO",
    "RECOGIDO",
    "EN_CAMINO",
    "ENTREGADO",
    "RETIRADO",
    "CANCELADO",
]
ReturnState = Literal["PENDIENTE", "APROBADA", "RECHAZADA", "COMPLETADA"]
DeliveryMode = Literal["ENTREGA_DIRECTA", "RETIRO_SUCURSAL", "DELIVERY"]


class ORMResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class CommerceLineRequest(BaseModel):
    id_variante: int = Field(gt=0)
    cantidad: int = Field(gt=0)


class CommerceLineResponse(ORMResponse):
    id_detalle: int
    id_variante: int
    sku: str
    producto: str
    talla: str
    color: str
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal
    stock_disponible: int
    activo: bool
    imagen_url: str | None = None


class CartItemCreate(CommerceLineRequest):
    pass


class CartItemUpdate(BaseModel):
    cantidad: int = Field(gt=0)


class CartResponse(ORMResponse):
    id_carrito: int
    estado: str
    items: list[CommerceLineResponse]
    total: Decimal


class AddressCreate(BaseModel):
    id_ciudad: int = Field(gt=0)
    alias: str | None = Field(default=None, max_length=60)
    zona: str | None = Field(default=None, max_length=120)
    direccion: str = Field(min_length=3, max_length=255)
    referencia: str | None = Field(default=None, max_length=255)
    latitud: Decimal | None = Field(default=None, ge=-90, le=90)
    longitud: Decimal | None = Field(default=None, ge=-180, le=180)
    place_id: str | None = Field(default=None, max_length=255)
    es_principal: bool = False

    @model_validator(mode="after")
    def coordinates_are_paired(self) -> "AddressCreate":
        if (self.latitud is None) != (self.longitud is None):
            raise ValueError("Latitud y longitud deben enviarse juntas")
        return self


class AddressUpdate(BaseModel):
    id_ciudad: int | None = Field(default=None, gt=0)
    alias: str | None = Field(default=None, max_length=60)
    zona: str | None = Field(default=None, max_length=120)
    direccion: str | None = Field(default=None, min_length=3, max_length=255)
    referencia: str | None = Field(default=None, max_length=255)
    latitud: Decimal | None = Field(default=None, ge=-90, le=90)
    longitud: Decimal | None = Field(default=None, ge=-180, le=180)
    place_id: str | None = Field(default=None, max_length=255)
    es_principal: bool | None = None
    activo: bool | None = None

    @model_validator(mode="after")
    def has_fields(self) -> "AddressUpdate":
        if not self.model_fields_set:
            raise ValueError("Debe enviar al menos un campo")
        if ("latitud" in self.model_fields_set) != ("longitud" in self.model_fields_set):
            raise ValueError("Latitud y longitud deben actualizarse juntas")
        return self


class AddressResponse(ORMResponse):
    id_direccion: int
    id_ciudad: int
    ciudad: str
    alias: str | None
    zona: str | None
    direccion: str
    referencia: str | None
    latitud: Decimal | None
    longitud: Decimal | None
    es_principal: bool
    activo: bool


class ReservationCreate(BaseModel):
    id_sucursal: int = Field(gt=0)
    fecha_cita: datetime | None = None
    observacion: str | None = Field(default=None, max_length=1000)
    items: list[CommerceLineRequest] = Field(min_length=1)


class ReservationStatusUpdate(BaseModel):
    estado: ReservationState


class ReservationResponse(ORMResponse):
    id_reserva: int
    id_sucursal: int
    sucursal: str
    direccion_sucursal: str
    fecha_reserva: datetime
    fecha_cita: datetime | None
    fecha_expiracion: datetime | None
    estado: ReservationState
    observacion: str | None
    items: list[CommerceLineResponse]


class SaleCreate(BaseModel):
    id_sucursal: int = Field(gt=0)
    id_cliente: int | None = Field(default=None, gt=0)
    id_reserva: int | None = Field(default=None, gt=0)
    modalidad_entrega: DeliveryMode = "ENTREGA_DIRECTA"
    items: list[CommerceLineRequest] = Field(min_length=1)
    registrar_efectivo: bool = True


class CheckoutCreate(BaseModel):
    id_sucursal: int = Field(gt=0)
    modalidad_entrega: Literal["RETIRO_SUCURSAL", "DELIVERY"]
    id_direccion: int | None = Field(default=None, gt=0)
    id_cotizacion: int | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def delivery_requires_address(self) -> "CheckoutCreate":
        if self.modalidad_entrega == "DELIVERY" and self.id_direccion is None:
            raise ValueError("Delivery requiere una dirección")
        if self.modalidad_entrega == "DELIVERY" and self.id_cotizacion is None:
            raise ValueError("Delivery requiere una cotización vigente")
        if self.modalidad_entrega == "RETIRO_SUCURSAL" and self.id_direccion is not None:
            raise ValueError("Retiro en sucursal no requiere dirección")
        return self


class SaleResponse(ORMResponse):
    id_venta: int
    id_cliente: int | None
    id_sucursal: int
    sucursal: str
    id_empleado: int | None
    id_reserva: int | None
    canal_venta: str
    modalidad_entrega: DeliveryMode
    estado: str
    subtotal: Decimal
    costo_envio: Decimal
    total: Decimal
    fecha_venta: datetime
    items: list[CommerceLineResponse]


class OrderStatusUpdate(BaseModel):
    estado: OrderState


class OrderResponse(ORMResponse):
    id_pedido: int
    id_venta: int
    estado: OrderState
    modalidad_entrega: DeliveryMode
    id_sucursal: int
    sucursal: str
    direccion_sucursal: str
    id_direccion: int | None
    direccion_entrega: str | None
    total: Decimal
    fecha_creacion: datetime
    fecha_preparacion: datetime | None
    fecha_finalizacion: datetime | None
    items: list[CommerceLineResponse]


class ShippingQuoteCreate(BaseModel):
    id_sucursal: int = Field(gt=0)
    id_direccion: int = Field(gt=0)


class ShippingQuoteResponse(ORMResponse):
    id_cotizacion: int
    id_sucursal: int
    id_direccion: int
    distancia_km: Decimal
    duracion_estimada_min: int | None
    costo_estimado: Decimal
    proveedor_rutas: str
    fecha_cotizacion: datetime
    expira_en: datetime | None


class ReturnLineCreate(BaseModel):
    id_detalle_venta: int = Field(gt=0)
    cantidad: int = Field(gt=0)
    estado_prenda: Literal["APTA_REINGRESO", "NO_APTA"] = "APTA_REINGRESO"


class ReturnCreate(BaseModel):
    id_venta: int = Field(gt=0)
    motivo: str = Field(min_length=3, max_length=255)
    items: list[ReturnLineCreate] = Field(min_length=1)


class ReturnStatusUpdate(BaseModel):
    estado: ReturnState


class ReturnLineResponse(ORMResponse):
    id_detalle_devolucion: int
    id_detalle_venta: int
    id_variante: int
    producto: str
    talla: str
    color: str
    cantidad: int
    estado_prenda: str


class ReturnResponse(ORMResponse):
    id_devolucion: int
    id_venta: int
    motivo: str
    estado: ReturnState
    fecha_solicitud: datetime
    fecha_resolucion: datetime | None
    items: list[ReturnLineResponse]


class NotificationResponse(ORMResponse):
    id_notificacion: int
    tipo: str
    titulo: str | None
    contenido: str
    estado: str
    fecha_creacion: datetime


class SupplierPurchaseHistoryItem(BaseModel):
    fecha_recepcion: datetime
    proveedor: str
    id_orden_compra: int | None
    id_recepcion: int
    producto: str
    id_variante: int
    sku: str
    talla: str
    color: str
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal
    total_compra: Decimal
    sucursal: str
    estado: str
    usuario_responsable: str | None


class SupplierPurchaseHistoryPage(BaseModel):
    items: list[SupplierPurchaseHistoryItem]
    total: int
    page: int
    page_size: int
