from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.modules.auth.exceptions import (
    EmailAlreadyRegisteredError,
    EmailDeliveryError,
    InactiveUserError,
    InvalidCredentialsError,
    InvalidPasswordRecoveryCodeError,
    InvalidPasswordResetTokenError,
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


async def invalid_password_recovery_code_handler(
    _: Request,
    __: InvalidPasswordRecoveryCodeError,
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": "El código es incorrecto, venció o alcanzó el límite de intentos."},
    )


async def invalid_password_reset_token_handler(
    _: Request,
    __: InvalidPasswordResetTokenError,
) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": "La autorización para cambiar la contraseña no es válida o venció."},
    )


async def email_delivery_handler(_: Request, __: EmailDeliveryError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "No pudimos enviar el código. Intenta nuevamente en unos minutos."},
    )


def register_auth_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(EmailAlreadyRegisteredError, email_already_registered_handler)
    app.add_exception_handler(InvalidCredentialsError, invalid_credentials_handler)
    app.add_exception_handler(InactiveUserError, inactive_user_handler)
    app.add_exception_handler(PermissionDeniedError, permission_denied_handler)
    app.add_exception_handler(SecurityConfigurationError, security_configuration_handler)
    app.add_exception_handler(
        InvalidPasswordRecoveryCodeError,
        invalid_password_recovery_code_handler,
    )
    app.add_exception_handler(
        InvalidPasswordResetTokenError,
        invalid_password_reset_token_handler,
    )
    app.add_exception_handler(EmailDeliveryError, email_delivery_handler)
