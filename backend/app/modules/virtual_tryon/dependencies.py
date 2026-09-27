from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from redis.asyncio import Redis

from app.core.config import Settings, get_settings
from app.integrations.cloudinary import CloudinaryError, CloudinaryStorage
from app.modules.virtual_tryon.service import (
    MemoryTryOnStore,
    RedisTryOnStore,
    TryOnStore,
    VirtualTryOnService,
)

_shared_memory_store = MemoryTryOnStore()


async def get_tryon_store(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AsyncGenerator[TryOnStore, None]:
    redis_client = None
    if settings.redis_url:
        try:
            redis_client = Redis.from_url(settings.redis_url, decode_responses=True)
            store = RedisTryOnStore(redis_client, fallback=_shared_memory_store)
        except Exception:
            store = _shared_memory_store
    else:
        store = _shared_memory_store

    try:
        yield store
    finally:
        if redis_client is not None:
            await redis_client.aclose()


async def get_virtual_tryon_service(
    settings: Annotated[Settings, Depends(get_settings)],
    store: Annotated[TryOnStore, Depends(get_tryon_store)],
) -> VirtualTryOnService:
    return VirtualTryOnService(settings=settings, store=store)


def get_optional_cloudinary_storage() -> CloudinaryStorage | None:
    settings = get_settings()
    if not settings.cloudinary_url:
        return None
    try:
        return CloudinaryStorage(settings.cloudinary_url)
    except CloudinaryError:
        return None
