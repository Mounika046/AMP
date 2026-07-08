import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AgentProfile, Citation, Conversation, ExecutionTrace, Message, Ticket
from app.schemas import CitationOut, ConversationOut, ExecutionTraceOut, MessageOut, MonitoringRow

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def citations_for(db: Session, message_id: str) -> list[CitationOut]:
    citations = db.execute(select(Citation).where(Citation.message_id == message_id)).scalars().all()
    return [
        CitationOut(
            document_id=item.document_id,
            document_name=item.document_name,
            page_number=item.page_number,
            source_text=item.source_text,
            score=item.score,
        )
        for item in citations
    ]


def trace_tools(trace: ExecutionTrace | None) -> list[str]:
    if trace is None or not trace.tools_called:
        return []
    try:
        value = json.loads(trace.tools_called)
    except Exception:
        return []
    return [str(item) for item in value] if isinstance(value, list) else []


def to_conversation_out(db: Session, conversation: Conversation) -> ConversationOut:
    profile = db.get(AgentProfile, conversation.profile_id)
    knowledge_categories: list[str] = []
    if profile is not None:
        try:
            knowledge_categories = json.loads(profile.knowledge_categories)
        except Exception:
            knowledge_categories = []
    messages = (
        db.execute(select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at))
        .scalars()
        .all()
    )
    return ConversationOut(
        id=conversation.id,
        agent_id=conversation.profile_id,
        agent_name=profile.name if profile is not None else conversation.profile_id,
        knowledge_categories=knowledge_categories,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        escalated=conversation.escalated,
        messages=[
            MessageOut(
                id=message.id,
                role=message.role,
                content=message.content,
                confidence=message.confidence,
                created_at=message.created_at,
                citations=citations_for(db, message.id),
            )
            for message in messages
        ],
    )


@router.get("", response_model=list[ConversationOut])
def list_conversations(db: Session = Depends(get_db)) -> list[ConversationOut]:
    conversations = db.execute(select(Conversation).order_by(Conversation.updated_at.desc())).scalars().all()
    return [to_conversation_out(db, conversation) for conversation in conversations]


@router.get("/monitoring", response_model=list[MonitoringRow])
def monitoring_rows(db: Session = Depends(get_db)) -> list[MonitoringRow]:
    conversations = db.execute(select(Conversation).order_by(Conversation.updated_at.desc())).scalars().all()
    rows: list[MonitoringRow] = []
    for conversation in conversations:
        messages = (
            db.execute(select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at))
            .scalars()
            .all()
        )
        user_message = next((item for item in messages if item.role == "user"), None)
        assistant_message = next((item for item in reversed(messages) if item.role == "assistant"), None)
        if not user_message or not assistant_message:
            continue
        profile = db.get(AgentProfile, conversation.profile_id)
        category = ""
        knowledge_categories: list[str] = []
        if profile is not None:
            try:
                knowledge_categories = json.loads(profile.knowledge_categories)
                category = ", ".join(knowledge_categories)
            except Exception:
                category = profile.name
        ticket_created = (
            db.scalar(select(Ticket).where(Ticket.conversation_id == conversation.id).limit(1)) is not None
        )
        trace = (
            db.execute(
                select(ExecutionTrace)
                .where(ExecutionTrace.conversation_id == conversation.id)
                .order_by(ExecutionTrace.created_at.desc())
            )
            .scalars()
            .first()
        )
        rows.append(
            MonitoringRow(
                conversation_id=conversation.id,
                agent_name=profile.name if profile is not None else conversation.profile_id,
                knowledge_categories=knowledge_categories,
                query=user_message.content,
                answer=assistant_message.content,
                response_summary=assistant_message.content[:160],
                category=category or conversation.profile_id,
                sources=len(citations_for(db, assistant_message.id)),
                tools_called=trace_tools(trace),
                ticket_created=ticket_created,
                escalated=conversation.escalated or ticket_created,
                latency="OCI runtime",
                confidence=assistant_message.confidence or 0,
                input_tokens=trace.input_tokens if trace else None,
                output_tokens=trace.output_tokens if trace else None,
                total_tokens=trace.total_tokens if trace else None,
                time=assistant_message.created_at,
            )
        )
    return rows


@router.get("/{conversation_id}", response_model=ConversationOut)
def get_conversation(conversation_id: str, db: Session = Depends(get_db)) -> ConversationOut:
    conversation = db.get(Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return to_conversation_out(db, conversation)


@router.get("/{conversation_id}/trace", response_model=list[ExecutionTraceOut])
def get_trace(conversation_id: str, db: Session = Depends(get_db)) -> list[ExecutionTraceOut]:
    traces = (
        db.execute(
            select(ExecutionTrace)
            .where(ExecutionTrace.conversation_id == conversation_id)
            .order_by(ExecutionTrace.created_at.desc())
        )
        .scalars()
        .all()
    )
    return [
        ExecutionTraceOut(
            conversation_id=item.conversation_id,
            question=item.question,
            retrieval_summary=item.retrieval_summary,
            sources_found=item.sources_found,
            answer_summary=item.answer_summary,
            tools_called=trace_tools(item),
            tool_summary=item.tool_summary,
            input_tokens=item.input_tokens,
            output_tokens=item.output_tokens,
            total_tokens=item.total_tokens,
            created_at=item.created_at,
        )
        for item in traces
    ]
