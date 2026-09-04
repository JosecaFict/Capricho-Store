from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

PurchaseState = Literal[
    "SOLICITADA", "CONFIRMADA", "EN_TRANSITO", "PARCIAL", "RECIBIDA", "CANCELADA"
]
TransferState = Literal["SOLICITADA", "APROBADA", "EN_TRANSITO", "RECIBIDA", "CANCELADA"]
AdjustmentType = Literal["AJUSTE_POSITIVO", "AJUSTE_NEGATIVO"]


class ORMResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SupplierCreate(BaseModel):
    id_ciudad: int | None = Field(default=None, gt=0)
    razon_social: str = Field(min_length=1, max_length=150)
    nombre_comercial: str | None = Field(default=None, max_length=150)
    nit: str | None = Field(default=None, max_length=40)
    telefono: str | None = Field(default=None, max_length=30)
    correo: EmailStr | None = None
    direccion: str | None = Field(default=None, max_length=255)
    nombre_contacto: str | None = Field(default=None, max_length=120)
    telefono_contacto: str | None = Field(default=None, max_length=30)
    correo_contacto: EmailStr | None = None
    activo: bool = True


class SupplierUpdate(BaseModel):
    id_ciudad: int | None = Field(default=None, gt=0)
    razon_social: str | None = Field(default=None, min_length=1, max_length=150)
    nombre_comercial: str | None = Field(default=None, max_length=150)
    nit: str | None = Field(default=None, max_length=40)
    telefono: str | None = Field(default=None, max_length=30)
    correo: EmailStr | None = None
    direccion: str | None = Field(default=None, max_length=255)
    nombre_contacto: str | None = Field(default=None, max_length=120)
    telefono_contacto: str | None = Field(default=None, max_length=30)
    correo_contacto: EmailStr | None = None
    activo: bool | None = None

    @model_validator(mode="after")
    def has_fields(self) -> "SupplierUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field is required")
        return self


class SupplierResponse(ORMResponse):
    id_proveedor: int
    id_ciudad: int | None
    razon_social: str
    nombre_comercial: str | None
    nit: str | None
    telefono: str | None
    correo: EmailStr | None
    direccion: str | None
    nombre_contacto: str | None
    telefono_contacto: str | None
    correo_contacto: EmailStr | None
    activo: bool
    created_at: datetime
    updated_at: datetime


class SupplierProductRequest(BaseModel):
    codigo_proveedor: str | None = Field(default=None, max_length=100)


class SupplierProductResponse(ORMResponse):
    id_producto_proveedor: int
    id_producto: int
    producto: str
    codigo_proveedor: str | None
    activo: bool


class PurchaseDetailCreate(BaseModel):
    id_variante: int = Field(gt=0)
    cantidad: int = Field(gt=0)
    costo_unitario_estimado: Decimal | None = Field(default=None, ge=0)


class PurchaseOrderCreate(BaseModel):
    id_proveedor: int = Field(gt=0)
    id_sucursal: int = Field(gt=0)
    id_empleado: int | None = Field(default=None, gt=0)
    fecha_estimada: date | None = None
    observacion: str | None = None
    detalles: list[PurchaseDetailCreate] = Field(min_length=1)


class PurchaseOrderUpdate(BaseModel):
    estado: PurchaseState | None = None
    fecha_estimada: date | None = None
    observacion: str | None = None

    @model_validator(mode="after")
    def has_fields(self) -> "PurchaseOrderUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field is required")
        return self


class PurchaseDetailResponse(ORMResponse):
    id_detalle_orden: int
    id_variante: int
    cantidad: int
    costo_unitario_estimado: Decimal | None


class PurchaseOrderResponse(ORMResponse):
    id_orden_compra: int
    id_proveedor: int
    id_sucursal: int
    id_empleado: int | None
    estado: PurchaseState
    fecha_orden: datetime
    fecha_estimada: date | None
    observacion: str | None
    detalles: list[PurchaseDetailResponse]


class ReceiptDetailCreate(BaseModel):
    id_variante: int = Field(gt=0)
    cantidad_recibida: int = Field(gt=0)
    costo_unitario: Decimal = Field(ge=0)
    numero_lote: str | None = Field(default=None, max_length=100)


class ReceiptCreate(BaseModel):
    id_orden_compra: int = Field(gt=0)
    id_empleado: int | None = Field(default=None, gt=0)
    observacion: str | None = None
    detalles: list[ReceiptDetailCreate] = Field(min_length=1)


class ReceiptDetailResponse(ORMResponse):
    id_detalle_recepcion: int
    id_variante: int
    cantidad_recibida: int
    costo_unitario: Decimal
    id_lote: int


class ReceiptResponse(ORMResponse):
    id_recepcion: int
    id_orden_compra: int | None
    id_sucursal: int
    id_empleado: int | None
    fecha_recepcion: datetime
    estado: str
    observacion: str | None
    detalles: list[ReceiptDetailResponse]


class LotResponse(ORMResponse):
    id_lote: int
    id_detalle_recepcion: int
    id_sucursal: int
    id_variante: int
    numero_lote: str | None
    cantidad_inicial: int
    cantidad_disponible: int
    costo_unitario: Decimal
    fecha_ingreso: datetime
    activo: bool


class InventoryResponse(ORMResponse):
    id_inventario: int
    id_sucursal: int
    sucursal: str
    id_variante: int
    sku: str
    producto: str
    talla: str
    color: str
    categoria: str
    stock_fisico: int
    stock_reservado: int
    stock_minimo: int
    stock_disponible: int
    estado_stock: Literal["DISPONIBLE", "STOCK_BAJO", "AGOTADO"]
    costo_promedio_ponderado: Decimal | None


class MinimumStockUpdate(BaseModel):
    stock_minimo: int = Field(ge=0)


class MovementLotResponse(ORMResponse):
    id_lote: int
    cantidad: int
    costo_unitario: Decimal


class MovementResponse(ORMResponse):
    id_movimiento: int
    id_inventario: int
    id_empleado: int | None
    tipo_movimiento: str
    cantidad: int
    referencia_tipo: str | None
    referencia_id: int | None
    motivo: str | None
    fecha_hora: datetime
    costo_fifo_consumido: Decimal
    lotes: list[MovementLotResponse]


class AdjustmentCreate(BaseModel):
    tipo: AdjustmentType
    cantidad: int = Field(gt=0)
    motivo: str = Field(min_length=1, max_length=255)
    costo_unitario: Decimal | None = Field(default=None, ge=0)
    id_detalle_recepcion: int | None = Field(default=None, gt=0)

class TransferDetailCreate(BaseModel):
    id_variante: int = Field(gt=0)
    cantidad: int = Field(gt=0)


class TransferCreate(BaseModel):
    id_sucursal_origen: int = Field(gt=0)
    id_sucursal_destino: int = Field(gt=0)
    id_empleado: int | None = Field(default=None, gt=0)
    detalles: list[TransferDetailCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def different_branches(self) -> "TransferCreate":
        if self.id_sucursal_origen == self.id_sucursal_destino:
            raise ValueError("Origin and destination branches must differ")
        return self


class TransferStatusUpdate(BaseModel):
    estado: TransferState


class TransferResponse(ORMResponse):
    id_transferencia: int
    id_sucursal_origen: int
    id_sucursal_destino: int
    id_empleado: int | None
    estado: TransferState
    fecha_solicitud: datetime
    fecha_recepcion: datetime | None
    detalles: list[TransferDetailCreate]
