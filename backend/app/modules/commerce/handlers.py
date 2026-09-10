from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.modules.commerce.exceptions import (
    CommerceConflictError,
    CommerceNotFoundError,
    InvalidCommerceOperationError,
)


async def not_found_handler(_: Request, exc: CommerceNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": exc.detail})


async def conflict_handler(_: Request, exc: CommerceConflictError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"detail": exc.detail})


async def invalid_handler(_: Request, exc: InvalidCommerceOperationError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": exc.detail})


def register_commerce_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(CommerceNotFoundError, not_found_handler)
    app.add_exception_handler(CommerceConflictError, conflict_handler)
    app.add_exception_handler(InvalidCommerceOperationError, invalid_handler)
