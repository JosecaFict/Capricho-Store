class RecommendationDomainError(RuntimeError):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class RecommendationNotFoundError(RecommendationDomainError):
    pass


class InvalidRecommendationConfigError(RecommendationDomainError):
    pass
