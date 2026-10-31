"""
Deterministic financial math - no LLM involved. Mirrored client-side in
frontend/src/services/financeService.js for instant slider feedback in the
What-If Simulator (a network round-trip per slider tick would be laggy);
this module is the source of truth for the "official" analysis results.
"""

from typing import Literal, TypedDict


def calculate_emi(principal: float, annual_rate_percent: float, tenure_months: int) -> float:
    """Standard EMI formula: P x r x (1+r)^n / ((1+r)^n - 1)."""
    if tenure_months <= 0:
        return 0.0
    monthly_rate = annual_rate_percent / 12 / 100
    if monthly_rate == 0:
        return round(principal / tenure_months, 2)
    factor = (1 + monthly_rate) ** tenure_months
    emi = principal * monthly_rate * factor / (factor - 1)
    return round(emi, 2)


def calculate_total_interest(principal: float, emi: float, tenure_months: int) -> float:
    total_repayment = emi * tenure_months
    return round(total_repayment - principal, 2)


def calculate_dti(existing_emis: float, new_emi: float, monthly_income: float) -> float:
    """Debt-to-Income ratio, as a percentage."""
    if monthly_income <= 0:
        return 100.0
    return round((existing_emis + new_emi) / monthly_income * 100, 1)


Affordability = Literal["Safe", "Moderate", "Stretched", "High Risk"]


def calculate_affordability(dti_percent: float) -> Affordability:
    if dti_percent <= 35:
        return "Safe"
    if dti_percent <= 50:
        return "Moderate"
    if dti_percent <= 65:
        return "Stretched"
    return "High Risk"


class HealthScoreBreakdown(TypedDict):
    score: int
    income_stability: str
    savings: str
    debt_burden: str
    cash_flow: str


def calculate_health_score(
    monthly_income: float,
    monthly_expenses: float,
    existing_emis: float,
    savings: float,
) -> HealthScoreBreakdown:
    """
    An AI-generated educational financial wellness indicator (0-100) - NOT a
    regulated credit score. Combines savings ratio, debt burden, and cash
    surplus into one weighted score with a plain-language breakdown.
    """
    surplus = monthly_income - monthly_expenses - existing_emis
    savings_ratio = (surplus / monthly_income * 100) if monthly_income > 0 else 0
    debt_ratio = (existing_emis / monthly_income * 100) if monthly_income > 0 else 100
    emergency_fund_months = (savings / monthly_expenses) if monthly_expenses > 0 else 0

    savings_score = max(0, min(35, savings_ratio * 1.2))
    debt_score = max(0, 35 - debt_ratio * 0.7)
    emergency_score = max(0, min(30, emergency_fund_months * 6))
    score = round(savings_score + debt_score + emergency_score)
    score = max(0, min(100, score))

    return {
        "score": score,
        "income_stability": "Good" if monthly_income > 0 else "Unknown",
        "savings": "Good" if savings_ratio >= 25 else "Moderate" if savings_ratio >= 10 else "Low",
        "debt_burden": "Low" if debt_ratio <= 20 else "Moderate" if debt_ratio <= 40 else "High",
        "cash_flow": "Healthy" if surplus > 0 else "Tight",
    }
