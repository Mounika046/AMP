from fastapi import APIRouter

from app.services.transaction_tools import DEFAULT_DEMO_USER_ID, get_demo_user_data

router = APIRouter(prefix="/api/me", tags=["employee transactions"])


@router.get("/profile")
def employee_profile(user_id: str = DEFAULT_DEMO_USER_ID) -> dict:
    return get_demo_user_data(user_id)["profile"]


@router.get("/leave-balance")
def leave_balance(user_id: str = DEFAULT_DEMO_USER_ID) -> dict:
    return get_demo_user_data(user_id)["leave_balance"]


@router.get("/payroll-summary")
def payroll_summary(user_id: str = DEFAULT_DEMO_USER_ID) -> dict:
    return get_demo_user_data(user_id)["payroll_summary"]


@router.get("/assets")
def assigned_assets(user_id: str = DEFAULT_DEMO_USER_ID) -> dict:
    return {"assets": get_demo_user_data(user_id)["assigned_assets"]}


@router.get("/access")
def access_summary(user_id: str = DEFAULT_DEMO_USER_ID) -> dict:
    return {"access": get_demo_user_data(user_id)["access_summary"]}


@router.get("/tickets")
def user_ticket_summary(user_id: str = DEFAULT_DEMO_USER_ID) -> dict:
    return {"tickets": get_demo_user_data(user_id)["ticket_summary"]}
