from app.modules.auth.repository import resolve_effective_permissions


def test_permission_inherited_from_role() -> None:
    permissions = resolve_effective_permissions({"productos.ver"}, {})

    assert permissions == {"productos.ver"}


def test_individual_permission_is_granted() -> None:
    permissions = resolve_effective_permissions(set(), {"ventas.crear": True})

    assert permissions == {"ventas.crear"}


def test_individual_revocation_overrides_role_permission() -> None:
    permissions = resolve_effective_permissions(
        {"productos.ver", "ventas.ver"},
        {"productos.ver": False},
    )

    assert permissions == {"ventas.ver"}

