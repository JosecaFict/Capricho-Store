from typing import Literal

from pydantic import BaseModel, Field


class TryOnTaskCreateResponse(BaseModel):
    task_id: str = Field(..., description="Unique identifier for the try-on task")
    status: Literal["pending", "processing"] = Field(
        default="pending", description="Initial status of the task"
    )
    message: str = Field(
        default="Tarea de vestidor virtual iniciada",
        description="User-friendly status message",
    )


class TryOnTaskStatusResponse(BaseModel):
    task_id: str
    status: Literal["pending", "processing", "completed", "failed"]
    progress: int = Field(default=0, ge=0, le=100)
    eta_seconds: int = Field(default=15, ge=0)
    step_message: str = Field(default="Iniciando escáner...")
    result_image_url: str | None = None
    original_photo_url: str | None = None
    garment_image_url: str | None = None
    product_id: int
    color_id: int | None = None
    color_name: str | None = None
    error: str | None = None
