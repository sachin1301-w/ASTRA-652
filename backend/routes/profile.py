import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from models.db import DocumentOwner, InsurancePolicy, Loan, User, UserProfile, get_session
from models.schemas import ProfileAssetCreate, ProfileUpdate, SavedAssetOut, UserProfileOut
from services.security import get_current_user

router = APIRouter(prefix="/api/profile", tags=["profile"])


def _number(value) -> float:
    if value is None:
        return 0
    match = re.search(r"\d[\d,]*(?:\.\d+)?", str(value))
    return float(match.group(0).replace(",", "")) if match else 0


def _monthly_premium(value) -> float:
    amount = _number(value)
    text = str(value).lower()
    if any(token in text for token in ("month", "/mo", "monthly")):
        return amount
    return round(amount / 12, 2)


def _get_or_create(session, user_id: str) -> UserProfile:
    profile = session.get(UserProfile, user_id)
    if profile is None:
        profile = UserProfile(user_id=user_id)
        session.add(profile)
        session.flush()
    return profile


def _require_owner(user_id: str, user: User) -> None:
    if user.id != user_id:
        raise HTTPException(status_code=403, detail="You cannot access another user's profile.")


def _require_document_owner(session, document_id: str, user_id: str) -> None:
    owner = session.get(DocumentOwner, document_id)
    if owner is None or owner.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found.")


def _asset_out(asset, impact: float) -> SavedAssetOut:
    return SavedAssetOut(
        id=asset.id,
        document_id=asset.document_id,
        filename=asset.filename,
        summary=asset.summary,
        fields=asset.fields or {},
        risks=asset.risks or [],
        monthly_impact=impact,
    )


def _profile_out(session, profile: UserProfile) -> UserProfileOut:
    loans = session.scalars(select(Loan).where(Loan.user_id == profile.user_id).order_by(Loan.created_at.desc())).all()
    policies = session.scalars(
        select(InsurancePolicy)
        .where(InsurancePolicy.user_id == profile.user_id)
        .order_by(InsurancePolicy.created_at.desc())
    ).all()
    return UserProfileOut(
        user_id=profile.user_id,
        name=profile.name,
        monthly_income=profile.monthly_income,
        monthly_expenses=profile.monthly_expenses,
        existing_emis=profile.existing_emis,
        savings=profile.savings,
        investments=profile.investments,
        credit_score=profile.credit_score,
        goals=profile.goals,
        risk_tolerance=profile.risk_tolerance,
        employment_type=profile.employment_type,
        monthly_insurance_premiums=profile.monthly_insurance_premiums,
        loans=[_asset_out(item, item.monthly_emi) for item in loans],
        insurance_policies=[_asset_out(item, item.monthly_premium) for item in policies],
    )


@router.get("/{user_id}", response_model=UserProfileOut)
def get_profile(user_id: str, user: User = Depends(get_current_user)):
    _require_owner(user_id, user)
    with get_session() as session:
        profile = _get_or_create(session, user_id)
        session.commit()
        return _profile_out(session, profile)


@router.patch("/{user_id}", response_model=UserProfileOut)
def update_profile(user_id: str, payload: ProfileUpdate, user: User = Depends(get_current_user)):
    _require_owner(user_id, user)
    with get_session() as session:
        profile = _get_or_create(session, user_id)
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(profile, key, value)
        session.commit()
        session.refresh(profile)
        return _profile_out(session, profile)


@router.post("/{user_id}/loans", response_model=UserProfileOut)
def save_loan(user_id: str, payload: ProfileAssetCreate, user: User = Depends(get_current_user)):
    _require_owner(user_id, user)
    with get_session() as session:
        profile = _get_or_create(session, user_id)
        _require_document_owner(session, payload.document_id, user_id)
        existing = session.scalar(
            select(Loan).where(Loan.user_id == user_id, Loan.document_id == payload.document_id)
        )
        if existing is None:
            monthly_emi = _number(payload.fields.get("emi"))
            session.add(Loan(
                user_id=user_id,
                document_id=payload.document_id,
                filename=payload.filename,
                summary=payload.summary,
                fields=payload.fields,
                risks=payload.risks,
                monthly_emi=monthly_emi,
            ))
            profile.existing_emis += monthly_emi
        session.commit()
        session.refresh(profile)
        return _profile_out(session, profile)


@router.post("/{user_id}/insurance", response_model=UserProfileOut)
def save_insurance(user_id: str, payload: ProfileAssetCreate, user: User = Depends(get_current_user)):
    _require_owner(user_id, user)
    with get_session() as session:
        profile = _get_or_create(session, user_id)
        _require_document_owner(session, payload.document_id, user_id)
        existing = session.scalar(
            select(InsurancePolicy).where(
                InsurancePolicy.user_id == user_id,
                InsurancePolicy.document_id == payload.document_id,
            )
        )
        if existing is None:
            monthly_premium = _monthly_premium(payload.fields.get("premium"))
            session.add(InsurancePolicy(
                user_id=user_id,
                document_id=payload.document_id,
                filename=payload.filename,
                summary=payload.summary,
                fields=payload.fields,
                risks=payload.risks,
                monthly_premium=monthly_premium,
            ))
            profile.monthly_insurance_premiums += monthly_premium
            profile.monthly_expenses += monthly_premium
        session.commit()
        session.refresh(profile)
        return _profile_out(session, profile)
