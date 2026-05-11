import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Quotation(Base):
    __tablename__ = "contract_quotations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("crm_customers.id"), nullable=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("pm_projects.id"), nullable=True)
    total_amount = Column(Numeric(12, 2), nullable=False)
    discount = Column(Numeric(12, 2), default=0)
    status = Column(String(20), default="草稿")  # 草稿, 已发送, 已确认, 已签约, 作废
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("QuotationItem", back_populates="quotation", lazy="selectin",
                         cascade="all, delete-orphan")


class QuotationItem(Base):
    __tablename__ = "contract_quotation_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quotation_id = Column(UUID(as_uuid=True), ForeignKey("contract_quotations.id", ondelete="CASCADE"), nullable=False)
    space = Column(String(50), nullable=False)
    category = Column(String(50), nullable=False)
    item_name = Column(String(200), nullable=False)
    unit = Column(String(20), nullable=False)
    quantity = Column(Numeric(10, 2), nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    amount = Column(Numeric(12, 2), nullable=True)  # GENERATED ALWAYS AS

    quotation = relationship("Quotation", back_populates="items")


class Contract(Base):
    __tablename__ = "contract_contracts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    quotation_id = Column(UUID(as_uuid=True), ForeignKey("contract_quotations.id"), nullable=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("pm_projects.id"), nullable=True)
    contract_no = Column(String(50), nullable=False)
    customer_name = Column(String(100), nullable=True)
    signed_at = Column(Date, nullable=True)
    total_amount = Column(Numeric(12, 2), nullable=True)
    file_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class ChangeOrder(Base):
    __tablename__ = "contract_change_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    contract_id = Column(UUID(as_uuid=True), ForeignKey("contract_contracts.id"), nullable=False)
    change_desc = Column(Text, nullable=False)
    amount_delta = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), default="待确认")  # 待确认, 已确认, 已拒绝
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
