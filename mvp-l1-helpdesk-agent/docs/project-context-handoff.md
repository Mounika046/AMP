# OCI L1 Helpdesk Agent - Project Context Handoff

Use this file as the starting context when continuing this project in a new chat session or on another system.

## Project Purpose

This project is an MVP of an L1 helpdesk agent built to demonstrate the potential of OCI enterprise AI services.

The application is intended to later fit into an agent marketplace where multiple enterprise agents can be listed and reused. For now, it focuses on a working helpdesk MVP with:

- User helpdesk chat
- Admin console
- OCI Responses API
- OCI Vector Store file search
- Document upload and deletion
- Agent configuration
- Specialist agent routing
- Transactional demo tools
- Ticket creation/status through a ticketing integration
- Monitoring and execution trace details
- Nitro/Redwood-inspired UI work

The user strongly prefers OCI services and does not want local AI fallbacks.

## Current Architecture Direction

The project started with agent profiles, but the design direction has shifted toward a proper supervisor-led multi-agent architecture.

The important distinction:

- Old profile model: profiles were mostly configuration overlays on the same chat runtime.
- Current/proposed agent model: each profile becomes a specialist agent with its own instructions, knowledge scope, and transactional tool scope.

The current agentic architecture is:

1. User asks a question in one general helpdesk chat.
2. General Helpdesk is the default entry point.
3. Supervisor agent classifies intent and routes the query to a specialist.
4. Specialist agent answers using its scoped instructions, knowledge categories, and tools.
5. OCI Responses handles answer generation, file search, tool selection, tool-result submission, and confidence evaluation.
6. If answer confidence is weak, supervisor can try a secondary specialist.
7. If still weak, system can use General Helpdesk fallback or create a ticket.
8. Monitoring records selected agent, categories checked, tools called, citations, token usage, confidence, and execution trace.

The architecture diagram is in:

- `docs/agentic-architecture-diagram.png`

Meeting notes are in:

- `docs/meeting-notes-agent-architecture.md`

## Important Design Decisions

### No Local AI Fallback

The application should use OCI services directly. Do not add local LLM fallback behavior.

### Vector Store Only for RAG

For the current MVP, RAG uses OCI Vector Store directly.

Object Storage was intentionally removed from the RAG flow for now. The admin uploads files directly into the vector store, and the app stores vector file IDs so individual documents can be deleted later.

### Agent Selection in User Chat

The user chat should not expose a knowledge-category dropdown.

The desired user-facing model is:

- User chats with General Helpdesk Assistant by default.
- Supervisor routes internally to the right specialist.
- Admin manages each agent's knowledge scope in the admin UI.

### Knowledge Scope Still Matters

Knowledge scope selection should remain in Admin Agent configuration because the application should be generic and customizable.

Default knowledge scopes:

- General Helpdesk: all configured categories
- IT Support: IT Support + Access Management
- HR Assistant: HCM
- Payroll Assistant: Payroll
- Onboarding Assistant: Onboarding

Admin can later change these.

### Dynamic Categories

Knowledge categories can be added in the Knowledge Base section.

New categories should be reflected in:

- Document upload category selection
- Agent knowledge scope selection
- RAG category filters during specialist answer generation

### Transactional Queries

The app supports demo transactional tools for user-specific questions.

Example:

- “How many leaves do I have?”
- “What assets are assigned to me?”
- “What is my payroll status?”
- “What tickets do I have?”

For now these tools use sample data, but the architecture should allow replacing them later with Oracle enterprise products or other real systems.

Sample users:

- Mounika
- Madhuri

The frontend has a round account/user selector in the top right. Proper SSO will be added later when credentials are available.

### Confidence Calculation

Confidence should not be a fixed deterministic number only.

Current direction:

- Use an OCI model-based confidence evaluator.
- Use heuristic confidence only as fallback if evaluation fails.
- Consider hybrid confidence later:
  - Citation support
  - Retrieval quality
  - Tool success
  - Routing confidence
  - Evaluator score
  - Fallback penalty

Important idea:

- Tool-backed transactional answers should have high confidence only when a scoped tool returns valid data.
- RAG answers should be evaluated based on citation support.
- Routing confidence should be separate from final answer confidence.

## Backend Structure

Backend is FastAPI with SQLite for local MVP state.

Important backend files:

- `backend/app/main.py`
  - Registers API routers.

- `backend/app/services/agent_orchestrator.py`
  - Main supervisor/specialist orchestration flow.
  - Contains `run_agent_workflow`.
  - Handles conversation creation, routing, specialist execution, fallback, persistence, trace creation.

- `backend/app/services/oci.py`
  - OCI Responses API adapter.
  - Handles:
    - Supervisor routing call
    - Specialist answer generation
    - File search tool configuration
    - Transactional tool schemas
    - Function tool execution/submission
    - Source extraction
    - Token extraction
    - Confidence evaluation

- `backend/app/services/transaction_tools.py`
  - Demo transactional data and tool implementations.
  - Contains sample user data and tool schemas by agent.

- `backend/app/routers/chat.py`
  - Thin chat API wrapper.
  - Calls `run_agent_workflow`.

- `backend/app/routers/conversations.py`
  - Conversation list, monitoring table, trace/details endpoints.

- `backend/app/routers/agents.py`
  - Agent list/update endpoints.
  - Seeds default agents if empty.

- `backend/app/routers/documents.py`
  - Knowledge base document upload/delete/list logic.

- `backend/app/routers/transactions.py`
  - Demo API routes for transactional data.

- `backend/app/services/settings_service.py`
  - Settings/configuration values.

- `backend/app/models.py`
  - SQLAlchemy models.
  - Some internal model names may still use `AgentProfile` and `profile_id` for DB compatibility.

- `backend/app/schemas.py`
  - API schemas.

- `backend/app/seed.py`
  - Default agents and categories.

## Frontend Structure

Frontend is React/Vite with Nitro/Redwood-inspired UI work.

Important frontend files:

- `frontend/src/App.tsx`
  - Main UI and screens.
  - Admin console, user chat, agent configuration, knowledge base, monitoring.

- `frontend/src/lib/api.ts`
  - API client.
  - Default backend API base should be `http://localhost:8088/api`.

- `frontend/src/lib/types.ts`
  - Frontend API types.

- `frontend/src/app-theme.ts`
  - App theme tokens.

- `frontend/src/styles.css`
  - UI styling.

User chat should use General Helpdesk as the default entry point and should not expose the old knowledge dropdown.

Admin navigation should include:

- Dashboard
- Knowledge base
- Agent profiles / agents
- Agent Configuration
- Monitoring

Execution Trace as a separate left-nav section was removed; trace details should be available by opening a particular monitoring query.

## Current UI Expectations

The UI should remain professional and usable, not clumsy.

The user asked for real Nitro usage where possible, but also wanted the application to remain usable and similar in spirit to the previous helpdesk UI.

Top bar:

- App identity
- Role selector
- Round account icon/user selector

Removed from top bar:

- Settings icon
- Notification icon
- Help icon
- Search bar
- Account icon previously used before the new round user selector

Knowledge Base:

- Should not show fake documents.
- Empty state is acceptable.
- Uploaded documents should reflect actual vector store uploads.

Monitoring:

- Response summary should be short, around two lines with ellipsis in table view.
- Clicking a query should open full query details and execution trace.
- Include:
  - Agent that answered
  - Knowledge categories checked
  - Tools called
  - Sources
  - Token counts
  - Confidence and confidence reason

Dashboard:

- Agent activity trend and knowledge readiness were removed.

## Run Commands

Backend:

```powershell
cd C:\Users\Mounika\PycharmProjects\AMP\mvp-l1-helpdesk-agent\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8088
```

Frontend:

```powershell
cd C:\Users\Mounika\PycharmProjects\AMP\mvp-l1-helpdesk-agent\frontend
npm run dev
```

Frontend usually runs on:

```text
http://localhost:5178
```

Backend API:

```text
http://localhost:8088/api
```

Useful checks:

```powershell
cd C:\Users\Mounika\PycharmProjects\AMP\mvp-l1-helpdesk-agent
python -m compileall backend/app
```

Frontend build:

```powershell
cd C:\Users\Mounika\PycharmProjects\AMP\mvp-l1-helpdesk-agent\frontend
npm run build
```

## Git / Repo Context

Remote repo:

```text
https://github.com/CSS-Engineering-Accelerators/oci-l1-helpdesk
```

Work has been done on a feature branch for Zendesk/token/Nitro/agentic changes.

Before pushing, check:

```powershell
git status
```

Do not commit secrets:

- `backend/.env` should not be committed.
- Use `backend/.env.example` for placeholders.

The user previously wanted only certain docs artifacts in the repo. Be careful with extra generated docs/files.

Important docs currently useful:

- `docs/agentic-architecture-diagram.png`
- `docs/meeting-notes-agent-architecture.md`
- `docs/project-context-handoff.md`
- `docs/Nitro_UI_Setup_and_Usage_Manual.docx`

Old/extra files like `docs/future` or rough/generated diagrams should not be added unless explicitly requested.

## Environment Variables

Backend `.env` contains OCI and ticketing values. It is already filled on the user's machine.

Do not ask for inline secrets if `.env` exists.

Key OCI concepts:

- OCI profile/config
- OCI region
- OCI compartment
- OCI GenAI project OCID
- OCI vector store ID
- OCI file search model

Object Storage envs may exist but are not currently used for RAG.

## Ticketing

Ticketing was wired to an external helpdesk provider for MVP purposes.

The app should be able to:

- Create tickets from chat
- Store ticket references
- Refresh status from provider
- Show user tickets

Future direction may replace current ticketing provider with Oracle HR Helpdesk or another Oracle product.

## Sample Uploads

There is a `sample_uploads` folder with files useful for testing document upload.

The user wanted sample upload files included in the repo.

## Important User Preferences

- Be concrete and implementation-focused.
- Do not stop at proposal when the user asks to implement.
- Keep architecture explanations honest.
- Do not add fake documents, fake tickets, or fake monitoring rows.
- Empty screens are better than fake data.
- Do not mention Atlantis or prototype references inside the app UI.
- Avoid showing internal reference names to demo users.
- Keep features working as a real MVP.
- Use OCI services, not local fallback.
- Keep file and function names clean and aligned with the agentic architecture.

## Current Open Direction

The next phase should keep improving the agentic implementation:

- Make supervisor routing and specialist execution clearer in code and UI.
- Keep `agent_orchestrator.py` as the orchestration owner.
- Keep `oci.py` as the OCI service adapter, not business orchestration.
- Keep `transaction_tools.py` as demo transactional tool boundary.
- Consider further renaming DB internals only if safe and migration is planned.
- Improve architecture diagram if the mentor wants a stronger version.
- Ensure monitoring proves the agentic flow:
  - selected specialist
  - secondary/fallback path
  - categories checked
  - tools used
  - confidence method/reason
  - sources and citations

## Suggested First Prompt for a New Chat Session

Use this prompt when starting a new chat:

```text
I am continuing work on the OCI L1 Helpdesk Agent MVP. Please first read docs/project-context-handoff.md and docs/meeting-notes-agent-architecture.md, then inspect the current repo state before suggesting changes. The current goal is to keep the app aligned with the supervisor-led multi-agent architecture using OCI Responses, OCI Vector Store, transactional tools, ticketing, and monitoring. Do not add local AI fallback or fake demo data.
```
