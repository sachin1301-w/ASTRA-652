import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from models.db import User
from services.cognee_service import cognee_service
from services.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cognee", tags=["cognee"])


class CogneeSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)


class CogneeSearchResponse(BaseModel):
    success: bool
    query: str
    results: list[str]


@router.post("/search", response_model=CogneeSearchResponse)
async def search_financial_memory(payload: CogneeSearchRequest, user: User = Depends(get_current_user)):
    """Direct access to this user's Cognee financial memory, scoped to their
    own dataset only. Mainly useful for inspecting what the chat endpoint's
    retrieval step would see for a given question. Returns an empty list
    (not an error) if Cognee is unavailable or has nothing relevant yet."""
    try:
        results = await cognee_service.search(user.id, payload.query)
    except Exception as exc:  # noqa: BLE001 - search is best-effort, never a hard failure
        logger.warning("Cognee search failed for user %s: %s", user.id, exc)
        results = []
    return CogneeSearchResponse(success=True, query=payload.query, results=results)
