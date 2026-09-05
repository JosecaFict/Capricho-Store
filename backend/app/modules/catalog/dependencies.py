from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db_session
from app.integrations.cloudinary import CloudinaryError, CloudinaryStorage
from app.modules.catalog.exceptions import CatalogStorageError
from app.modules.catalog.repository import CatalogRepository
from app.modules.catalog.service import CatalogService


async def get_catalog_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AsyncIterator[CatalogService]:
    yield CatalogService(session, CatalogRepository(session))


def get_cloudinary_storage() -> CloudinaryStorage:
    settings = get_settings()
    if not settings.cloudinary_url:
        raise CatalogStorageError("Cloudinary no está configurado")
    try:
        return CloudinaryStorage(settings.cloudinary_url)
    except CloudinaryError as exc:
        raise CatalogStorageError(str(exc)) from exc
