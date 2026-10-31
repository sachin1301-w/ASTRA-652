"""
ML Status, diagnostics, credit evaluation, and computer vision endpoints for FinLens AI.
"""

import io
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image
from pydantic import BaseModel, Field

from models.db import User
from services.ml.credit_service import FraudChecker, LoanPredictor
from services.ml.registry import registry
from services.security import get_current_user

router = APIRouter(prefix="/api/ml", tags=["ml"])


class LoanApprovalRequest(BaseModel):
    monthly_income: float = Field(..., gt=0)
    loan_amount: float = Field(..., gt=0)
    loan_term_months: Optional[int] = 36
    credit_score: Optional[int] = None
    employment_type: Optional[str] = "Salaried"
    existing_emis: Optional[float] = 0.0


class FraudCheckRequest(BaseModel):
    claim_amount: float = Field(..., gt=0)
    policy_id: Optional[str] = ""
    incident_type: Optional[str] = "Vehicle Damage"
    days_since_policy_start: Optional[int] = 180


@router.get("/status")
def get_ml_status(user: User = Depends(get_current_user)):
    """
    Returns runtime status for all configured ML models, resource usage,
    and availability. Requires authentication.
    """
    status_data = registry.get_status()
    return {
        "success": True,
        **status_data,
    }


@router.post("/loan-approval")
def evaluate_loan_approval(payload: LoanApprovalRequest, user: User = Depends(get_current_user)):
    """
    Evaluates loan approval likelihood using local trained model (if available)
    or calibrated risk estimation.
    """
    predictor = registry.get("loan")
    if predictor is None:
        # Fallback to calibrated predictor instance
        predictor = LoanPredictor("", "")

    result = predictor.predict(payload.model_dump())
    return {
        "success": True,
        **result,
    }


@router.post("/fraud-check")
def evaluate_claim_fraud(payload: FraudCheckRequest, user: User = Depends(get_current_user)):
    """
    Evaluates claim fraud risk. Fraud is ALWAYS flagged for human review, never an auto-rejection.
    """
    checker = registry.get("fraud")
    if checker is None:
        checker = FraudChecker("", "")

    result = checker.check(payload.model_dump())
    return {
        "success": True,
        **result,
    }


@router.post("/damage-check")
async def evaluate_car_damage(
    image: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """
    Classifies motor damage images (crack, scratch, dent, flat tyre, glass, lamp)
    using ViT. Returns top-3 predictions. Photo-based hint only; surveyor decides.
    """
    content = await image.read()
    if not content or len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image required (jpeg/png up to 5 MB).")

    pipeline = registry.get("car_damage")
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Car damage detection model is unavailable.")

    try:
        img = Image.open(io.BytesIO(content)).convert("RGB")
        raw_predictions = pipeline(img, top_k=3)
        predictions = [
            {"label": p.get("label", ""), "score": round(float(p.get("score", 0.0)), 4)}
            for p in raw_predictions
        ]
        return {
            "success": True,
            "predictions": predictions,
            "disclaimer": "Photo-based hint only. A surveyor decides.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze damage: {e}")
