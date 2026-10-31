from fastapi import APIRouter

from models.schemas import EmiRequest, EmiResponse, HealthScoreRequest, HealthScoreResponse
from services import finance_calculations as calc

router = APIRouter(prefix="/api/finance", tags=["finance"])


@router.post("/emi", response_model=EmiResponse)
def compute_emi(payload: EmiRequest) -> EmiResponse:
    emi = calc.calculate_emi(payload.principal, payload.annual_rate_percent, payload.tenure_months)
    total_interest = calc.calculate_total_interest(payload.principal, emi, payload.tenure_months)
    dti = calc.calculate_dti(payload.existing_emis, emi, payload.monthly_income)
    return EmiResponse(
        emi=emi,
        total_interest=total_interest,
        total_repayment=round(payload.principal + total_interest, 2),
        dti_percent=dti,
        affordability=calc.calculate_affordability(dti),
    )


@router.post("/health-score", response_model=HealthScoreResponse)
def compute_health_score(payload: HealthScoreRequest) -> HealthScoreResponse:
    breakdown = calc.calculate_health_score(
        payload.monthly_income, payload.monthly_expenses, payload.existing_emis, payload.savings
    )
    return HealthScoreResponse(**breakdown)
