from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category
from app.schemas import CategoryCreate, CategoryOut

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)) -> list[CategoryOut]:
    return db.execute(select(Category).order_by(Category.name)).scalars().all()


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(body: CategoryCreate, db: Session = Depends(get_db)) -> CategoryOut:
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Category name is required.")
    existing = db.execute(select(Category).where(Category.name == name)).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Category already exists.")
    category = Category(name=name, description=body.description)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category
