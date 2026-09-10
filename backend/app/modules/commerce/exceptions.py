class CommerceDomainError(RuntimeError):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class CommerceNotFoundError(CommerceDomainError):
    pass


class CommerceConflictError(CommerceDomainError):
    pass


class InvalidCommerceOperationError(CommerceDomainError):
    pass


class PaymentGatewayError(CommerceDomainError):
    pass
