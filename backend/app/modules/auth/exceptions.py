class AuthError(RuntimeError):
    """Base class for authentication domain errors."""


class EmailAlreadyRegisteredError(AuthError):
    pass


class InvalidCredentialsError(AuthError):
    pass


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
