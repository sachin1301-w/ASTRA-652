from fastapi import APIRouter, Depends, HTTPException

from models.db import User
from models.schemas import AssistantChatRequest, AssistantChatResponse, SourceCitation
from services import gemini_service
from services.cognee_service import cognee_service
from services.ml import embedding_service
from services.ml.pii_service import mask_pii
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

    # Retrieve user's cited document chunks via semantic embeddings
    retrieved_sources = embedding_service.retrieve(user.id, payload.question, k=4)
    embedding_section = ""
    if retrieved_sources:
        chunks_text = "\n\n".join(
            f"[Doc: {s['filename']}, page {s['page']}]:\n{s['snippet']}"
            for s in retrieved_sources
        )
        embedding_section = (
            f"\n\nCited Document Excerpts (from user's uploaded documents):\n{chunks_text}\n\n"
            "INSTRUCTION: Answer ONLY based on the provided document excerpts, financial memory, and user profile. "
            "Cite document name and page number when referring to facts. If the information needed to answer is not "
            "found in the documents or profile, state clearly: 'This information is not present in your uploaded documents.'"
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

    raw_context = payload.dynamic_context or 'No additional context provided.'
    masked_context, _ = mask_pii(raw_context)
    masked_question, _ = mask_pii(payload.question.strip())

    prompt = (
        f"{SAFETY_INSTRUCTION}\n\n{language_instruction}\n\n"
        f"Authenticated user: {user.name}\n\n"
        f"Financial context:\n{masked_context}"
        f"{embedding_section}"
        f"{memory_section}\n\n"
        f"User question:\n{masked_question}"
    )
    try:
        selected_model = gemini_service.resolve_model(payload.model)
        answer = await gemini_service.generate_text(prompt, model=selected_model)
    except gemini_service.GeminiUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    citation_objs = [
        SourceCitation(
            document_id=s["document_id"],
            filename=s["filename"],
            page=s["page"],
            snippet=s["snippet"],
            score=s["score"],
        )
        for s in retrieved_sources
    ]

    return AssistantChatResponse(
        success=True,
        answer=answer,
        model=selected_model,
        sources=citation_objs,
    )

