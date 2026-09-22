from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.modules.auth.dependencies import (
    CurrentPrincipal,
    get_current_principal,
    get_optional_principal,
    require_permission,
)
from app.modules.recommendations.dependencies import get_recommendation_service
from app.modules.recommendations.schemas import (
    InteractionCreate,
    InteractionResponse,
    RecommendationConfigResponse,
    RecommendationConfigUpdate,
    RecommendationStats,
    RecommendedProductItem,
)
from app.modules.recommendations.service import RecommendationService

router = APIRouter(tags=["recommendations"])
Service = Annotated[RecommendationService, Depends(get_recommendation_service)]


@router.get("/recommendations", response_model=list[RecommendedProductItem])  # [CU-17] Recomendaciones personalizadas
async def get_personalized_recommendations(
    service: Service,
    principal: Annotated[CurrentPrincipal | None, Depends(get_optional_principal)] = None,
    limit: int = Query(default=8, ge=1, le=24),
):
    user_id = principal.user.id_usuario if principal else None
    return await service.get_personalized_recommendations(user_id=user_id, limit=limit)


@router.get(  # [CU-17] Prendas relacionadas o similares
    "/recommendations/products/{product_id}/related",
    response_model=list[RecommendedProductItem],
)
async def get_related_products(
    product_id: int,
    service: Service,
    limit: int = Query(default=4, ge=1, le=12),
):
    return await service.get_related_products(product_id=product_id, limit=limit)


@router.post(  # [CU-17] Registrar interacción de usuario
    "/recommendations/interaction",
    response_model=InteractionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def record_interaction(
    payload: InteractionCreate,
    principal: Annotated[CurrentPrincipal, Depends(get_current_principal)],
    service: Service,
):
    return await service.record_interaction(
        user_id=principal.user.id_usuario,
        payload=payload,
    )


@router.get(  # [CU-17] Configuración de pesos del algoritmo
    "/admin/recommendations/config",
    response_model=RecommendationConfigResponse,
)
async def get_recommendation_config(
    principal: Annotated[CurrentPrincipal, Depends(require_permission("promociones.gestionar"))],
    service: Service,
):
    return await service.get_config()


@router.put(  # [CU-17] Actualizar pesos de recomendación
    "/admin/recommendations/config",
    response_model=RecommendationConfigResponse,
)
async def update_recommendation_config(
    payload: RecommendationConfigUpdate,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("promociones.gestionar"))],
    service: Service,
):
    return await service.update_config(payload)


@router.get(  # [CU-17] Estadísticas de interacción y conversión
    "/admin/recommendations/stats",
    response_model=RecommendationStats,
)
async def get_recommendation_stats(
    principal: Annotated[CurrentPrincipal, Depends(require_permission("promociones.gestionar"))],
    service: Service,
):
    return await service.get_stats()


@router.get(  # [CU-17] Simular recomendaciones por cliente
    "/admin/recommendations/simulate/{client_id}",
    response_model=list[RecommendedProductItem],
)
async def simulate_recommendations_admin(
    client_id: int,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("promociones.gestionar"))],
    service: Service,
    limit: int = Query(default=6, ge=1, le=12),
):
    return await service.simulate_for_client(client_id=client_id, limit=limit)
