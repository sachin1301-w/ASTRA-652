"""
Local image storage service.

This is the temporary stand-in for cloud object storage. Swap
`save_uploaded_image` for an S3-backed `upload_to_s3(file) -> str` (returning
an S3 key/URL instead of a local path) once the AWS integration phase starts -
callers only need the returned path/reference, not how it was stored.
"""

import os
import re
import uuid

from fastapi import HTTPException, UploadFile

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def _sanitize_filename(filename: str) -> str:
    name = os.path.basename(filename or "upload")
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    return name or "upload"


async def save_uploaded_image(file: UploadFile) -> str:
    """
    Validates and saves a single uploaded image to local temporary storage.
    Returns the absolute path to the saved file.
    """
    original_name = _sanitize_filename(file.filename or "")
    extension = os.path.splitext(original_name)[1].lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload a JPG, JPEG, or PNG image.",
        )

    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Image is too large. Please upload a file smaller than 5 MB.",
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{extension}"
    stored_path = os.path.join(UPLOAD_DIR, stored_name)

    with open(stored_path, "wb") as f:
        f.write(contents)

    return stored_path


def delete_image(path: str) -> None:
    """Best-effort cleanup - medical images are not retained after processing."""
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except OSError:
        pass
