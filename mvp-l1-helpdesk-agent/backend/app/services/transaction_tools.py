from __future__ import annotations

import json
from typing import Any


DEFAULT_DEMO_USER_ID = "EMP001"

DEMO_EMPLOYEE_DATA: dict[str, dict[str, Any]] = {
    "EMP001": {
        "profile": {
            "employee_id": "EMP001",
            "name": "Mounika",
            "email": "mounika@example.com",
            "department": "Engineering",
            "manager": "Anika Rao",
            "location": "Hyderabad",
        },
        "leave_balance": {
            "annual_leave": 12,
            "sick_leave": 5,
            "casual_leave": 2,
            "comp_off": 1,
            "last_updated": "2026-07-01",
        },
        "payroll_summary": {
            "next_pay_date": "2026-07-31",
            "last_pay_date": "2026-06-30",
            "payroll_status": "Processed",
            "reimbursement_status": "No pending reimbursements",
            "tax_declaration_status": "Submitted",
        },
        "assigned_assets": [
            {
                "asset_tag": "LAP-20491",
                "type": "Laptop",
                "model": "Lenovo ThinkPad T14",
                "status": "Assigned",
                "assigned_on": "2025-11-18",
            },
            {
                "asset_tag": "MON-11827",
                "type": "Monitor",
                "model": "Dell 24 inch",
                "status": "Assigned",
                "assigned_on": "2025-11-20",
            },
        ],
        "access_summary": [
            {"application": "Oracle Fusion HCM", "status": "Active", "role": "Employee Self Service"},
            {"application": "Jira", "status": "Active", "role": "Developer"},
            {"application": "OCI Console", "status": "Pending approval", "role": "Read Only"},
        ],
        "ticket_summary": [
            {
                "ticket_id": "HD-1042",
                "subject": "VPN connection intermittently fails",
                "status": "Open",
                "priority": "Medium",
            },
            {
                "ticket_id": "HD-1037",
                "subject": "Laptop replacement eligibility check",
                "status": "Solved",
                "priority": "Low",
            },
        ],
    },
    "EMP002": {
        "profile": {
            "employee_id": "EMP002",
            "name": "Madhuri",
            "email": "madhuri@example.com",
            "department": "Human Resources",
            "manager": "Rohit Menon",
            "location": "Bengaluru",
        },
        "leave_balance": {
            "annual_leave": 8,
            "sick_leave": 7,
            "casual_leave": 3,
            "comp_off": 0,
            "last_updated": "2026-07-01",
        },
        "payroll_summary": {
            "next_pay_date": "2026-07-31",
            "last_pay_date": "2026-06-30",
            "payroll_status": "Processed",
            "reimbursement_status": "One travel reimbursement pending approval",
            "tax_declaration_status": "Pending employee update",
        },
        "assigned_assets": [
            {
                "asset_tag": "LAP-30984",
                "type": "Laptop",
                "model": "HP EliteBook 840",
                "status": "Assigned",
                "assigned_on": "2026-02-12",
            },
            {
                "asset_tag": "PHN-77210",
                "type": "Mobile phone",
                "model": "iPhone 15",
                "status": "Assigned",
                "assigned_on": "2026-02-15",
            },
        ],
        "access_summary": [
            {"application": "Oracle Fusion HCM", "status": "Active", "role": "HR Specialist"},
            {"application": "Oracle Learning", "status": "Active", "role": "Learning Admin"},
            {"application": "Payroll Console", "status": "Not requested", "role": "None"},
        ],
        "ticket_summary": [
            {
                "ticket_id": "HD-1081",
                "subject": "Tax declaration update not saving",
                "status": "Pending",
                "priority": "Medium",
            }
        ],
    },
}


TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "type": "function",
        "name": "get_employee_profile",
        "description": "Get the current employee profile, department, manager, and location.",
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "type": "function",
        "name": "get_leave_balance",
        "description": "Get the current employee leave balance by leave type.",
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "type": "function",
        "name": "get_payroll_summary",
        "description": "Get the current employee payroll, pay date, reimbursement, and tax declaration summary.",
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "type": "function",
        "name": "get_assigned_assets",
        "description": "Get the IT assets currently assigned to the employee.",
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "type": "function",
        "name": "get_access_summary",
        "description": "Get the employee's application access and approval status summary.",
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "type": "function",
        "name": "get_user_ticket_summary",
        "description": "Get the employee's recent helpdesk ticket summary.",
        "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
    },
]

TOOLS_BY_AGENT: dict[str, list[str]] = {
    "general-helpdesk": [
        "get_employee_profile",
        "get_leave_balance",
        "get_payroll_summary",
        "get_assigned_assets",
        "get_access_summary",
        "get_user_ticket_summary",
    ],
    "it-support": ["get_assigned_assets", "get_access_summary", "get_user_ticket_summary"],
    "hr-assistant": ["get_employee_profile", "get_leave_balance"],
    "payroll-assistant": ["get_payroll_summary"],
    "onboarding-assistant": ["get_employee_profile"],
}


def tool_schemas_for_agent(agent_id: str) -> list[dict[str, Any]]:
    allowed = set(TOOLS_BY_AGENT.get(agent_id, []))
    return [schema for schema in TOOL_SCHEMAS if schema["name"] in allowed]


def resolve_demo_user_id(user_id: str | None = None) -> str:
    if user_id in DEMO_EMPLOYEE_DATA:
        return user_id
    return DEFAULT_DEMO_USER_ID


def get_demo_user_data(user_id: str | None = None) -> dict[str, Any]:
    return DEMO_EMPLOYEE_DATA[resolve_demo_user_id(user_id)]


def execute_transaction_tool(
    tool_name: str,
    _arguments: dict[str, Any] | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """Return mock enterprise-system data for a model-selected transaction tool."""
    resolved_user_id = resolve_demo_user_id(user_id)
    user_data = get_demo_user_data(resolved_user_id)
    if tool_name == "get_employee_profile":
        result = user_data["profile"]
    elif tool_name == "get_leave_balance":
        result = user_data["leave_balance"]
    elif tool_name == "get_payroll_summary":
        result = user_data["payroll_summary"]
    elif tool_name == "get_assigned_assets":
        result = {"assets": user_data["assigned_assets"]}
    elif tool_name == "get_access_summary":
        result = {"access": user_data["access_summary"]}
    elif tool_name == "get_user_ticket_summary":
        result = {"tickets": user_data["ticket_summary"]}
    else:
        result = {"error": f"Unsupported transaction tool: {tool_name}"}

    return {
        "source": "mock_enterprise_connector",
        "employee_id": resolved_user_id,
        "tool": tool_name,
        "result": result,
    }


def summarize_tool_outputs(outputs: dict[str, Any]) -> str:
    if not outputs:
        return "No transactional connector was called."
    compact = {name: value.get("result", value) for name, value in outputs.items()}
    return json.dumps(compact, ensure_ascii=False)
