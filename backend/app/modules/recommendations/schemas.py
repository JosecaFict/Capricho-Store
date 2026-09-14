from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ORMResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)


InteractionType = Literal[
    "VER_PRODUCTO",
    "AGREGAR_CARRITO",
    "QUITAR_CARRITO",
    "USAR_VESTIDOR",
    "COMPRAR",
]


class RecommendationConfigResponse(ORMResponse):
    id_configuracion: int
    peso_categoria: Decimal
    peso_marca: Decimal
    peso_color: Decimal
    peso_talla: Decimal
    peso_temporada: Decimal
    peso_promocion: Decimal
    activo: bool
    created_at: datetime
    suma_pesos: Decimal = Decimal("100.00")


class RecommendationConfigUpdate(BaseModel):
    peso_categoria: Decimal = Field(ge=0, le=100)
    peso_marca: Decimal = Field(ge=0, le=100)
    peso_color: Decimal = Field(ge=0, le=100)
    peso_talla: Decimal = Field(ge=0, le=100)
    peso_temporada: Decimal = Field(ge=0, le=100)
    peso_promocion: Decimal = Field(ge=0, le=100)

    @model_validator(mode="after")
    def validate_sum_100(self) -> "RecommendationConfigUpdate":
        total = (
            self.peso_categoria
            + self.peso_marca
            + self.peso_color
            + self.peso_talla
            + self.peso_temporada
            + self.peso_promocion
        )
        if total != Decimal("100.00") and total != Decimal("100"):
            raise ValueError(
                f"La suma de los 6 pesos debe ser exactamente 100%. Suma actual: {total}%"
            )
        return self


class InteractionCreate(BaseModel):
    id_producto: int
    id_variante: int | None = None
    tipo_interaccion: InteractionType = "VER_PRODUCTO"


class InteractionResponse(ORMResponse):
    id_interaccion: int
    id_cliente: int
    id_producto: int
    id_variante: int | None = None
    tipo_interaccion: str
    fecha_hora: datetime


class RecommendedProductItem(BaseModel):
    id_producto: int
    nombre: str
    categoria: str
    marca: str
    precio_actual: Decimal | None = None
    descuento_porcentaje: Decimal | None = None
    precio_promocional: Decimal | None = None
    imagen_url: str | None = None
    puntuacion: Decimal
    motivo: str | None = None
    desglose: dict[str, Decimal] | None = None


class RecommendationStats(BaseModel):
    total_interacciones: int
    interacciones_por_tipo: dict[str, int]
    clientes_con_interacciones: int
    pesos_activos: dict[str, Decimal]
