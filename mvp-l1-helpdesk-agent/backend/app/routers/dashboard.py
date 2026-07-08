from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Conversation, Document, DocumentChunk, Ticket
from app.schemas import DashboardMetrics
from app.services.agent_orchestrator import count_user_questions

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/metrics", response_model=DashboardMetrics)
def metrics(db: Session = Depends(get_db)) -> DashboardMetrics:
    documents = db.scalar(select(func.count()).select_from(Document)) or 0
    chunks = db.scalar(select(func.count()).select_from(DocumentChunk)) or 0
    questions = count_user_questions(db)
    tickets = db.scalar(select(func.count()).select_from(Ticket)) or 0
    conversations = db.scalar(select(func.count()).select_from(Conversation)) or 0
    escalation_rate = round((tickets / conversations) * 100, 1) if conversations else 0
    return DashboardMetrics(
        documents=documents,
        chunks=chunks,
        questions_asked=questions,
        tickets_created=tickets,
        escalation_rate=escalation_rate,
    )
