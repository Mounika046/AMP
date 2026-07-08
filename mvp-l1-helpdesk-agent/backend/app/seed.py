import json

from sqlalchemy.orm import Session

from app.models import AgentProfile, Category, Citation, Document, DocumentChunk, Ticket
from app.services.settings_service import seed_defaults


DEFAULT_WELCOME_MESSAGE = ""
GENERAL_HELPDESK_PROFILE_ID = "general-helpdesk"
LEGACY_GENERAL_PROFILE_ID = "all-knowledge"


# Product defaults for permanent profile rows. Startup inserts missing profiles only;
# saved admin edits remain the database source of truth.
DEFAULT_PROFILES = [
    {
        "id": GENERAL_HELPDESK_PROFILE_ID,
        "name": "General Helpdesk Assistant",
        "description": "Supervisor entry agent that routes each request to the best specialist and handles fallback.",
        "response_tone": "Concise",
        "welcome_message": DEFAULT_WELCOME_MESSAGE,
        "instructions": (
            "Supervisor agent contract: classify the user's request, choose the best specialist agent, "
            "and use all-knowledge fallback only when the selected specialist cannot answer with enough confidence. "
            "Do not invent enterprise policy or personal employee data. Use approved knowledge, transactional tools, "
            "and ticket escalation boundaries."
        ),
        "knowledge_categories": [],
    },
    {
        "id": "it-support",
        "name": "IT Support",
        "description": "Answers employee IT questions about VPN, devices, access, and support processes.",
        "response_tone": "Concise",
        "welcome_message": DEFAULT_WELCOME_MESSAGE,
        "instructions": (
            "Specialist agent contract: handle IT support, endpoint devices, VPN, SSO, MFA, application access, "
            "and support-process questions. Use only assigned IT and Access Management knowledge categories for RAG. "
            "Use IT transactional tools only for user-specific assets, access status, and ticket summaries. "
            "Escalate when the answer is not supported by retrieved sources or tool output."
        ),
        "knowledge_categories": ["IT Support", "Access Management"],
    },
    {
        "id": "hr-assistant",
        "name": "HR Assistant",
        "description": "Answers HR policy and employee lifecycle questions.",
        "response_tone": "Concise",
        "welcome_message": DEFAULT_WELCOME_MESSAGE,
        "instructions": (
            "Specialist agent contract: handle HR policy, HCM, employee lifecycle, benefits, and leave-balance questions. "
            "Use only assigned HCM knowledge categories for RAG. Use HR transactional tools only for employee profile "
            "and leave-balance lookups. Escalate when policy interpretation or source coverage is insufficient."
        ),
        "knowledge_categories": ["HCM"],
    },
    {
        "id": "payroll-assistant",
        "name": "Payroll Assistant",
        "description": "Answers payroll, payment method, and payroll timing questions.",
        "response_tone": "Concise",
        "welcome_message": DEFAULT_WELCOME_MESSAGE,
        "instructions": (
            "Specialist agent contract: handle payroll timing, payment method, reimbursement, tax declaration, "
            "and payroll self-service questions. Use only assigned Payroll knowledge categories for RAG. "
            "Use payroll transactional tools only for user-specific payroll summaries. Escalate pay correction "
            "or sensitive payroll-change requests."
        ),
        "knowledge_categories": ["Payroll"],
    },
    {
        "id": "onboarding-assistant",
        "name": "Onboarding Assistant",
        "description": "Guides new hires and managers through onboarding tasks.",
        "response_tone": "Concise",
        "welcome_message": DEFAULT_WELCOME_MESSAGE,
        "instructions": (
            "Specialist agent contract: handle onboarding readiness, day-one tasks, manager checklists, and new-hire "
            "process questions. Use only assigned Onboarding knowledge categories for RAG. Use profile lookup only "
            "when employee context is needed. Escalate when source coverage is insufficient."
        ),
        "knowledge_categories": ["Onboarding"],
    },
]


DEFAULT_CATEGORIES = [
    ("IT Support", "VPN, devices, service desk process, and endpoint support."),
    ("HCM", "Employee lifecycle, HR policy, benefits, and workplace guidance."),
    ("Payroll", "Payment methods, payroll timing, and payroll employee self-service."),
    ("Onboarding", "New hire readiness, day-one tasks, and manager checklists."),
    ("Access Management", "SSO, MFA, application access, and group membership."),
]

SEEDED_DOCUMENT_IDS = [
    "sample-vpn-policy",
    "sample-it-handbook",
    "sample-access-mfa",
    "sample-payroll-faq",
    "sample-hcm-benefits",
    "sample-onboarding-checklist",
]

SEEDED_TICKET_SUBJECTS = [
    "VPN access keeps failing after MFA",
    "Laptop replacement eligibility review",
    "Payroll bank detail update confirmation",
]


def seed_categories(db: Session) -> None:
    for name, description in DEFAULT_CATEGORIES:
        if db.query(Category).filter(Category.name == name).first():
            continue
        db.add(Category(name=name, description=description))
    db.commit()


def seed_profiles(db: Session) -> None:
    legacy_profile = db.get(AgentProfile, LEGACY_GENERAL_PROFILE_ID)
    current_profile = db.get(AgentProfile, GENERAL_HELPDESK_PROFILE_ID)
    if legacy_profile is not None and current_profile is None:
        legacy_profile.id = GENERAL_HELPDESK_PROFILE_ID
        legacy_profile.name = "General Helpdesk Assistant"
        legacy_profile.description = "Answers general helpdesk questions across all approved knowledge sources."
        db.flush()
    elif legacy_profile is not None and current_profile is not None:
        db.delete(legacy_profile)
        db.flush()

    for profile in DEFAULT_PROFILES:
        existing = db.get(AgentProfile, profile["id"])
        if existing:
            existing.name = profile["name"]
            existing.description = profile["description"]
            if not existing.response_tone:
                existing.response_tone = profile["response_tone"]
            existing.welcome_message = profile["welcome_message"]
            if "Specialist agent contract" not in existing.instructions and "Supervisor agent contract" not in existing.instructions:
                existing.instructions = profile["instructions"]
            if not existing.knowledge_categories:
                existing.knowledge_categories = json.dumps(profile["knowledge_categories"])
            continue
        db.add(
            AgentProfile(
                id=profile["id"],
                name=profile["name"],
                description=profile["description"],
                response_tone=profile["response_tone"],
                welcome_message=profile["welcome_message"],
                instructions=profile["instructions"],
                knowledge_categories=json.dumps(profile["knowledge_categories"]),
            )
        )
    db.commit()


def remove_seeded_documents_and_tickets(db: Session) -> None:
    db.query(Citation).filter(Citation.document_id.in_(SEEDED_DOCUMENT_IDS)).delete(synchronize_session=False)
    db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(SEEDED_DOCUMENT_IDS)).delete(
        synchronize_session=False
    )
    db.query(Document).filter(Document.id.in_(SEEDED_DOCUMENT_IDS)).delete(synchronize_session=False)
    db.query(Ticket).filter(
        Ticket.conversation_id.is_(None),
        Ticket.subject.in_(SEEDED_TICKET_SUBJECTS),
    ).delete(synchronize_session=False)
    db.commit()


def seed_default_data(db: Session) -> None:
    seed_defaults(db)
    seed_categories(db)
    seed_profiles(db)
    remove_seeded_documents_and_tickets(db)
