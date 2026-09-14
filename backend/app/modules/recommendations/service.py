import logging
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.commerce.repository import CommerceRepository
from app.modules.recommendations.exceptions import (
    InvalidRecommendationConfigError,
    RecommendationNotFoundError,
)
from app.modules.recommendations.repository import RecommendationRepository
from app.modules.recommendations.schemas import (
    InteractionCreate,
    InteractionResponse,
    RecommendationConfigResponse,
    RecommendationConfigUpdate,
    RecommendationStats,
    RecommendedProductItem,
)

logger = logging.getLogger(__name__)


class RecommendationService:
    def __init__(
        self,
        session: AsyncSession,
        repository: RecommendationRepository,
    ) -> None:
        self.session = session
        self.repository = repository

    async def get_config(self) -> RecommendationConfigResponse:
        config = await self.repository.get_active_config()
        total = (
            config.peso_categoria
            + config.peso_marca
            + config.peso_color
            + config.peso_talla
            + config.peso_temporada
            + config.peso_promocion
        )
        return RecommendationConfigResponse(
            id_configuracion=config.id_configuracion,
            peso_categoria=config.peso_categoria,
            peso_marca=config.peso_marca,
            peso_color=config.peso_color,
            peso_talla=config.peso_talla,
            peso_temporada=config.peso_temporada,
            peso_promocion=config.peso_promocion,
            activo=config.activo,
            created_at=config.created_at,
            suma_pesos=total,
        )

    async def update_config(
        self, payload: RecommendationConfigUpdate
    ) -> RecommendationConfigResponse:
        total = (
            payload.peso_categoria
            + payload.peso_marca
            + payload.peso_color
            + payload.peso_talla
            + payload.peso_temporada
            + payload.peso_promocion
        )
        if total != Decimal("100.00") and total != Decimal("100"):
            raise InvalidRecommendationConfigError(
                f"La suma de los pesos debe ser exactamente 100%. Suma actual: {total}%"
            )

        updated = await self.repository.update_active_config(payload)
        await self.session.commit()
        return RecommendationConfigResponse(
            id_configuracion=updated.id_configuracion,
            peso_categoria=updated.peso_categoria,
            peso_marca=updated.peso_marca,
            peso_color=updated.peso_color,
            peso_talla=updated.peso_talla,
            peso_temporada=updated.peso_temporada,
            peso_promocion=updated.peso_promocion,
            activo=updated.activo,
            created_at=updated.created_at,
            suma_pesos=total,
        )

    async def record_interaction(
        self,
        user_id: int,
        payload: InteractionCreate,
    ) -> InteractionResponse:
        client = await self.repository.get_client_by_user_id(user_id)
        if not client:
            raise RecommendationNotFoundError("Cliente no encontrado para el usuario")

        item = await self.repository.record_interaction(
            client_id=client.id_cliente,
            product_id=payload.id_producto,
            variant_id=payload.id_variante,
            interaction_type=payload.tipo_interaccion,
        )
        await self.session.commit()
        return InteractionResponse(
            id_interaccion=item.id_interaccion,
            id_cliente=item.id_cliente,
            id_producto=item.id_producto,
            id_variante=item.id_variante,
            tipo_interaccion=item.tipo_interaccion,
            fecha_hora=item.fecha_hora,
        )

    async def get_personalized_recommendations(
        self, user_id: int | None = None, limit: int = 8
    ) -> list[RecommendedProductItem]:
        client_id: int | None = None
        if user_id:
            client = await self.repository.get_client_by_user_id(user_id)
            if client:
                client_id = client.id_cliente

        return await self._compute_recommendations_for_client(client_id, limit=limit)

    async def get_related_products(
        self, product_id: int, limit: int = 4
    ) -> list[RecommendedProductItem]:
        candidates = await self.repository.get_catalog_products_for_scoring(limit=50)
        target = next((c for c in candidates if c["id_producto"] == product_id), None)
        if not target:
            return []

        # Find products in same category or brand, excluding current product
        related = [c for c in candidates if c["id_producto"] != product_id]

        commerce_repo = CommerceRepository(self.session)
        discounts = await commerce_repo.get_active_discounts_for_products(
            [r["id_producto"] for r in related]
        )

        results: list[RecommendedProductItem] = []
        for r in related:
            score = Decimal("50.00")
            reason = "Prenda con estilo similar"
            if r["id_categoria"] == target["id_categoria"]:
                score += Decimal("30.00")
                reason = f"Más opciones en {r['categoria']}"
            if r["id_marca"] == target["id_marca"]:
                score += Decimal("15.00")
                reason = f"Misma marca: {r['marca']}"
            if bool(r["color_ids"] & target["color_ids"]):
                score += Decimal("5.00")

            disc = discounts.get(r["id_producto"])
            descuento_pct = disc[0] if disc else None
            precio_prom = None
            if disc and r["precio_actual"]:
                precio_prom = (
                    r["precio_actual"] * (Decimal("1.00") - (disc[0] / Decimal("100")))
                ).quantize(Decimal("0.01"))

            results.append(
                RecommendedProductItem(
                    id_producto=r["id_producto"],
                    nombre=r["nombre"],
                    categoria=r["categoria"],
                    marca=r["marca"],
                    precio_actual=r["precio_actual"],
                    descuento_porcentaje=descuento_pct,
                    precio_promocional=precio_prom,
                    imagen_url=r["imagen_url"],
                    puntuacion=min(score, Decimal("100.00")),
                    motivo=reason,
                )
            )

        results.sort(key=lambda x: x.puntuacion, reverse=True)
        return results[:limit]

    async def get_stats(self) -> RecommendationStats:
        stats = await self.repository.get_interaction_stats()
        config = await self.repository.get_active_config()
        return RecommendationStats(
            total_interacciones=stats["total_interacciones"],
            interacciones_por_tipo=stats["interacciones_por_tipo"],
            clientes_con_interacciones=stats["clientes_con_interacciones"],
            pesos_activos={
                "categoria": config.peso_categoria,
                "marca": config.peso_marca,
                "color": config.peso_color,
                "talla": config.peso_talla,
                "temporada": config.peso_temporada,
                "promocion": config.peso_promocion,
            },
        )

    async def simulate_for_client(
        self, client_id: int, limit: int = 6
    ) -> list[RecommendedProductItem]:
        return await self._compute_recommendations_for_client(client_id, limit=limit)

    async def _compute_recommendations_for_client(
        self, client_id: int | None, limit: int = 8
    ) -> list[RecommendedProductItem]:
        config = await self.repository.get_active_config()
        candidates = await self.repository.get_catalog_products_for_scoring(limit=80)
        active_season_ids = await self.repository.get_active_season_ids()

        commerce_repo = CommerceRepository(self.session)
        product_ids = [c["id_producto"] for c in candidates]
        discounts = await commerce_repo.get_active_discounts_for_products(product_ids)

        profile = (
            await self.repository.get_client_preference_profile(client_id)
            if client_id
            else {
                "categories": {},
                "brands": {},
                "colors": {},
                "sizes": {},
            }
        )

        has_profile = (
            bool(profile["categories"])
            or bool(profile["brands"])
            or bool(profile["colors"])
            or bool(profile["sizes"])
        )

        max_cat = max(profile["categories"].values(), default=1.0) or 1.0
        max_brand = max(profile["brands"].values(), default=1.0) or 1.0
        max_color = max(profile["colors"].values(), default=1.0) or 1.0
        max_size = max(profile["sizes"].values(), default=1.0) or 1.0

        scored_items: list[RecommendedProductItem] = []

        for c in candidates:
            pid = c["id_producto"]
            desglose: dict[str, Decimal] = {}

            # Category
            cat_sim = Decimal(str(profile["categories"].get(c["id_categoria"], 0.0) / max_cat))
            cat_sim = max(Decimal("0.0"), min(Decimal("1.0"), cat_sim))
            cat_pts = (config.peso_categoria * cat_sim).quantize(Decimal("0.01"))
            desglose["categoria"] = cat_pts

            # Brand
            brand_sim = Decimal(str(profile["brands"].get(c["id_marca"], 0.0) / max_brand))
            brand_sim = max(Decimal("0.0"), min(Decimal("1.0"), brand_sim))
            brand_pts = (config.peso_marca * brand_sim).quantize(Decimal("0.01"))
            desglose["marca"] = brand_pts

            # Color
            matched_color_score = max(
                (profile["colors"].get(col_id, 0.0) for col_id in c["color_ids"]),
                default=0.0,
            )
            color_sim = Decimal(str(matched_color_score / max_color))
            color_sim = max(Decimal("0.0"), min(Decimal("1.0"), color_sim))
            color_pts = (config.peso_color * color_sim).quantize(Decimal("0.01"))
            desglose["color"] = color_pts

            # Size
            matched_size_score = max(
                (profile["sizes"].get(sz_id, 0.0) for sz_id in c["size_ids"]),
                default=0.0,
            )
            size_sim = Decimal(str(matched_size_score / max_size))
            size_sim = max(Decimal("0.0"), min(Decimal("1.0"), size_sim))
            size_pts = (config.peso_talla * size_sim).quantize(Decimal("0.01"))
            desglose["talla"] = size_pts

            # Season
            is_active_season = bool(c["temporada_ids"] & active_season_ids)
            season_pts = (
                config.peso_temporada if is_active_season else Decimal("0.00")
            ).quantize(Decimal("0.01"))
            desglose["temporada"] = season_pts

            # Promotion
            has_promo = pid in discounts
            promo_pts = (
                config.peso_promocion if has_promo else Decimal("0.00")
            ).quantize(Decimal("0.01"))
            desglose["promocion"] = promo_pts

            # Total score
            score = sum(desglose.values(), Decimal("0.00")).quantize(Decimal("0.01"))

            # Determine best reason
            reason = "Prenda destacada de la tienda"
            if has_profile:
                best_factor = max(desglose.items(), key=lambda item: item[1])
                if best_factor[0] == "categoria" and best_factor[1] > 0:
                    reason = f"Por tu preferencia en {c['categoria']}"
                elif best_factor[0] == "marca" and best_factor[1] > 0:
                    reason = f"Por tu afinidad con la marca {c['marca']}"
                elif best_factor[0] == "color" and best_factor[1] > 0:
                    reason = "Disponible en tus colores preferidos"
                elif best_factor[0] == "promocion" and best_factor[1] > 0:
                    reason = "En oferta especial para ti"
                elif best_factor[0] == "temporada" and best_factor[1] > 0:
                    reason = "Tendencia de la temporada actual"
            else:
                # Cold start: boost season and promo
                if has_promo:
                    score += Decimal("20.00")
                    reason = "Oferta con descuento vigente"
                elif is_active_season:
                    score += Decimal("15.00")
                    reason = "Colección de temporada"

            disc = discounts.get(pid)
            descuento_pct = disc[0] if disc else None
            precio_prom = None
            if disc and c["precio_actual"]:
                precio_prom = (
                    c["precio_actual"] * (Decimal("1.00") - (disc[0] / Decimal("100")))
                ).quantize(Decimal("0.01"))

            scored_items.append(
                RecommendedProductItem(
                    id_producto=pid,
                    nombre=c["nombre"],
                    categoria=c["categoria"],
                    marca=c["marca"],
                    precio_actual=c["precio_actual"],
                    descuento_porcentaje=descuento_pct,
                    precio_promocional=precio_prom,
                    imagen_url=c["imagen_url"],
                    puntuacion=min(score, Decimal("100.00")),
                    motivo=reason,
                    desglose=desglose,
                )
            )

        scored_items.sort(key=lambda x: x.puntuacion, reverse=True)
        return scored_items[:limit]
