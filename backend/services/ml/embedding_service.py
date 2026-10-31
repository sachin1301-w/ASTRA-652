"""
Cited Answers and Semantic Retrieval Service using Multilingual E5 Small.
Handles text chunking (120-180 words with overlap), normalized cosine embeddings,
isolated multi-tenant storage, and strict citation provenance for FinLens AI.
"""

import logging
import re
from typing import Any, Dict, List, Optional

import numpy as np
from sqlalchemy import delete, select

from config import settings
from models.db import DocumentChunk, get_session
from services.ml.pii_service import mask_pii
from services.ml.registry import registry

logger = logging.getLogger(__name__)


def chunk_text(
    text: str,
    target_words: int = 150,
    overlap_words: int = 20,
    default_page: int = 1,
) -> List[Dict[str, Any]]:
    """
    Splits text into chunks of 120 to 180 words with 20 words overlap.
    Preserves page numbers (if marked) and detects short headings.
    """
    if not text or not text.strip():
        return []

    # Check for page markers like '--- Page 1 ---' or form-feeds '\x0c'
    page_splits = re.split(r"(?:---+\s*Page\s+(\d+)\s*---+|\f)", text)
    pages: List[tuple[int, str]] = []

    if len(page_splits) > 1:
        current_page = default_page
        for part in page_splits:
            if not part:
                continue
            if part.isdigit():
                current_page = int(part)
            else:
                pages.append((current_page, part))
    else:
        pages.append((default_page, text))

    chunks: List[Dict[str, Any]] = []

    for page_num, page_content in pages:
        lines = page_content.split("\n")
        current_heading = ""
        words: List[str] = []

        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue

            # Detect short headings: <= 60 chars, markdown # or title/uppercase
            if len(line_str) <= 60 and (
                line_str.startswith("#")
                or line_str.isupper()
                or (line_str.istitle() and not line_str.endswith("."))
            ):
                current_heading = line_str.lstrip("#").strip()

            line_words = line_str.split()
            words.extend(line_words)

        if not words:
            continue

        idx = 0
        step = max(1, target_words - overlap_words)
        while idx < len(words):
            chunk_words = words[idx : idx + target_words]
            chunk_str = " ".join(chunk_words)
            if chunk_str.strip():
                chunks.append(
                    {
                        "page": page_num,
                        "heading": current_heading,
                        "text": chunk_str,
                    }
                )
            idx += step
            if idx >= len(words):
                break

    return chunks


def index_document_chunks(
    user_id: str,
    document_id: str,
    filename: str,
    extracted_text: str,
) -> int:
    """
    Chunks and embeds extracted text using multilingual-e5-small.
    Masks PII before storing chunks. Stores vectors in SQLite.
    Returns the number of chunks indexed.
    """
    if not extracted_text or not extracted_text.strip():
        return 0

    chunks = chunk_text(extracted_text)
    if not chunks:
        return 0

    # Check if embedding model is enabled and available
    model = registry.get("embeddings")
    embeddings_list = []

    if model is not None:
        try:
            # E5 requires the prefix "passage: "
            passages = [f"passage: {c['text']}" for c in chunks]
            vectors = model.encode(passages, normalize_embeddings=True)
            embeddings_list = [v.tolist() for v in vectors]
        except Exception as e:
            logger.warning(f"Failed to generate embeddings for document {document_id}: {e}")
            embeddings_list = [[] for _ in chunks]
    else:
        embeddings_list = [[] for _ in chunks]

    with get_session() as session:
        # Clear any existing chunks for this document to avoid duplicates
        session.execute(
            delete(DocumentChunk).where(
                DocumentChunk.document_id == document_id,
                DocumentChunk.user_id == user_id,
            )
        )

        for chunk_data, emb in zip(chunks, embeddings_list):
            # Mask sensitive PII before persisting searchable chunk text
            masked_chunk, _ = mask_pii(chunk_data["text"])
            doc_chunk = DocumentChunk(
                user_id=user_id,
                document_id=document_id,
                filename=filename,
                page=chunk_data["page"],
                heading=chunk_data.get("heading", ""),
                text=masked_chunk,
                embedding=emb,
            )
            session.add(doc_chunk)

        session.commit()

    return len(chunks)


def delete_document_chunks(user_id: str, document_id: str) -> None:
    """Deletes all indexed chunks for a deleted document."""
    with get_session() as session:
        session.execute(
            delete(DocumentChunk).where(
                DocumentChunk.document_id == document_id,
                DocumentChunk.user_id == user_id,
            )
        )
        session.commit()


def retrieve(user_id: str, question: str, k: int = 4) -> List[Dict[str, Any]]:
    """
    Retrieves the top k most relevant chunks strictly belonging to user_id.
    Uses cosine similarity (dot product of normalized vectors, dimension 384).
    Returns sources: [{document_id, filename, page, snippet, score}].
    """
    if not question or not question.strip():
        return []

    model = registry.get("embeddings")
    if model is None:
        return []

    try:
        # E5 requires the prefix "query: "
        query_vec = model.encode([f"query: {question.strip()}"], normalize_embeddings=True)[0]
    except Exception as e:
        logger.warning(f"Failed to encode query embedding: {e}")
        return []

    with get_session() as session:
        chunks = session.scalars(
            select(DocumentChunk).where(
                DocumentChunk.user_id == user_id,
            )
        ).all()

        if not chunks:
            return []

        scored_chunks = []
        for c in chunks:
            if not c.embedding or len(c.embedding) == 0:
                continue
            emb_arr = np.array(c.embedding, dtype=np.float32)
            score = float(np.dot(query_vec, emb_arr))
            scored_chunks.append((score, c))

        if not scored_chunks:
            return []

        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        top_k = scored_chunks[:k]

        results = []
        for score, c in top_k:
            results.append(
                {
                    "document_id": c.document_id,
                    "filename": c.filename,
                    "page": c.page,
                    "snippet": c.text[:200].strip(),
                    "score": round(score, 4),
                }
            )

        return results
