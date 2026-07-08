from dataclasses import dataclass
from typing import Any

import httpx

from app.config import get_settings, validate_zendesk_configuration


@dataclass
class ZendeskTicket:
    ticket_id: int
    url: str
    status: str


class ZendeskService:
    def __init__(self) -> None:
        self.settings = get_settings()
        validate_zendesk_configuration(self.settings)

    @property
    def base_url(self) -> str:
        subdomain = (self.settings.zendesk_subdomain or "").strip()
        subdomain = subdomain.removeprefix("https://").removeprefix("http://")
        subdomain = subdomain.removesuffix(".zendesk.com").strip("/")
        return f"https://{subdomain}.zendesk.com"

    def create_ticket(
        self,
        subject: str,
        description: str,
        priority: str,
        conversation_id: str | None = None,
    ) -> ZendeskTicket:
        payload: dict[str, Any] = {
            "ticket": {
                "subject": subject,
                "comment": {"body": self._ticket_body(description, conversation_id)},
                "priority": self._priority(priority),
                "requester": {
                    "name": self.settings.zendesk_default_requester_name,
                    "email": self.settings.zendesk_default_requester_email,
                },
                "tags": self._tags(),
            }
        }
        group_id = self._group_id()
        if group_id is not None:
            payload["ticket"]["group_id"] = group_id

        response = httpx.post(
            f"{self.base_url}/api/v2/tickets.json",
            json=payload,
            auth=(f"{self.settings.zendesk_email}/token", self.settings.zendesk_api_token or ""),
            timeout=30,
        )
        response.raise_for_status()
        ticket = response.json()["ticket"]
        ticket_id = int(ticket["id"])
        return ZendeskTicket(
            ticket_id=ticket_id,
            url=f"{self.base_url}/agent/tickets/{ticket_id}",
            status=str(ticket.get("status") or "open").title(),
        )

    def get_ticket(self, ticket_id: int) -> ZendeskTicket:
        response = httpx.get(
            f"{self.base_url}/api/v2/tickets/{ticket_id}.json",
            auth=(f"{self.settings.zendesk_email}/token", self.settings.zendesk_api_token or ""),
            timeout=30,
        )
        response.raise_for_status()
        ticket = response.json()["ticket"]
        return ZendeskTicket(
            ticket_id=int(ticket["id"]),
            url=f"{self.base_url}/agent/tickets/{ticket_id}",
            status=str(ticket.get("status") or "open").title(),
        )

    def _tags(self) -> list[str]:
        return [tag.strip() for tag in self.settings.zendesk_tags.split(",") if tag.strip()]

    def _priority(self, priority: str) -> str:
        value = priority.strip().lower()
        if value == "high":
            return "high"
        if value == "low":
            return "low"
        return "normal"

    def _group_id(self) -> int | None:
        if not self.settings.zendesk_group_id:
            return None
        value = self.settings.zendesk_group_id.strip()
        return int(value) if value else None

    def _ticket_body(self, description: str, conversation_id: str | None) -> str:
        lines = [description.strip()]
        if conversation_id:
            lines.append("")
            lines.append(f"Conversation ID: {conversation_id}")
        lines.append("")
        lines.append("Created by OCI L1 HelpDesk Agent.")
        return "\n".join(lines)
