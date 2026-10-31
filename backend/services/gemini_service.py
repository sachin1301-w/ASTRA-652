import base64
import json
import logging

import httpx

from config import settings

logger = logging.getLogger(__name__)

SUPPORTED_MODELS = (
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
)


class GeminiUnavailableError(RuntimeError):
    pass


def resolve_model(model: str | None = None) -> str:
    selected = model or settings.gemini_model
    if selected not in SUPPORTED_MODELS:
        raise ValueError(f"Unsupported Gemini model: {selected}")
    return selected


def _endpoint(model: str | None = None) -> str:
    return f"https://generativelanguage.googleapis.com/v1beta/models/{resolve_model(model)}:generateContent"


def _response_text(data: dict) -> str:
    try:
        return "".join(
            part.get("text", "")
            for part in data["candidates"][0]["content"]["parts"]
        ).strip()
    except (KeyError, IndexError, TypeError):
        return ""


def _http_error_message(exc: httpx.HTTPError, fallback: str) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        try:
            message = exc.response.json().get("error", {}).get("message", "").strip()
            if message:
                return message
        except (ValueError, AttributeError):
            pass
    return fallback


async def generate_text(
    prompt: str,
    *,
    temperature: float = 0.25,
    model: str | None = None,
    file_bytes: bytes | None = None,
    mime_type: str | None = None,
) -> str:
    if not settings.gemini_api_key:
        raise GeminiUnavailableError("GEMINI_API_KEY is not configured on the backend.")
    parts: list[dict] = [{"text": prompt}]
    if file_bytes and mime_type:
        parts.append({
            "inlineData": {
                "mimeType": mime_type,
                "data": base64.b64encode(file_bytes).decode("utf-8"),
            }
        })
    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": 2048},
    }

    models_to_try = [resolve_model(model)]
    for m in SUPPORTED_MODELS:
        if m not in models_to_try:
            models_to_try.append(m)

    last_exc = None
    for target_model in models_to_try:
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(
                    _endpoint(target_model),
                    headers={"x-goog-api-key": settings.gemini_api_key, "Content-Type": "application/json"},
                    json=payload,
                )
                response.raise_for_status()
                text = _response_text(response.json())
                if not text:
                    raise GeminiUnavailableError("Gemini returned an empty response.")
                return text
        except httpx.HTTPStatusError as exc:
            last_exc = exc
            if exc.response.status_code in (429, 500, 502, 503, 504) and target_model != models_to_try[-1]:
                logger.warning("Model %s returned HTTP %s; trying fallback model...", target_model, exc.response.status_code)
                continue
            logger.error("Gemini text generation failed on %s: %s", target_model, exc)
            raise GeminiUnavailableError(
                _http_error_message(exc, "Gemini is unavailable right now. Please try again.")
            ) from exc
        except httpx.HTTPError as exc:
            last_exc = exc
            logger.error("Gemini text generation failed: %s", exc)
            raise GeminiUnavailableError(
                _http_error_message(exc, "Gemini is unavailable right now. Please try again.")
            ) from exc

    if last_exc:
        raise GeminiUnavailableError("All available Gemini models are currently busy. Please retry in a few seconds.")


async def generate_json(
    prompt: str,
    *,
    model: str | None = None,
    file_bytes: bytes | None = None,
    mime_type: str | None = None,
) -> dict:
    if not settings.gemini_api_key:
        raise GeminiUnavailableError("GEMINI_API_KEY is not configured on the backend.")
    parts: list[dict] = [{"text": prompt}]
    if file_bytes and mime_type:
        parts.append({
            "inlineData": {
                "mimeType": mime_type,
                "data": base64.b64encode(file_bytes).decode("utf-8"),
            }
        })
    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 2048,
            "responseMimeType": "application/json",
        },
    }

    models_to_try = [resolve_model(model)]
    for m in SUPPORTED_MODELS:
        if m not in models_to_try:
            models_to_try.append(m)

    last_exc = None
    for target_model in models_to_try:
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(
                    _endpoint(target_model),
                    headers={"x-goog-api-key": settings.gemini_api_key, "Content-Type": "application/json"},
                    json=payload,
                )
                response.raise_for_status()
                text = _response_text(response.json())
                return json.loads(text)
        except httpx.HTTPStatusError as exc:
            last_exc = exc
            if exc.response.status_code in (429, 500, 502, 503, 504) and target_model != models_to_try[-1]:
                logger.warning("Model %s returned HTTP %s; trying fallback model...", target_model, exc.response.status_code)
                continue
            logger.error("Gemini structured generation failed on %s: %s", target_model, exc)
            raise GeminiUnavailableError(
                _http_error_message(exc, "Gemini could not analyze the document right now.")
            ) from exc
        except (json.JSONDecodeError, GeminiUnavailableError) as exc:
            last_exc = exc
            logger.error("Gemini structured generation failed on %s: %s", target_model, exc)
            raise GeminiUnavailableError("Gemini could not analyze the document right now.") from exc
        except httpx.HTTPError as exc:
            last_exc = exc
            logger.error("Gemini structured generation failed: %s", exc)
            raise GeminiUnavailableError(
                _http_error_message(exc, "Gemini could not analyze the document right now.")
            ) from exc

    if last_exc:
        raise GeminiUnavailableError("All available Gemini models are currently busy. Please retry in a few seconds.")
