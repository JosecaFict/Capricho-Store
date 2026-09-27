import asyncio
import base64
import json
import os
import tempfile
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import date
from typing import Any, Protocol

import httpx
from fastapi import HTTPException
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.integrations.cloudinary import CloudinaryStorage
from app.modules.catalog.models import ImagenProducto, Producto
from app.modules.virtual_tryon.schemas import (
    TryOnQuotaResponse,
    TryOnTaskCreateResponse,
    TryOnTaskStatusResponse,
)


def _safe_unlink(filepath: str | None) -> None:
    if filepath and os.path.exists(filepath):
        try:
            os.unlink(filepath)
        except Exception:
            pass


def _read_and_cleanup_file(filepath: str | None) -> bytes | None:
    if not filepath or not os.path.exists(filepath):
        return None
    try:
        with open(filepath, "rb") as f:
            return f.read()
    finally:
        try:
            os.unlink(filepath)
        except Exception:
            pass


class TryOnError(HTTPException):
    """Base error for virtual try-on module."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(status_code=status_code, detail=message)


@dataclass
class LocalTryOnTask:
    task_id: str
    product_id: int
    color_id: int | None
    color_name: str | None
    human_image_url: str
    garment_image_url: str
    user_id: int | None = None
    user_photo_public_id: str | None = None
    created_at: float = field(default_factory=time.time)
    external_task_id: str | None = None
    provider: str = "piapi"
    is_live: bool = False
    result_image_url: str | None = None
    status: str = "processing"
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "LocalTryOnTask":
        if "provider" not in data:
            data["provider"] = "piapi"
        return cls(**data)


class TryOnStore(Protocol):
    async def save_task(self, task: LocalTryOnTask, ttl_seconds: int = 3600) -> None: ...
    async def get_task(self, task_id: str) -> LocalTryOnTask | None: ...
    async def get_daily_count(self, user_id: int) -> int: ...
    async def increment_daily_count(self, user_id: int) -> int: ...


class RedisTryOnStore:
    def __init__(self, client: Redis, fallback: "MemoryTryOnStore | None" = None) -> None:
        self.client = client
        self.fallback = fallback or MemoryTryOnStore()

    @staticmethod
    def _task_key(task_id: str) -> str:
        return f"tryon:task:{task_id}"

    @staticmethod
    def _daily_key(user_id: int) -> str:
        today = date.today().isoformat()
        return f"tryon:daily:{user_id}:{today}"

    async def save_task(self, task: LocalTryOnTask, ttl_seconds: int = 3600) -> None:
        data = task.to_dict()
        try:
            await self.client.set(self._task_key(task.task_id), json.dumps(data), ex=ttl_seconds)
        except Exception:
            await self.fallback.save_task(task, ttl_seconds)

    async def get_task(self, task_id: str) -> LocalTryOnTask | None:
        try:
            val = await self.client.get(self._task_key(task_id))
            if not val:
                return await self.fallback.get_task(task_id)
            data = json.loads(val)
            return LocalTryOnTask.from_dict(data)
        except Exception:
            return await self.fallback.get_task(task_id)

    async def get_daily_count(self, user_id: int) -> int:
        try:
            val = await self.client.get(self._daily_key(user_id))
            return int(val) if val else 0
        except Exception:
            return await self.fallback.get_daily_count(user_id)

    async def increment_daily_count(self, user_id: int) -> int:
        try:
            key = self._daily_key(user_id)
            pipe = self.client.pipeline()
            pipe.incr(key)
            pipe.expire(key, 86400)
            res = await pipe.execute()
            return int(res[0])
        except Exception:
            return await self.fallback.increment_daily_count(user_id)


class MemoryTryOnStore:
    """In-memory store fallback for local development and unit tests."""

    def __init__(self) -> None:
        self._tasks: dict[str, tuple[LocalTryOnTask, float]] = {}
        self._daily_counts: dict[str, int] = {}

    async def save_task(self, task: LocalTryOnTask, ttl_seconds: int = 3600) -> None:
        self._tasks[task.task_id] = (task, time.time() + ttl_seconds)

    async def get_task(self, task_id: str) -> LocalTryOnTask | None:
        now = time.time()
        item = self._tasks.get(task_id)
        if not item:
            return None
        task, expire_at = item
        if expire_at < now:
            self._tasks.pop(task_id, None)
            return None
        return task

    async def get_daily_count(self, user_id: int) -> int:
        today = date.today().isoformat()
        return self._daily_counts.get(f"{user_id}:{today}", 0)

    async def increment_daily_count(self, user_id: int) -> int:
        today = date.today().isoformat()
        key = f"{user_id}:{today}"
        self._daily_counts[key] = self._daily_counts.get(key, 0) + 1
        return self._daily_counts[key]


class VirtualTryOnService:
    _hf_client: Any = None
    _hf_jobs: dict[str, Any] = {}

    def __init__(
        self,
        settings: Settings | None = None,
        store: TryOnStore | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.store = store or MemoryTryOnStore()

    async def _resolve_garment_info(
        self,
        session: AsyncSession,
        product_id: int,
        color_id: int | None,
    ) -> tuple[str, str]:
        product_stmt = select(Producto).where(Producto.id_producto == product_id)
        res = await session.execute(product_stmt)
        product = res.scalar_one_or_none()
        if not product:
            raise TryOnError("El producto no existe", status_code=404)
        if not product.permite_vestidor:
            raise TryOnError("Este producto no está habilitado para vestidor virtual", status_code=400)

        img_stmt = (
            select(ImagenProducto)
            .where(ImagenProducto.id_producto == product_id)
            .order_by(ImagenProducto.es_principal.desc(), ImagenProducto.orden.asc())
        )
        img_res = await session.execute(img_stmt)
        images = list(img_res.scalars().all())

        if not images:
            raise TryOnError("El producto no cuenta con imágenes publicadas para la prueba", status_code=400)

        garment_url = images[0].secure_url
        if color_id is not None:
            color_images = [img for img in images if img.id_color == color_id]
            if color_images:
                garment_url = color_images[0].secure_url

        garment_des = product.nombre or "upper body clothing"
        return garment_url, garment_des

    async def _resolve_garment_image(
        self,
        session: AsyncSession,
        product_id: int,
        color_id: int | None,
    ) -> str:
        url, _ = await self._resolve_garment_info(session, product_id, color_id)
        return url

    async def get_user_quota(self, user_id: int) -> TryOnQuotaResponse:
        daily_limit = self.settings.tryon_daily_limit_per_user
        used_today = await self.store.get_daily_count(user_id)
        return TryOnQuotaResponse(
            daily_limit=daily_limit,
            used_today=used_today,
            remaining_today=max(0, daily_limit - used_today),
        )

    async def create_task(
        self,
        *,
        session: AsyncSession,
        user_id: int,
        product_id: int,
        color_id: int | None,
        color_name: str | None,
        photo_bytes: bytes,
        filename: str,
        content_type: str,
        storage: CloudinaryStorage | None,
    ) -> TryOnTaskCreateResponse:
        # 1. Quota check
        daily_limit = self.settings.tryon_daily_limit_per_user
        used_today = await self.store.get_daily_count(user_id)
        if used_today >= daily_limit:
            raise TryOnError(
                f"Has alcanzado tu límite de {daily_limit} pruebas virtuales gratuitas por hoy. Vuelve mañana para seguir probándote prendas.",
                status_code=429,
            )

        # 2. File size validation
        max_bytes = self.settings.tryon_max_file_size_mb * 1024 * 1024
        if len(photo_bytes) > max_bytes:
            raise TryOnError(
                f"La fotografía supera el límite permitido de {self.settings.tryon_max_file_size_mb} MB.",
                status_code=413,
            )
        if len(photo_bytes) < 512:
            raise TryOnError("El archivo de imagen es demasiado pequeño o está dañado.", status_code=400)

        # 3. File signature validation (JPEG, PNG, WebP)
        is_jpeg = photo_bytes.startswith(b"\xff\xd8\xff")
        is_png = photo_bytes.startswith(b"\x89PNG\r\n\x1a\n")
        is_webp = photo_bytes[:4] == b"RIFF" and len(photo_bytes) > 12 and photo_bytes[8:12] == b"WEBP"
        if not (is_jpeg or is_png or is_webp):
            raise TryOnError(
                "Formato de imagen no compatible. Por favor sube una imagen en formato JPG, PNG o WebP.",
                status_code=400,
            )

        garment_image_url, garment_des = await self._resolve_garment_info(session, product_id, color_id)

        # 4. Upload customer photo to Cloudinary temporary folder
        user_photo_url: str
        user_photo_public_id: str | None = None
        if storage is not None:
            try:
                upload = await storage.upload_tryon_photo(
                    content=photo_bytes,
                    filename=filename or "user_tryon.jpg",
                    content_type=content_type or "image/jpeg",
                )
                user_photo_url = upload.secure_url
                user_photo_public_id = upload.public_id
            except Exception:
                encoded = base64.b64encode(photo_bytes).decode("utf-8")
                user_photo_url = f"data:{content_type or 'image/jpeg'};base64,{encoded}"
        else:
            encoded = base64.b64encode(photo_bytes).decode("utf-8")
            user_photo_url = f"data:{content_type or 'image/jpeg'};base64,{encoded}"

        task_id = str(uuid.uuid4())
        provider_config = (self.settings.tryon_provider or "piapi").lower().strip()
        has_replicate_token = bool(
            self.settings.replicate_api_token and self.settings.replicate_api_token.strip()
        )
        has_hf_token = bool(self.settings.hf_token and self.settings.hf_token.strip())
        has_piapi_key = bool(self.settings.piapi_api_key and self.settings.piapi_api_key.strip())

        if provider_config == "replicate" and has_replicate_token and user_photo_url.startswith("http"):
            external_id = await self._dispatch_replicate_task(
                human_image=user_photo_url,
                garment_image=garment_image_url,
                garment_des=garment_des,
            )
            local_task = LocalTryOnTask(
                task_id=task_id,
                user_id=user_id,
                product_id=product_id,
                color_id=color_id,
                color_name=color_name,
                human_image_url=user_photo_url,
                garment_image_url=garment_image_url,
                user_photo_public_id=user_photo_public_id,
                external_task_id=external_id,
                provider="replicate",
                is_live=True,
                status="processing",
            )
        elif provider_config == "huggingface" and has_hf_token:
            await self._dispatch_hf_task(
                human_image=user_photo_url,
                garment_image=garment_image_url,
                garment_des=garment_des,
                task_id=task_id,
            )
            local_task = LocalTryOnTask(
                task_id=task_id,
                user_id=user_id,
                product_id=product_id,
                color_id=color_id,
                color_name=color_name,
                human_image_url=user_photo_url,
                garment_image_url=garment_image_url,
                user_photo_public_id=user_photo_public_id,
                external_task_id=task_id,
                provider="huggingface",
                is_live=True,
                status="processing",
            )
        elif has_piapi_key and user_photo_url.startswith("http"):
            external_id = await self._dispatch_piapi_task(
                human_image=user_photo_url,
                cloth_image=garment_image_url,
            )
            local_task = LocalTryOnTask(
                task_id=task_id,
                user_id=user_id,
                product_id=product_id,
                color_id=color_id,
                color_name=color_name,
                human_image_url=user_photo_url,
                garment_image_url=garment_image_url,
                user_photo_public_id=user_photo_public_id,
                external_task_id=external_id,
                provider="piapi",
                is_live=True,
                status="processing",
            )
        else:
            local_task = LocalTryOnTask(
                task_id=task_id,
                user_id=user_id,
                product_id=product_id,
                color_id=color_id,
                color_name=color_name,
                human_image_url=user_photo_url,
                garment_image_url=garment_image_url,
                user_photo_public_id=user_photo_public_id,
                provider="simulation",
                is_live=False,
                status="processing",
            )

        await self.store.save_task(local_task)
        new_count = await self.store.increment_daily_count(user_id)
        remaining = max(0, daily_limit - new_count)

        return TryOnTaskCreateResponse(
            task_id=task_id,
            status="processing",
            message="Prueba virtual iniciada exitosamente",
            remaining_today=remaining,
        )

    async def _dispatch_piapi_task(self, *, human_image: str, cloth_image: str) -> str:
        url = "https://api.piapi.ai/api/v1/task"
        headers = {
            "x-api-key": (self.settings.piapi_api_key or "").strip(),
            "Content-Type": "application/json",
        }
        model = (self.settings.piapi_model or "kling").strip()
        payload = {
            "model": model,
            "task_type": "ai_try_on",
            "input": {
                "model_input": human_image,
                "upper_input": cloth_image,
                "batch_size": 1,
            },
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.is_error:
                    error_detail = res.text
                    try:
                        err_json = res.json()
                        error_detail = err_json.get("message") or err_json.get("error") or res.text
                    except Exception:
                        pass
                    if res.status_code in (402, 429) or "insufficient" in error_detail.lower() or "balance" in error_detail.lower():
                        raise TryOnError(
                            "El servicio de vestidor virtual con IA está en mantenimiento temporal. Por favor intenta más tarde.",
                            status_code=503,
                        )
                    raise TryOnError(f"Error al comunicar con el motor de IA ({res.status_code}): {error_detail}")
                data = res.json()
                data_obj = data.get("data") or {}
                external_task_id = data_obj.get("task_id")
                if not external_task_id:
                    raise TryOnError("PiAPI no devolvió un identificador de tarea válido")
                return str(external_task_id)
        except TryOnError:
            raise
        except Exception as exc:
            raise TryOnError(f"Error al comunicar con el motor de IA: {exc}") from exc

    async def get_task_status(
        self,
        task_id: str,
        user_id: int | None = None,
        storage: CloudinaryStorage | None = None,
    ) -> TryOnTaskStatusResponse:
        task = await self.store.get_task(task_id)
        if not task:
            raise TryOnError("La tarea de prueba virtual no existe o ha expirado", status_code=404)

        if user_id is not None and task.user_id is not None and task.user_id != user_id:
            raise TryOnError("No tienes permiso para consultar esta prueba virtual", status_code=403)

        if task.is_live and task.provider == "replicate" and task.external_task_id and task.status != "completed":
            resp = await self._poll_replicate_status(task, storage=storage)
            await self.store.save_task(task)
            return resp

        if task.is_live and task.provider == "huggingface" and task.status != "completed":
            resp = await self._poll_hf_status(task, storage=storage)
            await self.store.save_task(task)
            return resp

        if task.is_live and task.external_task_id and task.status != "completed":
            resp = await self._poll_piapi_status(task)
            if task.status in ("completed", "failed") and task.user_photo_public_id and storage:
                try:
                    await storage.destroy(task.user_photo_public_id)
                    task.user_photo_public_id = None
                except Exception:
                    pass
            await self.store.save_task(task)
            return resp

        # Simulation Lifecycle calculation
        elapsed = time.time() - task.created_at
        total_expected_duration = 14.0

        if elapsed < 3.5:
            progress = int((elapsed / 3.5) * 30)
            return TryOnTaskStatusResponse(
                task_id=task.task_id,
                status="processing",
                progress=max(10, min(progress, 32)),
                eta_seconds=max(1, int(total_expected_duration - elapsed)),
                step_message="1. Silueta y postura detectada ✓",
                original_photo_url=task.human_image_url,
                garment_image_url=task.garment_image_url,
                product_id=task.product_id,
                color_id=task.color_id,
                color_name=task.color_name,
                is_live=task.is_live,
            )
        elif elapsed < 7.5:
            progress = 30 + int(((elapsed - 3.5) / 4.0) * 35)
            return TryOnTaskStatusResponse(
                task_id=task.task_id,
                status="processing",
                progress=min(progress, 68),
                eta_seconds=max(1, int(total_expected_duration - elapsed)),
                step_message="2. Ajustando dimensiones y proporciones de prenda ✓",
                original_photo_url=task.human_image_url,
                garment_image_url=task.garment_image_url,
                product_id=task.product_id,
                color_id=task.color_id,
                color_name=task.color_name,
                is_live=task.is_live,
            )
        elif elapsed < 13.0:
            progress = 68 + int(((elapsed - 7.5) / 5.5) * 28)
            return TryOnTaskStatusResponse(
                task_id=task.task_id,
                status="processing",
                progress=min(progress, 96),
                eta_seconds=max(1, int(total_expected_duration - elapsed)),
                step_message="3. Renderizando caída de tela, pliegues y sombras en curso...",
                original_photo_url=task.human_image_url,
                garment_image_url=task.garment_image_url,
                product_id=task.product_id,
                color_id=task.color_id,
                color_name=task.color_name,
                is_live=task.is_live,
            )
        else:
            task.status = "completed"
            result_url = task.result_image_url or task.garment_image_url
            if task.user_photo_public_id and storage:
                try:
                    await storage.destroy(task.user_photo_public_id)
                    task.user_photo_public_id = None
                except Exception:
                    pass
            await self.store.save_task(task)
            return TryOnTaskStatusResponse(
                task_id=task.task_id,
                status="completed",
                progress=100,
                eta_seconds=0,
                step_message="¡Ajuste completado! Mira cómo te queda.",
                result_image_url=result_url,
                original_photo_url=task.human_image_url,
                garment_image_url=task.garment_image_url,
                product_id=task.product_id,
                color_id=task.color_id,
                color_name=task.color_name,
                is_live=task.is_live,
            )

    async def _poll_piapi_status(self, task: LocalTryOnTask) -> TryOnTaskStatusResponse:
        url = f"https://api.piapi.ai/api/v1/task/{task.external_task_id}"
        headers = {"x-api-key": (self.settings.piapi_api_key or "").strip()}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, headers=headers)
                res.raise_for_status()
                data = res.json()
                data_obj = data.get("data") or {}
                remote_status = data_obj.get("status", "processing").lower()

                if remote_status in ("completed", "success", "succeeded"):
                    task.status = "completed"
                    output = data_obj.get("output") or {}
                    works = output.get("works") or []
                    result_url = None
                    if isinstance(works, list) and len(works) > 0 and isinstance(works[0], dict):
                        first_work = works[0]
                        img_node = first_work.get("image")
                        if isinstance(img_node, dict):
                            result_url = img_node.get("resource")
                        elif isinstance(img_node, str):
                            result_url = img_node
                        if not result_url:
                            result_url = first_work.get("resource") or first_work.get("url")

                    if not result_url:
                        result_url = (
                            output.get("image_url")
                            or output.get("image")
                            or output.get("resource")
                            or task.garment_image_url
                        )

                    task.result_image_url = result_url
                    return TryOnTaskStatusResponse(
                        task_id=task.task_id,
                        status="completed",
                        progress=100,
                        eta_seconds=0,
                        step_message="¡Look generado con IA completado!",
                        result_image_url=result_url,
                        original_photo_url=task.human_image_url,
                        garment_image_url=task.garment_image_url,
                        product_id=task.product_id,
                        color_id=task.color_id,
                        color_name=task.color_name,
                        is_live=True,
                    )
                elif remote_status in ("failed", "error"):
                    task.status = "failed"
                    task.error = data_obj.get("error", "Error durante el procesamiento con IA")
                    return TryOnTaskStatusResponse(
                        task_id=task.task_id,
                        status="failed",
                        progress=0,
                        eta_seconds=0,
                        step_message="No se pudo completar la prueba de ropa",
                        error=task.error,
                        original_photo_url=task.human_image_url,
                        garment_image_url=task.garment_image_url,
                        product_id=task.product_id,
                        color_id=task.color_id,
                        color_name=task.color_name,
                        is_live=True,
                    )
                else:
                    elapsed = time.time() - task.created_at
                    progress = min(92, int((elapsed / 20.0) * 100))
                    return TryOnTaskStatusResponse(
                        task_id=task.task_id,
                        status="processing",
                        progress=max(15, progress),
                        eta_seconds=max(3, int(20 - elapsed)),
                        step_message="Ajustando prenda a tu silueta con IA...",
                        original_photo_url=task.human_image_url,
                        garment_image_url=task.garment_image_url,
                        product_id=task.product_id,
                        color_id=task.color_id,
                        color_name=task.color_name,
                        is_live=True,
                    )
        except Exception:
            return TryOnTaskStatusResponse(
                task_id=task.task_id,
                status="processing",
                progress=65,
                eta_seconds=8,
                step_message="Ajustando prenda a tu figura...",
                original_photo_url=task.human_image_url,
                garment_image_url=task.garment_image_url,
                product_id=task.product_id,
                color_id=task.color_id,
                color_name=task.color_name,
                is_live=True,
            )

    async def _dispatch_hf_task(
        self,
        *,
        human_image: str,
        garment_image: str,
        garment_des: str,
        task_id: str,
    ) -> str:
        temp_human_file: str | None = None
        if human_image.startswith("data:"):
            header, encoded = human_image.split(",", 1)
            raw = base64.b64decode(encoded)
            suffix = ".png" if "png" in header else ".jpg"
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
                f.write(raw)
                temp_human_file = f.name
            human_ref = temp_human_file
        else:
            human_ref = human_image

        space = (self.settings.hf_space or "yisol/IDM-VTON").strip()
        hf_token = (self.settings.hf_token or "").strip() or None

        def _submit_job() -> Any:
            from gradio_client import Client, handle_file

            if VirtualTryOnService._hf_client is None:
                try:
                    VirtualTryOnService._hf_client = Client(
                        space,
                        token=hf_token,
                    )
                except TypeError:
                    VirtualTryOnService._hf_client = Client(
                        space,
                        hf_token=hf_token,
                    )
            client = VirtualTryOnService._hf_client
            job = client.submit(
                dict={"background": handle_file(human_ref), "layers": [], "composite": None},
                garm_img=handle_file(garment_image),
                garment_des=garment_des or "clothing",
                is_checked=True,
                is_checked_crop=False,
                denoise_steps=30,
                seed=42,
                api_name="/tryon",
            )
            return job

        try:
            job = await asyncio.to_thread(_submit_job)
            VirtualTryOnService._hf_jobs[task_id] = job
            return task_id
        except Exception as exc:
            raise TryOnError(f"Error al iniciar prueba virtual con Hugging Face: {exc}") from exc
        finally:
            if temp_human_file:
                await asyncio.to_thread(_safe_unlink, temp_human_file)

    async def _poll_hf_status(
        self,
        task: LocalTryOnTask,
        storage: CloudinaryStorage | None = None,
    ) -> TryOnTaskStatusResponse:
        job = VirtualTryOnService._hf_jobs.get(task.task_id)
        elapsed = time.time() - task.created_at

        if job is None:
            if task.status == "completed":
                return TryOnTaskStatusResponse(
                    task_id=task.task_id,
                    status="completed",
                    progress=100,
                    eta_seconds=0,
                    step_message="¡Ajuste completado con IDM-VTON!",
                    result_image_url=task.result_image_url,
                    original_photo_url=task.human_image_url,
                    garment_image_url=task.garment_image_url,
                    product_id=task.product_id,
                    color_id=task.color_id,
                    color_name=task.color_name,
                    is_live=True,
                )
            elif task.status == "failed":
                return TryOnTaskStatusResponse(
                    task_id=task.task_id,
                    status="failed",
                    progress=0,
                    eta_seconds=0,
                    step_message="No se pudo completar la prueba con IA",
                    error=task.error,
                    original_photo_url=task.human_image_url,
                    garment_image_url=task.garment_image_url,
                    product_id=task.product_id,
                    color_id=task.color_id,
                    color_name=task.color_name,
                    is_live=True,
                )
            else:
                if elapsed > 120.0:
                    task.status = "failed"
                    task.error = "Tiempo de espera agotado al conectar con Hugging Face"
                    return TryOnTaskStatusResponse(
                        task_id=task.task_id,
                        status="failed",
                        progress=0,
                        eta_seconds=0,
                        step_message="Tiempo de espera agotado",
                        error=task.error,
                        original_photo_url=task.human_image_url,
                        garment_image_url=task.garment_image_url,
                        product_id=task.product_id,
                        color_id=task.color_id,
                        color_name=task.color_name,
                        is_live=True,
                    )
                progress = min(92, max(15, int((elapsed / 25.0) * 100)))
                return TryOnTaskStatusResponse(
                    task_id=task.task_id,
                    status="processing",
                    progress=progress,
                    eta_seconds=max(3, int(25.0 - elapsed)),
                    step_message="Procesando prueba virtual con IDM-VTON...",
                    original_photo_url=task.human_image_url,
                    garment_image_url=task.garment_image_url,
                    product_id=task.product_id,
                    color_id=task.color_id,
                    color_name=task.color_name,
                    is_live=True,
                )

        if job.done():
            VirtualTryOnService._hf_jobs.pop(task.task_id, None)
            exc = job.exception()
            if exc:
                task.status = "failed"
                task.error = f"Error en IDM-VTON: {exc}"
                if task.user_photo_public_id and storage:
                    try:
                        await storage.destroy(task.user_photo_public_id)
                        task.user_photo_public_id = None
                    except Exception:
                        pass
                return TryOnTaskStatusResponse(
                    task_id=task.task_id,
                    status="failed",
                    progress=0,
                    eta_seconds=0,
                    step_message="No se pudo completar la prueba con IA",
                    error=task.error,
                    original_photo_url=task.human_image_url,
                    garment_image_url=task.garment_image_url,
                    product_id=task.product_id,
                    color_id=task.color_id,
                    color_name=task.color_name,
                    is_live=True,
                )

            try:
                result_tuple = job.result()
                output_path = (
                    result_tuple[0]
                    if isinstance(result_tuple, (tuple, list))
                    else str(result_tuple)
                )
                img_bytes = await asyncio.to_thread(_read_and_cleanup_file, output_path)
                result_url = None

                if img_bytes:
                    if storage is not None:
                        upload = await storage.upload_tryon_photo(
                            content=img_bytes,
                            filename=f"tryon_hf_{task.task_id}.png",
                            content_type="image/png",
                        )
                        result_url = upload.secure_url
                    else:
                        b64 = base64.b64encode(img_bytes).decode("utf-8")
                        result_url = f"data:image/png;base64,{b64}"

                task.result_image_url = result_url or task.garment_image_url
                task.status = "completed"
            except Exception as e:
                task.status = "failed"
                task.error = f"Error al procesar el resultado de la imagen: {e}"

            if task.user_photo_public_id and storage:
                try:
                    await storage.destroy(task.user_photo_public_id)
                    task.user_photo_public_id = None
                except Exception:
                    pass

            if task.status == "completed":
                return TryOnTaskStatusResponse(
                    task_id=task.task_id,
                    status="completed",
                    progress=100,
                    eta_seconds=0,
                    step_message="¡Ajuste completado con IDM-VTON! Mira cómo te queda.",
                    result_image_url=task.result_image_url,
                    original_photo_url=task.human_image_url,
                    garment_image_url=task.garment_image_url,
                    product_id=task.product_id,
                    color_id=task.color_id,
                    color_name=task.color_name,
                    is_live=True,
                )
            else:
                return TryOnTaskStatusResponse(
                    task_id=task.task_id,
                    status="failed",
                    progress=0,
                    eta_seconds=0,
                    step_message="Error al procesar el resultado",
                    error=task.error,
                    original_photo_url=task.human_image_url,
                    garment_image_url=task.garment_image_url,
                    product_id=task.product_id,
                    color_id=task.color_id,
                    color_name=task.color_name,
                    is_live=True,
                )

        try:
            status_obj = job.status()
            rank = getattr(status_obj, "rank", None)
            queue_size = getattr(status_obj, "queue_size", None)
            eta_val = getattr(status_obj, "eta", None)
        except Exception:
            rank = None
            queue_size = None
            eta_val = None

        if rank is not None and rank > 0:
            step_msg = f"En cola de espera de Hugging Face (turno {rank} de {queue_size or '?'})..."
            progress = min(25, max(5, int((elapsed / 30.0) * 25)))
            eta_sec = int(eta_val) if eta_val and eta_val > 0 else max(10, int(30 - elapsed))
        elif elapsed < 8.0:
            step_msg = "Detectando silueta y segmentando prenda con IDM-VTON..."
            progress = max(15, min(45, int((elapsed / 8.0) * 45)))
            eta_sec = max(5, int(22 - elapsed))
        elif elapsed < 16.0:
            step_msg = "Alineando prenda con cuerpo y calculando caída de tela..."
            progress = max(45, min(75, 45 + int(((elapsed - 8.0) / 8.0) * 30)))
            eta_sec = max(4, int(22 - elapsed))
        else:
            step_msg = "Generando textura fotorrealista y detalles finales..."
            progress = max(75, min(95, 75 + int(((elapsed - 16.0) / 10.0) * 20)))
            eta_sec = max(2, int(26 - elapsed))

        return TryOnTaskStatusResponse(
            task_id=task.task_id,
            status="processing",
            progress=progress,
            eta_seconds=eta_sec,
            step_message=step_msg,
            original_photo_url=task.human_image_url,
            garment_image_url=task.garment_image_url,
            product_id=task.product_id,
            color_id=task.color_id,
            color_name=task.color_name,
            is_live=True,
        )

    async def _dispatch_replicate_task(
        self,
        *,
        human_image: str,
        garment_image: str,
        garment_des: str,
    ) -> str:
        model = (self.settings.replicate_model or "cuuupid/idm-vton").strip()
        url = f"https://api.replicate.com/v1/models/{model}/predictions"
        token = (self.settings.replicate_api_token or "").strip()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Prefer": "respond-async",
        }
        payload = {
            "input": {
                "human_img": human_image,
                "garm_img": garment_image,
                "garment_des": garment_des or "clothing",
                "category": "upper_body",
                "crop": False,
                "steps": 30,
            }
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(url, headers=headers, json=payload)
                if res.is_error:
                    error_detail = res.text
                    try:
                        err_json = res.json()
                        error_detail = (
                            err_json.get("detail")
                            or err_json.get("title")
                            or err_json.get("error")
                            or res.text
                        )
                    except Exception:
                        pass
                    raise TryOnError(
                        f"Error al iniciar prueba en Replicate ({res.status_code}): {error_detail}"
                    )
                data = res.json()
                external_id = data.get("id")
                if not external_id:
                    raise TryOnError("Replicate no devolvió un identificador de predicción válido")
                return str(external_id)
        except TryOnError:
            raise
        except Exception as exc:
            raise TryOnError(f"Error al comunicar con Replicate: {exc}") from exc

    async def _poll_replicate_status(
        self,
        task: LocalTryOnTask,
        storage: CloudinaryStorage | None = None,
    ) -> TryOnTaskStatusResponse:
        url = f"https://api.replicate.com/v1/predictions/{task.external_task_id}"
        token = (self.settings.replicate_api_token or "").strip()
        headers = {"Authorization": f"Bearer {token}"}
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url, headers=headers)
                res.raise_for_status()
                data = res.json()
                remote_status = (data.get("status") or "processing").lower()

                if remote_status == "succeeded":
                    task.status = "completed"
                    raw_output = data.get("output")
                    out_url = (
                        raw_output[0]
                        if isinstance(raw_output, list) and raw_output
                        else raw_output
                    )

                    result_url = None
                    if out_url and isinstance(out_url, str) and storage is not None:
                        try:
                            img_resp = await client.get(out_url, timeout=20.0)
                            if img_resp.status_code == 200:
                                upload = await storage.upload_tryon_photo(
                                    content=img_resp.content,
                                    filename=f"tryon_rep_{task.task_id}.png",
                                    content_type="image/png",
                                )
                                result_url = upload.secure_url
                        except Exception:
                            result_url = out_url
                    elif out_url and isinstance(out_url, str):
                        result_url = out_url

                    task.result_image_url = result_url or task.garment_image_url

                    if task.user_photo_public_id and storage:
                        try:
                            await storage.destroy(task.user_photo_public_id)
                            task.user_photo_public_id = None
                        except Exception:
                            pass

                    return TryOnTaskStatusResponse(
                        task_id=task.task_id,
                        status="completed",
                        progress=100,
                        eta_seconds=0,
                        step_message="¡Ajuste completado con Replicate IDM-VTON! Mira cómo te queda.",
                        result_image_url=task.result_image_url,
                        original_photo_url=task.human_image_url,
                        garment_image_url=task.garment_image_url,
                        product_id=task.product_id,
                        color_id=task.color_id,
                        color_name=task.color_name,
                        is_live=True,
                    )
                elif remote_status in ("failed", "canceled"):
                    task.status = "failed"
                    task.error = data.get("error") or "Error durante el procesamiento en Replicate"
                    if task.user_photo_public_id and storage:
                        try:
                            await storage.destroy(task.user_photo_public_id)
                            task.user_photo_public_id = None
                        except Exception:
                            pass
                    return TryOnTaskStatusResponse(
                        task_id=task.task_id,
                        status="failed",
                        progress=0,
                        eta_seconds=0,
                        step_message="No se pudo completar la prueba de ropa con Replicate",
                        error=task.error,
                        original_photo_url=task.human_image_url,
                        garment_image_url=task.garment_image_url,
                        product_id=task.product_id,
                        color_id=task.color_id,
                        color_name=task.color_name,
                        is_live=True,
                    )
                else:
                    elapsed = time.time() - task.created_at
                    progress = min(92, max(15, int((elapsed / 20.0) * 100)))
                    eta_sec = max(3, int(20 - elapsed))
                    if elapsed < 6.0:
                        msg = "Iniciando GPU dedicada y detectando silueta..."
                    elif elapsed < 14.0:
                        msg = "Alineando prenda con IDM-VTON y calculando caída de tela..."
                    else:
                        msg = "Generando textura fotorrealista y detalles finales..."

                    return TryOnTaskStatusResponse(
                        task_id=task.task_id,
                        status="processing",
                        progress=progress,
                        eta_seconds=eta_sec,
                        step_message=msg,
                        original_photo_url=task.human_image_url,
                        garment_image_url=task.garment_image_url,
                        product_id=task.product_id,
                        color_id=task.color_id,
                        color_name=task.color_name,
                        is_live=True,
                    )
        except Exception:
            elapsed = time.time() - task.created_at
            return TryOnTaskStatusResponse(
                task_id=task.task_id,
                status="processing",
                progress=min(90, max(20, int((elapsed / 20.0) * 100))),
                eta_seconds=max(3, int(20 - elapsed)),
                step_message="Procesando look con Replicate...",
                original_photo_url=task.human_image_url,
                garment_image_url=task.garment_image_url,
                product_id=task.product_id,
                color_id=task.color_id,
                color_name=task.color_name,
                is_live=True,
            )

