import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ChatRequest, ChatResponse
from app.services.agent_orchestrator import run_agent_workflow

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def create_chat_response(request: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    try:
        return run_agent_workflow(db, request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"OCI chat request failed: {type(error).__name__}: {error}",
        ) from error


@router.post("/stream")
def stream_chat_response(request: ChatRequest, db: Session = Depends(get_db)) -> StreamingResponse:
    try:
        result = run_agent_workflow(db, request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"OCI chat request failed: {type(error).__name__}: {error}",
        ) from error

    def events():
        yield f"data: {json.dumps({'type': 'tool', 'name': 'file_search'})}\n\n"
        yield f"data: {json.dumps({'type': 'token', 'text': result.answer})}\n\n"
        yield (
            "data: "
            + json.dumps(
                {
                    "type": "done",
                    "conversation_id": result.conversation_id,
                    "response_id": result.assistant_message_id,
                    "sources": [source.model_dump() for source in result.citations],
                    "ticket": None,
                }
            )
            + "\n\n"
        )

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
