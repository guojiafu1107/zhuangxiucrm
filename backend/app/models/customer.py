import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Numeric, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Customer(Base):
    __tablename__ = "crm_customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    source = Column(String(20), nullable=True)  # 官网, 电话, 转介绍, 广告, 其他
    stage = Column(String(20), default="线索")  # 线索, 已联系, 量房, 报预算, 签合同, 在建, 完工
    house_address = Column(Text, nullable=True)
    area = Column(Numeric(8, 2), nullable=True)
    house_type = Column(String(20), nullable=True)
    style_preference = Column(String(50), nullable=True)
    budget_min = Column(Numeric(10, 2), nullable=True)
    budget_max = Column(Numeric(10, 2), nullable=True)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    remark = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    follow_ups = relationship("FollowUp", back_populates="customer", lazy="selectin",
                              order_by="FollowUp.created_at.desc()")


class FollowUp(Base):
    __tablename__ = "crm_follow_ups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("crm_customers.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(20), nullable=False)  # 电话, 微信, 量房, 报价, 其他
    content = Column(Text, nullable=True)
    next_plan = Column(Text, nullable=True)
    next_time = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    customer = relationship("Customer", back_populates="follow_ups")
