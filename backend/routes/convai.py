from fastapi import APIRouter
from config import settings

router = APIRouter(prefix="/api/convai", tags=["convai"])


@router.get("/config")
def get_convai_config():
    """Returns the configured Convai 3D Avatar Experience and Character IDs."""
    char_id = settings.resolved_convai_character_id
    exp_id = settings.resolved_convai_experience_id or char_id
    active_id = char_id or exp_id
    return {
        "character_id": char_id or active_id,
        "experience_id": exp_id or active_id,
        "configured": bool(active_id),
    }
