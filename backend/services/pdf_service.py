"""
PDF text extraction via PyMuPDF (fitz). Handles the document formats the
frontend's client-side Tesseract.js OCR can't: text-layer PDFs (ITRs, bank
statements, loan agreements exported as PDF).
"""

import pymupdf


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Extracts all readable text from a PDF's pages. Raises ValueError if the
    PDF has no extractable text layer (e.g. a scanned image with no OCR) -
    callers should surface this as "could not read this document" rather
    than silently returning an empty analysis.
    """
    with pymupdf.open(stream=pdf_bytes, filetype="pdf") as doc:
        pages_text = [page.get_text() for page in doc]

    text = "\n".join(pages_text).strip()
    if not text:
        raise ValueError("No extractable text found in this PDF (it may be a scanned image).")
    return text
