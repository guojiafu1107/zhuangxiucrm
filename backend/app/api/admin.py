import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas import (
    TenantUpdate, InviteUserRequest, UserRoleUpdate,
    UserResponse, APIResponse,
)
from app.utils.auth import hash_password

router = APIRouter(prefix="/api/v1/admin", tags=["系统管理"])


@router.get("/tenant", response_model=APIResponse)
async def get_tenant(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="租户未找到")
    return APIResponse(data={
        "id": str(tenant.id),
        "name": tenant.name,
        "domain": tenant.domain,
        "logo_url": tenant.logo_url,
        "settings": tenant.settings,
        "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
    })


@router.put("/tenant", response_model=APIResponse)
async def update_tenant(
    req: TenantUpdate,
    current_user: User = Depends(require_role("owner")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="租户未找到")

    update_data = req.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(tenant, key, value)
    await db.flush()
    return APIResponse(message="租户配置已更新")


@router.get("/users", response_model=APIResponse)
async def list_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.tenant_id == current_user.tenant_id).order_by(User.created_at)
    )
    users = result.scalars().all()
    return APIResponse(data=[
        UserResponse.model_validate(u).model_dump() for u in users
    ])


@router.post("/users/invite", response_model=APIResponse, status_code=201)
async def invite_user(
    req: InviteUserRequest,
    current_user: User = Depends(require_role("owner")),
    db: AsyncSession = Depends(get_db),
):
    # Check if email exists in tenant
    result = await db.execute(
        select(User).where(User.tenant_id == current_user.tenant_id, User.email == req.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该邮箱已在企业中注册")

    default_password = "123456"  # Should send invite email in production
    user = User(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        name=req.name,
        email=req.email,
        hashed_password=hash_password(default_password),
        role=req.role,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return APIResponse(
        data={"id": str(user.id)},
        message=f"成员已邀请（默认密码：{default_password}）",
    )


@router.put("/users/{user_id}/role", response_model=APIResponse)
async def update_user_role(
    user_id: str,
    req: UserRoleUpdate,
    current_user: User = Depends(require_role("owner")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == current_user.tenant_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="用户未找到")
    user.role = req.role
    await db.flush()
    return APIResponse(message="角色已更新")
