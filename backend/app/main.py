import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine, Base
from app.api import auth, customers, projects, contracts, finance, materials, reports, admin


_db_initialized = False


async def ensure_db_init():
    """确保数据库表已创建（懒加载，避免冷启动时重复执行）"""
    global _db_initialized
    if not _db_initialized:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        _db_initialized = True


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate production config
    if not settings.jwt_secret_key:
        raise RuntimeError(
            "JWT_SECRET_KEY is not set! "
            "Please set it in .env or environment variables for production."
        )
    if not os.environ.get("VERCEL_ENV"):
        # 非 Vercel 模式：启动时创建表
        await ensure_db_init()
    yield
    if not os.environ.get("VERCEL_ENV"):
        await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    description="装修企业 CRM SaaS 系统 API",
    version="1.0.0",
    docs_url="/docs",
    lifespan=lifespan,
)

# CORS - 支持逗号分隔字符串和 JSON 数组
import json as json_lib
cors_raw = settings.cors_origins
try:
    cors_list = json_lib.loads(cors_raw) if cors_raw.startswith("[") else [o.strip() for o in cors_raw.split(",") if o.strip()]
except (json_lib.JSONDecodeError, AttributeError):
    cors_list = ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(projects.router)
app.include_router(contracts.router)
app.include_router(finance.router)
app.include_router(materials.router)
app.include_router(reports.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    # Vercel 模式下，在首次请求时初始化数据库
    if os.environ.get("VERCEL_ENV"):
        await ensure_db_init()
    return {"status": "ok", "service": settings.app_name}
