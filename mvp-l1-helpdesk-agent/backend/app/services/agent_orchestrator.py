from datetime import datetime
import json
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AgentProfile,
    Citation,
    Conversation,
    ExecutionTrace,
    Message,
)
from app.schemas import ChatRequest, ChatResponse, CitationOut
from app.services import settings_service
from app.services.transaction_tools import summarize_tool_outputs
from app.services.oci import OCIServiceFacade


GENERAL_HELPDESK_PROFILE_ID = "general-helpdesk"
SECONDARY_ROUTE_MIN_CONFIDENCE = 0.65
ANSWER_CONFIDENCE_THRESHOLD = 0.56


def _reduce_confidence_for_fallback(generated, penalty: float) -> None:
    generated.confidence = max(0.0, round(generated.confidence - penalty, 3))
    if generated.confidence_reason:
        generated.confidence_reason = f"{generated.confidence_reason}; fallback penalty applied: -{penalty:.2f}"


def _agent_categories(agent: AgentProfile) -> list[str]:
    try:
        value = json.loads(agent.knowledge_categories)
    except json.JSONDecodeError:
        return []
    return value if isinstance(value, list) else []


def _agent_payload(agent: AgentProfile) -> dict:
    return {
        "id": agent.id,
        "name": agent.name,
        "description": agent.description,
        "knowledge_categories": _agent_categories(agent),
    }


def _weak_answer(generated) -> bool:
    if generated.sources or generated.tools_called:
        return False
    answer = generated.answer.lower()
    cannot_answer_markers = [
        "could not",
        "can't find",
        "cannot find",
        "not enough information",
        "do not have enough",
        "don't have enough",
    ]
    return generated.confidence <= ANSWER_CONFIDENCE_THRESHOLD or any(marker in answer for marker in cannot_answer_markers)


def _requested_agent_id(request: ChatRequest) -> str:
    return request.agent_id or request.profile_id or GENERAL_HELPDESK_PROFILE_ID


def run_agent_workflow(db: Session, request: ChatRequest) -> ChatResponse:
    requested_agent = db.get(AgentProfile, _requested_agent_id(request)) or db.get(
        AgentProfile, GENERAL_HELPDESK_PROFILE_ID
    )
    if requested_agent is None:
        raise ValueError("No agent exists.")

    if request.conversation_id:
        conversation = db.get(Conversation, request.conversation_id)
    else:
        conversation = None

    if conversation is None:
        conversation = Conversation(
            id=uuid4().hex,
            profile_id=requested_agent.id,
            title=request.message[:80],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(conversation)
        db.flush()

    user_message = Message(
        id=uuid4().hex,
        conversation_id=conversation.id,
        role="user",
        content=request.message,
    )
    db.add(user_message)

    history = [
        message.content
        for message in db.execute(
            select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at)
        )
        .scalars()
        .all()
    ]

    ai = OCIServiceFacade()
    llm_model = settings_service.get_chat_model_override(db)
    vector_store_top_k = settings_service.as_int("vector_store_top_k", db, 5)
    max_sources = settings_service.as_int("max_sources", db, 5)
    all_agents = db.execute(select(AgentProfile).order_by(AgentProfile.name)).scalars().all()
    final_agent = requested_agent
    route_summary = "Manual agent selection used; supervisor routing was not required."
    fallback_summary = "Fallback not used."
    attempts: list[str] = []

    if requested_agent.id == GENERAL_HELPDESK_PROFILE_ID:
        routing = ai.route_to_agent(
            question=request.message,
            agents=[_agent_payload(agent) for agent in all_agents],
            history=history,
            llm_model=llm_model,
        )
        route_summary = (
            f"Supervisor routed to {routing.primary_agent_id}"
            f"{f' with secondary {routing.secondary_agent_id}' if routing.secondary_agent_id else ''}. "
            f"Confidence: {routing.confidence:.2f}. Intent: {routing.intent}. Reason: {routing.reason}"
        )
        final_agent = db.get(AgentProfile, routing.primary_agent_id) or requested_agent
    else:
        routing = None

    def run_specialist(agent: AgentProfile, previous_response_id: str | None):
        categories = _agent_categories(agent)
        return ai.generate_answer(
            question=request.message,
            agent_name=agent.name,
            response_tone=agent.response_tone,
            agent_instructions=agent.instructions,
            history=history,
            previous_response_id=previous_response_id,
            llm_model=llm_model,
            vector_store_top_k=vector_store_top_k,
            max_sources=max_sources,
            knowledge_categories=categories,
            agent_id=agent.id,
            user_id=request.user_id,
        )

    generated = run_specialist(final_agent, conversation.oci_response_id)
    attempts.append(
        f"{final_agent.name}: confidence {generated.confidence:.2f}, sources {len(generated.sources)}, "
        f"tools {', '.join(generated.tools_called or []) or 'none'}"
    )

    if requested_agent.id == GENERAL_HELPDESK_PROFILE_ID and routing is not None and _weak_answer(generated):
        if routing.secondary_agent_id and routing.confidence >= SECONDARY_ROUTE_MIN_CONFIDENCE:
            secondary_agent = db.get(AgentProfile, routing.secondary_agent_id)
            if secondary_agent is not None:
                secondary_generated = run_specialist(secondary_agent, generated.response_id)
                attempts.append(
                    f"{secondary_agent.name}: confidence {secondary_generated.confidence:.2f}, "
                    f"sources {len(secondary_generated.sources)}, tools {', '.join(secondary_generated.tools_called or []) or 'none'}"
                )
                if not _weak_answer(secondary_generated):
                    generated = secondary_generated
                    _reduce_confidence_for_fallback(generated, 0.05)
                    final_agent = secondary_agent
                    fallback_summary = f"Used secondary specialist: {secondary_agent.name}."

    if requested_agent.id == GENERAL_HELPDESK_PROFILE_ID and _weak_answer(generated):
        general_agent = db.get(AgentProfile, GENERAL_HELPDESK_PROFILE_ID)
        if general_agent is not None and final_agent.id != general_agent.id:
            general_generated = run_specialist(general_agent, generated.response_id)
            attempts.append(
                f"{general_agent.name} all-knowledge fallback: confidence {general_generated.confidence:.2f}, "
                f"sources {len(general_generated.sources)}, tools {', '.join(general_generated.tools_called or []) or 'none'}"
            )
            generated = general_generated
            _reduce_confidence_for_fallback(generated, 0.1)
            final_agent = general_agent
            fallback_summary = "Used General Helpdesk Assistant all-knowledge fallback."

    knowledge_categories = _agent_categories(final_agent)
    conversation.profile_id = final_agent.id

    assistant_message = Message(
        id=uuid4().hex,
        conversation_id=conversation.id,
        role="assistant",
        content=generated.answer,
        confidence=generated.confidence,
    )
    db.add(assistant_message)
    db.flush()

    citation_outputs: list[CitationOut] = []
    for source in generated.sources:
        citation = Citation(
            id=uuid4().hex,
            message_id=assistant_message.id,
            document_id=source.document_id,
            chunk_id=source.chunk_id,
            document_name=source.document_name,
            page_number=source.page_number,
            source_text=source.source_text,
            score=source.score,
        )
        db.add(citation)
        citation_outputs.append(
            CitationOut(
                document_id=source.document_id,
                document_name=source.document_name,
                page_number=source.page_number,
                source_text=source.source_text,
                score=source.score,
            )
        )

    tools_called = generated.tools_called or []
    if generated.sources:
        tools_called = ["file_search", *tools_called]
    tool_summary = summarize_tool_outputs(generated.tool_outputs or {})
    db.add(
        ExecutionTrace(
            id=uuid4().hex,
            conversation_id=conversation.id,
            question=request.message,
            retrieval_summary=(
                f"{route_summary} {fallback_summary} Final agent: {final_agent.name}. "
                f"OCI Responses evaluated file_search with agent categories "
                f"{', '.join(knowledge_categories) or 'all configured knowledge'} and returned {len(generated.sources)} source(s). "
                f"Transactional tools selected: {', '.join(generated.tools_called or []) or 'none'}. "
                f"Attempts: {' | '.join(attempts)}."
            ),
            sources_found=len(generated.sources),
            answer_summary=(
                "Answer generated by OCI Responses using agent instructions, OCI Vector Store, "
                f"and selected transactional connector tools. Confidence method: {generated.confidence_method or 'unknown'}. "
                f"Confidence reason: {generated.confidence_reason or 'not provided'}."
            ),
            tools_called=json.dumps(tools_called),
            tool_summary=tool_summary,
            input_tokens=generated.input_tokens,
            output_tokens=generated.output_tokens,
            total_tokens=generated.total_tokens,
        )
    )
    conversation.updated_at = datetime.utcnow()
    conversation.oci_response_id = generated.response_id
    db.commit()

    return ChatResponse(
        conversation_id=conversation.id,
        user_message_id=user_message.id,
        assistant_message_id=assistant_message.id,
        answer=generated.answer,
        confidence=generated.confidence,
        citations=citation_outputs,
        suggested_prompts=generated.suggested_prompts,
    )


def count_user_questions(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(Message).where(Message.role == "user")) or 0
