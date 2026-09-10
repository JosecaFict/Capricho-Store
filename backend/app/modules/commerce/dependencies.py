from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.modules.commerce.repository import CommerceRepository
from app.modules.commerce.service import CommerceService


async def get_commerce_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AsyncIterator[CommerceService]:
    yield CommerceService(session, CommerceRepository(session))
