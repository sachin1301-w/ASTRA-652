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
