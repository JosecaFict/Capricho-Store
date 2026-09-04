from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response, status

from app.modules.auth.dependencies import (
    CurrentPrincipal,
    build_request_audit_context,
    require_permission,
)
from app.modules.catalog.dependencies import get_catalog_service
from app.modules.catalog.schemas import (
    BrandCreate,
    BrandResponse,
    BrandUpdate,
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    CollectionCreate,
    CollectionRelationRequest,
    CollectionResponse,
    CollectionUpdate,
    ColorCreate,
    ColorResponse,
    ColorUpdate,
    MeasurementResponse,
    MeasurementUpsert,
    PriceCreate,
    PriceResponse,
    ProductCreate,
    ProductImageCreate,
    ProductImageResponse,
    ProductImageUpdate,
    ProductPage,
    ProductResponse,
    ProductUpdate,
    SeasonCreate,
    SeasonRelationRequest,
    SeasonResponse,
    SeasonUpdate,
    SizeResponse,
    VariantCreate,
    VariantResponse,
    VariantUpdate,
)
from app.modules.catalog.service import CatalogService

router = APIRouter(tags=["catalog"])


def audit_context_for(request: Request, principal: CurrentPrincipal):
    return build_request_audit_context(
        request,
        user_id=principal.user.id_usuario,
        session_id=principal.session_id,
    )


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.list_categories()


@router.get("/categories/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: int, service: Annotated[CatalogService, Depends(get_catalog_service)]
):
    return await service.get_category(category_id)


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.crear"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.create_category(payload, audit_context_for(request, principal))


@router.patch("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    payload: CategoryUpdate,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.editar"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.update_category(
        category_id, payload, audit_context_for(request, principal)
    )


@router.get("/brands", response_model=list[BrandResponse])
async def list_brands(service: Annotated[CatalogService, Depends(get_catalog_service)]):
    return await service.list_brands()


@router.get("/brands/{brand_id}", response_model=BrandResponse)
async def get_brand(
    brand_id: int, service: Annotated[CatalogService, Depends(get_catalog_service)]
):
    return await service.get_brand(brand_id)


@router.post("/brands", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
async def create_brand(
    payload: BrandCreate,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.crear"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.create_brand(payload, audit_context_for(request, principal))


@router.patch("/brands/{brand_id}", response_model=BrandResponse)
async def update_brand(
    brand_id: int,
    payload: BrandUpdate,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.editar"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.update_brand(brand_id, payload, audit_context_for(request, principal))


@router.get("/sizes", response_model=list[SizeResponse])
async def list_sizes(service: Annotated[CatalogService, Depends(get_catalog_service)]):
    return await service.list_sizes()


@router.get("/colors", response_model=list[ColorResponse])
async def list_colors(service: Annotated[CatalogService, Depends(get_catalog_service)]):
    return await service.list_colors()


@router.post("/colors", response_model=ColorResponse, status_code=status.HTTP_201_CREATED)
async def create_color(
    payload: ColorCreate,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.crear"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.create_color(payload, audit_context_for(request, principal))


@router.patch("/colors/{color_id}", response_model=ColorResponse)
async def update_color(
    color_id: int,
    payload: ColorUpdate,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.editar"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.update_color(color_id, payload, audit_context_for(request, principal))


@router.get("/seasons", response_model=list[SeasonResponse])
async def list_seasons(service: Annotated[CatalogService, Depends(get_catalog_service)]):
    return await service.list_seasons()


@router.get("/seasons/{season_id}", response_model=SeasonResponse)
async def get_season(
    season_id: int, service: Annotated[CatalogService, Depends(get_catalog_service)]
):
    return await service.get_season(season_id)


@router.post("/seasons", response_model=SeasonResponse, status_code=status.HTTP_201_CREATED)
async def create_season(
    payload: SeasonCreate,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.crear"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.create_season(payload, audit_context_for(request, principal))


@router.patch("/seasons/{season_id}", response_model=SeasonResponse)
async def update_season(
    season_id: int,
    payload: SeasonUpdate,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.editar"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.update_season(season_id, payload, audit_context_for(request, principal))


@router.get("/collections", response_model=list[CollectionResponse])
async def list_collections(service: Annotated[CatalogService, Depends(get_catalog_service)]):
    return await service.list_collections()


@router.get("/collections/{collection_id}", response_model=CollectionResponse)
async def get_collection(
    collection_id: int, service: Annotated[CatalogService, Depends(get_catalog_service)]
):
    return await service.get_collection(collection_id)


@router.post(
    "/collections", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED
)
async def create_collection(
    payload: CollectionCreate,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.crear"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.create_collection(payload, audit_context_for(request, principal))


@router.patch("/collections/{collection_id}", response_model=CollectionResponse)
async def update_collection(
    collection_id: int,
    payload: CollectionUpdate,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.editar"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.update_collection(
        collection_id, payload, audit_context_for(request, principal)
    )


@router.get("/products", response_model=ProductPage)
async def list_products(
    service: Annotated[CatalogService, Depends(get_catalog_service)],
    categoria: str | None = None,
    publico_objetivo: Literal["HOMBRE", "MUJER"] | None = None,
    marca: str | None = None,
    talla: str | None = None,
    color: str | None = None,
    temporada: str | None = None,
    sucursal: int | None = Query(default=None, gt=0),
    permite_vestidor: bool | None = None,
    activo: bool | None = True,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort: Literal["nombre", "-nombre", "precio", "-precio", "created_at", "-created_at"] =
        "nombre",
):
    return await service.list_products(
        category=categoria,
        target=publico_objetivo,
        brand=marca,
        size=talla,
        color=color,
        season=temporada,
        branch_id=sucursal,
        fitting_room=permite_vestidor,
        active=activo,
        page=page,
        page_size=page_size,
        sort=sort,
    )


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    service: Annotated[CatalogService, Depends(get_catalog_service)],
    sucursal: int | None = Query(default=None, gt=0),
):
    return await service.get_product(product_id, sucursal)


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.crear"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.create_product(payload, audit_context_for(request, principal))


@router.patch("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    payload: ProductUpdate,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.editar"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.update_product(product_id, payload, audit_context_for(request, principal))


@router.get("/products/{product_id}/variants", response_model=list[VariantResponse])
async def list_variants(
    product_id: int,
    service: Annotated[CatalogService, Depends(get_catalog_service)],
    sucursal: int | None = Query(default=None, gt=0),
):
    return await service.list_variants(product_id, sucursal)


@router.post(
    "/products/{product_id}/variants",
    response_model=VariantResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_variant(
    product_id: int,
    payload: VariantCreate,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.crear"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.create_variant(
        product_id, payload, audit_context_for(request, principal)
    )


@router.patch("/variants/{variant_id}", response_model=VariantResponse)
async def update_variant(
    variant_id: int,
    payload: VariantUpdate,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.editar"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.update_variant(variant_id, payload, audit_context_for(request, principal))


@router.get("/products/{product_id}/measurements", response_model=list[MeasurementResponse])
async def list_measurements(
    product_id: int, service: Annotated[CatalogService, Depends(get_catalog_service)]
):
    return await service.list_measurements(product_id)


@router.put(
    "/products/{product_id}/measurements/{size_id}", response_model=MeasurementResponse
)
async def upsert_measurement(
    product_id: int,
    size_id: int,
    payload: MeasurementUpsert,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.editar"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.upsert_measurement(
        product_id, size_id, payload, audit_context_for(request, principal)
    )


@router.get("/products/{product_id}/price", response_model=PriceResponse)
async def get_current_price(
    product_id: int, service: Annotated[CatalogService, Depends(get_catalog_service)]
):
    return await service.get_current_price(product_id)


@router.post(
    "/products/{product_id}/price",
    response_model=PriceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def set_price(
    product_id: int,
    payload: PriceCreate,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.editar"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.set_price(
        product_id,
        payload,
        principal.user.id_usuario,
        audit_context_for(request, principal),
    )


@router.get("/products/{product_id}/price-history", response_model=list[PriceResponse])
async def list_price_history(
    product_id: int, service: Annotated[CatalogService, Depends(get_catalog_service)]
):
    return await service.list_price_history(product_id)


@router.get("/products/{product_id}/images", response_model=list[ProductImageResponse])
async def list_images(
    product_id: int, service: Annotated[CatalogService, Depends(get_catalog_service)]
):
    return await service.list_images(product_id)


@router.post(
    "/products/{product_id}/images",
    response_model=ProductImageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_image(
    product_id: int,
    payload: ProductImageCreate,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.editar"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.create_image(product_id, payload, audit_context_for(request, principal))


@router.patch("/product-images/{image_id}", response_model=ProductImageResponse)
async def update_image(
    image_id: int,
    payload: ProductImageUpdate,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.editar"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.update_image(image_id, payload, audit_context_for(request, principal))


@router.get("/products/{product_id}/seasons", response_model=list[SeasonResponse])
async def list_product_seasons(
    product_id: int, service: Annotated[CatalogService, Depends(get_catalog_service)]
):
    return await service.list_product_seasons(product_id)


@router.post("/products/{product_id}/seasons", response_model=SeasonResponse)
async def add_product_season(
    product_id: int,
    payload: SeasonRelationRequest,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.editar"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.add_product_season(
        product_id, payload.id_temporada, audit_context_for(request, principal)
    )


@router.delete("/products/{product_id}/seasons/{season_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_product_season(
    product_id: int,
    season_id: int,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.editar"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    await service.remove_product_season(
        product_id, season_id, audit_context_for(request, principal)
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/products/{product_id}/collections", response_model=list[CollectionResponse])
async def list_product_collections(
    product_id: int, service: Annotated[CatalogService, Depends(get_catalog_service)]
):
    return await service.list_product_collections(product_id)


@router.post("/products/{product_id}/collections", response_model=CollectionResponse)
async def add_product_collection(
    product_id: int,
    payload: CollectionRelationRequest,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.editar"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    return await service.add_product_collection(
        product_id, payload.id_coleccion, audit_context_for(request, principal)
    )


@router.delete(
    "/products/{product_id}/collections/{collection_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_product_collection(
    product_id: int,
    collection_id: int,
    request: Request,
    principal: Annotated[CurrentPrincipal, Depends(require_permission("productos.editar"))],
    service: Annotated[CatalogService, Depends(get_catalog_service)],
):
    await service.remove_product_collection(
        product_id, collection_id, audit_context_for(request, principal)
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
