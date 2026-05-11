import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.finance import PaymentSchedule, Transaction
from app.schemas import TransactionCreate, PaymentScheduleUpdate, APIResponse
from app.utils.excel import export_to_excel

router = APIRouter(prefix="/api/v1", tags=["财务管理"])


@router.get("/payment-schedules", response_model=APIResponse)
async def list_payment_schedules(
    project_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.contract import Contract
    # Always join through contract for tenant isolation (PaymentSchedule has no tenant_id)
    query = select(PaymentSchedule).join(Contract, PaymentSchedule.contract_id == Contract.id)
    query = query.where(Contract.tenant_id == current_user.tenant_id)
    if project_id:
        query = query.where(Contract.project_id == project_id)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    offset = (page - 1) * page_size
    query = query.order_by(PaymentSchedule.due_date.asc().nullslast()).offset(offset).limit(page_size)
    result = await db.execute(query)
    schedules = result.scalars().all()

    return APIResponse(data={
        "total": total, "page": page, "page_size": page_size,
        "items": [
            {
                "id": str(s.id),
                "contract_id": str(s.contract_id),
                "stage_name": s.stage_name,
                "ratio": float(s.ratio),
                "amount": float(s.amount),
                "due_date": str(s.due_date) if s.due_date else None,
                "paid_at": str(s.paid_at) if s.paid_at else None,
                "status": s.status,
            }
            for s in schedules
        ],
    })


@router.post("/payment-schedules/{schedule_id}/mark-paid", response_model=APIResponse)
async def mark_paid(
    schedule_id: str,
    req: PaymentScheduleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PaymentSchedule).where(PaymentSchedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="收款计划未找到")

    schedule.paid_at = req.paid_at if req.paid_at else date.today()
    schedule.status = "已收款"
    await db.flush()
    return APIResponse(message="已标记为已收款")


@router.get("/transactions", response_model=APIResponse)
async def list_transactions(
    project_id: Optional[str] = None,
    category: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Transaction).where(Transaction.tenant_id == current_user.tenant_id)
    if project_id:
        query = query.where(Transaction.project_id == project_id)
    if category:
        query = query.where(Transaction.category == category)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    offset = (page - 1) * page_size
    query = query.order_by(Transaction.paid_at.desc().nullslast()).offset(offset).limit(page_size)
    result = await db.execute(query)
    transactions = result.scalars().all()

    return APIResponse(data={
        "total": total, "page": page, "page_size": page_size,
        "items": [
            {
                "id": str(t.id),
                "project_id": str(t.project_id) if t.project_id else None,
                "category": t.category,
                "type": t.type,
                "amount": float(t.amount),
                "payment_method": t.payment_method,
                "paid_at": str(t.paid_at) if t.paid_at else None,
                "remark": t.remark,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in transactions
        ],
    })


@router.post("/transactions", response_model=APIResponse, status_code=201)
async def create_transaction(
    req: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    transaction = Transaction(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        **req.model_dump(),
    )
    db.add(transaction)
    await db.flush()
    return APIResponse(data={"id": str(transaction.id)}, message="交易记录已创建")


@router.get("/transactions/export")
async def export_transactions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction).where(Transaction.tenant_id == current_user.tenant_id)
        .order_by(Transaction.paid_at.desc().nullslast())
    )
    transactions = result.scalars().all()
    headers = ["类别", "交易类型", "金额", "支付方式", "交易日期", "备注", "创建时间"]
    rows = [
        [
            t.category, t.type, float(t.amount),
            t.payment_method or "", str(t.paid_at) if t.paid_at else "",
            t.remark or "",
            t.created_at.strftime("%Y-%m-%d %H:%M") if t.created_at else "",
        ]
        for t in transactions
    ]
    return export_to_excel(headers, rows, "财务数据")
