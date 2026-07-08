from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_runtime_schema() -> None:
    inspector = inspect(engine)
    if "document_chunks" not in inspector.get_table_names():
        return

    table_names = set(inspector.get_table_names())
    if "agent_profiles" in table_names:
        with engine.begin() as connection:
            if settings.database_url.startswith("sqlite"):
                connection.execute(text("PRAGMA foreign_keys=OFF"))
            if "conversations" in table_names:
                connection.execute(
                    text(
                        "UPDATE conversations SET profile_id = 'general-helpdesk' "
                        "WHERE profile_id = 'all-knowledge'"
                    )
                )
            connection.execute(
                text(
                    "UPDATE agent_profiles SET id = 'general-helpdesk', "
                    "name = 'General Helpdesk Assistant', "
                    "description = 'Answers general helpdesk questions across all approved knowledge sources.' "
                    "WHERE id = 'all-knowledge' "
                    "AND NOT EXISTS (SELECT 1 FROM agent_profiles WHERE id = 'general-helpdesk')"
                )
            )
            connection.execute(text("DELETE FROM agent_profiles WHERE id = 'all-knowledge'"))
            if settings.database_url.startswith("sqlite"):
                connection.execute(text("PRAGMA foreign_keys=ON"))

    agent_profile_columns = {column["name"] for column in inspector.get_columns("agent_profiles")}
    with engine.begin() as connection:
        if "response_tone" not in agent_profile_columns:
            connection.execute(
                text("ALTER TABLE agent_profiles ADD COLUMN response_tone VARCHAR(64) DEFAULT 'Concise' NOT NULL")
            )
        if "welcome_message" not in agent_profile_columns:
            connection.execute(
                text("ALTER TABLE agent_profiles ADD COLUMN welcome_message TEXT DEFAULT '' NOT NULL")
            )

    conversation_columns = {column["name"] for column in inspector.get_columns("conversations")}
    if "oci_response_id" not in conversation_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE conversations ADD COLUMN oci_response_id VARCHAR(255)"))

    document_columns = {column["name"] for column in inspector.get_columns("documents")}
    with engine.begin() as connection:
        if "vector_store_file_id" not in document_columns:
            connection.execute(text("ALTER TABLE documents ADD COLUMN vector_store_file_id VARCHAR(255)"))
        if "vector_store_batch_id" not in document_columns:
            connection.execute(text("ALTER TABLE documents ADD COLUMN vector_store_batch_id VARCHAR(255)"))

    ticket_columns = {column["name"] for column in inspector.get_columns("tickets")}
    with engine.begin() as connection:
        if "zendesk_ticket_id" not in ticket_columns:
            connection.execute(text("ALTER TABLE tickets ADD COLUMN zendesk_ticket_id INTEGER"))
        if "zendesk_ticket_url" not in ticket_columns:
            connection.execute(text("ALTER TABLE tickets ADD COLUMN zendesk_ticket_url VARCHAR(500)"))

    execution_trace_columns = {column["name"] for column in inspector.get_columns("execution_traces")}
    with engine.begin() as connection:
        if "input_tokens" not in execution_trace_columns:
            connection.execute(text("ALTER TABLE execution_traces ADD COLUMN input_tokens INTEGER"))
        if "output_tokens" not in execution_trace_columns:
            connection.execute(text("ALTER TABLE execution_traces ADD COLUMN output_tokens INTEGER"))
        if "total_tokens" not in execution_trace_columns:
            connection.execute(text("ALTER TABLE execution_traces ADD COLUMN total_tokens INTEGER"))
        if "tools_called" not in execution_trace_columns:
            connection.execute(text("ALTER TABLE execution_traces ADD COLUMN tools_called TEXT"))
        if "tool_summary" not in execution_trace_columns:
            connection.execute(text("ALTER TABLE execution_traces ADD COLUMN tool_summary TEXT"))
