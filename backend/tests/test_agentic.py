import asyncio

from config import settings
from services import agentic_service
from services.agentic_service import _emi_tool, _health_tool, _select_tools


def test_agent_selects_financial_tools_for_affordability_question():
    tools = _select_tools(
        "Can I afford this new loan?",
        "Loan amount: ₹500000, interest rate: 10%, tenure: 36 months",
    )

    assert tools == ["profile", "health_score", "emi"]


def test_agent_selects_document_and_memory_tools_for_document_question():
    tools = _select_tools("What risks are in my uploaded insurance policy?", "")

    assert tools == ["profile", "document_search", "financial_memory"]


def test_agent_health_and_emi_tools_return_structured_results():
    profile = {
        "monthly_income": 100000,
        "monthly_expenses": 40000,
        "existing_emis": 10000,
        "savings": 300000,
    }

    health = _health_tool(profile)
    emi = _emi_tool(
        "Can I afford this loan?",
        "Loan amount: ₹500000, interest rate: 10%, tenure: 36 months",
        profile,
    )

    assert 0 <= health["score"] <= 100
    assert emi is not None
    assert emi["emi"] > 0
    assert emi["affordability"] in {"Safe", "Moderate", "Stretched", "High Risk"}


def test_gemini_calls_emi_then_answers(monkeypatch):
    profile = {"monthly_income": 100000, "monthly_expenses": 40000, "existing_emis": 10000, "savings": 300000}
    responses = iter([
        {"candidates": [{"content": {"role": "model", "parts": [{"functionCall": {
            "name": "calculate_emi",
            "args": {"principal": 500000, "annual_rate_percent": 10, "tenure_months": 36},
        }}]}}]},
        {"candidates": [{"content": {"role": "model", "parts": [{"text": "Your estimated EMI is ₹16,134."}]}}]},
    ])
    monkeypatch.setattr(settings, "enable_agent", True)
    monkeypatch.setattr(agentic_service, "_profile_tool", lambda _: profile)
    async def fake_generate(*args, **kwargs):
        return next(responses)
    monkeypatch.setattr(agentic_service.gemini_service, "generate_with_tools", fake_generate)

    result = asyncio.run(agentic_service.run_agent("authenticated-user", "Calculate my EMI", language="en"))

    assert result.answer == "Your estimated EMI is ₹16,134."
    assert [step["tool"] for step in result.steps] == ["calculate_emi"]


def test_tool_error_is_returned_and_model_can_answer(monkeypatch):
    responses = iter([
        {"candidates": [{"content": {"role": "model", "parts": [{"functionCall": {
            "name": "calculate_emi",
            "args": {"principal": 500000, "annual_rate_percent": 10, "tenure_months": 36},
        }}]}}]},
        {"candidates": [{"content": {"role": "model", "parts": [{"text": "I could not calculate that loan safely."}]}}]},
    ])
    monkeypatch.setattr(settings, "enable_agent", True)
    monkeypatch.setattr(agentic_service, "_profile_tool", lambda _: {})
    async def failing_tool(*args, **kwargs):
        raise ValueError("temporary tool failure")
    monkeypatch.setattr(agentic_service, "_execute_tool", failing_tool)
    async def fake_generate(*args, **kwargs):
        return next(responses)
    monkeypatch.setattr(agentic_service.gemini_service, "generate_with_tools", fake_generate)

    result = asyncio.run(agentic_service.run_agent("authenticated-user", "Calculate my EMI"))

    assert result.answer == "I could not calculate that loan safely."
    assert result.steps[0]["ok"] is False


def test_agent_stops_at_max_iterations(monkeypatch):
    call = {"count": 0}
    monkeypatch.setattr(settings, "enable_agent", True)
    monkeypatch.setattr(agentic_service, "_profile_tool", lambda _: {})
    async def fake_generate(*args, **kwargs):
        call["count"] += 1
        return {"candidates": [{"content": {"role": "model", "parts": [{"functionCall": {
            "name": "get_profile", "args": {},
        }}]}}]}
    monkeypatch.setattr(agentic_service.gemini_service, "generate_with_tools", fake_generate)
    monkeypatch.setattr(agentic_service, "_legacy_run", lambda *args: agentic_service.AgentRun("fallback"))

    result = asyncio.run(agentic_service.run_agent("authenticated-user", "Show my profile"))

    assert call["count"] == 5
    assert result.context == "fallback"


def test_user_id_in_tool_args_is_ignored(monkeypatch):
    captured = {}
    monkeypatch.setattr(settings, "enable_agent", True)
    def fake_profile(user_id):
        captured["profile_user"] = user_id
        return {}
    monkeypatch.setattr(agentic_service, "_profile_tool", fake_profile)
    async def fake_generate(*args, **kwargs):
        if len(args[0]) == 1:
            return {"candidates": [{"content": {"role": "model", "parts": [{"functionCall": {
                "name": "get_profile", "args": {"user_id": "attacker"},
            }}]}}]}
        return {"candidates": [{"content": {"role": "model", "parts": [{"text": "Done"}]}}]}
    monkeypatch.setattr(agentic_service.gemini_service, "generate_with_tools", fake_generate)

    result = asyncio.run(agentic_service.run_agent("authenticated-user", "Show my profile"))

    assert result.answer == "Done"
    assert captured["profile_user"] == "authenticated-user"


def test_disabled_agent_uses_legacy_path(monkeypatch):
    monkeypatch.setattr(settings, "enable_agent", False)
    expected = agentic_service.AgentRun("legacy")
    monkeypatch.setattr(agentic_service, "_legacy_run", lambda *args: expected)

    result = asyncio.run(agentic_service.run_agent("authenticated-user", "Hello"))

    assert result is expected
