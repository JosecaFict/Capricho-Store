from collections.abc import AsyncIterator
from unittest.mock import AsyncMock, Mock

from httpx import ASGITransport, AsyncClient
from sqlalchemy.exc import OperationalError

from app.db.session import get_db_session
from app.main import app


async def test_health_reports_running_application() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "service": "Capricho Store Test API",
        "environment": "test",
    }


async def test_ready_executes_database_check() -> None:
    session = AsyncMock()
    result = Mock()
    result.scalar_one.return_value = 1
    session.execute.return_value = result

    async def override_session() -> AsyncIterator[AsyncMock]:
        yield session

    app.dependency_overrides[get_db_session] = override_session
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/ready")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "database": "available"}
    session.execute.assert_awaited_once()


async def test_ready_returns_503_when_database_is_unavailable() -> None:
    session = AsyncMock()
    session.execute.side_effect = OperationalError("SELECT 1", {}, OSError("offline"))

    async def override_session() -> AsyncIterator[AsyncMock]:
        yield session

    app.dependency_overrides[get_db_session] = override_session
    try:
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/v1/ready")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}
