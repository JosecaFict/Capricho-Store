from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_v1_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.db.session import engine
from app.modules.auth.handlers import register_auth_exception_handlers
from app.modules.catalog.handlers import register_catalog_exception_handlers
from app.modules.commerce.handlers import register_commerce_exception_handlers
from app.modules.employees.handlers import register_employee_exception_handlers
from app.modules.inventory.handlers import register_inventory_exception_handlers
from app.modules.recommendations.handlers import register_recommendation_exception_handlers


async def run_startup_migrations() -> None:
    """Run idempotent schema updates and constraint migrations on PostgreSQL."""
    try:
        from sqlalchemy import text
        import logging

        logger = logging.getLogger("capricho.migrations")
        async with engine.begin() as conn:
            # Actualizar check constraint de notificacion para admitir LEIDO, ACTIVO, FALLIDO
            await conn.execute(
                text(
                    """
                    DO $$
                    BEGIN
                        ALTER TABLE IF EXISTS notificacion DROP CONSTRAINT IF EXISTS notificacion_estado_check;
                        ALTER TABLE IF EXISTS notificacion ADD CONSTRAINT notificacion_estado_check 
                            CHECK (estado IN ('PENDIENTE', 'ENVIANDO', 'ENVIADO', 'ENTREGADO', 'ERROR', 'LEIDO', 'ACTIVO', 'FALLIDO'));
                    EXCEPTION
                        WHEN OTHERS THEN
                            NULL;
                    END $$;
                    """
                )
            )
            await conn.execute(
                text(
                    """
                    DO $$
                    BEGIN
                        ALTER TABLE IF EXISTS capricho.notificacion DROP CONSTRAINT IF EXISTS notificacion_estado_check;
                        ALTER TABLE IF EXISTS capricho.notificacion ADD CONSTRAINT notificacion_estado_check 
                            CHECK (estado IN ('PENDIENTE', 'ENVIANDO', 'ENVIADO', 'ENTREGADO', 'ERROR', 'LEIDO', 'ACTIVO', 'FALLIDO'));
                    EXCEPTION
                        WHEN OTHERS THEN
                            NULL;
                    END $$;
                    """
                )
            )
            logger.info("Migración de notificacion_estado_check verificada exitosamente.")
    except Exception as exc:
        import logging
        logging.getLogger("capricho.migrations").warning("No se pudo ejecutar la migración inicial de notificaciones: %s", exc)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Release the connection pool when the application stops."""
    await run_startup_migrations()
    yield
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.debug)

    application = FastAPI(
        title=settings.app_name,
        debug=settings.debug,
        lifespan=lifespan,
    )
    if settings.cors_origin_list:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origin_list,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    application.include_router(api_v1_router, prefix="/api/v1")
    register_exception_handlers(application)
    register_auth_exception_handlers(application)
    register_employee_exception_handlers(application)
    register_catalog_exception_handlers(application)
    register_commerce_exception_handlers(application)
    register_inventory_exception_handlers(application)
    register_recommendation_exception_handlers(application)
    return application


app = create_app()
