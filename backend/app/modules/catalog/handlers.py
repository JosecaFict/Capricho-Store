from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.modules.catalog.exceptions import (
    CatalogConflictError,
    CatalogNotFoundError,
    CatalogStorageError,
    InvalidCatalogDataError,
)


async def not_found_handler(_: Request, exc: CatalogNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": exc.detail})


async def conflict_handler(_: Request, exc: CatalogConflictError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_409_CONFLICT, content={"detail": exc.detail})


async def invalid_data_handler(_: Request, exc: InvalidCatalogDataError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": exc.detail})


async def storage_handler(_: Request, exc: CatalogStorageError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_502_BAD_GATEWAY, content={"detail": exc.detail})


def register_catalog_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(CatalogNotFoundError, not_found_handler)
    app.add_exception_handler(CatalogConflictError, conflict_handler)
    app.add_exception_handler(InvalidCatalogDataError, invalid_data_handler)
    app.add_exception_handler(CatalogStorageError, storage_handler)
