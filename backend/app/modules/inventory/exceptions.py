class InventoryDomainError(RuntimeError):
    """Base inventory domain error."""


class InventoryNotFoundError(InventoryDomainError):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class InventoryConflictError(InventoryDomainError):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class InvalidInventoryOperationError(InventoryDomainError):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)
