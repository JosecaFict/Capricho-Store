from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.modules.recommendations.exceptions import (
    InvalidRecommendationConfigError,
    RecommendationNotFoundError,
)


async def not_found_handler(_: Request, exc: RecommendationNotFoundError) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"detail": exc.detail})


async def invalid_config_handler(
    _: Request, exc: InvalidRecommendationConfigError
) -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"detail": exc.detail})


def register_recommendation_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(RecommendationNotFoundError, not_found_handler)
    app.add_exception_handler(InvalidRecommendationConfigError, invalid_config_handler)
