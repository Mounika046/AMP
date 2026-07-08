from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Setting
from app.schemas import SettingOut, SettingUpdate
from app.services import settings_service

router = APIRouter(prefix="/api/settings", tags=["settings"])


def to_out(key: str, value: str, updated_at: datetime | None = None) -> SettingOut:
    meta = settings_service.SETTING_META[key]
    return SettingOut(
        key=key,
        value=value,
        updated_at=updated_at or datetime.utcnow(),
        default_value=settings_service.DEFAULT_SETTINGS[key],
        label=meta["label"],
        description=meta["description"],
        type_hint=meta["type_hint"],
        section=meta["section"],
    )


@router.get("", response_model=list[SettingOut])
def list_settings(db: Session = Depends(get_db)) -> list[SettingOut]:
    values = settings_service.get_all(db)
    rows = {row.key: row for row in db.query(Setting).all()}
    return [
        to_out(key, values[key], rows.get(key).updated_at if rows.get(key) else None)
        for key in settings_service.SETTING_META
    ]


@router.patch("/{key}", response_model=SettingOut)
def update_setting(key: str, body: SettingUpdate, db: Session = Depends(get_db)) -> SettingOut:
    if key not in settings_service.SETTING_META:
        raise HTTPException(status_code=404, detail=f"Unknown setting key: {key}")
    row = settings_service.set_value(key, body.value, db)
    return to_out(row.key, row.value, row.updated_at)
