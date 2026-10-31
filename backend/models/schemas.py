from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    id: str
    name: str
    email: str


class LoginResponse(BaseModel):
    success: bool
    message: str
    user: Optional[UserOut] = None
    access_token: str
    token_type: Literal["bearer"] = "bearer"


class ErrorResponse(BaseModel):
    success: bool = False
    error: str


class AssistantAnalyzeResponse(BaseModel):
    success: bool
    language: Literal["en", "hi"]
    answer: str
    document_context: str


class AssistantChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    language: Literal["en", "hi"] = "en"
    dynamic_context: str = Field(default="", max_length=20000)
    model: Optional[Literal[
        "gemini-3.8-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
    ]] = None


class AssistantChatResponse(BaseModel):
    success: bool
    answer: str
    model: str


DocumentType = Literal[
    "itr",
    "bank_statement",
    "salary_slip",
    "loan_agreement",
    "insurance_policy",
    "investment_statement",
    "credit_report",
]


class DocumentUploadResponse(BaseModel):
    success: bool
    id: str
    filename: str
    document_type: DocumentType
    summary: str
    fields: dict
    risks: list[str]


MemoryStatus = Literal["pending", "added", "failed", "disabled"]


class DocumentOut(BaseModel):
    id: str
    filename: str
    document_type: DocumentType
    summary: str
    fields: dict
    risks: list[str]
    extracted_text: str
    memory_status: MemoryStatus
    memory_error: Optional[str] = None


class DocumentSummaryOut(BaseModel):
    id: str
    filename: str
    document_type: DocumentType
    summary: str
    processing_status: Literal["uploaded", "analyzed"]
    has_file: bool
    content_type: Optional[str] = None
    file_size: Optional[int] = None
    created_at: datetime
    risks_count: int
    memory_status: MemoryStatus


class DocumentListResponse(BaseModel):
    success: bool
    documents: list[DocumentSummaryOut]


class HindiExplanationResponse(BaseModel):
    success: bool
    document_id: str
    hindi_title: str
    hindi_summary: str
    key_points: list[str]
    risks: list[str]
    spoken_text: str


class EmiRequest(BaseModel):
    principal: float = Field(gt=0)
    annual_rate_percent: float = Field(ge=0)
    tenure_months: int = Field(gt=0)
    existing_emis: float = Field(default=0, ge=0)
    monthly_income: float = Field(default=0, ge=0)


class EmiResponse(BaseModel):
    emi: float
    total_interest: float
    total_repayment: float
    dti_percent: float
    affordability: Literal["Safe", "Moderate", "Stretched", "High Risk"]


class HealthScoreRequest(BaseModel):
    monthly_income: float = Field(ge=0)
    monthly_expenses: float = Field(ge=0)
    existing_emis: float = Field(default=0, ge=0)
    savings: float = Field(default=0, ge=0)


class HealthScoreResponse(BaseModel):
    score: int
    income_stability: str
    savings: str
    debt_burden: str
    cash_flow: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    monthly_income: Optional[float] = Field(default=None, ge=0)
    monthly_expenses: Optional[float] = Field(default=None, ge=0)
    existing_emis: Optional[float] = Field(default=None, ge=0)
    savings: Optional[float] = Field(default=None, ge=0)
    investments: Optional[float] = Field(default=None, ge=0)
    credit_score: Optional[float] = Field(default=None, ge=0)
    goals: Optional[str] = None
    risk_tolerance: Optional[str] = None
    employment_type: Optional[str] = None


class ProfileAssetCreate(BaseModel):
    document_id: str
    filename: str
    summary: str = ""
    fields: dict[str, Any] = Field(default_factory=dict)
    risks: list[str] = Field(default_factory=list)


class SavedAssetOut(BaseModel):
    id: str
    document_id: str
    filename: str
    summary: str
    fields: dict[str, Any]
    risks: list[str]
    monthly_impact: float


class UserProfileOut(BaseModel):
    user_id: str
    name: str
    monthly_income: float
    monthly_expenses: float
    existing_emis: float
    savings: float
    investments: float
    credit_score: Optional[float]
    goals: str
    risk_tolerance: str
    employment_type: str
    monthly_insurance_premiums: float
    loans: list[SavedAssetOut]
    insurance_policies: list[SavedAssetOut]
