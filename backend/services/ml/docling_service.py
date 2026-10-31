"""
Offline Document Reader Fallback using IBM Granite Docling 258M.
Renders scanned PDF/image pages at 150 DPI with PyMuPDF, converts to DocTags with
granite-docling-258M, and transforms to clean Markdown via docling-core.
English/Latin script only. Thread-safe execution with configurable timeout.
"""

import concurrent.futures
import io
import logging
from typing import Any, List, Optional


import fitz  # PyMuPDF
from PIL import Image

from config import settings
from services.ml.registry import registry

logger = logging.getLogger(__name__)


def _render_pages_to_images(file_bytes: bytes, mime_type: str, max_pages: int = 3) -> List[Image.Image]:
    """Renders up to max_pages from PDF or single image to PIL Images at ~150 DPI."""
    images: List[Image.Image] = []
    if "pdf" in mime_type.lower() or file_bytes[:4] == b"%PDF":
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        total_pages = min(len(doc), max_pages)
        for i in range(total_pages):
            page = doc.load_page(i)
            # 150 DPI matrix (72 * 2.0833 ~ 150)
            zoom = 150 / 72
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
            images.append(img)
        doc.close()
    else:
        try:
            img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
            images.append(img)
        except Exception as e:
            logger.warning(f"Could not open image for docling: {e}")
    return images


def _process_single_page(processor: Any, model: Any, image: Image.Image) -> str:
    """Runs Granite Docling vision-text model on one image and converts DocTags to Markdown."""
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image"},
                {"type": "text", "text": "Convert this page to docling."},
            ],
        }
    ]
    prompt = processor.apply_chat_template(messages, add_generation_prompt=True)
    inputs = processor(text=prompt, images=[image], return_tensors="pt")

    # Move to model device
    if hasattr(model, "device"):
        inputs = inputs.to(model.device)

    # Generate doctags
    generated_ids = model.generate(**inputs, max_new_tokens=4096)
    prompt_length = inputs.input_ids.shape[1]
    trimmed_ids = generated_ids[:, prompt_length:]
    doctags = processor.batch_decode(trimmed_ids, skip_special_tokens=False)[0].lstrip()

    # Convert doctags to Markdown using docling-core
    try:
        from docling_core.types.doc import DoclingDocument
        from docling_core.types.doc.document import DocTagsDocument

        doctags_doc = DocTagsDocument.from_doctags_and_image_pairs([doctags], [image])
        doc = DoclingDocument.load_from_doctags(doctags_doc, document_name="Document")
        return doc.export_to_markdown()
    except Exception as e:
        logger.warning(f"docling-core export_to_markdown failed: {e}. Falling back to clean doctags.")
        import re
        clean_text = re.sub(r"<[^>]+>", " ", doctags)
        return " ".join(clean_text.split())


def _convert_document_sync(file_bytes: bytes, mime_type: str, max_pages: int) -> Optional[str]:
    """Synchronous page-by-page inference loop."""
    docling_bundle = registry.get("docling")
    if not docling_bundle:
        return None

    processor = docling_bundle["processor"]
    model = docling_bundle["model"]

    images = _render_pages_to_images(file_bytes, mime_type, max_pages=max_pages)
    if not images:
        return None

    page_markdowns: List[str] = []
    for idx, img in enumerate(images, start=1):
        try:
            logger.info(f"Docling processing page {idx}/{len(images)}...")
            md = _process_single_page(processor, model, img)
            page_markdowns.append(f"--- Page {idx} ---\n\n{md}")
        except Exception as e:
            logger.error(f"Docling failed on page {idx}: {e}")
            page_markdowns.append(f"--- Page {idx} ---\n\n[Docling error reading page {idx}]")

    return "\n\n".join(page_markdowns)


def read_document_with_docling(
    file_bytes: bytes,
    mime_type: str = "application/pdf",
    timeout_seconds: int = 90,
) -> Optional[str]:
    """
    Executes offline Docling conversion in a thread pool with a timeout (default 90s).
    Returns markdown text or None if unavailable/timed out.
    """
    if not file_bytes:
        return None

    max_pages = settings.ml_max_pages_docling

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_convert_document_sync, file_bytes, mime_type, max_pages)
        try:
            result = future.result(timeout=timeout_seconds)
            return result
        except concurrent.futures.TimeoutError:
            logger.warning(f"Docling conversion timed out after {timeout_seconds}s")
            return None
        except Exception as e:
            logger.error(f"Docling conversion failed: {e}")
            return None
