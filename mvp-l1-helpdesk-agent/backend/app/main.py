from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings, validate_oci_configuration
from app.database import Base, SessionLocal, engine, ensure_runtime_schema
from app.routers import agents, categories, chat, conversations, dashboard, documents, health, settings, tickets, transactions
from app.seed import seed_default_data

app = FastAPI(title="L1 HelpDesk Agent MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5178", "http://127.0.0.1:5178"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    validate_oci_configuration(get_settings())
    Base.metadata.create_all(bind=engine)
    ensure_runtime_schema()
    db = SessionLocal()
    try:
        seed_default_data(db)
    finally:
        db.close()


app.include_router(health.router)
app.include_router(settings.router)
app.include_router(categories.router)
app.include_router(agents.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(conversations.router)
app.include_router(tickets.router)
app.include_router(dashboard.router)
app.include_router(transactions.router)
