import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.customer import Customer
from app.models.contract import Quotation, QuotationItem, Contract, ChangeOrder
from app.utils.excel import export_to_excel
from app.schemas import (
    QuotationCreate, QuotationItemCreate, QuotationItemUpdate,
    ContractCreate, ChangeOrderCreate,
    APIResponse,
)

router = APIRouter(prefix="/api/v1", tags=["报价与合同"])


# ===== Quotations =====
@router.get("/quotations", response_model=APIResponse)
async def list_quotations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Quotation).where(Quotation.tenant_id == current_user.tenant_id)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    offset = (page - 1) * page_size
    query = query.order_by(Quotation.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    quotations = result.scalars().all()

    return APIResponse(data={
        "total": total, "page": page, "page_size": page_size,
        "items": [
            {
                "id": str(q.id),
                "customer_id": str(q.customer_id) if q.customer_id else None,
                "total_amount": float(q.total_amount),
                "discount": float(q.discount) if q.discount else 0,
                "status": q.status,
                "items_count": len(q.items) if q.items else 0,
                "created_at": q.created_at.isoformat() if q.created_at else None,
            }
            for q in quotations
        ],
    })


@router.post("/quotations", response_model=APIResponse, status_code=201)
async def create_quotation(
    req: QuotationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    quotation = Quotation(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        **req.model_dump(),
    )
    db.add(quotation)
    await db.flush()
    return APIResponse(data={"id": str(quotation.id)}, message="报价单已创建")


@router.get("/quotations/export")
async def export_quotations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Quotation).where(Quotation.tenant_id == current_user.tenant_id)
        .order_by(Quotation.created_at.desc())
    )
    quotations = result.scalars().all()
    headers = ["报价总额", "优惠金额", "状态", "报价项数", "创建时间"]
    rows = [
        [
            float(q.total_amount), float(q.discount) if q.discount else 0,
            q.status, len(q.items) if q.items else 0,
            q.created_at.strftime("%Y-%m-%d %H:%M") if q.created_at else "",
        ]
        for q in quotations
    ]
    return export_to_excel(headers, rows, "报价数据")


@router.get("/quotations/{quotation_id}", response_model=APIResponse)
async def get_quotation(
    quotation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Quotation)
        .where(Quotation.id == quotation_id, Quotation.tenant_id == current_user.tenant_id)
        .options(joinedload(Quotation.items))
    )
    quotation = result.unique().scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=404, detail="报价单未找到")
    return APIResponse(data={
        "id": str(quotation.id),
        "customer_id": str(quotation.customer_id) if quotation.customer_id else None,
        "project_id": str(quotation.project_id) if quotation.project_id else None,
        "total_amount": float(quotation.total_amount),
        "discount": float(quotation.discount) if quotation.discount else 0,
        "status": quotation.status,
        "items": [
            {
                "id": str(i.id),
                "space": i.space,
                "category": i.category,
                "item_name": i.item_name,
                "unit": i.unit,
                "quantity": float(i.quantity),
                "unit_price": float(i.unit_price),
                "amount": float(i.amount) if i.amount else float(i.quantity * i.unit_price),
            }
            for i in quotation.items
        ],
        "created_at": quotation.created_at.isoformat() if quotation.created_at else None,
    })


@router.post("/quotations/{quotation_id}/items", response_model=APIResponse, status_code=201)
async def add_quotation_item(
    quotation_id: str,
    req: QuotationItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = QuotationItem(
        id=uuid.uuid4(),
        quotation_id=quotation_id,
        amount=req.quantity * req.unit_price,
        **req.model_dump(),
    )
    db.add(item)
    await db.flush()
    return APIResponse(data={"id": str(item.id)}, message="报价项已添加")


@router.put("/quotations/{quotation_id}/items/{item_id}", response_model=APIResponse)
async def update_quotation_item(
    quotation_id: str,
    item_id: str,
    req: QuotationItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(QuotationItem).where(QuotationItem.id == item_id, QuotationItem.quotation_id == quotation_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="报价项未找到")

    update_data = req.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    item.amount = float(item.quantity) * float(item.unit_price)
    await db.flush()
    return APIResponse(message="报价项已更新")


@router.delete("/quotations/{quotation_id}/items/{item_id}", response_model=APIResponse)
async def delete_quotation_item(
    quotation_id: str,
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(QuotationItem).where(QuotationItem.id == item_id, QuotationItem.quotation_id == quotation_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="报价项未找到")
    await db.delete(item)
    await db.flush()
    return APIResponse(message="报价项已删除")


# ===== Contracts =====
@router.get("/contracts", response_model=APIResponse)
async def list_contracts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Contract).where(Contract.tenant_id == current_user.tenant_id)
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    offset = (page - 1) * page_size
    query = query.order_by(Contract.created_at.desc()).offset(offset).limit(page_size)
    result = await db.execute(query)
    contracts = result.scalars().all()

    return APIResponse(data={
        "total": total, "page": page, "page_size": page_size,
        "items": [
            {
                "id": str(c.id),
                "contract_no": c.contract_no,
                "customer_name": c.customer_name,
                "total_amount": float(c.total_amount) if c.total_amount else 0,
                "signed_at": str(c.signed_at) if c.signed_at else None,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in contracts
        ],
    })


@router.post("/contracts", response_model=APIResponse, status_code=201)
async def create_contract(
    req: ContractCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contract = Contract(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        **req.model_dump(),
    )
    db.add(contract)
    await db.flush()

    # Update quotation status to 已签约
    if req.quotation_id:
        result = await db.execute(select(Quotation).where(Quotation.id == req.quotation_id))
        quotation = result.scalar_one_or_none()
        if quotation:
            quotation.status = "已签约"

    await db.flush()
    return APIResponse(data={"id": str(contract.id)}, message="合同已创建")


@router.get("/contracts/export")
async def export_contracts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contract).where(Contract.tenant_id == current_user.tenant_id)
        .order_by(Contract.created_at.desc())
    )
    contracts = result.scalars().all()
    headers = ["合同编号", "客户名称", "合同金额", "签订日期", "创建时间"]
    rows = [
        [
            c.contract_no, c.customer_name or "",
            float(c.total_amount) if c.total_amount else 0,
            str(c.signed_at) if c.signed_at else "",
            c.created_at.strftime("%Y-%m-%d %H:%M") if c.created_at else "",
        ]
        for c in contracts
    ]
    return export_to_excel(headers, rows, "合同数据")


@router.get("/contracts/{contract_id}", response_model=APIResponse)
async def get_contract(
    contract_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Contract).where(Contract.id == contract_id, Contract.tenant_id == current_user.tenant_id)
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="合同未找到")
    return APIResponse(data={
        "id": str(contract.id),
        "quotation_id": str(contract.quotation_id) if contract.quotation_id else None,
        "project_id": str(contract.project_id) if contract.project_id else None,
        "contract_no": contract.contract_no,
        "customer_name": contract.customer_name,
        "total_amount": float(contract.total_amount) if contract.total_amount else 0,
        "signed_at": str(contract.signed_at) if contract.signed_at else None,
        "file_url": contract.file_url,
        "created_at": contract.created_at.isoformat() if contract.created_at else None,
    })


@router.post("/contracts/{contract_id}/changes", response_model=APIResponse, status_code=201)
async def create_change_order(
    contract_id: str,
    req: ChangeOrderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    change = ChangeOrder(
        id=uuid.uuid4(),
        contract_id=contract_id,
        created_by=current_user.id,
        **req.model_dump(),
    )
    db.add(change)
    await db.flush()
    return APIResponse(data={"id": str(change.id)}, message="变更单已创建")
