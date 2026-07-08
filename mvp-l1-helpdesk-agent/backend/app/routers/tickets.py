from fastapi import APIRouter, Depends, HTTPException
import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Conversation, Ticket
from app.schemas import TicketCreate, TicketOut
from app.services.zendesk import ZendeskService

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


def to_out(ticket: Ticket) -> TicketOut:
    return TicketOut(
        id=ticket.id,
        conversation_id=ticket.conversation_id,
        subject=ticket.subject,
        description=ticket.description,
        priority=ticket.priority,
        status=ticket.status,
        zendesk_ticket_id=ticket.zendesk_ticket_id,
        zendesk_ticket_url=ticket.zendesk_ticket_url,
        created_at=ticket.created_at,
    )


def sync_zendesk_ticket(ticket: Ticket) -> None:
    if ticket.zendesk_ticket_id is None:
        return
    try:
        zendesk_ticket = ZendeskService().get_ticket(ticket.zendesk_ticket_id)
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except httpx.HTTPStatusError as error:
        detail = error.response.text[:1000] if error.response is not None else str(error)
        raise HTTPException(status_code=502, detail=f"Zendesk ticket status sync failed: {detail}") from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"Zendesk ticket status sync failed: {error}") from error

    ticket.status = zendesk_ticket.status
    ticket.zendesk_ticket_url = zendesk_ticket.url


@router.get("", response_model=list[TicketOut])
def list_tickets(db: Session = Depends(get_db)) -> list[TicketOut]:
    tickets = db.execute(select(Ticket).order_by(Ticket.created_at.desc())).scalars().all()
    for ticket in tickets:
        sync_zendesk_ticket(ticket)
    db.commit()
    return [to_out(ticket) for ticket in tickets]


@router.post("", response_model=TicketOut)
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db)) -> TicketOut:
    try:
        zendesk_ticket = ZendeskService().create_ticket(
            subject=payload.subject,
            description=payload.description,
            priority=payload.priority,
            conversation_id=payload.conversation_id,
        )
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except httpx.HTTPStatusError as error:
        detail = error.response.text[:1000] if error.response is not None else str(error)
        raise HTTPException(status_code=502, detail=f"Zendesk ticket creation failed: {detail}") from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"Zendesk ticket creation failed: {error}") from error

    ticket = Ticket(
        conversation_id=payload.conversation_id,
        subject=payload.subject,
        description=payload.description,
        priority=payload.priority,
        status=zendesk_ticket.status,
        zendesk_ticket_id=zendesk_ticket.ticket_id,
        zendesk_ticket_url=zendesk_ticket.url,
    )
    db.add(ticket)

    if payload.conversation_id:
        conversation = db.get(Conversation, payload.conversation_id)
        if conversation:
            conversation.escalated = True

    db.commit()
    db.refresh(ticket)
    return to_out(ticket)


@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)) -> TicketOut:
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    sync_zendesk_ticket(ticket)
    db.commit()
    db.refresh(ticket)
    return to_out(ticket)
