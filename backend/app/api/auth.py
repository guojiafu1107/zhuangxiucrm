import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas import (
    RegisterRequest, LoginRequest, TokenResponse, RefreshRequest,
    UserResponse, APIResponse,
)
from app.utils.auth import hash_password, verify_password, create_access_token, create_refresh_token

router = APIRouter(prefix="/api/v1/auth", tags=["认证"])


@router.post("/register", response_model=APIResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该邮箱已被注册")

    # Create tenant
    tenant = Tenant(id=uuid.uuid4(), name=req.company_name)
    db.add(tenant)
    await db.flush()

    # Create owner user
    user = User(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        name=req.name,
        email=req.email,
        hashed_password=hash_password(req.password),
        role="owner",
        is_active=True,
    )
    db.add(user)
    await db.flush()

    return APIResponse(data={"tenant_id": str(tenant.id), "user_id": str(user.id)}, message="注册成功")


@router.post("/login", response_model=APIResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email, User.is_active == True))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    access_token = create_access_token({"sub": str(user.id), "tenant_id": str(user.tenant_id), "role": user.role})
    refresh_token = create_refresh_token({"sub": str(user.id), "tenant_id": str(user.tenant_id)})

    return APIResponse(data=TokenResponse(access_token=access_token, refresh_token=refresh_token).model_dump())


@router.post("/refresh", response_model=APIResponse)
async def refresh(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    from jose import JWTError, jwt
    from app.config import settings
    try:
        payload = jwt.decode(req.refresh_token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="无效的刷新令牌")
    except JWTError:
        raise HTTPException(status_code=401, detail="无效的刷新令牌")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="用户不存在")

    access_token = create_access_token({"sub": str(user.id), "tenant_id": str(user.tenant_id), "role": user.role})
    return APIResponse(data={"access_token": access_token, "token_type": "bearer"})


@router.post("/logout", response_model=APIResponse)
async def logout(current_user: User = Depends(get_current_user)):
    # In production, invalidate refresh token in Redis
    return APIResponse(message="已退出登录")


@router.get("/me", response_model=APIResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return APIResponse(data=UserResponse.model_validate(current_user).model_dump())
