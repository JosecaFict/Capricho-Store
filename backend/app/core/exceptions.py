import logging

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class DatabaseUnavailableError(RuntimeError):
    """Raised when PostgreSQL cannot serve a readiness query."""


async def database_unavailable_handler(
    request: Request,
    exc: DatabaseUnavailableError,
) -> JSONResponse:
    logger.error(
        "Database readiness check failed",
        extra={"path": request.url.path},
        exc_info=exc,
    )
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Database unavailable"},
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(DatabaseUnavailableError, database_unavailable_handler)

