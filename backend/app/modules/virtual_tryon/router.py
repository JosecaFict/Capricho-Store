from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.integrations.cloudinary import CloudinaryStorage
from app.modules.auth.dependencies import CurrentPrincipal, get_current_principal
from app.modules.virtual_tryon.dependencies import (
    get_optional_cloudinary_storage,
    get_virtual_tryon_service,
)
from app.modules.virtual_tryon.schemas import (
    TryOnQuotaResponse,
    TryOnTaskCreateResponse,
    TryOnTaskStatusResponse,
)
from app.modules.virtual_tryon.service import VirtualTryOnService

router = APIRouter(prefix="/try-on", tags=["virtual-try-on"])


@router.get(
    "/quota",
    response_model=TryOnQuotaResponse,
    summary="Consultar cuota diaria restante de pruebas virtuales del usuario",
)
async def get_tryon_quota(
    principal: Annotated[CurrentPrincipal, Depends(get_current_principal)],
    service: Annotated[VirtualTryOnService, Depends(get_virtual_tryon_service)],
) -> TryOnQuotaResponse:
    return await service.get_user_quota(principal.user.id_usuario)


@router.post(
    "/tasks",
    response_model=TryOnTaskCreateResponse,
    status_code=201,
    summary="Iniciar tarea de prueba virtual de ropa (Requiere usuario autenticado)",
)
async def create_tryon_task(
    product_id: Annotated[int, Form(description="ID del producto a probar")],
    file: Annotated[UploadFile, File(description="Fotografía del cliente")],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    principal: Annotated[CurrentPrincipal, Depends(get_current_principal)],
    service: Annotated[VirtualTryOnService, Depends(get_virtual_tryon_service)],
    storage: Annotated[CloudinaryStorage | None, Depends(get_optional_cloudinary_storage)],
    color_id: Annotated[int | None, Form(description="ID del color seleccionado")] = None,
    color_name: Annotated[str | None, Form(description="Nombre del color")] = None,
) -> TryOnTaskCreateResponse:
    content = await file.read()
    return await service.create_task(
        session=session,
        user_id=principal.user.id_usuario,
        product_id=product_id,
        color_id=color_id,
        color_name=color_name,
        photo_bytes=content,
        filename=file.filename or "cliente.jpg",
        content_type=file.content_type or "image/jpeg",
        storage=storage,
    )


@router.get(
    "/tasks/{task_id}",
    response_model=TryOnTaskStatusResponse,
    summary="Consultar estado de la prueba virtual y limpiar foto temporal al completar",
)
async def get_tryon_task_status(
    task_id: str,
    principal: Annotated[CurrentPrincipal, Depends(get_current_principal)],
    service: Annotated[VirtualTryOnService, Depends(get_virtual_tryon_service)],
    storage: Annotated[CloudinaryStorage | None, Depends(get_optional_cloudinary_storage)],
) -> TryOnTaskStatusResponse:
    return await service.get_task_status(
        task_id=task_id,
        user_id=principal.user.id_usuario,
        storage=storage,
    )
