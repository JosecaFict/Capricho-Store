class CatalogError(RuntimeError):
    """Base class for catalog domain errors."""


class CatalogNotFoundError(CatalogError):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class CatalogConflictError(CatalogError):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class InvalidCatalogDataError(CatalogError):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class CatalogStorageError(CatalogError):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)
