from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.modules.catalog.repository import CatalogRepository
from app.modules.catalog.service import CatalogService


async def get_catalog_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AsyncIterator[CatalogService]:
    yield CatalogService(session, CatalogRepository(session))
