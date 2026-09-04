from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.modules.inventory.repository import InventoryRepository
from app.modules.inventory.service import InventoryService


async def get_inventory_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AsyncIterator[InventoryService]:
    yield InventoryService(session, InventoryRepository(session))
