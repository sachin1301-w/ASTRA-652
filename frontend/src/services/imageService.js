/**
 * Document text extraction for uploaded financial documents.
 *
 * Files (PDFs and Images): uploaded directly to the backend, where
 * Gemini Multimodal Vision and PyMuPDF extract accurate financial fields,
 * tables, and currency data.
 */

import { uploadDocument } from './financeService'

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png']
export const ALLOWED_DOCUMENT_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf']
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

export function validateImageFile(file) {
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    return 'Please upload a JPG, JPEG, PNG, or PDF file.'
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'File is too large. Please upload a file smaller than 10 MB.'
  }
  return null
}

/**
 * Uploads a document (PDF or image) to the backend for Gemini-powered processing.
 *
 * @param {File} file
 * @param {string} documentType - one of the backend's DocumentType values
 * @param {(percent: number) => void} [onProgress]
 * @returns {Promise<{ status: 'success' | 'error', text?: string, documentId?: string, error?: string }>}
 */
export async function extractTextFromDocument(file, documentType, onProgress) {
  const validationError = validateImageFile(file)
  if (validationError) {
    return { status: 'error', error: validationError }
  }

  try {
    onProgress?.(30)
    const result = await uploadDocument({ documentType, file })
    onProgress?.(100)
    return { status: 'success', text: result.summary || 'Document uploaded.', documentId: result.id }
  } catch (error) {
    return {
      status: 'error',
      error: error.message || 'Unable to process this document. Please try another file.',
    }
  }
}
