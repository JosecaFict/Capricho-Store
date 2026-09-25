from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.session import get_db_session
from app.main import app
from app.modules.catalog.models import ImagenProducto, Producto
from app.modules.virtual_tryon.dependencies import (
    get_optional_cloudinary_storage,
    get_virtual_tryon_service,
)
from app.modules.virtual_tryon.service import TryOnError, VirtualTryOnService


@pytest.mark.asyncio
async def test_virtual_tryon_service_product_not_found():
    service = VirtualTryOnService()
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute = AsyncMock(return_value=mock_result)

    with pytest.raises(TryOnError) as exc_info:
        await service.create_task(
            session=mock_session,
            product_id=9999,
            color_id=None,
            color_name=None,
            photo_bytes=b"fake-photo",
            filename="foto.jpg",
            content_type="image/jpeg",
            storage=None,
        )
    assert exc_info.value.status_code == 404
    assert "no existe" in exc_info.value.detail


@pytest.mark.asyncio
async def test_virtual_tryon_service_not_allowed_for_tryon():
    service = VirtualTryOnService()
    mock_session = AsyncMock()
    mock_product = MagicMock(spec=Producto)
    mock_product.id_producto = 10
    mock_product.permite_vestidor = False
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_product
    mock_session.execute = AsyncMock(return_value=mock_result)

    with pytest.raises(TryOnError) as exc_info:
        await service.create_task(
            session=mock_session,
            product_id=10,
            color_id=None,
            color_name=None,
            photo_bytes=b"fake-photo",
            filename="foto.jpg",
            content_type="image/jpeg",
            storage=None,
        )
    assert exc_info.value.status_code == 400
    assert "no está habilitado" in exc_info.value.detail


@pytest.mark.asyncio
async def test_virtual_tryon_service_success_and_status():
    service = VirtualTryOnService()
    mock_session = AsyncMock()

    mock_product = MagicMock(spec=Producto)
    mock_product.id_producto = 1
    mock_product.permite_vestidor = True

    mock_image = MagicMock(spec=ImagenProducto)
    mock_image.id_producto = 1
    mock_image.id_color = 2
    mock_image.secure_url = "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg"

    # Mock product query and image query
    mock_product_result = MagicMock()
    mock_product_result.scalar_one_or_none.return_value = mock_product

    mock_image_result = MagicMock()
    mock_image_result.scalars.return_value.all.return_value = [mock_image]

    mock_session.execute.side_effect = [mock_product_result, mock_image_result]

    resp = await service.create_task(
        session=mock_session,
        product_id=1,
        color_id=2,
        color_name="Azul Marino",
        photo_bytes=b"test-photo-bytes",
        filename="test.jpg",
        content_type="image/jpeg",
        storage=None,
    )
    assert resp.task_id is not None
    assert resp.status == "processing"

    status_resp = await service.get_task_status(resp.task_id)
    assert status_resp.task_id == resp.task_id
    assert status_resp.product_id == 1
    assert status_resp.color_id == 2
    assert status_resp.color_name == "Azul Marino"
    assert status_resp.progress >= 0
    assert status_resp.step_message is not None


@pytest.mark.asyncio
async def test_virtual_tryon_endpoints_flow():
    mock_session = AsyncMock()

    mock_product = MagicMock(spec=Producto)
    mock_product.id_producto = 1
    mock_product.permite_vestidor = True

    mock_image = MagicMock(spec=ImagenProducto)
    mock_image.id_producto = 1
    mock_image.id_color = 1
    mock_image.secure_url = "https://res.cloudinary.com/demo/image/upload/sample.jpg"

    mock_product_result = MagicMock()
    mock_product_result.scalar_one_or_none.return_value = mock_product

    mock_image_result = MagicMock()
    mock_image_result.scalars.return_value.all.return_value = [mock_image]

    mock_session.execute.side_effect = [mock_product_result, mock_image_result]

    async def override_db():
        yield mock_session

    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_optional_cloudinary_storage] = lambda: None

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            files = {"file": ("selfie.jpg", b"image-content", "image/jpeg")}
            data = {"product_id": "1", "color_id": "1", "color_name": "Negro"}

            create_res = await client.post("/api/v1/try-on/tasks", data=data, files=files)
            assert create_res.status_code == 201
            payload = create_res.json()
            assert "task_id" in payload

            task_id = payload["task_id"]
            status_res = await client.get(f"/api/v1/try-on/tasks/{task_id}")
            assert status_res.status_code == 200
            status_payload = status_res.json()
            assert status_payload["task_id"] == task_id
            assert status_payload["status"] in ("processing", "completed")
            assert "step_message" in status_payload
    finally:
        app.dependency_overrides.clear()
