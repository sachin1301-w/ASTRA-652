"""Background document processing used by the automatic upload workflow."""

import logging

from config import settings
from models.db import Document, DocumentBinary, get_session
from services import finance_extraction_service
from services.cognee_service import CogneeUnavailableError, cognee_service
from services.ml.embedding_service import index_document_chunks
from services.ml.pii_service import mask_pii

logger = logging.getLogger(__name__)


async def process_document(document_id: str, user_id: str, model: str | None = None) -> None:
    """Extract, index, and sync one uploaded document without blocking upload."""
    with get_session() as session:
        document = session.get(Document, document_id)
        stored_file = session.get(DocumentBinary, document_id)
        if document is None:
            return
        document.memory_status = "pending"
        session.commit()
        document_type = document.document_type
        text, filename = document.extracted_text or "", document.filename
        file_bytes = stored_file.data if stored_file else None
        mime_type = stored_file.content_type if stored_file else None

    masked_text, pii_report = mask_pii(text)
    try:
        result = await finance_extraction_service.extract_financial_data(
            document_type, masked_text, file_bytes=file_bytes, mime_type=mime_type, model=model
        )
        extracted = result.get("extracted_text") or text
        masked_extracted, extracted_pii = mask_pii(extracted)
        with get_session() as session:
            document = session.get(Document, document_id)
            if document is None:
                return
            document.summary = result["summary"]
            document.fields = result["fields"]
            document.risks = result["risks"]
            document.pii_report = pii_report if pii_report.get("total", 0) else extracted_pii
            document.extraction_method = result.get("extraction_method", "gemini")
            document.extracted_text = masked_extracted if settings.store_masked_text else extracted
            session.commit()
            indexed_text = document.extracted_text
            summary, fields = document.summary, document.fields
        try:
            index_document_chunks(user_id, document_id, filename, indexed_text)
        except Exception as exc:
            logger.warning("Automatic document indexing failed for %s: %s", document_id, exc)
        memory_text = f"Document type: {document_type}\nSummary: {summary}\n{fields}\nFull text:\n{indexed_text[:8000]}"
        await cognee_service.add_document(user_id, mask_pii(memory_text)[0], metadata={"document_id": document_id})
        await cognee_service.process_document(user_id)
        memory_status, memory_error = "added", None
    except CogneeUnavailableError as exc:
        memory_status, memory_error = "disabled", str(exc)
    except Exception as exc:
        logger.exception("Automatic document processing failed for %s", document_id)
        memory_status, memory_error = "failed", str(exc)[:2000]

    with get_session() as session:
        document = session.get(Document, document_id)
        if document is not None:
            document.memory_status = memory_status
            document.memory_error = memory_error
            session.commit()
