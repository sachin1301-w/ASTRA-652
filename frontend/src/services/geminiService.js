import { authenticatedFetch } from './apiService'

const RAW_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').trim()
const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '').replace(/\/api$/, '')

export function buildDynamicContext({ twin, product, documentInsights }) {
  const parts = []
  if (twin) {
    const surplus = twin.monthlyIncome - twin.monthlyExpenses - twin.existingEmis
    const savedLoans = (twin.loans || []).map((item) => `- ${item.filename}: ${item.summary}`).join('\n')
    const savedPolicies = (twin.insurancePolicies || []).map((item) => `- ${item.filename}: ${item.summary}`).join('\n')
    parts.push(
      `User Profile:\nName: ${twin.name || 'Not provided'}\n` +
      `Employment: ${twin.employmentType || 'Not provided'}\n` +
      `Monthly Income: ₹${Number(twin.monthlyIncome || 0).toLocaleString('en-IN')}\n` +
      `Monthly Expenses: ₹${Number(twin.monthlyExpenses || 0).toLocaleString('en-IN')}\n` +
      `Existing EMI: ₹${Number(twin.existingEmis || 0).toLocaleString('en-IN')}\n` +
      `Monthly Insurance Premiums: ₹${Number(twin.monthlyInsurancePremiums || 0).toLocaleString('en-IN')}\n` +
      `Monthly Surplus: ₹${surplus.toLocaleString('en-IN')}\n` +
      `Savings: ₹${Number(twin.savings || 0).toLocaleString('en-IN')}\n` +
      `Investments: ₹${Number(twin.investments || 0).toLocaleString('en-IN')}\n` +
      `Credit Score: ${twin.creditScore || 'Not provided'}\n` +
      `Risk Tolerance: ${twin.riskTolerance || 'Not provided'}\n` +
      `Financial Goals: ${twin.goals || 'Not provided'}` +
      (savedLoans ? `\n\nSaved Loans:\n${savedLoans}` : '') +
      (savedPolicies ? `\n\nSaved Insurance Policies:\n${savedPolicies}` : ''),
    )
  }
  if (product) {
    parts.push(
      `Selected Product:\n${product.name} ₹${Number(product.amount).toLocaleString('en-IN')}\n` +
      `Interest Rate: ${product.rate}%\nTenure: ${product.tenureMonths} Months\n` +
      `Estimated EMI: ₹${Number(product.emi).toLocaleString('en-IN')}`,
    )
  }
  if (documentInsights) parts.push(`Document Insights:\n${documentInsights}`)
  return parts.join('\n\n')
}

export function buildDocumentContextMessage(documentSummary, fields, risks) {
  const fieldLines = Object.entries(fields || {})
    .filter(([, value]) => value)
    .map(([key, value]) => `- ${key.replace(/_/g, ' ')}: ${value}`)
    .join('\n')
  const riskLines = (risks || []).map((risk) => `- ${risk}`).join('\n')
  return `Uploaded document summary: ${documentSummary}\n${fieldLines ? `Key details:\n${fieldLines}\n` : ''}${riskLines ? `Flagged items:\n${riskLines}` : ''}`
}

export async function sendMessage({ question, language, dynamicContext, model }) {
  const response = await authenticatedFetch(`${API_BASE_URL}/api/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, language, dynamic_context: dynamicContext || '', model }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || 'Gemini is unavailable right now. Please try again.')
  return { text: data.answer, model: data.model }
}
