import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.material import MaterialItem
from app.schemas import MaterialCreate, MaterialUpdate, APIResponse
from app.utils.excel import export_to_excel

router = APIRouter(prefix="/api/v1/materials", tags=["材料库"])


@router.get("", response_model=APIResponse)
async def list_materials(
    category: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(MaterialItem).where(MaterialItem.tenant_id == current_user.tenant_id)
    if category:
        query = query.where(MaterialItem.category == category)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    offset = (page - 1) * page_size
    query = query.order_by(MaterialItem.name).offset(offset).limit(page_size)
    result = await db.execute(query)
    materials = result.scalars().all()

    return APIResponse(data={
        "total": total, "page": page, "page_size": page_size,
        "items": [
            {
                "id": str(m.id),
                "name": m.name,
                "category": m.category,
                "unit": m.unit,
                "default_price": float(m.default_price) if m.default_price else None,
                "supplier": m.supplier,
            }
            for m in materials
        ],
    })


@router.post("", response_model=APIResponse, status_code=201)
async def create_material(
    req: MaterialCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    material = MaterialItem(
        id=uuid.uuid4(),
        tenant_id=current_user.tenant_id,
        **req.model_dump(),
    )
    db.add(material)
    await db.flush()
    return APIResponse(data={"id": str(material.id)}, message="材料已添加")


@router.get("/export")
async def export_materials(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MaterialItem).where(MaterialItem.tenant_id == current_user.tenant_id)
        .order_by(MaterialItem.name)
    )
    materials = result.scalars().all()
    headers = ["材料名称", "分类", "单位", "默认单价", "供应商"]
    rows = [
        [m.name, m.category or "", m.unit or "", float(m.default_price) if m.default_price else "", m.supplier or ""]
        for m in materials
    ]
    return export_to_excel(headers, rows, "材料数据")


@router.put("/{material_id}", response_model=APIResponse)
async def update_material(
    material_id: str,
    req: MaterialUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MaterialItem).where(MaterialItem.id == material_id, MaterialItem.tenant_id == current_user.tenant_id)
    )
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="材料未找到")
    update_data = req.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(material, key, value)
    await db.flush()
    return APIResponse(message="材料已更新")
