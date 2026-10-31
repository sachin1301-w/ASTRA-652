"""
Unit and integration tests for FinLens ML modules and fallback behaviors.
"""

import os
import pytest
from fastapi.testclient import TestClient

from config import settings
from main import app
from models.db import DocumentChunk, User, get_session
from models.schemas import DocumentType
from services.ml.credit_service import FraudChecker, LoanPredictor
from services.ml.embedding_service import chunk_text, retrieve
from services.ml.pii_service import mask_pii
from services.security import create_session

client = TestClient(app)


def get_auth_token():
    with get_session() as session:
        user = session.query(User).first()
        token = create_session(session, user.id)
        session.commit()
        return token, user.id


# --- 1. PII Masking Tests ---

def test_pii_masking_all_types():
    text = (
        "Borrower: Ananya Iyer, PAN: ABCDE1234F, Aadhaar: 9876 5432 1098. "
        "Contact: +91 9123456789, email: ananya@example.com, UPI: ananya@oksbi. "
        "Account Number: 987654321012345, IFSC: SBIN0001234."
    )
    masked, report = mask_pii(text)

    assert "ABCDE1234F" not in masked
    assert "9876 5432 1098" not in masked
    assert "9123456789" not in masked
    assert "ananya@example.com" not in masked
    assert "ananya@oksbi" not in masked
    assert "987654321012345" not in masked
    assert "SBIN0001234" not in masked

    assert report["pan"] == 1
    assert report["aadhaar"] == 1
    assert report["phone"] == 1
    assert report["email"] == 1
    assert report["upi"] == 1
    assert report["account"] == 1
    assert report["ifsc"] == 1
    assert report["total"] >= 7


def test_pii_masking_preserves_financial_numbers():
    text = (
        "Sanctioned loan of ₹5,00,000 at 10.5% interest rate. "
        "Monthly EMI is ₹12,500. DTI ratio is 35%. "
        "Net income is INR 75,000 /month with Rs. 50,000 bonus."
    )
    masked, report = mask_pii(text)

    assert "₹5,00,000" in masked
    assert "10.5%" in masked
    assert "₹12,500" in masked
    assert "35%" in masked
    assert report["total"] == 0


# --- 2. Multi-tenant Retrieval Isolation ---

def test_retrieval_user_isolation():
    user_a = "user_test_alpha"
    user_b = "user_test_beta"

    with get_session() as session:
        # Seed chunks for user_a and user_b
        session.add(
            DocumentChunk(
                user_id=user_a,
                document_id="doc_a",
                filename="alpha_agreement.pdf",
                page=1,
                heading="Cardiac Waiting",
                text="Waiting period for pre-existing cardiac conditions is 24 months.",
                embedding=[0.5] * 384,
            )
        )
        session.add(
            DocumentChunk(
                user_id=user_b,
                document_id="doc_b",
                filename="beta_confidential.pdf",
                page=1,
                heading="Secret Plan",
                text="Confidential corporate roadmap for user beta.",
                embedding=[0.5] * 384,
            )
        )
        session.commit()

    # Query strictly for user_a
    results_a = retrieve(user_a, "cardiac conditions")
    # Verify no leaks of user_b data
    for res in results_a:
        assert res["document_id"] != "doc_b"
        assert "beta" not in res["filename"]


# --- 3. Status Endpoint ---

def test_status_endpoint_requires_auth():
    resp = client.get("/api/ml/status")
    assert resp.status_code == 401


def test_status_endpoint_success():
    token, _ = get_auth_token()
    resp = client.get("/api/ml/status", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "models" in data
    assert "embeddings" in data["models"]
    assert "ner" in data["models"]
    assert "docling" in data["models"]


# --- 4. Credit & Fraud Normalization ---

def test_loan_predictor_normalization():
    predictor = LoanPredictor("", "")
    result = predictor.predict({
        "monthly_income": 85000,
        "loan_amount": 250000,
        "loan_term_months": 36,
    })
    assert result["decision"] in ("approved", "rejected")
    assert 0.0 <= result["probability"] <= 1.0
    assert result["confidence"] in ("high", "medium", "low")
    assert len(result["reasons"]) >= 1


def test_fraud_checker_always_human_review():
    checker = FraudChecker("", "")
    result = checker.check({
        "claim_amount": 150000,
        "incident_type": "Vehicle Collision",
    })
    # Fraud must NEVER be a rejection
    assert result["decision"] == "needs human review"
    assert "rejected" not in result["decision"].lower()
    assert result["confidence"] in ("high", "medium", "low")


# --- 5. Production ML Disabled Default Behavior ---

def test_app_ml_disabled_by_default():
    assert settings.ml_enabled is False
    from services.ml.registry import registry
    # When disabled, get(name) strictly returns None
    assert registry.get("embeddings") is None
    assert registry.get("ner") is None
    assert registry.get("docling") is None


# --- 6. Real Model Verification Marker ---

@pytest.mark.ml
def test_real_e5_embeddings_if_present():
    from services.ml.registry import registry
    if not os.path.exists("ml_models/multilingual-e5-small"):
        pytest.skip("multilingual-e5-small not downloaded")
    # Temporarily toggle enable flag to test local loader
    settings.ml_enabled = True
    settings.enable_embeddings = True
    try:
        model = registry.get("embeddings")
        assert model is not None
        vec = model.encode(["passage: test phrase"], normalize_embeddings=True)
        assert len(vec[0]) == 384
    finally:
        settings.ml_enabled = False
        settings.enable_embeddings = False
