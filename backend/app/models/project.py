import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, Numeric, SmallInteger
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.database import Base


class Project(Base):
    __tablename__ = "pm_projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("crm_customers.id"), nullable=False)
    name = Column(String(200), nullable=False)
    address = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)
    expected_end_date = Column(Date, nullable=True)
    actual_end_date = Column(Date, nullable=True)
    status = Column(String(20), default="待开工")  # 待开工, 施工中, 待验收, 完工, 停工
    progress_percent = Column(Numeric(5, 2), default=0)
    designer_name = Column(String(50), nullable=True)
    pm_name = Column(String(50), nullable=True)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    stages = relationship("Stage", back_populates="project", lazy="selectin",
                          order_by="Stage.order_no")
    members = relationship("ProjectMember", back_populates="project", lazy="selectin")
    materials = relationship("ProjectMaterial", back_populates="project", lazy="selectin")


class ProjectMember(Base):
    __tablename__ = "pm_project_members"

    project_id = Column(UUID(as_uuid=True), ForeignKey("pm_projects.id"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    role = Column(String(20), nullable=False)  # 设计师, 项目经理, 工长, 监理, 其他

    project = relationship("Project", back_populates="members")


class Stage(Base):
    __tablename__ = "pm_stages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("pm_projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(50), nullable=False)
    order_no = Column(SmallInteger, nullable=False)
    worker_name = Column(String(50), nullable=True)
    planned_start = Column(Date, nullable=True)
    planned_end = Column(Date, nullable=True)
    actual_start = Column(Date, nullable=True)
    actual_end = Column(Date, nullable=True)
    status = Column(String(20), default="未开始")  # 未开始, 进行中, 已完成, 已验收, 延期

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    project = relationship("Project", back_populates="stages")
    logs = relationship("ConstructionLog", back_populates="stage", lazy="selectin",
                        order_by="ConstructionLog.created_at.desc()")


class ConstructionLog(Base):
    __tablename__ = "pm_construction_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("pm_stages.id"), nullable=False)
    content = Column(Text, nullable=False)
    images = Column(ARRAY(String), default=list)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    stage = relationship("Stage", back_populates="logs")


class ProjectMaterial(Base):
    __tablename__ = "pm_project_materials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("pm_projects.id"), nullable=False)
    material_id = Column(UUID(as_uuid=True), ForeignKey("material_items.id"), nullable=False)
    planned_qty = Column(Numeric(10, 2), nullable=True)
    actual_qty = Column(Numeric(10, 2), nullable=True)
    unit_price = Column(Numeric(10, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    project = relationship("Project", back_populates="materials")
