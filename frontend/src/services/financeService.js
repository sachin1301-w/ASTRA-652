import { authenticatedFetch } from './apiService'

/**
 * Client-side mirror of backend/services/finance_calculations.py, for
 * instant slider feedback in the What-If Simulator - a network round-trip
 * per slider tick would be laggy. Keep these two implementations in sync;
 * the backend copy is the source of truth for "official" analysis results
 * (e.g. the Product Explorer's "Analyze For Me" button calls the API).
 */

export function calculateEmi(principal, annualRatePercent, tenureMonths) {
  if (tenureMonths <= 0) return 0
  const monthlyRate = annualRatePercent / 12 / 100
  if (monthlyRate === 0) return Math.round((principal / tenureMonths) * 100) / 100
  const factor = Math.pow(1 + monthlyRate, tenureMonths)
  return Math.round(((principal * monthlyRate * factor) / (factor - 1)) * 100) / 100
}

export function calculateTotalInterest(principal, emi, tenureMonths) {
  return Math.round((emi * tenureMonths - principal) * 100) / 100
}

export function calculateDti(existingEmis, newEmi, monthlyIncome) {
  if (monthlyIncome <= 0) return 100
  return Math.round(((existingEmis + newEmi) / monthlyIncome) * 1000) / 10
}

export function calculateAffordability(dtiPercent) {
  if (dtiPercent <= 35) return 'Safe'
  if (dtiPercent <= 50) return 'Moderate'
  if (dtiPercent <= 65) return 'Stretched'
  return 'High Risk'
}

export const AFFORDABILITY_COLOR = {
  Safe: 'text-brand-green',
  Moderate: 'text-brand-blue',
  Stretched: 'text-amber-600',
  'High Risk': 'text-red-600',
}

export function calculateHealthScore({ monthlyIncome, monthlyExpenses, existingEmis, savings }) {
  const surplus = monthlyIncome - monthlyExpenses - existingEmis
  const savingsRatio = monthlyIncome > 0 ? (surplus / monthlyIncome) * 100 : 0
  const debtRatio = monthlyIncome > 0 ? (existingEmis / monthlyIncome) * 100 : 100
  const emergencyFundMonths = monthlyExpenses > 0 ? savings / monthlyExpenses : 0

  const savingsScore = Math.max(0, Math.min(35, savingsRatio * 1.2))
  const debtScore = Math.max(0, 35 - debtRatio * 0.7)
  const emergencyScore = Math.max(0, Math.min(30, emergencyFundMonths * 6))
  const score = Math.max(0, Math.min(100, Math.round(savingsScore + debtScore + emergencyScore)))

  return {
    score,
    incomeStability: monthlyIncome > 0 ? 'Good' : 'Unknown',
    savings: savingsRatio >= 25 ? 'Good' : savingsRatio >= 10 ? 'Moderate' : 'Low',
    debtBurden: debtRatio <= 20 ? 'Low' : debtRatio <= 40 ? 'Moderate' : 'High',
    cashFlow: surplus > 0 ? 'Healthy' : 'Tight',
  }
}

const RAW_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').trim()
const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '').replace(/\/api$/, '')

async function parseJsonOrThrow(response, fallbackMessage) {
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error || fallbackMessage)
  }
  return data
}

/**
 * Stage 1: upload a document for text extraction.
 * @param {{ documentType: string, file?: File, extractedText?: string }} params
 */
export async function uploadDocument({ documentType, file, extractedText }) {
  const formData = new FormData()
  formData.append('document_type', documentType)
  if (file) formData.append('file', file)
  if (extractedText) formData.append('extracted_text', extractedText)

  const response = await authenticatedFetch(`${API_BASE_URL}/api/documents/upload`, { method: 'POST', body: formData })
  return parseJsonOrThrow(response, 'Unable to process this document. Please try another file.')
}

/** Stage 2: run structured financial extraction on an uploaded document. */
export async function analyzeDocument(documentId, model) {
  const formData = new FormData()
  formData.append('document_id', documentId)
  if (model) formData.append('model', model)
  const response = await authenticatedFetch(`${API_BASE_URL}/api/documents/analyze`, { method: 'POST', body: formData })
  return parseJsonOrThrow(response, 'Unable to analyze this document right now.')
}

export async function getDocument(documentId) {
  const response = await authenticatedFetch(`${API_BASE_URL}/api/documents/${documentId}`)
  return parseJsonOrThrow(response, 'Document not found.')
}

/** Lists every document the current user has uploaded, optionally filtered by document type. */
export async function listDocuments(documentType) {
  const url = new URL(`${API_BASE_URL}/api/documents`)
  if (documentType && documentType !== 'all') url.searchParams.append('document_type', documentType)
  const response = await authenticatedFetch(url.toString())
  return parseJsonOrThrow(response, 'Unable to load your documents.')
}

export async function deleteDocument(documentId) {
  const response = await authenticatedFetch(`${API_BASE_URL}/api/documents/${documentId}`, { method: 'DELETE' })
  return parseJsonOrThrow(response, 'Unable to delete this document.')
}

/** Generates a structured Hindi explanation and speech audio script for a document. */
export async function getHindiDocumentExplanation(documentId, model) {
  const url = new URL(`${API_BASE_URL}/api/documents/${documentId}/hindi-explanation`)
  if (model) url.searchParams.append('model', model)
  const response = await authenticatedFetch(url.toString(), { method: 'POST' })
  return parseJsonOrThrow(response, 'Unable to generate Hindi explanation right now.')
}


export async function getProfile(userId) {
  const response = await authenticatedFetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(userId)}`)
  return parseJsonOrThrow(response, 'Unable to load your financial profile.')
}

export async function updateProfile(userId, patch) {
  const response = await authenticatedFetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return parseJsonOrThrow(response, 'Unable to update your financial profile.')
}

export async function saveProfileAsset(userId, assetType, asset) {
  const endpoint = assetType === 'loan_agreement' ? 'loans' : 'insurance'
  const response = await authenticatedFetch(`${API_BASE_URL}/api/profile/${encodeURIComponent(userId)}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: asset.id,
      filename: asset.filename,
      summary: asset.summary,
      fields: asset.fields || {},
      risks: asset.risks || [],
    }),
  })
  return parseJsonOrThrow(response, 'Unable to save this document to your profile.')
}

export async function downloadDocument(documentId, filename) {
  const response = await authenticatedFetch(`${API_BASE_URL}/api/documents/${documentId}/download`)
  if (!response.ok) return parseJsonOrThrow(response, 'Unable to download this document.')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename || 'financial-document'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
