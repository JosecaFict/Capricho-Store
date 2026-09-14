from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.modules.recommendations.repository import RecommendationRepository
from app.modules.recommendations.service import RecommendationService


async def get_recommendation_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AsyncIterator[RecommendationService]:
    repository = RecommendationRepository(session)
    yield RecommendationService(session, repository)
