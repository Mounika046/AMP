from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Setting


DEFAULT_SETTINGS: dict[str, str] = {
    "confidence_threshold": "0.72",
    "max_sources": "5",
    "chunk_size": "400",
    "chunk_overlap": "50",
    "vector_store_top_k": "5",
    "llm_model": "",
    "latency_warn_ms": "3000",
    "latency_error_ms": "8000",
}


SETTING_META: dict[str, dict[str, str]] = {
    "confidence_threshold": {
        "label": "Confidence Threshold",
        "description": "Minimum confidence expected before the answer is treated as complete.",
        "type_hint": "float",
        "section": "retrieval",
    },
    "max_sources": {
        "label": "Max Sources Returned",
        "description": "Maximum number of citations displayed for an answer.",
        "type_hint": "int",
        "section": "retrieval",
    },
    "chunk_size": {
        "label": "Chunk Size",
        "description": "Number of tokens per text chunk when splitting documents.",
        "type_hint": "int",
        "section": "chunking",
    },
    "chunk_overlap": {
        "label": "Chunk Overlap",
        "description": "Number of overlapping tokens between consecutive chunks.",
        "type_hint": "int",
        "section": "chunking",
    },
    "vector_store_top_k": {
        "label": "Vector Store Top K",
        "description": "Maximum number of vector store results returned per query.",
        "type_hint": "int",
        "section": "retrieval",
    },
    "llm_model": {
        "label": "Llm Model",
        "description": "OCI model ID used to generate answers. Leave blank to use OCI_FILE_SEARCH_MODEL from .env.",
        "type_hint": "text",
        "section": "llm",
    },
    "latency_warn_ms": {
        "label": "Latency Warn Ms",
        "description": "Response-time threshold in ms above which a warning is shown.",
        "type_hint": "int",
        "section": "ui",
    },
    "latency_error_ms": {
        "label": "Latency Error Ms",
        "description": "Response-time threshold in ms above which an error indicator is shown.",
        "type_hint": "int",
        "section": "ui",
    },
}


def seed_defaults(db: Session) -> None:
    for key, value in DEFAULT_SETTINGS.items():
        if db.get(Setting, key) is None:
            db.add(Setting(key=key, value=value, updated_at=datetime.utcnow()))
    db.commit()


def normalize_value(key: str, value: str) -> str:
    if key == "llm_model" and value == "cohere.command-latest":
        return ""
    return value


def get_all(db: Session) -> dict[str, str]:
    values = dict(DEFAULT_SETTINGS)
    for row in db.query(Setting).all():
        values[row.key] = normalize_value(row.key, row.value)
    return values


def get(key: str, db: Session) -> str:
    row = db.get(Setting, key)
    if row is not None:
        return normalize_value(key, row.value)
    return DEFAULT_SETTINGS.get(key, "")


def set_value(key: str, value: str, db: Session) -> Setting:
    existing = db.get(Setting, key)
    if existing is None:
        existing = Setting(key=key, value=value, updated_at=datetime.utcnow())
        db.add(existing)
    else:
        existing.value = value
        existing.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(existing)
    return existing


def as_int(key: str, db: Session, default: int) -> int:
    try:
        return int(get(key, db))
    except (TypeError, ValueError):
        return default


def get_chat_model_override(db: Session) -> str | None:
    value = get("llm_model", db).strip()
    if not value or value == "cohere.command-latest":
        return None
    return value
