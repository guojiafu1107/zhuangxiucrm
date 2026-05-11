import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from sqlalchemy.orm.attributes import set_committed_value

from app.utils.excel import export_to_excel

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.customer import Customer, FollowUp
from app.schemas import (
    CustomerCreate, CustomerUpdate, CustomerStageUpdate,
    FollowUpCreate, CustomerResponse, FollowUpResponse,
    APIResponse,
)

router = APIRouter(prefix="/api/v1/customers", tags=["客户管理"])


@router.get("", response_model=APIResponse)
async def list_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    stage: Optional[str] = None,
    source: Optional[str] = None,
    assigned_to: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Customer).where(
        Customer.tenant_id == current_user.tenant_id,
        Customer.deleted_at.is_(None),
    )

    if stage:
        query = query.where(Customer.stage == stage)
    if source:
        query = query.where(Customer.source == source)
    if assigned_to:
        query = query.where(Customer.assigned_to == uuid.UUID(assigned_to))
    if search:
        query = query.where(
            or_(
                Customer.name.ilike(f"%{search}%"),
                Customer.phone.ilike(f"%{search}%"),
                Customer.house_address.ilike(f"%{search}%"),
            )
        )

    # Total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Paginated results
    offset = (page - 1) * page_size
    query = query.options(joinedload(Customer.follow_ups)).order_by(Customer.updated_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    customers = result.unique().scalars().all()

    return APIResponse(data={
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [CustomerResponse.model_validate(c).model_dump() for c in customers],
    })


@router.post("", response_model=APIResponse, status_code=201)
async def create_customer(
    req: CustomerCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    customer = Customer(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        **req.model_dump(exclude_none=True),
    )
    db.add(customer)
    await db.flush()
    # Set empty follow_ups to avoid lazy-load during response serialization
    set_committed_value(customer, 'follow_ups', [])
    return APIResponse(data=CustomerResponse.model_validate(customer).model_dump(), message="客户创建成功")


@router.get("/export")
async def export_customers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer)
        .where(Customer.tenant_id == current_user.tenant_id, Customer.deleted_at.is_(None))
        .order_by(Customer.updated_at.desc())
    )
    customers = result.scalars().all()
    headers = ["客户姓名", "手机号", "来源", "阶段", "房屋地址", "面积(㎡)", "户型", "风格偏好", "预算下限", "预算上限", "备注", "创建时间", "更新时间"]
    rows = [
        [
            c.name, c.phone or "", c.source or "", c.stage,
            c.house_address or "", float(c.area) if c.area else "",
            c.house_type or "", c.style_preference or "",
            float(c.budget_min) if c.budget_min else "", float(c.budget_max) if c.budget_max else "",
            c.remark or "", c.created_at.strftime("%Y-%m-%d %H:%M") if c.created_at else "",
            c.updated_at.strftime("%Y-%m-%d %H:%M") if c.updated_at else "",
        ]
        for c in customers
    ]
    return export_to_excel(headers, rows, "客户数据")


@router.get("/{customer_id}", response_model=APIResponse)
async def get_customer(
    customer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer)
        .where(Customer.id == customer_id, Customer.tenant_id == current_user.tenant_id, Customer.deleted_at.is_(None))
        .options(joinedload(Customer.follow_ups))
    )
    customer = result.unique().scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="客户未找到")
    return APIResponse(data=CustomerResponse.model_validate(customer).model_dump())


@router.put("/{customer_id}", response_model=APIResponse)
async def update_customer(
    customer_id: str,
    req: CustomerUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == current_user.tenant_id, Customer.deleted_at.is_(None))
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="客户未找到")

    update_data = req.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(customer, key, value)
    customer.updated_at = datetime.utcnow()
    await db.flush()
    # Avoid lazy-load greenlet issue during response serialization
    from sqlalchemy import inspect as sa_inspect
    if 'follow_ups' in sa_inspect(customer).unloaded:
        set_committed_value(customer, 'follow_ups', [])
    return APIResponse(data=CustomerResponse.model_validate(customer).model_dump(), message="客户更新成功")


@router.patch("/{customer_id}/stage", response_model=APIResponse)
async def update_customer_stage(
    customer_id: str,
    req: CustomerStageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == current_user.tenant_id, Customer.deleted_at.is_(None))
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="客户未找到")

    customer.stage = req.stage
    customer.updated_at = datetime.utcnow()
    await db.flush()
    return APIResponse(message="阶段更新成功")


@router.delete("/{customer_id}", response_model=APIResponse)
async def delete_customer(
    customer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == current_user.tenant_id, Customer.deleted_at.is_(None))
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="客户未找到")
    customer.deleted_at = datetime.utcnow()
    await db.flush()
    return APIResponse(message="客户已删除")


@router.post("/{customer_id}/follow-ups", response_model=APIResponse)
async def add_follow_up(
    customer_id: str,
    req: FollowUpCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == current_user.tenant_id, Customer.deleted_at.is_(None))
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="客户未找到")

    follow_up = FollowUp(
        id=uuid.uuid4(),
        customer_id=customer.id,
        created_by=current_user.id,
        **req.model_dump(),
    )
    db.add(follow_up)
    await db.flush()
    return APIResponse(data=FollowUpResponse.model_validate(follow_up).model_dump(), message="跟进记录已添加")


@router.get("/{customer_id}/follow-ups", response_model=APIResponse)
async def get_follow_ups(
    customer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FollowUp)
        .where(FollowUp.customer_id == customer_id)
        .order_by(FollowUp.created_at.desc())
    )
    follow_ups = result.scalars().all()
    return APIResponse(data=[FollowUpResponse.model_validate(f).model_dump() for f in follow_ups])
