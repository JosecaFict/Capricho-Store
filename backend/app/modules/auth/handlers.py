from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.modules.auth.exceptions import (
    EmailAlreadyRegisteredError,
    InactiveUserError,
    InvalidCredentialsError,
    PermissionDeniedError,
    SecurityConfigurationError,
)


async def email_already_registered_handler(
    _: Request,
    __: EmailAlreadyRegisteredError,
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "Email already registered"},
    )


async def invalid_credentials_handler(
    _: Request,
    __: InvalidCredentialsError,
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": "Invalid credentials"},
        headers={"WWW-Authenticate": "Bearer"},
    )


async def inactive_user_handler(_: Request, exc: InactiveUserError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"detail": f"User is {exc.state.lower()}"},
    )


async def permission_denied_handler(
    _: Request,
    __: PermissionDeniedError,
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"detail": "Permission denied"},
    )


async def security_configuration_handler(
    _: Request,
    __: SecurityConfigurationError,
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "Security configuration unavailable"},
    )


def register_auth_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(EmailAlreadyRegisteredError, email_already_registered_handler)
    app.add_exception_handler(InvalidCredentialsError, invalid_credentials_handler)
    app.add_exception_handler(InactiveUserError, inactive_user_handler)
    app.add_exception_handler(PermissionDeniedError, permission_denied_handler)
    app.add_exception_handler(SecurityConfigurationError, security_configuration_handler)

