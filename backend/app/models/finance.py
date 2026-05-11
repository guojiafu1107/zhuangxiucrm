import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class PaymentSchedule(Base):
    __tablename__ = "finance_payment_schedules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contract_contracts.id"), nullable=False)
    stage_name = Column(String(100), nullable=False)
    ratio = Column(Numeric(5, 2), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    due_date = Column(Date, nullable=True)
    paid_at = Column(Date, nullable=True)
    status = Column(String(20), default="待收款")  # 待收款, 已收款, 已逾期
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class Transaction(Base):
    __tablename__ = "finance_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("pm_projects.id"), nullable=True)
    category = Column(String(20), nullable=False)  # 收入, 支出
    type = Column(String(30), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String(20), nullable=True)
    paid_at = Column(Date, nullable=True)
    remark = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
