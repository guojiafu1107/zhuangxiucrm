from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    app_name: str = "装修CRM系统"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://crm_user:secret@localhost:5432/crm"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT (MUST be overridden in production via .env)
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # CORS - 逗号分隔的 origins，兼容 Render 环境变量
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"

    # File upload
    max_upload_size: int = 20 * 1024 * 1024  # 20MB
    upload_dir: str = "./uploads"

    # MinIO / S3
    s3_endpoint: Optional[str] = None
    s3_access_key: Optional[str] = None
    s3_secret_key: Optional[str] = None
    s3_bucket: str = "crm-files"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
