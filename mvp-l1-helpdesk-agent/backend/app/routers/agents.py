import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AgentProfile
from app.schemas import AgentOut, AgentUpdate
from app.seed import seed_profiles

router = APIRouter(prefix="/api/agents", tags=["agents"])
ALLOWED_RESPONSE_TONES = {"Concise", "Friendly", "Formal"}


def to_out(profile: AgentProfile) -> AgentOut:
    return AgentOut(
        id=profile.id,
        name=profile.name,
        description=profile.description,
        response_tone=profile.response_tone,
        instructions=profile.instructions,
        knowledge_categories=json.loads(profile.knowledge_categories),
    )


@router.get("", response_model=list[AgentOut])
def list_agents(db: Session = Depends(get_db)) -> list[AgentOut]:
    agents = db.execute(select(AgentProfile).order_by(AgentProfile.name)).scalars().all()
    if not agents:
        seed_profiles(db)
        agents = db.execute(select(AgentProfile).order_by(AgentProfile.name)).scalars().all()
    return [to_out(agent) for agent in agents]


@router.patch("/{agent_id}", response_model=AgentOut)
def update_agent(
    agent_id: str, payload: AgentUpdate, db: Session = Depends(get_db)
) -> AgentOut:
    profile = db.get(AgentProfile, agent_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Agent not found")

    if payload.description is not None:
        profile.description = payload.description
    if payload.response_tone is not None:
        if payload.response_tone not in ALLOWED_RESPONSE_TONES:
            raise HTTPException(status_code=400, detail="Unsupported response tone")
        profile.response_tone = payload.response_tone
    if payload.instructions is not None:
        profile.instructions = payload.instructions
    if payload.knowledge_categories is not None:
        profile.knowledge_categories = json.dumps(payload.knowledge_categories)

    db.commit()
    db.refresh(profile)
    return to_out(profile)
