import logging
from typing import Optional

import os

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import func, select

from models.db import (
    Document,
    DocumentBinary,
    DocumentOwner,
    InsurancePolicy,
    Loan,
    User,
    UserProfile,
    get_session,
)
from models.schemas import (
    DocumentListResponse,
    DocumentOut,
    DocumentSummaryOut,
    DocumentType,
    DocumentUploadResponse,
    HindiExplanationResponse,
)
from services import finance_extraction_service, pdf_service
from services.cognee_service import CogneeUnavailableError, cognee_service
from services.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_PDF_TYPES = {"application/pdf"}
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png"}
MAX_FILE_BYTES = 10 * 1024 * 1024


def _owned_document(session, document_id: str, user_id: str) -> Document:
    document = session.get(Document, document_id)
    owner = session.get(DocumentOwner, document_id)
    if document is None or owner is None or owner.user_id != user_id:
        raise HTTPException(status_code=404, detail="Document not found.")
    return document


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    document_type: DocumentType = Form(...),
    file: Optional[UploadFile] = File(None),
    extracted_text: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
):
    """
    Stage 1 of 2: extract text and store it (unanalyzed). PDFs are extracted
    here via PyMuPDF; for images, the frontend already ran Tesseract.js
    client-side and passes the result as `extracted_text` - this endpoint
    never re-implements image OCR server-side.
    """
    text = ""

    contents = None
    content_type = None
    if file is not None and file.filename:
        contents = await file.read()
        if len(contents) > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail="File is too large. Maximum size is 10 MB.")
        content_type = file.content_type or "application/octet-stream"
        is_pdf = content_type in ALLOWED_PDF_TYPES or file.filename.lower().endswith(".pdf")
        is_image = content_type in ALLOWED_IMAGE_TYPES or file.filename.lower().endswith((".jpg", ".jpeg", ".png"))
        if is_image and content_type == "application/octet-stream":
            content_type = "image/png" if file.filename.lower().endswith(".png") else "image/jpeg"
        if not is_pdf and not is_image:
            raise HTTPException(
                status_code=400,
                detail="Unable to process this document. Please try another file.",
            )
        if is_pdf:
            try:
                text = pdf_service.extract_text_from_pdf(contents)
            except ValueError:
                # Scanned or non-text PDF - Gemini will process the file directly during analysis
                text = ""
        elif extracted_text and extracted_text.strip():
            text = extracted_text.strip()
        else:
            # Images will be analyzed directly by Gemini Vision
            text = ""
    elif extracted_text and extracted_text.strip():
        text = extracted_text.strip()
    else:
        raise HTTPException(
            status_code=400,
            detail="A file or extracted text is required.",
        )

    with get_session() as session:
        document = Document(
            filename=(file.filename if file else "uploaded-document"),
            document_type=document_type,
            extracted_text=text,
        )
        session.add(document)
        session.flush()
        session.add(DocumentOwner(document_id=document.id, user_id=user.id))
        if contents is not None:
            session.add(DocumentBinary(document_id=document.id, content_type=content_type, data=contents))
        session.commit()
        session.refresh(document)

        return DocumentUploadResponse(
            success=True,
            id=document.id,
            filename=document.filename,
            document_type=document.document_type,
            summary="",
            fields={},
            risks=[],
        )


async def _sync_document_to_memory(
    document_id: str, user_id: str, document_type: str, summary: str, fields: dict, extracted_text: str
) -> None:
    """Pushes an analyzed document's content into the user's Cognee financial
    memory and cognifies it. Runs as a FastAPI background task, strictly
    after the analyze response has already been sent - a Cognee failure here
    must never turn into a broken/slow upload for the user (per the
    graceful-fallback requirement); it's only recorded on the document row
    for the frontend to surface as a status badge.
    """
    memory_text_parts = [f"Document type: {document_type}"]
    if summary:
        memory_text_parts.append(f"Summary: {summary}")
    for key, value in (fields or {}).items():
        if value:
            memory_text_parts.append(f"{key.replace('_', ' ').title()}: {value}")
    if extracted_text:
        memory_text_parts.append(f"Full text:\n{extracted_text[:8000]}")
    memory_text = "\n".join(memory_text_parts)

    try:
        await cognee_service.add_document(
            user_id, memory_text, metadata={"document_id": document_id, "document_type": document_type}
        )
        await cognee_service.process_document(user_id)
        status, error = "added", None
    except CogneeUnavailableError as exc:
        status, error = "disabled", str(exc)
    except Exception as exc:  # noqa: BLE001 - background task; must not propagate
        logger.warning("Cognee memory sync failed for document %s: %s", document_id, exc)
        status, error = "failed", str(exc)[:2000]

    with get_session() as session:
        document = session.get(Document, document_id)
        if document is not None:
            document.memory_status = status
            document.memory_error = error
            session.commit()


@router.post("/analyze", response_model=DocumentUploadResponse)
async def analyze_document(
    background_tasks: BackgroundTasks,
    document_id: str = Form(...),
    model: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
):
    """Stage 2 of 2: runs Gemini multimodal structured extraction on a previously uploaded document."""
    with get_session() as session:
        document = _owned_document(session, document_id, user.id)
        stored_file = session.get(DocumentBinary, document_id)

        file_bytes = stored_file.data if stored_file else None
        mime_type = stored_file.content_type if stored_file else None

        try:
            result = await finance_extraction_service.extract_financial_data(
                document.document_type,
                document.extracted_text,
                file_bytes=file_bytes,
                mime_type=mime_type,
                model=model,
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        document.summary = result["summary"]
        document.fields = result["fields"]
        document.risks = result["risks"]
        if result.get("extracted_text"):
            document.extracted_text = result["extracted_text"]
        document.memory_status = "pending"
        document.memory_error = None
        session.commit()
        session.refresh(document)

        background_tasks.add_task(
            _sync_document_to_memory,
            document.id,
            user.id,
            document.document_type,
            document.summary,
            document.fields,
            document.extracted_text,
        )

        return DocumentUploadResponse(
            success=True,
            id=document.id,
            filename=document.filename,
            document_type=document.document_type,
            summary=document.summary,
            fields=document.fields,
            risks=document.risks,
        )


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    document_type: Optional[DocumentType] = None,
    user: User = Depends(get_current_user),
):
    """Returns every document the user has uploaded, across all document types."""
    with get_session() as session:
        query = (
            select(Document)
            .join(DocumentOwner, DocumentOwner.document_id == Document.id)
            .where(DocumentOwner.user_id == user.id)
            .order_by(Document.created_at.desc())
        )
        if document_type:
            query = query.where(Document.document_type == document_type)
        documents = session.scalars(query).all()

        # Select content_type/length only - avoids loading every file's binary data into memory.
        binary_rows = session.execute(
            select(DocumentBinary.document_id, DocumentBinary.content_type, func.length(DocumentBinary.data))
        ).all()
        binary_meta = {row[0]: (row[1], row[2]) for row in binary_rows}

        items = [
            DocumentSummaryOut(
                id=document.id,
                filename=document.filename,
                document_type=document.document_type,
                summary=document.summary,
                processing_status="analyzed" if (document.summary or document.fields) else "uploaded",
                has_file=document.id in binary_meta,
                content_type=binary_meta.get(document.id, (None, None))[0],
                file_size=binary_meta.get(document.id, (None, None))[1],
                created_at=document.created_at,
                risks_count=len(document.risks or []),
                memory_status=document.memory_status,
            )
            for document in documents
        ]
        return DocumentListResponse(success=True, documents=items)


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(document_id: str, user: User = Depends(get_current_user)):
    with get_session() as session:
        document = _owned_document(session, document_id, user.id)
        return DocumentOut(
            id=document.id,
            filename=document.filename,
            document_type=document.document_type,
            summary=document.summary,
            fields=document.fields,
            risks=document.risks,
            extracted_text=document.extracted_text,
            memory_status=document.memory_status,
            memory_error=document.memory_error,
        )


@router.get("/{document_id}/download")
async def download_document(document_id: str, user: User = Depends(get_current_user)):
    with get_session() as session:
        document = _owned_document(session, document_id, user.id)
        stored_file = session.get(DocumentBinary, document_id)
        if stored_file is None:
            raise HTTPException(status_code=404, detail="The original file is not available for download.")
        filename = os.path.basename(document.filename).replace('"', "") or "document"
        return Response(
            content=stored_file.data,
            media_type=stored_file.content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )


@router.delete("/{document_id}")
async def delete_document(document_id: str, user: User = Depends(get_current_user)):
    """Deletes a document and its file, and unwinds any Financial Twin totals it contributed."""
    with get_session() as session:
        document = _owned_document(session, document_id, user.id)

        loan = session.scalar(
            select(Loan).where(Loan.user_id == user.id, Loan.document_id == document_id)
        )
        if loan is not None:
            profile = session.get(UserProfile, user.id)
            if profile is not None:
                profile.existing_emis = max(0.0, profile.existing_emis - loan.monthly_emi)
            session.delete(loan)

        policy = session.scalar(
            select(InsurancePolicy).where(
                InsurancePolicy.user_id == user.id, InsurancePolicy.document_id == document_id
            )
        )
        if policy is not None:
            profile = session.get(UserProfile, user.id)
            if profile is not None:
                profile.monthly_insurance_premiums = max(0.0, profile.monthly_insurance_premiums - policy.monthly_premium)
                profile.monthly_expenses = max(0.0, profile.monthly_expenses - policy.monthly_premium)
            session.delete(policy)

        stored_file = session.get(DocumentBinary, document_id)
        if stored_file is not None:
            session.delete(stored_file)

        owner = session.get(DocumentOwner, document_id)
        if owner is not None:
            session.delete(owner)

        session.delete(document)
        session.commit()
        return {"success": True}


@router.post("/{document_id}/hindi-explanation", response_model=HindiExplanationResponse)
async def get_document_hindi_explanation(
    document_id: str,
    model: Optional[str] = None,
    user: User = Depends(get_current_user),
):
    """Generates an easy-to-understand Hindi explanation and spoken audio script for the document."""
    with get_session() as session:
        document = _owned_document(session, document_id, user.id)
        explanation = await finance_extraction_service.explain_document_in_hindi(
            document_type=document.document_type,
            summary=document.summary,
            fields=document.fields,
            risks=document.risks,
            extracted_text=document.extracted_text,
            model=model,
        )
        return HindiExplanationResponse(
            success=True,
            document_id=document.id,
            hindi_title=explanation["hindi_title"],
            hindi_summary=explanation["hindi_summary"],
            key_points=explanation["key_points"],
            risks=explanation["risks"],
            spoken_text=explanation["spoken_text"],
        )

