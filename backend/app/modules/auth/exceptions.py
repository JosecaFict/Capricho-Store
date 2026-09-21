class AuthError(RuntimeError):
    """Base class for authentication domain errors."""


class EmailAlreadyRegisteredError(AuthError):
    pass


class CiAlreadyRegisteredError(AuthError):
    pass


class InvalidAvatarError(AuthError):
    pass


class InvalidCredentialsError(AuthError):
    def __init__(self, detail: str = "El correo o la contraseña no son correctos.") -> None:
        self.detail = detail
        super().__init__(detail)


class AccountTemporarilyLockedError(AuthError):
    def __init__(self, retry_after: int, message: str | None = None) -> None:
        self.retry_after = retry_after
        if not message:
            if retry_after > 60:
                mins = (retry_after + 59) // 60
                message = f"Demasiados intentos fallidos. Por seguridad, tu cuenta está pausada por {mins} minutos."
            else:
                message = f"Demasiados intentos fallidos. Por seguridad, tu cuenta está pausada por {retry_after} segundos."
        self.message = message
        super().__init__(message)


class AccountPermanentlyBlockedError(AuthError):
    def __init__(
        self,
        message: str = "Tu cuenta ha sido bloqueada tras múltiples intentos fallidos. Debes recuperar tu contraseña para desbloquearla.",
    ) -> None:
        self.message = message
        super().__init__(message)


class InactiveUserError(AuthError):
    def __init__(self, state: str) -> None:
        self.state = state
        super().__init__(f"User state does not allow authentication: {state}")


class PermissionDeniedError(AuthError):
    pass


class SecurityConfigurationError(AuthError):
    pass


class InvalidPasswordRecoveryCodeError(AuthError):
    pass


class InvalidPasswordResetTokenError(AuthError):
    pass


class EmailDeliveryError(AuthError):
    pass
