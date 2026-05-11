from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, extract, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.customer import Customer
from app.models.project import Project, Stage, ProjectMember
from app.models.contract import Contract, Quotation
from app.models.finance import Transaction
from app.schemas import APIResponse

router = APIRouter(prefix="/api/v1/reports", tags=["数据报表"])

CUSTOMER_STAGES = ["线索", "已联系", "量房", "报预算", "签合同", "在建", "完工"]
PROJECT_STATUSES = ["待开工", "施工中", "待验收", "完工", "停工"]


@router.get("/overview", response_model=APIResponse)
async def overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user.tenant_id
    today = date.today()
    first_of_month = today.replace(day=1)

    # Total & monthly new customers
    total_customers = await db.scalar(
        select(func.count()).select_from(Customer).where(
            Customer.tenant_id == tenant_id, Customer.deleted_at.is_(None)
        )
    )
    monthly_new_customers = await db.scalar(
        select(func.count()).select_from(Customer).where(
            Customer.tenant_id == tenant_id, Customer.deleted_at.is_(None),
            Customer.created_at >= first_of_month,
        )
    )

    # Funnel conversion: count by stage
    funnel_data = []
    for stage in CUSTOMER_STAGES:
        count = await db.scalar(
            select(func.count()).select_from(Customer).where(
                Customer.tenant_id == tenant_id, Customer.stage == stage,
                Customer.deleted_at.is_(None),
            )
        )
        funnel_data.append({"stage": stage, "count": count or 0})

    # Customers with stage >= "签合同" = converted
    converted = sum(item["count"] for item in funnel_data if funnel_data.index(item) >= CUSTOMER_STAGES.index("签合同"))
    lead_count = funnel_data[0]["count"]  # 线索
    conversion_rate = round(converted / lead_count * 100, 1) if lead_count > 0 else 0

    # Projects stats
    total_projects = await db.scalar(
        select(func.count()).select_from(Project).where(
            Project.tenant_id == tenant_id, Project.deleted_at.is_(None)
        )
    )
    project_counts = {}
    for status in PROJECT_STATUSES:
        count = await db.scalar(
            select(func.count()).select_from(Project).where(
                Project.tenant_id == tenant_id, Project.status == status,
                Project.deleted_at.is_(None),
            )
        )
        project_counts[status] = count or 0

    active_projects = project_counts.get("施工中", 0)

    # Contract amounts (total & this month)
    total_contract_amount = await db.scalar(
        select(func.sum(Contract.total_amount)).select_from(Contract).where(
            Contract.tenant_id == tenant_id,
        )
    ) or 0

    monthly_contract_amount = await db.scalar(
        select(func.sum(Contract.total_amount)).select_from(Contract).where(
            Contract.tenant_id == tenant_id,
            Contract.signed_at >= first_of_month,
        )
    ) or 0

    # Monthly income (this month)
    monthly_income = await db.scalar(
        select(func.sum(Transaction.amount)).select_from(Transaction).where(
            Transaction.tenant_id == tenant_id,
            Transaction.category == "收入",
            Transaction.paid_at >= first_of_month,
        )
    ) or 0

    monthly_expense = await db.scalar(
        select(func.sum(Transaction.amount)).select_from(Transaction).where(
            Transaction.tenant_id == tenant_id,
            Transaction.category == "支出",
            Transaction.paid_at >= first_of_month,
        )
    ) or 0

    return APIResponse(data={
        "total_customers": total_customers or 0,
        "monthly_new_customers": monthly_new_customers or 0,
        "total_projects": total_projects or 0,
        "active_projects": active_projects,
        "total_contract_amount": float(total_contract_amount),
        "monthly_contract_amount": float(monthly_contract_amount),
        "monthly_income": float(monthly_income),
        "monthly_expense": float(monthly_expense),
        "conversion_rate": conversion_rate,
        "funnel": funnel_data,
        "project_counts": project_counts,
    })


@router.get("/sales-funnel", response_model=APIResponse)
async def sales_funnel(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    funnel_data = []
    for stage in CUSTOMER_STAGES:
        count = await db.scalar(
            select(func.count())
            .select_from(Customer)
            .where(
                Customer.tenant_id == current_user.tenant_id,
                Customer.stage == stage,
                Customer.deleted_at.is_(None),
            )
        )
        funnel_data.append({"stage": stage, "count": count or 0})

    # Calculate conversion rates
    max_count = max((d["count"] for d in funnel_data), default=0)
    for d in funnel_data:
        d["percentage"] = round(d["count"] / max_count * 100, 1) if max_count > 0 else 0

    return APIResponse(data=funnel_data)


@router.get("/profit", response_model=APIResponse)
async def profit_report(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total_contract = await db.scalar(
        select(func.sum(Contract.total_amount))
        .select_from(Contract)
        .where(Contract.tenant_id == current_user.tenant_id)
    )

    project_counts = {}
    for status in PROJECT_STATUSES:
        count = await db.scalar(
            select(func.count())
            .select_from(Project)
            .where(
                Project.tenant_id == current_user.tenant_id,
                Project.status == status,
                Project.deleted_at.is_(None),
            )
        )
        project_counts[status] = count or 0

    return APIResponse(data={
        "total_contract_amount": float(total_contract) if total_contract else 0,
        "project_counts": project_counts,
    })


@router.get("/efficiency", response_model=APIResponse)
async def efficiency_report(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total_projects = await db.scalar(
        select(func.count())
        .select_from(Project)
        .where(
            Project.tenant_id == current_user.tenant_id,
            Project.deleted_at.is_(None),
        )
    )

    stages_query = await db.execute(
        select(
            Stage.name,
            func.count().label("total"),
            func.sum(
                case((Stage.status == "延期", 1), else_=0)
            ).label("overdue_count"),
        )
        .select_from(Stage)
        .join(Project, Stage.project_id == Project.id)
        .where(
            Project.tenant_id == current_user.tenant_id,
            Project.deleted_at.is_(None),
        )
        .group_by(Stage.name)
    )
    stage_stats = [
        {"name": row.name, "total": row.total, "overdue": row.overdue_count}
        for row in stages_query
    ]

    return APIResponse(data={
        "total_projects": total_projects or 0,
        "stage_efficiency": stage_stats,
    })


@router.get("/monthly-trend", response_model=APIResponse)
async def monthly_trend(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Monthly contract amounts and income/expense for the last 12 months"""
    tenant_id = current_user.tenant_id
    today = date.today()
    twelve_months_ago = today.replace(day=1) - timedelta(days=365)

    # Monthly contract amounts
    rows = await db.execute(
        select(
            extract("year", Contract.signed_at).label("year"),
            extract("month", Contract.signed_at).label("month"),
            func.sum(Contract.total_amount).label("amount"),
        )
        .where(
            Contract.tenant_id == tenant_id,
            Contract.signed_at >= twelve_months_ago,
        )
        .group_by("year", "month")
        .order_by("year", "month")
    )
    contract_trend = {}
    for row in rows:
        key = f"{int(row.year)}-{int(row.month):02d}"
        contract_trend[key] = float(row.amount)

    # Monthly income
    income_rows = await db.execute(
        select(
            extract("year", Transaction.paid_at).label("year"),
            extract("month", Transaction.paid_at).label("month"),
            func.sum(Transaction.amount).label("amount"),
            Transaction.category,
        )
        .where(
            Transaction.tenant_id == tenant_id,
            Transaction.paid_at >= twelve_months_ago,
        )
        .group_by("year", "month", Transaction.category)
        .order_by("year", "month")
    )
    income_trend = {}
    expense_trend = {}
    for row in income_rows:
        key = f"{int(row.year)}-{int(row.month):02d}"
        if row.category == "收入":
            income_trend[key] = float(row.amount)
        else:
            expense_trend[key] = float(row.amount)

    # Build complete 12-month series
    months = []
    for i in range(12):
        dt = today.replace(day=1) - timedelta(days=30 * (11 - i))
        key = dt.strftime("%Y-%m")
        months.append({
            "month": key,
            "label": f"{dt.month}月",
            "contract_amount": contract_trend.get(key, 0),
            "income": income_trend.get(key, 0),
            "expense": expense_trend.get(key, 0),
        })

    return APIResponse(data=months)


@router.get("/performance", response_model=APIResponse)
async def performance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Designer/employee performance ranking"""
    tenant_id = current_user.tenant_id

    # Top designers by contract amount (join via Quotation.created_by)
    designer_data = await db.execute(
        select(
            User.name,
            func.count(Contract.id).label("contract_count"),
            func.sum(Contract.total_amount).label("total_amount"),
        )
        .select_from(Contract)
        .join(Quotation, Contract.quotation_id == Quotation.id)
        .join(User, User.id == Quotation.created_by)
        .where(
            Contract.tenant_id == tenant_id,
            User.role.in_(["owner", "designer"]),
        )
        .group_by(User.name)
        .order_by(func.sum(Contract.total_amount).desc().nullslast())
        .limit(10)
    )
    top_designers = [
        {
            "name": row.name,
            "contract_count": row.contract_count,
            "total_amount": float(row.total_amount) if row.total_amount else 0,
        }
        for row in designer_data
    ]

    # Top PMs by project count
    pm_data = await db.execute(
        select(
            User.name,
            func.count(Project.id).label("project_count"),
        )
        .select_from(Project)
        .join(ProjectMember, Project.id == ProjectMember.project_id)
        .join(User, User.id == ProjectMember.user_id)
        .where(
            Project.tenant_id == tenant_id,
            Project.deleted_at.is_(None),
            ProjectMember.role == "项目经理",
        )
        .group_by(User.name)
        .order_by(func.count(Project.id).desc())
        .limit(10)
    )
    top_pms = [
        {"name": row.name, "project_count": row.project_count}
        for row in pm_data
    ]

    return APIResponse(data={
        "top_designers": top_designers,
        "top_pms": top_pms,
    })


@router.get("/customer-source", response_model=APIResponse)
async def customer_source(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Customer source breakdown"""
    rows = await db.execute(
        select(
            Customer.source,
            func.count().label("count"),
        )
        .where(
            Customer.tenant_id == current_user.tenant_id,
            Customer.deleted_at.is_(None),
            Customer.source.isnot(None),
        )
        .group_by(Customer.source)
        .order_by(func.count().desc())
    )
    sources = [
        {"source": row.source, "count": row.count}
        for row in rows
    ]
    return APIResponse(data=sources)
