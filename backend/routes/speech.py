import io
import logging
import base64

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from gtts import gTTS

from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/speech", tags=["speech"])
SARVAM_API_URL = "https://api.sarvam.ai"


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10000)
    language: str = Field(default="hi")


@router.post("/tts")
def text_to_speech(payload: TTSRequest):
    """
    Generates authentic, high-definition native spoken audio (MP3) via Google TTS.
    Guarantees crystal-clear Hindi pronunciation even when Windows or the user's
    browser does not have a native Hindi TTS voice pack installed.
    """
    raw_text = payload.text.strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    # Clean any markdown or formatting symbols before passing to TTS
    clean = raw_text.replace("*", " ").replace("#", " ").replace("`", " ")
    clean = " ".join(clean.split())
    if not clean:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    is_hindi = payload.language == "hi" or any("\u0900" <= ch <= "\u097f" for ch in clean)
    lang = "hi" if is_hindi else "en"
    tld = "co.in"

    if settings.sarvam_ai_api_key:
        try:
            language_code = "hi-IN" if is_hindi else "en-IN"
            response = httpx.post(
                f"{SARVAM_API_URL}/text-to-speech",
                headers={"api-subscription-key": settings.sarvam_ai_api_key},
                json={
                    "text": clean,
                    "language_code": language_code,
                    "speaker": "shubh",
                    "model": "bulbul:v3",
                    "speech_sample_rate": 22050,
                    "output_audio_codec": "mp3",
                    "enable_preprocessing": True,
                },
                timeout=45,
            )
            response.raise_for_status()
            audio = response.json().get("audios", [None])[0]
            if not audio:
                raise ValueError("Sarvam returned no audio data.")
            return Response(
                content=base64.b64decode(audio),
                media_type="audio/mpeg",
                headers={"X-Speech-Provider": "sarvam"},
            )
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "Sarvam TTS rejected the request (%s): %s",
                exc.response.status_code,
                exc.response.text[:500],
            )
            logger.warning("Sarvam TTS failed; falling back to Google TTS.")
        except (httpx.HTTPError, ValueError, KeyError, base64.binascii.Error) as exc:
            logger.warning("Sarvam TTS failed; falling back to Google TTS: %s", exc)

    try:
        tts = gTTS(text=clean, lang=lang, tld=tld)
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        return Response(content=buf.getvalue(), media_type="audio/mpeg")
    except Exception as exc:
        logger.error("TTS generation failed: %s", exc)
        raise HTTPException(status_code=500, detail="Unable to generate speech audio right now.") from exc


@router.post("/stt")
async def speech_to_text(
    audio: UploadFile = File(...),
    language: str = Form(default="hi"),
):
    """Transcribes a recorded audio upload with Sarvam Saaras."""
    if not settings.sarvam_ai_api_key:
        raise HTTPException(status_code=503, detail="Sarvam AI is not configured.")

    content = await audio.read()
    if not content:
        raise HTTPException(status_code=400, detail="Audio cannot be empty.")

    language_code = "hi-IN" if language == "hi" else "en-IN"
    filename = audio.filename or "recording.webm"
    content_type = audio.content_type or "audio/webm"
    try:
        response = httpx.post(
            f"{SARVAM_API_URL}/speech-to-text",
            headers={"api-subscription-key": settings.sarvam_ai_api_key},
            files={"file": (filename, content, content_type)},
            data={"model": "saaras:v2", "language_code": language_code},
            timeout=60,
        )
        response.raise_for_status()
        result = response.json()
        return {
            "success": True,
            "transcript": result.get("transcript", ""),
            "language_code": result.get("language_code", language_code),
            "provider": "sarvam",
        }
    except httpx.HTTPError as exc:
        logger.error("Sarvam STT failed: %s", exc)
        raise HTTPException(status_code=502, detail="Unable to transcribe audio right now.") from exc
