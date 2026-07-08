# L1 Helpdesk Agent Architecture - Meeting Notes

## Context

The current application is moving from a single chat runtime with configurable profiles toward a supervisor-led multi-agent helpdesk architecture.

The goal is not just to label profiles as agents, but to create clearer responsibility boundaries:

- A supervisor agent handles routing and fallback.
- Specialist agents handle domain-specific queries.
- Each specialist has its own instructions, knowledge scope, and transactional tools.
- OCI Responses is used for routing, answering, file search, tool selection, and confidence evaluation.

## Architecture Summary

The user interacts with one helpdesk chat interface. For general helpdesk requests, the supervisor agent first classifies the user intent and selects the most suitable specialist agent.

The specialist agent then answers using:

- Its own system instructions
- Its configured knowledge categories
- OCI Vector Store through file search
- Its allowed transactional tools
- The selected user context when the question is user-specific

The answer is evaluated for confidence. If the answer is weak, the supervisor can retry using a secondary specialist. If that still does not resolve the query, the system can fall back to the General Helpdesk agent or create a ticket.

## Why This Is Agentic

This is not a fixed one-pipeline chatbot.

The agentic behavior comes from:

- Dynamic routing by the supervisor agent
- Specialist agents with scoped autonomy
- OCI tool selection at runtime
- Evidence-aware confidence evaluation
- Runtime fallback and escalation
- Monitoring that records which agent, tools, knowledge categories, sources, and tokens were used

## Current Agent Roles

General Helpdesk:
Default entry point and broad fallback agent. It can search across all configured knowledge categories and use all available demo tools.

IT Support:
Handles VPN, device, access, and IT support process questions. It uses IT-related knowledge and IT support tools.

HR Assistant:
Handles HCM, benefits, leave, and employee lifecycle questions. It uses HR knowledge and profile or leave-related tools.

Payroll Assistant:
Handles payslip, payroll timing, deduction, and payment questions. It uses payroll knowledge and payroll tools.

Onboarding Assistant:
Handles new hire readiness, checklist, and onboarding process questions. It uses onboarding knowledge and onboarding-related tools.

## Request Flow

1. User asks a question in chat.
2. Supervisor agent routes the query to the best specialist.
3. Specialist agent runs with scoped instructions, RAG filters, and allowed tools.
4. OCI Responses performs answer generation and tool selection.
5. Confidence evaluator checks whether the answer is supported.
6. If confidence is weak, fallback is applied.
7. The final answer, citations, tool calls, token usage, confidence, and trace are stored for monitoring.

## Key Talking Point

The improvement over simple agent profiles is that profiles are no longer only configuration overlays. They become specialist execution boundaries. The supervisor owns routing and fallback, while each specialist owns domain-specific reasoning, retrieval scope, and transactional tool access.

## Demo-Friendly Explanation

"This architecture uses a supervisor-led multi-agent workflow. The user still sees one simple helpdesk chat, but behind the scenes the supervisor classifies the request and routes it to the right specialist agent. Each specialist has its own instructions, knowledge access, and tool access. OCI Responses handles the agent execution, including file search, tool selection, and confidence evaluation. If the selected agent cannot answer confidently, the supervisor can retry another specialist, fall back to General Helpdesk, or create a ticket. The full process is recorded in monitoring for traceability."
