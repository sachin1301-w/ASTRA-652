from fastapi import APIRouter, Depends, HTTPException

from models.db import User
from models.schemas import AssistantChatRequest, AssistantChatResponse
from services import gemini_service
from services.cognee_service import cognee_service
from services.security import get_current_user

router = APIRouter(prefix="/api/assistant", tags=["assistant"])

SAFETY_INSTRUCTION = """You are FinLens AI, an empathetic, highly articulate personal financial assistant powered by Paytm AI.
Provide clear, educational, and personalized guidance based on the supplied user profile and document context.

CONVERSATIONAL & VOICE BEHAVIOR GUIDELINES:
1. Spoken Cadence: Keep spoken explanations crisp, conversational, and direct (2-4 sentences per thought). Avoid overwhelming bullet points when a clean natural explanation is better.
2. Financial Numbers & Currency: Always speak monetary amounts clearly in Indian context (e.g. "₹50,000" as "Fifty thousand rupees", "₹2.5 Lakh" as "Two point five lakh rupees").
3. Demystify Fine Print: Break down complex terms (APR, foreclosure charges, DTI ratio, amortization, tax exemptions under 80C) into everyday analogies.
4. Active Empathy & Tone: Professional, reassuring, and encouraging. Never judge the user's debt or income.
5. Guardrails: Never guarantee loan approval, stock returns, or legal/tax outcomes. Clearly flag risks, prepayment penalties, or hidden processing fees. If a decision carries high legal or tax stakes, advise consulting a certified professional."""


@router.post("/chat", response_model=AssistantChatResponse)
async def chat(payload: AssistantChatRequest, user: User = Depends(get_current_user)):
    language_instruction = (
        "Respond only in simple Hindi using Devanagari script."
        if payload.language == "hi"
        else "Respond only in simple English."
    )

    # Cognee retrieval is additive: it only ever adds a "Financial memory"
    # section on top of the existing profile-derived dynamic_context. If
    # Cognee has nothing relevant or is unavailable, get_financial_context()
    # returns None and chat proceeds exactly as it did before this existed.
    memory_context = await cognee_service.get_financial_context(user.id, payload.question)
    memory_section = (
        f"\n\nFinancial memory (retrieved from this user's uploaded documents, "
        f"may span multiple documents):\n{memory_context.context_text}"
        if memory_context
        else ""
    )

    prompt = (
        f"{SAFETY_INSTRUCTION}\n\n{language_instruction}\n\n"
        f"Authenticated user: {user.name}\n\n"
        f"Financial context:\n{payload.dynamic_context or 'No additional context provided.'}"
        f"{memory_section}\n\n"
        f"User question:\n{payload.question.strip()}"
    )
    try:
        selected_model = gemini_service.resolve_model(payload.model)
        answer = await gemini_service.generate_text(prompt, model=selected_model)
    except gemini_service.GeminiUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return AssistantChatResponse(success=True, answer=answer, model=selected_model)
