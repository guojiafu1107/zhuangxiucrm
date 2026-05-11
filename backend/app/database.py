import os
from typing import AsyncGenerator
from sqlalchemy import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# 兼容各种平台的数据连接串格式
db_url = settings.database_url
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)

# Supabase 需要 SSL
if "sslmode" not in db_url:
    sep = "&" if "?" in db_url else "?"
    db_url += f"{sep}sslmode=require"

# Vercel 无服务器模式：使用 NullPool（不保持连接池）
# 其他模式（Docker/本地）：使用连接池
is_serverless = os.environ.get("VERCEL_ENV") == "1"
if is_serverless:
    engine = create_async_engine(
        db_url,
        echo=settings.debug,
        poolclass=NullPool,
    )
else:
    engine = create_async_engine(
        db_url,
        echo=settings.debug,
        pool_size=20,
        max_overflow=10,
    )

async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
