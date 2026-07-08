import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
from openai import OpenAI

try:
    from oci_genai_auth import OciUserPrincipalAuth
except ImportError:  # pragma: no cover - depends on installed OCI auth package
    from oci_openai import OciUserPrincipalAuth

from app.config import get_settings, validate_oci_configuration
from app.services.transaction_tools import execute_transaction_tool, tool_schemas_for_agent


BASE_AGENT_INSTRUCTIONS = """
You are part of an enterprise Level-1 helpdesk multi-agent workflow.

You may use:
- file_search for approved knowledge-base retrieval.
- function tools for user-specific transactional data when the user asks about their own record.

Rules:
- For company-specific policy, process, procedure, troubleshooting, onboarding, payroll, HR, or access questions, answer only from retrieved knowledge.
- For user-specific questions, answer only from transactional tool results.
- Do not invent policies, numbers, eligibility, balances, statuses, or procedures.
- If the selected specialist scope cannot answer with confidence, say that clearly so the supervisor fallback can continue.
- Keep answers concise, practical, and citation-aware.
""".strip()

SUPERVISOR_ROUTER_INSTRUCTIONS = """
You are the supervisor agent for an enterprise L1 helpdesk multi-agent workflow.

Your job is routing only. Do not answer the user's helpdesk question.
Choose the best specialist agent based on the user's intent, the agent descriptions, and the available knowledge categories.
Return only valid JSON with keys:
primary_agent_id, secondary_agent_id, confidence, intent, reason.

Use secondary_agent_id only when another specialist is genuinely plausible.
Prefer one clear specialist when possible.
""".strip()

CONFIDENCE_EVALUATOR_INSTRUCTIONS = """
You are a confidence evaluator for an enterprise L1 helpdesk answer.

Evaluate whether the final answer is supported by the provided evidence.
Evidence can include retrieved knowledge sources and transactional tool outputs.
Return only valid JSON with keys:
confidence, reason, escalation_recommended.

Scoring guidance:
- 0.90 to 1.00: Direct transactional tool result or strong retrieved evidence fully supports the answer.
- 0.75 to 0.89: Answer is mostly supported, with minor missing detail.
- 0.55 to 0.74: Partial support or limited evidence.
- 0.30 to 0.54: Weak support, uncertainty, or missing relevant source coverage.
- 0.00 to 0.29: Unsupported or likely unsafe to answer.

Do not reward confident wording. Reward evidence support.
""".strip()


@dataclass
class Source:
    document_id: str
    document_name: str
    page_number: int
    source_text: str
    score: float
    chunk_id: str


@dataclass
class GeneratedAnswer:
    answer: str
    confidence: float
    suggested_prompts: list[str]
    response_id: str | None
    sources: list[Source]
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    tools_called: list[str] | None = None
    tool_outputs: dict[str, Any] | None = None
    confidence_reason: str | None = None
    confidence_method: str | None = None


@dataclass
class ConfidenceEvaluation:
    score: float
    reason: str
    method: str
    escalation_recommended: bool


@dataclass
class RoutingDecision:
    primary_agent_id: str
    secondary_agent_id: str | None
    confidence: float
    intent: str
    reason: str


@dataclass
class VectorStoreUpload:
    file_id: str
    batch_id: str
    status: str


class OCIServiceFacade:
    """OCI OpenAI-compatible Responses API and Vector Store adapter."""

    def __init__(self) -> None:
        self.settings = get_settings()
        validate_oci_configuration(self.settings)
        self._responses_client: OpenAI | None = None

    @property
    def responses_client(self) -> OpenAI:
        if self._responses_client is None:
            auth = OciUserPrincipalAuth(
                config_file=str(Path(self.settings.oci_config_file).expanduser()),
                profile_name=self.settings.resolved_oci_profile,
            )
            base_url = (
                f"https://inference.generativeai.{self.settings.resolved_oci_region}"
                ".oci.oraclecloud.com/openai/v1"
            )
            self._responses_client = OpenAI(
                api_key="not-used",
                base_url=base_url,
                project=self.settings.oci_genai_project_ocid,
                default_headers={"opc-compartment-id": self.settings.oci_compartment_id},
                http_client=httpx.Client(auth=auth, timeout=60),
            )
        return self._responses_client

    def generate_answer(
        self,
        question: str,
        agent_name: str,
        response_tone: str,
        agent_instructions: str,
        history: list[str],
        previous_response_id: str | None = None,
        llm_model: str | None = None,
        vector_store_top_k: int | None = None,
        max_sources: int | None = None,
        knowledge_categories: list[str] | None = None,
        agent_id: str = "general-helpdesk",
        user_id: str | None = None,
    ) -> GeneratedAnswer:
        file_search_tool: dict[str, Any] = {
            "type": "file_search",
            "vector_store_ids": [self.settings.oci_vector_store_id],
        }
        if vector_store_top_k:
            file_search_tool["max_num_results"] = vector_store_top_k
        filters = self._build_category_filter(knowledge_categories or [])
        if filters:
            file_search_tool["filters"] = filters

        request_kwargs: dict[str, Any] = {
            "model": llm_model or self.settings.oci_file_search_model,
            "instructions": self._build_instructions(agent_name, response_tone, agent_instructions),
            "input": self._build_user_input(question, history, user_id),
            "tools": [file_search_tool, *tool_schemas_for_agent(agent_id)],
        }
        if previous_response_id:
            request_kwargs["previous_response_id"] = previous_response_id

        response = self.responses_client.responses.create(**request_kwargs)
        tools_called, tool_outputs = self._execute_requested_tools(response, user_id)
        if tool_outputs:
            response = self._submit_tool_outputs(
                response=response,
                model=llm_model or self.settings.oci_file_search_model,
                tool_outputs=tool_outputs,
            )
        answer = response.output_text or "I could not create a response from the configured OCI Vector Store."
        sources = self._extract_sources(response)[: max_sources or 5]
        token_usage = self._extract_token_usage(response)
        tool_output_map = {item["name"]: item["output"] for item in tool_outputs.values()}
        confidence = self._evaluate_confidence(
            model=llm_model or self.settings.oci_file_search_model,
            question=question,
            answer=answer,
            sources=sources,
            tools_called=tools_called,
            tool_outputs=tool_output_map,
        )
        return GeneratedAnswer(
            answer=answer,
            confidence=confidence.score,
            suggested_prompts=[
                "How do I reset my VPN?",
                "How do I request laptop replacement?",
                "What is the onboarding checklist?",
            ],
            response_id=getattr(response, "id", None),
            sources=sources,
            input_tokens=token_usage["input_tokens"],
            output_tokens=token_usage["output_tokens"],
            total_tokens=token_usage["total_tokens"],
            tools_called=tools_called,
            tool_outputs=tool_output_map,
            confidence_reason=confidence.reason,
            confidence_method=confidence.method,
        )

    def route_to_agent(
        self,
        question: str,
        agents: list[dict[str, Any]],
        history: list[str],
        llm_model: str | None = None,
    ) -> RoutingDecision:
        specialist_agents = [agent for agent in agents if agent["id"] != "general-helpdesk"]
        agent_lines = "\n".join(
            (
                f"- id: {agent['id']}\n"
                f"  name: {agent['name']}\n"
                f"  description: {agent['description']}\n"
                f"  knowledge_categories: {', '.join(agent['knowledge_categories']) or 'all categories'}"
            )
            for agent in specialist_agents
        )
        recent_history = "\n".join(history[-6:])
        response = self.responses_client.responses.create(
            model=llm_model or self.settings.oci_file_search_model,
            instructions=SUPERVISOR_ROUTER_INSTRUCTIONS,
            input=(
                f"Available specialist agents:\n{agent_lines}\n\n"
                f"Recent conversation:\n{recent_history or 'None'}\n\n"
                f"User question:\n{question}"
            ),
        )
        return self._parse_routing_decision(response.output_text or "", specialist_agents)

    def _parse_routing_decision(self, raw: str, agents: list[dict[str, Any]]) -> RoutingDecision:
        valid_ids = {agent["id"] for agent in agents}
        fallback_id = agents[0]["id"] if agents else "general-helpdesk"
        try:
            start = raw.find("{")
            end = raw.rfind("}")
            payload = json.loads(raw[start : end + 1] if start >= 0 and end >= start else raw)
        except Exception:
            payload = {}

        primary = str(payload.get("primary_agent_id") or payload.get("primary_profile_id") or fallback_id)
        if primary not in valid_ids:
            primary = fallback_id

        secondary_raw = payload.get("secondary_agent_id") or payload.get("secondary_profile_id")
        secondary = str(secondary_raw) if secondary_raw else None
        if secondary not in valid_ids or secondary == primary:
            secondary = None

        try:
            confidence = float(payload.get("confidence") or 0.0)
        except (TypeError, ValueError):
            confidence = 0.0

        return RoutingDecision(
            primary_agent_id=primary,
            secondary_agent_id=secondary,
            confidence=max(0.0, min(confidence, 1.0)),
            intent=str(payload.get("intent") or "general_helpdesk"),
            reason=str(payload.get("reason") or "Supervisor selected the closest available specialist."),
        )

    def _evaluate_confidence(
        self,
        model: str,
        question: str,
        answer: str,
        sources: list[Source],
        tools_called: list[str],
        tool_outputs: dict[str, Any],
    ) -> ConfidenceEvaluation:
        heuristic = self._heuristic_confidence(answer, sources, tools_called, tool_outputs)
        try:
            response = self.responses_client.responses.create(
                model=model,
                instructions=CONFIDENCE_EVALUATOR_INSTRUCTIONS,
                input=json.dumps(
                    {
                        "question": question,
                        "answer": answer,
                        "retrieved_sources": [
                            {
                                "document_name": source.document_name,
                                "source_text": source.source_text[:1200],
                                "score": source.score,
                            }
                            for source in sources[:5]
                        ],
                        "tools_called": tools_called,
                        "tool_outputs": tool_outputs,
                        "fallback_confidence_if_evaluator_fails": heuristic.score,
                    },
                    ensure_ascii=False,
                ),
            )
            parsed = self._parse_confidence_evaluation(response.output_text or "")
            if parsed is None:
                return heuristic
            return parsed
        except Exception:
            return heuristic

    def _parse_confidence_evaluation(self, raw: str) -> ConfidenceEvaluation | None:
        try:
            start = raw.find("{")
            end = raw.rfind("}")
            payload = json.loads(raw[start : end + 1] if start >= 0 and end >= start else raw)
        except Exception:
            return None

        try:
            score = float(payload.get("confidence"))
        except (TypeError, ValueError):
            return None

        return ConfidenceEvaluation(
            score=max(0.0, min(score, 1.0)),
            reason=str(payload.get("reason") or "Model evaluated answer support against available evidence."),
            method="model_evaluator",
            escalation_recommended=bool(payload.get("escalation_recommended", False)),
        )

    def _heuristic_confidence(
        self,
        answer: str,
        sources: list[Source],
        tools_called: list[str],
        tool_outputs: dict[str, Any],
    ) -> ConfidenceEvaluation:
        score = 0.45
        reason_parts: list[str] = []

        if tool_outputs:
            score = 0.88
            reason_parts.append("transactional tool output was returned")
        elif len(sources) >= 3:
            score = 0.82
            reason_parts.append("three or more retrieved sources were returned")
        elif sources:
            score = 0.68
            reason_parts.append("limited retrieved source evidence was returned")
        else:
            reason_parts.append("no retrieved sources or transactional tool output were returned")

        answer_lower = answer.lower()
        uncertainty_markers = [
            "not enough information",
            "could not",
            "can't find",
            "cannot find",
            "do not have enough",
            "don't have enough",
            "recommend creating a ticket",
        ]
        if any(marker in answer_lower for marker in uncertainty_markers):
            score = min(score, 0.52)
            reason_parts.append("answer contains uncertainty or escalation language")

        if tools_called and not tool_outputs:
            score = min(score, 0.5)
            reason_parts.append("a tool was requested but no usable tool output was returned")

        return ConfidenceEvaluation(
            score=max(0.0, min(score, 1.0)),
            reason="; ".join(reason_parts),
            method="heuristic_fallback",
            escalation_recommended=score < 0.56,
        )

    def upload_to_vector_store(
        self,
        local_path: Path,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        category: str | None = None,
    ) -> VectorStoreUpload:
        with local_path.open("rb") as file_obj:
            uploaded = self.responses_client.files.create(file=file_obj, purpose="assistants")

        file_entry: dict[str, Any] = {"file_id": uploaded.id}
        if category:
            file_entry["attributes"] = {"category": category}

        batch = self.responses_client.vector_stores.file_batches.create(
            vector_store_id=self.settings.oci_vector_store_id,
            files=[file_entry],
            chunking_strategy={
                "type": "static",
                "static": {
                    "max_chunk_size_tokens": chunk_size or self.settings.oci_vector_store_chunk_size,
                    "chunk_overlap_tokens": chunk_overlap or self.settings.oci_vector_store_chunk_overlap,
                },
            },
        )
        status = self._wait_for_vector_store_batch(batch.id)
        return VectorStoreUpload(file_id=uploaded.id, batch_id=batch.id, status=status)

    def _build_category_filter(self, categories: list[str]) -> dict[str, Any] | None:
        normalized = [category.strip() for category in categories if category.strip()]
        if not normalized:
            return None
        filters = [{"type": "eq", "key": "category", "value": category} for category in normalized]
        if len(filters) == 1:
            return filters[0]
        return {"type": "or", "filters": filters}

    def delete_vector_store_file(self, file_id: str, delete_uploaded_file: bool = True) -> None:
        self.responses_client.vector_stores.files.delete(
            vector_store_id=self.settings.oci_vector_store_id,
            file_id=file_id,
        )
        if delete_uploaded_file:
            self.responses_client.files.delete(file_id)

    def _wait_for_vector_store_batch(self, batch_id: str) -> str:
        started = time.time()
        while True:
            status = self.responses_client.vector_stores.file_batches.retrieve(
                vector_store_id=self.settings.oci_vector_store_id,
                batch_id=batch_id,
            )
            current = getattr(status, "status", "unknown")
            if current in {"completed", "failed", "cancelled"}:
                if current != "completed":
                    raise RuntimeError(f"OCI Vector Store indexing failed with status: {current}")
                return current
            if time.time() - started > self.settings.oci_vector_store_max_wait_seconds:
                raise TimeoutError(f"OCI Vector Store indexing timed out for batch: {batch_id}")
            time.sleep(5)

    def _build_instructions(self, agent_name: str, response_tone: str, agent_instructions: str) -> str:
        return (
            f"{BASE_AGENT_INSTRUCTIONS}\n\n"
            f"Active specialist agent: {agent_name}\n"
            f"Response tone: {response_tone}\n"
            f"Specialist instructions and boundaries:\n{agent_instructions}"
        )

    def _build_user_input(self, question: str, history: list[str], user_id: str | None = None) -> str:
        recent_history = "\n".join(history[-6:])
        user_context = f"Active demo user ID: {user_id or 'EMP001'}"
        return f"{user_context}\n\nRecent conversation:\n{recent_history or 'None'}\n\nUser question:\n{question}"

    def _execute_requested_tools(self, response: Any, user_id: str | None = None) -> tuple[list[str], dict[str, dict[str, Any]]]:
        tool_outputs: dict[str, dict[str, Any]] = {}
        tools_called: list[str] = []

        for call in self._extract_function_calls(response):
            tool_name = call["name"]
            call_id = call["call_id"]
            arguments = call["arguments"]
            output = execute_transaction_tool(tool_name, arguments, user_id=user_id)
            tools_called.append(tool_name)
            tool_outputs[call_id] = {
                "name": tool_name,
                "output": output,
            }

        return tools_called, tool_outputs

    def _submit_tool_outputs(self, response: Any, model: str, tool_outputs: dict[str, dict[str, Any]]) -> Any:
        tool_result_input = [
            {
                "type": "function_call_output",
                "call_id": call_id,
                "output": json.dumps(payload["output"], ensure_ascii=False),
            }
            for call_id, payload in tool_outputs.items()
        ]
        return self.responses_client.responses.create(
            model=model,
            previous_response_id=getattr(response, "id", None),
            input=tool_result_input,
        )

    def _extract_function_calls(self, response: Any) -> list[dict[str, Any]]:
        calls: list[dict[str, Any]] = []
        response_dict = self._as_dict(response)
        output_items = response_dict.get("output") or []
        if not isinstance(output_items, list):
            output_items = []

        for item in output_items:
            if not isinstance(item, dict):
                item = self._as_dict(item)
            item_type = item.get("type")
            tool_name = item.get("name")
            if item_type not in {"function_call", "tool_call"} or not tool_name:
                continue
            raw_arguments = item.get("arguments") or "{}"
            if isinstance(raw_arguments, str):
                try:
                    arguments = json.loads(raw_arguments)
                except json.JSONDecodeError:
                    arguments = {}
            elif isinstance(raw_arguments, dict):
                arguments = raw_arguments
            else:
                arguments = {}
            calls.append(
                {
                    "call_id": str(item.get("call_id") or item.get("id") or tool_name),
                    "name": str(tool_name),
                    "arguments": arguments,
                }
            )
        return calls

    def _extract_sources(self, response: Any) -> list[Source]:
        seen: set[tuple[str | None, str | None, str]] = set()
        sources: list[Source] = []

        for item in self._walk(self._as_dict(response)):
            file_id = item.get("file_id") or item.get("fileId")
            filename = item.get("filename") or item.get("file_name") or item.get("title")
            quote = item.get("quote") or item.get("text") or item.get("content") or ""
            if isinstance(quote, list):
                quote = " ".join(str(value) for value in quote)

            if not file_id and not filename:
                continue

            key = (file_id, filename, str(quote)[:120])
            if key in seen:
                continue
            seen.add(key)

            source_name = filename or file_id or "OCI Vector Store"
            chunk_id = f"{file_id or source_name}:{len(sources)}"
            sources.append(
                Source(
                    document_id=str(file_id or source_name),
                    document_name=str(source_name),
                    page_number=int(item.get("page_number") or item.get("page") or 0),
                    source_text=str(quote)[:2000],
                    score=float(item.get("score") or 0),
                    chunk_id=chunk_id,
                )
            )

        return sources[:5]

    def _extract_token_usage(self, response: Any) -> dict[str, int | None]:
        usage = self._as_dict(response).get("usage") or {}
        if not isinstance(usage, dict):
            usage = self._as_dict(usage)
        input_tokens = self._as_int(
            usage.get("input_tokens")
            or usage.get("prompt_tokens")
            or usage.get("inputTokens")
            or usage.get("promptTokens")
        )
        output_tokens = self._as_int(
            usage.get("output_tokens")
            or usage.get("completion_tokens")
            or usage.get("outputTokens")
            or usage.get("completionTokens")
        )
        total_tokens = self._as_int(usage.get("total_tokens") or usage.get("totalTokens"))
        if total_tokens is None and input_tokens is not None and output_tokens is not None:
            total_tokens = input_tokens + output_tokens
        return {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
        }

    def _as_int(self, value: Any) -> int | None:
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _as_dict(self, value: Any) -> dict[str, Any]:
        if hasattr(value, "model_dump"):
            return value.model_dump()
        if hasattr(value, "to_dict"):
            return value.to_dict()
        if isinstance(value, dict):
            return value
        return {"value": str(value)}

    def _walk(self, value: Any):
        if isinstance(value, dict):
            yield value
            for child in value.values():
                yield from self._walk(child)
        elif isinstance(value, list):
            for child in value:
                yield from self._walk(child)
