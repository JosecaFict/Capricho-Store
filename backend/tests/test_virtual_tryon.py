from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.db.session import get_db_session
from app.main import app
from app.modules.auth.dependencies import CurrentPrincipal, get_current_principal
from app.modules.auth.models import Usuario
from app.modules.catalog.models import ImagenProducto, Producto
from app.modules.virtual_tryon.dependencies import (
    get_optional_cloudinary_storage,
    get_tryon_store,
)
from app.modules.virtual_tryon.service import (
    LocalTryOnTask,
    MemoryTryOnStore,
    TryOnError,
    VirtualTryOnService,
)

VALID_JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"x" * 1024


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
            user_id=1,
            product_id=9999,
            color_id=None,
            color_name=None,
            photo_bytes=VALID_JPEG_BYTES,
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
            user_id=1,
            product_id=10,
            color_id=None,
            color_name=None,
            photo_bytes=VALID_JPEG_BYTES,
            filename="foto.jpg",
            content_type="image/jpeg",
            storage=None,
        )
    assert exc_info.value.status_code == 400
    assert "no está habilitado" in exc_info.value.detail


@pytest.mark.asyncio
async def test_virtual_tryon_service_file_validations():
    service = VirtualTryOnService()
    mock_session = AsyncMock()

    # 1. Invalid format (> 512 bytes, but not an image)
    with pytest.raises(TryOnError) as exc_info:
        await service.create_task(
            session=mock_session,
            user_id=1,
            product_id=1,
            color_id=None,
            color_name=None,
            photo_bytes=b"this is plain text not an image" * 25,
            filename="fake.txt",
            content_type="text/plain",
            storage=None,
        )
    assert exc_info.value.status_code == 400
    assert "no compatible" in exc_info.value.detail

    # 2. File too large (> 5MB)
    oversized = b"\xff\xd8\xff\xe0" + b"x" * (6 * 1024 * 1024)
    with pytest.raises(TryOnError) as exc_info:
        await service.create_task(
            session=mock_session,
            user_id=1,
            product_id=1,
            color_id=None,
            color_name=None,
            photo_bytes=oversized,
            filename="large.jpg",
            content_type="image/jpeg",
            storage=None,
        )
    assert exc_info.value.status_code == 413


@pytest.mark.asyncio
async def test_virtual_tryon_service_quota_limit():
    store = MemoryTryOnStore()
    service = VirtualTryOnService(store=store)
    mock_session = AsyncMock()

    mock_product = MagicMock(spec=Producto)
    mock_product.id_producto = 1
    mock_product.permite_vestidor = True

    mock_image = MagicMock(spec=ImagenProducto)
    mock_image.id_producto = 1
    mock_image.id_color = None
    mock_image.secure_url = "https://res.cloudinary.com/sample.jpg"

    mock_product_result = MagicMock()
    mock_product_result.scalar_one_or_none.return_value = mock_product
    mock_image_result = MagicMock()
    mock_image_result.scalars.return_value.all.return_value = [mock_image]
    mock_session.execute.side_effect = [mock_product_result, mock_image_result] * 6

    # Perform 5 successful tasks
    for i in range(5):
        resp = await service.create_task(
            session=mock_session,
            user_id=42,
            product_id=1,
            color_id=None,
            color_name=None,
            photo_bytes=VALID_JPEG_BYTES,
            filename="test.jpg",
            content_type="image/jpeg",
            storage=None,
        )
        assert resp.task_id is not None
        assert resp.remaining_today == 4 - i

    # 6th task should exceed quota
    with pytest.raises(TryOnError) as exc_info:
        await service.create_task(
            session=mock_session,
            user_id=42,
            product_id=1,
            color_id=None,
            color_name=None,
            photo_bytes=VALID_JPEG_BYTES,
            filename="test.jpg",
            content_type="image/jpeg",
            storage=None,
        )
    assert exc_info.value.status_code == 429
    assert "límite" in exc_info.value.detail


@pytest.mark.asyncio
async def test_virtual_tryon_endpoints_flow_and_auth():
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

    dummy_user = MagicMock(spec=Usuario)
    dummy_user.id_usuario = 10
    dummy_user.email = "cliente@test.com"

    dummy_principal = CurrentPrincipal(
        user=dummy_user,
        roles=frozenset(["CLIENTE"]),
        permissions=frozenset(["VER_CATALOGO"]),
        session_id="test-session",
    )

    async def override_db():
        yield mock_session

    test_store = MemoryTryOnStore()
    app.dependency_overrides[get_db_session] = override_db
    app.dependency_overrides[get_optional_cloudinary_storage] = lambda: None
    app.dependency_overrides[get_current_principal] = lambda: dummy_principal
    app.dependency_overrides[get_tryon_store] = lambda: test_store

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Check quota endpoint
            quota_res = await client.get("/api/v1/try-on/quota")
            assert quota_res.status_code == 200
            quota_data = quota_res.json()
            assert quota_data["daily_limit"] == 5
            assert quota_data["remaining_today"] >= 0

            # 2. Create task
            files = {"file": ("selfie.jpg", VALID_JPEG_BYTES, "image/jpeg")}
            data = {"product_id": "1", "color_id": "1", "color_name": "Negro"}

            create_res = await client.post("/api/v1/try-on/tasks", data=data, files=files)
            assert create_res.status_code == 201
            payload = create_res.json()
            assert "task_id" in payload
            assert payload["remaining_today"] is not None

            # 3. Status check
            task_id = payload["task_id"]
            status_res = await client.get(f"/api/v1/try-on/tasks/{task_id}")
            assert status_res.status_code == 200
            status_payload = status_res.json()
            assert status_payload["task_id"] == task_id
            assert status_payload["status"] in ("processing", "completed")
            assert "step_message" in status_payload
    finally:
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_virtual_tryon_photo_cleanup_in_cloudinary():
    mock_storage = AsyncMock()
    mock_storage.destroy = AsyncMock()

    service = VirtualTryOnService()
    task = LocalTryOnTask(
        task_id="cleanup-task-1",
        product_id=1,
        color_id=1,
        color_name="Blanco",
        human_image_url="https://res.cloudinary.com/capricho-store/tryon-temp/sample.jpg",
        garment_image_url="https://res.cloudinary.com/sample_shirt.jpg",
        user_id=10,
        user_photo_public_id="capricho-store/tryon-temp/sample_public_id",
        created_at=0.0,  # Elapsed > 14s, so status completes
    )
    await service.store.save_task(task)

    status_resp = await service.get_task_status("cleanup-task-1", user_id=10, storage=mock_storage)
    assert status_resp.status == "completed"
    # Ensure storage.destroy was called with the temporary public_id
    mock_storage.destroy.assert_called_once_with("capricho-store/tryon-temp/sample_public_id")


@pytest.mark.asyncio
async def test_piapi_dispatch_payload_and_polling():
    test_settings = Settings(
        DATABASE_URL="postgresql+asyncpg://user:pass@localhost/db",
        piapi_api_key="test-api-key",
        piapi_model="kling",
    )
    service = VirtualTryOnService(settings=test_settings)

    mock_post_resp = MagicMock()
    mock_post_resp.is_error = False
    mock_post_resp.json.return_value = {
        "code": 200,
        "data": {"task_id": "ext-task-123", "status": "pending"},
        "message": "success",
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_post_resp
        task_id = await service._dispatch_piapi_task(
            human_image="https://cdn.example.com/human.jpg",
            cloth_image="https://cdn.example.com/shirt.jpg",
        )
        assert task_id == "ext-task-123"
        call_kwargs = mock_post.call_args.kwargs
        assert call_kwargs["json"]["task_type"] == "ai_try_on"
        assert call_kwargs["json"]["model"] == "kling"
        assert call_kwargs["json"]["input"]["model_input"] == "https://cdn.example.com/human.jpg"
        assert call_kwargs["json"]["input"]["upper_input"] == "https://cdn.example.com/shirt.jpg"
        assert call_kwargs["headers"]["x-api-key"] == "test-api-key"

    mock_get_resp = MagicMock()
    mock_get_resp.raise_for_status = MagicMock()
    mock_get_resp.json.return_value = {
        "code": 200,
        "data": {
            "task_id": "ext-task-123",
            "status": "completed",
            "output": {
                "works": [
                    {
                        "image": {
                            "resource": "https://piapi-cdn.example.com/ai_result.jpg"
                        }
                    }
                ]
            },
        },
    }

    local_task = LocalTryOnTask(
        task_id="local-1",
        product_id=1,
        color_id=1,
        color_name="Azul",
        human_image_url="https://cdn.example.com/human.jpg",
        garment_image_url="https://cdn.example.com/shirt.jpg",
        external_task_id="ext-task-123",
        is_live=True,
    )
    await service.store.save_task(local_task)

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_get_resp
        res = await service._poll_piapi_status(local_task)
        assert res.status == "completed"
        assert res.progress == 100
        assert res.result_image_url == "https://piapi-cdn.example.com/ai_result.jpg"


@pytest.mark.asyncio
async def test_huggingface_dispatch_and_polling(tmp_path):
    test_settings = Settings(
        DATABASE_URL="postgresql+asyncpg://user:pass@localhost/db",
        HF_TOKEN="hf_dummy_token_123",
        TRYON_PROVIDER="huggingface",
    )
    service = VirtualTryOnService(settings=test_settings)

    mock_session = AsyncMock()
    mock_product = MagicMock(spec=Producto)
    mock_product.id_producto = 5
    mock_product.nombre = "Camisa Lino Blanca"
    mock_product.permite_vestidor = True

    mock_image = MagicMock(spec=ImagenProducto)
    mock_image.id_producto = 5
    mock_image.id_color = None
    mock_image.secure_url = "https://cdn.example.com/camisa.jpg"

    mock_product_res = MagicMock()
    mock_product_res.scalar_one_or_none.return_value = mock_product
    mock_image_res = MagicMock()
    mock_image_res.scalars.return_value.all.return_value = [mock_image]
    mock_session.execute.side_effect = [mock_product_res, mock_image_res]

    with patch.object(service, "_dispatch_hf_task", new_callable=AsyncMock) as mock_dispatch:
        mock_dispatch.return_value = "hf-task-id"
        res = await service.create_task(
            session=mock_session,
            user_id=10,
            product_id=5,
            color_id=None,
            color_name=None,
            photo_bytes=VALID_JPEG_BYTES,
            filename="foto.jpg",
            content_type="image/jpeg",
            storage=None,
        )
        assert res.task_id is not None
        mock_dispatch.assert_called_once()
        task = await service.store.get_task(res.task_id)
        assert task is not None
        assert task.provider == "huggingface"
        assert task.is_live is True

    # Now test polling when job finishes
    dummy_out = tmp_path / "out.png"
    dummy_out.write_bytes(b"dummy_png_bytes")

    mock_job = MagicMock()
    mock_job.done.return_value = True
    mock_job.exception.return_value = None
    mock_job.result.return_value = (str(dummy_out), str(dummy_out))

    VirtualTryOnService._hf_jobs[task.task_id] = mock_job

    mock_storage = AsyncMock()
    mock_upload = MagicMock()
    mock_upload.secure_url = "https://res.cloudinary.com/uploaded_tryon.png"
    mock_storage.upload_tryon_photo = AsyncMock(return_value=mock_upload)
    mock_storage.destroy = AsyncMock()

    status_resp = await service.get_task_status(task.task_id, user_id=10, storage=mock_storage)
    assert status_resp.status == "completed"
    assert status_resp.progress == 100
    assert status_resp.result_image_url == "https://res.cloudinary.com/uploaded_tryon.png"
    assert "IDM-VTON" in status_resp.step_message
    mock_storage.upload_tryon_photo.assert_called_once()

