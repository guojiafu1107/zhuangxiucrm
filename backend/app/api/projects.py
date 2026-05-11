import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.utils.excel import export_to_excel
from app.models.project import Project, ProjectMember, Stage, ConstructionLog, ProjectMaterial
from app.models.material import MaterialItem
from app.schemas import (
    ProjectCreate, ProjectUpdate, ProjectMemberAdd, StageCreate, StageUpdate,
    ConstructionLogCreate, ProjectMaterialCreate,
    StageWorkerInput, APIResponse,
)

router = APIRouter(prefix="/api/v1/projects", tags=["项目管理"])


@router.get("", response_model=APIResponse)
async def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    member_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Project).where(
        Project.tenant_id == current_user.tenant_id,
        Project.deleted_at.is_(None),
    )

    if status:
        query = query.where(Project.status == status)
    if member_id:
        query = query.where(Project.members.any(ProjectMember.user_id == uuid.UUID(member_id)))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    offset = (page - 1) * page_size
    query = query.options(
        joinedload(Project.stages),
        joinedload(Project.members),
    ).order_by(Project.created_at.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    projects = result.unique().scalars().all()

    items = []
    for p in projects:
        items.append({
            "id": str(p.id),
            "name": p.name,
            "customer_id": str(p.customer_id),
            "status": p.status,
            "progress_percent": float(p.progress_percent) if p.progress_percent else 0,
            "start_date": str(p.start_date) if p.start_date else None,
            "expected_end_date": str(p.expected_end_date) if p.expected_end_date else None,
            "members": [{"user_id": str(m.user_id), "role": m.role} for m in p.members],
            "stage_count": len(p.stages),
            "completed_stages": sum(1 for s in p.stages if s.status in ("已完成", "已验收")),
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })

    return APIResponse(data={"total": total, "page": page, "page_size": page_size, "items": items})


@router.post("", response_model=APIResponse, status_code=201)
async def create_project(
    req: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Separate member fields from project fields
    project_data = req.model_dump(exclude={'stages'})
    project = Project(id=uuid.uuid4(), tenant_id=current_user.tenant_id, **project_data)
    db.add(project)
    await db.flush()

    # Use provided stages or default stages
    if req.stages:
        stage_list = [(s.name, idx + 1, s.worker_name) for idx, s in enumerate(req.stages)]
    else:
        stage_list = [
            ("开工", 1), ("拆墙", 2), ("砌墙", 3), ("水电定位", 4), ("开槽", 5),
            ("水电管线布局", 6), ("泥瓦工程", 7), ("木工吊顶", 8), ("全屋定制", 9),
            ("墙面工程", 10), ("开关面板灯具安装", 11), ("开荒保洁", 12), ("家具家电", 13),
        ]
        stage_list = [(s[0], s[1], None) if len(s) == 2 else s for s in stage_list]

    for name, order, worker in stage_list:
        db.add(Stage(id=uuid.uuid4(), project_id=project.id, name=name, order_no=order, worker_name=worker))

    await db.flush()
    return APIResponse(data={"id": str(project.id)}, message="项目创建成功")


@router.get("/export")
async def export_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.tenant_id == current_user.tenant_id, Project.deleted_at.is_(None))
        .order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()
    headers = ["项目名称", "状态", "进度(%)", "计划开工", "预计完工", "实际完工", "创建时间"]
    rows = [
        [
            p.name, p.status, float(p.progress_percent) if p.progress_percent else 0,
            str(p.start_date) if p.start_date else "", str(p.expected_end_date) if p.expected_end_date else "",
            str(p.actual_end_date) if p.actual_end_date else "",
            p.created_at.strftime("%Y-%m-%d %H:%M") if p.created_at else "",
        ]
        for p in projects
    ]
    return export_to_excel(headers, rows, "项目数据")


@router.get("/{project_id}", response_model=APIResponse)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.tenant_id == current_user.tenant_id, Project.deleted_at.is_(None))
        .options(
            joinedload(Project.stages).joinedload(Stage.logs),
            joinedload(Project.members),
            joinedload(Project.materials),
        )
    )
    project = result.unique().scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")

    data = {
        "id": str(project.id),
        "customer_id": str(project.customer_id),
        "name": project.name,
        "address": project.address,
        "status": project.status,
        "progress_percent": float(project.progress_percent) if project.progress_percent else 0,
        "start_date": str(project.start_date) if project.start_date else None,
        "expected_end_date": str(project.expected_end_date) if project.expected_end_date else None,
        "actual_end_date": str(project.actual_end_date) if project.actual_end_date else None,
        "stages": [
            {
                "id": str(s.id),
                "name": s.name,
                "order_no": s.order_no,
                "status": s.status,
                "planned_start": str(s.planned_start) if s.planned_start else None,
                "planned_end": str(s.planned_end) if s.planned_end else None,
                "actual_start": str(s.actual_start) if s.actual_start else None,
                "actual_end": str(s.actual_end) if s.actual_end else None,
                "logs": [
                    {
                        "id": str(l.id),
                        "content": l.content,
                        "images": l.images,
                        "created_at": l.created_at.isoformat() if l.created_at else None,
                    }
                    for l in s.logs
                ],
            }
            for s in project.stages
        ],
        "members": [{"user_id": str(m.user_id), "role": m.role} for m in project.members],
        "materials": [
            {
                "id": str(m.id),
                "material_id": str(m.material_id),
                "planned_qty": float(m.planned_qty) if m.planned_qty else None,
                "actual_qty": float(m.actual_qty) if m.actual_qty else None,
                "unit_price": float(m.unit_price) if m.unit_price else None,
            }
            for m in project.materials
        ],
        "created_at": project.created_at.isoformat() if project.created_at else None,
    }
    return APIResponse(data=data)


@router.put("/{project_id}", response_model=APIResponse)
async def update_project(
    project_id: str,
    req: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.tenant_id == current_user.tenant_id, Project.deleted_at.is_(None))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")

    update_data = req.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(project, key, value)
    await db.flush()
    return APIResponse(message="项目更新成功")


@router.post("/{project_id}/members", response_model=APIResponse)
async def add_project_member(
    project_id: str,
    req: ProjectMemberAdd,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.tenant_id == current_user.tenant_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")

    member = ProjectMember(project_id=project.id, user_id=req.user_id, role=req.role)
    db.add(member)
    await db.flush()
    return APIResponse(message="成员已添加")


@router.delete("/{project_id}/members/{user_id}", response_model=APIResponse)
async def remove_project_member(
    project_id: str,
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="成员未找到")
    await db.delete(member)
    await db.flush()
    return APIResponse(message="成员已移除")


@router.get("/{project_id}/stages", response_model=APIResponse)
async def get_project_stages(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Stage)
        .where(Stage.project_id == project_id)
        .order_by(Stage.order_no)
        .options(joinedload(Stage.logs))
    )
    stages = result.unique().scalars().all()
    data = [
        {
            "id": str(s.id),
            "name": s.name,
            "order_no": s.order_no,
            "status": s.status,
            "planned_start": str(s.planned_start) if s.planned_start else None,
            "planned_end": str(s.planned_end) if s.planned_end else None,
            "actual_start": str(s.actual_start) if s.actual_start else None,
            "actual_end": str(s.actual_end) if s.actual_end else None,
            "logs_count": len(s.logs),
        }
        for s in stages
    ]
    return APIResponse(data=data)


@router.post("/{project_id}/stages", response_model=APIResponse, status_code=201)
async def add_stage(
    project_id: str,
    req: StageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stage = Stage(
        id=uuid.uuid4(),
        project_id=project_id,
        **req.model_dump(),
    )
    db.add(stage)
    await db.flush()
    return APIResponse(data={"id": str(stage.id)}, message="阶段已添加")


@router.put("/stages/{stage_id}", response_model=APIResponse)
async def update_stage(
    stage_id: str,
    req: StageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Stage).where(Stage.id == stage_id))
    stage = result.scalar_one_or_none()
    if not stage:
        raise HTTPException(status_code=404, detail="阶段未找到")

    update_data = req.model_dump(exclude_none=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(stage, key, value)
    await db.flush()
    return APIResponse(message="阶段更新成功")


@router.post("/stages/{stage_id}/logs", response_model=APIResponse, status_code=201)
async def create_construction_log(
    stage_id: str,
    content: str = Form(...),
    images: Optional[str] = Form(None),  # comma-separated image URLs
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Stage).where(Stage.id == stage_id))
    stage = result.scalar_one_or_none()
    if not stage:
        raise HTTPException(status_code=404, detail="阶段未找到")

    log = ConstructionLog(
        id=uuid.uuid4(),
        stage_id=stage_id,
        content=content,
        images=images.split(",") if images else [],
        created_by=current_user.id,
    )
    db.add(log)

    # Auto-update stage status to 进行中
    if stage.status == "未开始":
        stage.status = "进行中"
        stage.actual_start = date.today()

    await db.flush()
    return APIResponse(data={"id": str(log.id)}, message="日志已提交")


@router.get("/stages/{stage_id}/logs", response_model=APIResponse)
async def get_stage_logs(
    stage_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ConstructionLog)
        .where(ConstructionLog.stage_id == stage_id)
        .order_by(ConstructionLog.created_at.desc())
    )
    logs = result.scalars().all()
    data = [
        {
            "id": str(l.id),
            "content": l.content,
            "images": l.images,
            "created_by": str(l.created_by) if l.created_by else None,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]
    return APIResponse(data=data)


@router.patch("/{project_id}/progress", response_model=APIResponse)
async def update_project_progress(
    project_id: str,
    progress: float = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.tenant_id == current_user.tenant_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    project.progress_percent = progress
    await db.flush()
    return APIResponse(message="进度已更新")
