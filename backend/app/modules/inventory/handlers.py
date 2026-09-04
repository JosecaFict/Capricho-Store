from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.modules.inventory.exceptions import (
    InvalidInventoryOperationError,
    InventoryConflictError,
    InventoryNotFoundError,
)


async def not_found(_: Request, exc: InventoryNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": exc.detail})


async def conflict(_: Request, exc: InventoryConflictError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"detail": exc.detail})


async def invalid(_: Request, exc: InvalidInventoryOperationError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": exc.detail})


def register_inventory_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(InventoryNotFoundError, not_found)
    app.add_exception_handler(InventoryConflictError, conflict)
    app.add_exception_handler(InvalidInventoryOperationError, invalid)
