"""
Cognee integration - the AI memory/knowledge-graph layer that sits on top of
the existing SQLite + local-file document storage (models/db.py). Cognee
does NOT replace that storage: routes/documents.py still saves the original
file and extracted text exactly as before. This module only feeds the
already-extracted text into Cognee so questions in the chatbox can be
answered using relationships *across* a user's documents, not just the one
most recently uploaded.

Two backends, selected by COGNEE_MODE:

- "local" (default): cognee's own local stack (v1.5.4 as installed) - LanceDB
  for vectors, a local graph store, SQLite for its own metadata. Everything
  stays on this machine; nothing here introduces MongoDB or any external
  service. Data lives under settings.cognee_data_path. Reuses this project's
  existing Gemini key via litellm for cognify's LLM calls and embeddings -
  verified working end-to-end against the real Gemini API.

- "cloud": connects to a Cognee Cloud tenant (cognee.serve(url, api_key)) -
  an explicit, opt-in deviation from "everything local", used because the
  account already has a Cognee Cloud subscription. Storage and LLM calls for
  ingestion/graph-building happen on Cognee's managed infrastructure
  (confirmed Postgres/pgvector/S3 - still not MongoDB) instead of this
  machine. Verified working end-to-end (remember + cross-document recall)
  against the real tenant before being wired in here.

Either way, every user gets an isolated Cognee "dataset"
(dataset_name=f"user_{id}_financial_memory"), so a search/recall call never
sees another user's documents.
"""

import asyncio
import logging
import os
import re
from dataclasses import dataclass

from config import settings

logger = logging.getLogger(__name__)

# Cognee's own multi-tenant/auth posture only applies to its optional
# self-hosted API server (a different thing from Cognee Cloud); it must be
# set before `import cognee` to have any effect. We never run that server
# here, but this is cheap insurance against a future version enforcing it
# for direct library/cloud-client calls too.
os.environ.setdefault("ENABLE_BACKEND_ACCESS_CONTROL", "false")

_configured = False
_backend_kind: str | None = None  # "local" | "cloud"
_backend = None  # the `cognee` module (local) or a CloudClient instance (cloud)


class CogneeUnavailableError(RuntimeError):
    pass


@dataclass
class FinancialContext:
    context_text: str
    chunk_count: int


def _dataset_name(user_id: str) -> str:
    """Cognee dataset names are used as identifiers; sanitize the app's user id
    (a uuid4 hex string, or a fixed demo id like 'demo-user-001') into one."""
    safe_id = re.sub(r"[^a-zA-Z0-9_]", "_", user_id)
    return f"user_{safe_id}_financial_memory"


async def _get_backend():
    """Lazily configures and caches the selected backend on first use, so the
    rest of the app doesn't pay cognee's import/connection cost when it's
    disabled or never used. Returns (kind, backend)."""
    global _configured, _backend_kind, _backend
    if _configured:
        return _backend_kind, _backend
    if not settings.cognee_enabled:
        raise CogneeUnavailableError("Cognee integration is disabled (COGNEE_ENABLED=false).")

    import cognee as cognee_module

    if settings.cognee_mode == "cloud":
        if not settings.cognee_cloud_url:
            raise CogneeUnavailableError("COGNEE_MODE=cloud requires COGNEE_CLOUD_URL to be set.")
        if not settings.cognee_api_key:
            raise CogneeUnavailableError("COGNEE_MODE=cloud requires COGNEE_API_KEY to be set.")
        client = await cognee_module.serve(url=settings.cognee_cloud_url, api_key=settings.cognee_api_key)
        _backend_kind, _backend = "cloud", client
    else:
        if not settings.cognee_llm_api_key:
            raise CogneeUnavailableError(
                "No LLM API key configured for local Cognee mode (set GEMINI_API_KEY)."
            )
        data_root = os.path.abspath(settings.cognee_data_path)
        cognee_module.config.system_root_directory(os.path.join(data_root, "system"))
        cognee_module.config.data_root_directory(os.path.join(data_root, "data"))

        cognee_module.config.set_llm_provider(settings.cognee_llm_provider)
        cognee_module.config.set_llm_model(f"{settings.cognee_llm_provider}/{settings.cognee_llm_model}")
        cognee_module.config.set_llm_api_key(settings.cognee_llm_api_key)

        cognee_module.config.set_embedding_provider(settings.cognee_embedding_provider)
        cognee_module.config.set_embedding_model(
            f"{settings.cognee_embedding_provider}/{settings.cognee_embedding_model}"
        )
        cognee_module.config.set_embedding_api_key(settings.cognee_llm_api_key)
        cognee_module.config.set_embedding_dimensions(settings.cognee_embedding_dimensions)
        _backend_kind, _backend = "local", cognee_module

    _configured = True
    return _backend_kind, _backend


def _extract_text(result) -> str | None:
    if isinstance(result, dict):
        return result.get("text")
    return getattr(result, "text", None)


class CogneeService:
    """Namespaces every call by user (dataset_name) and serializes access.

    Local mode's graph store (ladybug) is a single-writer embedded database
    that takes a file lock - it errors out if two calls overlap, even within
    this same process (e.g. two documents analyzed back to back, each
    scheduling a background sync). Cloud mode doesn't need this for
    correctness, but serializing costs little and keeps the two modes
    behaving the same way.
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()

    async def initialize(self) -> None:
        await _get_backend()

    async def add_document(self, user_id: str, document_text: str, metadata: dict | None = None) -> None:
        """Adds extracted document text to the user's Cognee dataset.

        Local mode: ingestion only - call process_document() after (usually
        several add_document calls, then one process_document) so relationship
        extraction runs once across everything just added.

        Cloud mode: cognee's remember() ingests AND builds the graph in one
        server-side call (asynchronously - it returns once queued, not once
        finished), so process_document() is a no-op for this mode.
        """
        if not document_text or not document_text.strip():
            raise CogneeUnavailableError("No extracted text to add to financial memory.")
        kind, backend = await _get_backend()
        dataset = _dataset_name(user_id)
        async with self._lock:
            if kind == "cloud":
                await backend.remember(document_text, dataset_name=dataset)
            else:
                await backend.add(document_text, dataset_name=dataset)

    async def process_document(self, user_id: str) -> None:
        """Runs cognify (chunking + entity/relationship extraction + graph
        build) over everything added so far for this user that hasn't been
        processed yet. No-op in cloud mode - remember() already did this."""
        kind, backend = await _get_backend()
        if kind == "cloud":
            return
        async with self._lock:
            await backend.cognify(datasets=[_dataset_name(user_id)])

    async def search(self, user_id: str, query: str, top_k: int = 8) -> list[str]:
        """Returns raw retrieved text chunks relevant to the query, scoped to
        this user's dataset only. Deliberately requests raw CHUNKS rather than
        one of Cognee's own *_COMPLETION/graph-answer modes: this app's
        existing Gemini-backed chat (routes/assistant.py) remains the
        component that reasons over context and produces the answer - Cognee's
        job here is retrieval only, per the intended architecture, regardless
        of which backend is active."""
        kind, backend = await _get_backend()
        dataset = _dataset_name(user_id)
        async with self._lock:
            if kind == "cloud":
                results = await backend.recall(query, query_type="CHUNKS", datasets=[dataset], top_k=top_k)
            else:
                results = await backend.search(
                    query_text=query,
                    query_type=backend.SearchType.CHUNKS,
                    datasets=[dataset],
                    top_k=top_k,
                )
        return [text for text in (_extract_text(result) for result in results) if text]

    async def get_financial_context(self, user_id: str, query: str) -> FinancialContext | None:
        """Convenience wrapper for routes/assistant.py: returns a single
        formatted context blob to drop into the Gemini prompt, or None if
        Cognee has nothing relevant (or isn't available) - callers should
        treat None as "fall back to context-free/profile-only chat", not as
        an error."""
        try:
            chunks = await self.search(user_id, query)
        except Exception as exc:  # noqa: BLE001 - Cognee failures must never break chat
            logger.warning("Cognee search unavailable, continuing without financial memory context: %s", exc)
            return None
        if not chunks:
            return None
        context_text = "\n".join(f"- {chunk}" for chunk in chunks)
        return FinancialContext(context_text=context_text, chunk_count=len(chunks))


cognee_service = CogneeService()
