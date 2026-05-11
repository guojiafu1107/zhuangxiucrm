from datetime import date, datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


# ===== Auth =====
class RegisterRequest(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=200)
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


# ===== User =====
class UserResponse(BaseModel):
    id: UUID
    name: str
    email: str
    phone: Optional[str] = None
    role: str
    is_active: bool

    class Config:
        from_attributes = True


# ===== Customer =====
class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = None
    source: Optional[str] = None
    stage: Optional[str] = "线索"
    house_address: Optional[str] = None
    area: Optional[float] = None
    house_type: Optional[str] = None
    style_preference: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    assigned_to: Optional[UUID] = None
    remark: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    house_address: Optional[str] = None
    area: Optional[float] = None
    house_type: Optional[str] = None
    style_preference: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    assigned_to: Optional[UUID] = None
    remark: Optional[str] = None


class CustomerStageUpdate(BaseModel):
    stage: str


class FollowUpCreate(BaseModel):
    type: str
    content: Optional[str] = None
    next_plan: Optional[str] = None
    next_time: Optional[datetime] = None


class FollowUpResponse(BaseModel):
    id: UUID
    type: str
    content: Optional[str] = None
    next_plan: Optional[str] = None
    next_time: Optional[datetime] = None
    created_by: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CustomerResponse(BaseModel):
    id: UUID
    name: str
    phone: Optional[str] = None
    source: Optional[str] = None
    stage: str
    house_address: Optional[str] = None
    area: Optional[float] = None
    house_type: Optional[str] = None
    style_preference: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    assigned_to: Optional[UUID] = None
    remark: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    follow_ups: list[FollowUpResponse] = []

    class Config:
        from_attributes = True


# ===== Project =====
class StageWorkerInput(BaseModel):
    name: str
    worker_name: Optional[str] = None


class ProjectCreate(BaseModel):
    customer_id: UUID
    name: str
    address: Optional[str] = None
    start_date: Optional[date] = None
    expected_end_date: Optional[date] = None
    designer_name: Optional[str] = None
    pm_name: Optional[str] = None
    stages: Optional[list[StageWorkerInput]] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    start_date: Optional[date] = None
    expected_end_date: Optional[date] = None
    status: Optional[str] = None
    progress_percent: Optional[float] = None


class ProjectMemberAdd(BaseModel):
    user_id: UUID
    role: str


class StageCreate(BaseModel):
    name: str
    order_no: int
    worker_name: Optional[str] = None
    planned_start: Optional[date] = None
    planned_end: Optional[date] = None


class StageUpdate(BaseModel):
    status: Optional[str] = None
    worker_name: Optional[str] = None
    planned_start: Optional[date] = None
    planned_end: Optional[date] = None
    actual_start: Optional[date] = None
    actual_end: Optional[date] = None


class ConstructionLogCreate(BaseModel):
    content: str


class ProjectMaterialCreate(BaseModel):
    material_id: UUID
    planned_qty: Optional[float] = None
    unit_price: Optional[float] = None


# ===== Quotation =====
class QuotationItemCreate(BaseModel):
    space: str
    category: str
    item_name: str
    unit: str
    quantity: float
    unit_price: float


class QuotationItemUpdate(BaseModel):
    space: Optional[str] = None
    category: Optional[str] = None
    item_name: Optional[str] = None
    unit: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None


class QuotationCreate(BaseModel):
    customer_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    total_amount: float
    discount: Optional[float] = 0


# ===== Contract =====
class ContractCreate(BaseModel):
    quotation_id: UUID
    project_id: Optional[UUID] = None
    contract_no: str
    customer_name: Optional[str] = None
    signed_at: Optional[date] = None
    total_amount: Optional[float] = None


class ChangeOrderCreate(BaseModel):
    change_desc: str
    amount_delta: float


# ===== Finance =====
class TransactionCreate(BaseModel):
    project_id: Optional[UUID] = None
    category: str  # 收入, 支出
    type: str
    amount: float
    payment_method: Optional[str] = None
    paid_at: Optional[date] = None
    remark: Optional[str] = None


class PaymentScheduleUpdate(BaseModel):
    paid_at: Optional[date] = None


# ===== Material =====
class MaterialCreate(BaseModel):
    name: str
    category: Optional[str] = None
    unit: Optional[str] = None
    default_price: Optional[float] = None
    supplier: Optional[str] = None


class MaterialUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    default_price: Optional[float] = None
    supplier: Optional[str] = None


# ===== Tenant Settings =====
class TenantUpdate(BaseModel):
    name: Optional[str] = None
    logo_url: Optional[str] = None
    settings: Optional[dict] = None


# ===== User Invite =====
class InviteUserRequest(BaseModel):
    name: str
    email: EmailStr
    role: str


class UserRoleUpdate(BaseModel):
    role: str


# ===== Common =====
class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list


class APIResponse(BaseModel):
    code: int = 0
    data: Optional[dict | list] = None
    message: str = "success"
