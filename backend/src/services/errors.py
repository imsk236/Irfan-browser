class ResourceNotFoundError(ValueError):
    """Raised when a requested resource does not exist.

    Subclasses ValueError so existing service-layer tests that do
    pytest.raises(ValueError) still pass, while route handlers can
    distinguish not-found (404) from business-logic violations (422).
    """
