import os

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://test_user:test_password@localhost:5432/capricho_test",
)
os.environ.setdefault("APP_NAME", "Capricho Store Test API")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DEBUG", "false")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

