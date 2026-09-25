from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.integrations.cloudinary import CloudinaryStorage
from app.modules.virtual_tryon.dependencies import (
    get_optional_cloudinary_storage,
    get_virtual_tryon_service,
)
from app.modules.virtual_tryon.schemas import (
    TryOnTaskCreateResponse,
    TryOnTaskStatusResponse,
)
from app.modules.virtual_tryon.service import VirtualTryOnService

router = APIRouter(prefix="/try-on", tags=["virtual-try-on"])


@router.post(
    "/tasks",
    response_model=TryOnTaskCreateResponse,
    status_code=201,
    summary="Iniciar tarea de prueba virtual de ropa",
)
async def create_tryon_task(
    product_id: Annotated[int, Form(description="ID del producto a probar")],
    file: Annotated[UploadFile, File(description="Fotografía del cliente")],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    service: Annotated[VirtualTryOnService, Depends(get_virtual_tryon_service)],
    storage: Annotated[CloudinaryStorage | None, Depends(get_optional_cloudinary_storage)],
    color_id: Annotated[int | None, Form(description="ID del color seleccionado")] = None,
    color_name: Annotated[str | None, Form(description="Nombre del color")] = None,
) -> TryOnTaskCreateResponse:
    content = await file.read()
    return await service.create_task(
        session=session,
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
    summary="Consultar estado de la prueba virtual",
)
async def get_tryon_task_status(
    task_id: str,
    service: Annotated[VirtualTryOnService, Depends(get_virtual_tryon_service)],
) -> TryOnTaskStatusResponse:
    return await service.get_task_status(task_id)
