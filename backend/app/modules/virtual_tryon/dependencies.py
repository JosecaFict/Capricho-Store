from functools import lru_cache

from app.core.config import get_settings
from app.integrations.cloudinary import CloudinaryError, CloudinaryStorage
from app.modules.virtual_tryon.service import VirtualTryOnService


@lru_cache
def get_virtual_tryon_service() -> VirtualTryOnService:
    return VirtualTryOnService()


def get_optional_cloudinary_storage() -> CloudinaryStorage | None:
    settings = get_settings()
    if not settings.cloudinary_url:
        return None
    try:
        return CloudinaryStorage(settings.cloudinary_url)
    except CloudinaryError:
        return None
