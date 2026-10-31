"""
SQLite persistence via SQLAlchemy. Local-only storage for the prototype -
uploaded documents are not retained beyond what's needed to serve
GET /api/documents/{id}; see routes/documents.py for the delete-after-read
policy discussion.
"""

import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, LargeBinary, String, Text, UniqueConstraint, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "finlens.db")
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})


class Base(DeclarativeBase):
    pass


def _new_id() -> str:
    return uuid.uuid4().hex


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_id)
    filename: Mapped[str] = mapped_column(String)
    document_type: Mapped[str] = mapped_column(String)
    extracted_text: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text, default="")
    fields: Mapped[dict] = mapped_column(JSON, default=dict)
    risks: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    # Cognee knowledge-memory status: "disabled" | "pending" | "added" | "failed".
    # Independent of the file/SQLite storage above - Cognee never gates that path.
    memory_status: Mapped[str] = mapped_column(String, default="pending")
    memory_error: Mapped[str | None] = mapped_column(Text, nullable=True)


class FinancialTwin(Base):
    __tablename__ = "financial_twins"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String, default="")
    monthly_income: Mapped[float] = mapped_column(default=0)
    monthly_expenses: Mapped[float] = mapped_column(default=0)
    existing_emis: Mapped[float] = mapped_column(default=0)
    savings: Mapped[float] = mapped_column(default=0)
    risk_tolerance: Mapped[str] = mapped_column(String, default="Moderate")
    employment_type: Mapped[str] = mapped_column(String, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    monthly_income: Mapped[float] = mapped_column(default=70833)
    monthly_expenses: Mapped[float] = mapped_column(default=32000)
    existing_emis: Mapped[float] = mapped_column(default=14000)
    savings: Mapped[float] = mapped_column(default=150000)
    investments: Mapped[float] = mapped_column(default=0)
    credit_score: Mapped[float | None] = mapped_column(nullable=True)
    goals: Mapped[str] = mapped_column(Text, default="")
    risk_tolerance: Mapped[str] = mapped_column(String, default="Moderate")
    employment_type: Mapped[str] = mapped_column(String, default="Salaried")
    monthly_insurance_premiums: Mapped[float] = mapped_column(default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )


class Loan(Base):
    __tablename__ = "loans"
    __table_args__ = (UniqueConstraint("user_id", "document_id", name="uq_user_loan_document"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(String, index=True)
    document_id: Mapped[str] = mapped_column(String)
    filename: Mapped[str] = mapped_column(String)
    summary: Mapped[str] = mapped_column(Text, default="")
    fields: Mapped[dict] = mapped_column(JSON, default=dict)
    risks: Mapped[list] = mapped_column(JSON, default=list)
    monthly_emi: Mapped[float] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class InsurancePolicy(Base):
    __tablename__ = "insurance_policies"
    __table_args__ = (UniqueConstraint("user_id", "document_id", name="uq_user_policy_document"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_id)
    user_id: Mapped[str] = mapped_column(String, index=True)
    document_id: Mapped[str] = mapped_column(String)
    filename: Mapped[str] = mapped_column(String)
    summary: Mapped[str] = mapped_column(Text, default="")
    fields: Mapped[dict] = mapped_column(JSON, default=dict)
    risks: Mapped[list] = mapped_column(JSON, default=list)
    monthly_premium: Mapped[float] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token_hash: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class DocumentOwner(Base):
    __tablename__ = "document_owners"

    document_id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, index=True)


class DocumentBinary(Base):
    __tablename__ = "document_binaries"

    document_id: Mapped[str] = mapped_column(String, primary_key=True)
    content_type: Mapped[str] = mapped_column(String, default="application/octet-stream")
    data: Mapped[bytes] = mapped_column(LargeBinary)


def _add_missing_columns() -> None:
    """create_all only creates missing tables, not missing columns on tables that
    already exist. SQLite supports plain ADD COLUMN, so new nullable/defaulted
    columns on existing local databases are backfilled here instead of requiring
    a full migration framework or deleting the dev database."""
    inspector = inspect(engine)
    if "documents" not in inspector.get_table_names():
        return
    existing_columns = {col["name"] for col in inspector.get_columns("documents")}
    with engine.begin() as connection:
        if "memory_status" not in existing_columns:
            connection.execute(text("ALTER TABLE documents ADD COLUMN memory_status VARCHAR DEFAULT 'pending'"))
        if "memory_error" not in existing_columns:
            connection.execute(text("ALTER TABLE documents ADD COLUMN memory_error TEXT"))


def init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    Base.metadata.create_all(engine)
    _add_missing_columns()


def get_session() -> Session:
    return Session(engine)
