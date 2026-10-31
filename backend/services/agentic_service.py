"""Bounded agentic orchestration for FinLens financial questions.

The orchestrator selects read-only tools from the user's question, executes
them with the authenticated user scope, and returns grounded context for the
answer model. It does not mutate financial data or approve financial products.
"""

import logging
import re
from dataclasses import dataclass, field

from sqlalchemy import select

from models.db import Document, DocumentOwner, UserProfile, get_session
from services import finance_calculations as finance
from services.cognee_service import cognee_service
from services.ml import embedding_service
from services.ml.pii_service import mask_pii

logger = logging.getLogger(__name__)


@dataclass
class AgentRun:
    context: str
    sources: list[dict] = field(default_factory=list)
    tools_used: list[str] = field(default_factory=list)


def _number(pattern: str, text: str) -> float | None:
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return None
    return float(match.group(1).replace(",", ""))


def _select_tools(question: str, dynamic_context: str) -> list[str]:
    text = f"{question} {dynamic_context}".lower()
    tools = ["profile"]
    if any(term in text for term in ("afford", "emi", "loan", "borrow", "debt", "dti", "repay")):
        tools.append("health_score")
    if any(term in text for term in ("document", "statement", "policy", "agreement", "clause", "fee", "risk", "uploaded")):
        tools.extend(["document_search", "financial_memory"])
    if any(term in text for term in ("new loan", "this loan", "calculate emi", "monthly payment")):
        tools.append("emi")
    return list(dict.fromkeys(tools))


def _profile_tool(user_id: str) -> dict:
    with get_session() as session:
        profile = session.get(UserProfile, user_id)
        if profile is None:
            profile = UserProfile(user_id=user_id)
            session.add(profile)
            session.commit()
        return {
            "monthly_income": profile.monthly_income,
            "monthly_expenses": profile.monthly_expenses,
            "existing_emis": profile.existing_emis,
            "savings": profile.savings,
            "investments": profile.investments,
            "credit_score": profile.credit_score,
            "risk_tolerance": profile.risk_tolerance,
            "employment_type": profile.employment_type,
            "goals": profile.goals,
        }


def _health_tool(profile: dict) -> dict:
    return finance.calculate_health_score(
        profile["monthly_income"],
        profile["monthly_expenses"],
        profile["existing_emis"],
        profile["savings"],
    )


def _emi_tool(question: str, dynamic_context: str, profile: dict) -> dict | None:
    text = f"{question}\n{dynamic_context}"
    principal = _number(r"(?:loan amount|principal|amount)[^\d₹]*₹?\s*([\d,]+(?:\.\d+)?)", text)
    rate = _number(r"(?:interest rate|rate)[^\d]*(\d+(?:\.\d+)?)\s*%?", text)
    tenure = _number(r"(?:tenure|term)[^\d]*(\d+)\s*(?:months?|years?)?", text)
    if not principal or rate is None or not tenure:
        return None
    if re.search(r"(?:year|yr)", text, re.IGNORECASE):
        tenure *= 12
    emi = finance.calculate_emi(principal, rate, int(tenure))
    return {
        "principal": principal,
        "annual_rate_percent": rate,
        "tenure_months": int(tenure),
        "emi": emi,
        "total_interest": finance.calculate_total_interest(principal, emi, int(tenure)),
        "dti_percent": finance.calculate_dti(profile["existing_emis"], emi, profile["monthly_income"]),
        "affordability": finance.calculate_affordability(
            finance.calculate_dti(profile["existing_emis"], emi, profile["monthly_income"])
        ),
    }


async def run_agent(user_id: str, question: str, dynamic_context: str = "") -> AgentRun:
    """Execute the selected read-only tools for one authenticated question."""
    selected_tools = _select_tools(question, dynamic_context)
    profile = _profile_tool(user_id)
    results: dict[str, object] = {"profile": profile}
    sources: list[dict] = []

    if "health_score" in selected_tools:
        results["health_score"] = _health_tool(profile)

    if "emi" in selected_tools:
        emi_result = _emi_tool(question, dynamic_context, profile)
        if emi_result:
            results["emi"] = emi_result

    if "document_search" in selected_tools:
        sources = embedding_service.retrieve(user_id, question, k=4)
        results["document_search"] = [
            {"filename": item["filename"], "page": item["page"], "snippet": item["snippet"], "score": item["score"]}
            for item in sources
        ]
        if not sources:
            with get_session() as session:
                owned_documents = session.scalars(
                    select(Document)
                    .join(DocumentOwner, DocumentOwner.document_id == Document.id)
                    .where(DocumentOwner.user_id == user_id)
                    .order_by(Document.created_at.desc())
                    .limit(5)
                ).all()
                results["recent_documents"] = [
                    {"filename": item.filename, "summary": item.summary, "risks": item.risks or []}
                    for item in owned_documents
                ]

    if "financial_memory" in selected_tools:
        try:
            memory = await cognee_service.get_financial_context(user_id, question)
            if memory:
                results["financial_memory"] = {
                    "context": memory.context_text,
                    "chunk_count": memory.chunk_count,
                }
        except Exception as exc:
            logger.warning("Agent financial-memory tool failed for user %s: %s", user_id, exc)

    masked_context, _ = mask_pii(dynamic_context or "")
    masked_question, _ = mask_pii(question)
    results["user_supplied_context"] = masked_context
    results["question"] = masked_question
    tool_context = "\n\n".join(
        f"Tool `{name}` result:\n{value}" for name, value in results.items()
    )
    return AgentRun(
        context=tool_context,
        sources=sources,
        tools_used=selected_tools,
    )
