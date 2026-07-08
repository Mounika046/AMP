from datetime import datetime

from pydantic import BaseModel, Field


class AgentOut(BaseModel):
    id: str
    name: str
    description: str
    response_tone: str
    instructions: str
    knowledge_categories: list[str]


class AgentUpdate(BaseModel):
    description: str | None = None
    response_tone: str | None = None
    instructions: str | None = None
    knowledge_categories: list[str] | None = None


class DocumentOut(BaseModel):
    id: str
    name: str
    category: str
    status: str
    chunks: int
    vector_store_file_id: str | None = None
    vector_store_batch_id: str | None = None
    error: str | None = None
    created_at: datetime


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None


class CategoryOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    created_at: datetime


class SettingUpdate(BaseModel):
    value: str


class SettingOut(BaseModel):
    key: str
    value: str
    updated_at: datetime
    default_value: str
    label: str
    description: str
    type_hint: str
    section: str


class CitationOut(BaseModel):
    document_id: str
    document_name: str
    page_number: int
    source_text: str
    score: float


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    conversation_id: str | None = None
    agent_id: str = "general-helpdesk"
    profile_id: str | None = None
    user_id: str = "EMP001"


class ChatResponse(BaseModel):
    conversation_id: str
    user_message_id: str
    assistant_message_id: str
    answer: str
    confidence: float
    citations: list[CitationOut]
    suggested_prompts: list[str]


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    confidence: float | None
    created_at: datetime
    citations: list[CitationOut] = []


class ConversationOut(BaseModel):
    id: str
    agent_id: str
    agent_name: str
    knowledge_categories: list[str]
    title: str
    created_at: datetime
    updated_at: datetime
    escalated: bool
    messages: list[MessageOut]


class TicketCreate(BaseModel):
    conversation_id: str | None = None
    subject: str = Field(min_length=1)
    description: str = Field(min_length=1)
    priority: str = "Medium"


class TicketOut(BaseModel):
    id: int
    conversation_id: str | None
    subject: str
    description: str
    priority: str
    status: str
    zendesk_ticket_id: int | None = None
    zendesk_ticket_url: str | None = None
    created_at: datetime


class DashboardMetrics(BaseModel):
    documents: int
    chunks: int
    questions_asked: int
    tickets_created: int
    escalation_rate: float


class MonitoringRow(BaseModel):
    conversation_id: str
    agent_name: str
    knowledge_categories: list[str]
    query: str
    answer: str
    response_summary: str
    category: str
    sources: int
    tools_called: list[str]
    ticket_created: bool
    escalated: bool
    latency: str
    confidence: float
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    time: datetime


class ExecutionTraceOut(BaseModel):
    conversation_id: str
    question: str
    retrieval_summary: str
    sources_found: int
    answer_summary: str
    tools_called: list[str] = []
    tool_summary: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    created_at: datetime
