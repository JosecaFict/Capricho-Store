import hashlib
import time
from dataclasses import dataclass
from urllib.parse import unquote, urlparse

import httpx


class CloudinaryError(RuntimeError):
    """Raised when Cloudinary is unavailable or rejects an upload."""


@dataclass(frozen=True, slots=True)
class CloudinaryUpload:
    public_id: str
    secure_url: str
    formato: str | None
    ancho_px: int | None
    alto_px: int | None


class CloudinaryStorage:
    def __init__(self, cloudinary_url: str, *, timeout_seconds: float = 25.0) -> None:
        parsed = urlparse(cloudinary_url)
        if parsed.scheme != "cloudinary" or not parsed.username or not parsed.password:
            raise CloudinaryError("La configuración de Cloudinary no es válida")
        if not parsed.hostname:
            raise CloudinaryError("La configuración de Cloudinary no incluye el nombre de nube")
        self.cloud_name = parsed.hostname
        self.api_key = unquote(parsed.username)
        self.api_secret = unquote(parsed.password)
        self.timeout_seconds = timeout_seconds

    def _signature(self, params: dict[str, str | int]) -> str:
        serialized = "&".join(f"{key}={params[key]}" for key in sorted(params))
        return hashlib.sha1(f"{serialized}{self.api_secret}".encode()).hexdigest()

    async def upload_product_image(
        self,
        *,
        product_id: int,
        content: bytes,
        filename: str,
        content_type: str,
    ) -> CloudinaryUpload:
        timestamp = int(time.time())
        params: dict[str, str | int] = {
            "folder": f"capricho-store/productos/{product_id}",
            "timestamp": timestamp,
            "unique_filename": "true",
            "use_filename": "true",
        }
        data = {
            **params,
            "api_key": self.api_key,
            "signature": self._signature(params),
        }
        url = f"https://api.cloudinary.com/v1_1/{self.cloud_name}/image/upload"
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    url,
                    data=data,
                    files={"file": (filename, content, content_type)},
                )
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise CloudinaryError("Cloudinary no pudo almacenar la imagen") from exc

        secure_url = payload.get("secure_url")
        public_id = payload.get("public_id")
        if not isinstance(secure_url, str) or not isinstance(public_id, str):
            raise CloudinaryError("Cloudinary devolvió una respuesta incompleta")
        return CloudinaryUpload(
            public_id=public_id,
            secure_url=secure_url,
            formato=payload.get("format"),
            ancho_px=payload.get("width"),
            alto_px=payload.get("height"),
        )

    async def destroy(self, public_id: str) -> None:
        timestamp = int(time.time())
        params: dict[str, str | int] = {"public_id": public_id, "timestamp": timestamp}
        data = {
            **params,
            "api_key": self.api_key,
            "signature": self._signature(params),
        }
        url = f"https://api.cloudinary.com/v1_1/{self.cloud_name}/image/destroy"
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                await client.post(url, data=data)
        except httpx.HTTPError:
            # Best-effort compensation after a database failure.
            return
