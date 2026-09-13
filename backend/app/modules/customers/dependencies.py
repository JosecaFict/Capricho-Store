from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.modules.customers.service import CustomerAdminService


def get_customer_admin_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> CustomerAdminService:
    return CustomerAdminService(session)
