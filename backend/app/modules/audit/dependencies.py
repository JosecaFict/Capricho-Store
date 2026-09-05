from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.modules.audit.repository import AuditRepository
from app.modules.audit.service import AuditService


async def get_audit_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AsyncIterator[AuditService]:
    yield AuditService(AuditRepository(session))
