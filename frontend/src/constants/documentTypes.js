export const DOCUMENT_TYPES = [
  { value: 'itr', label: 'Income Tax Return (ITR)' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'salary_slip', label: 'Salary Slip' },
  { value: 'loan_agreement', label: 'Loan Agreement' },
  { value: 'insurance_policy', label: 'Insurance Policy' },
  { value: 'investment_statement', label: 'Investment Statement' },
  { value: 'credit_report', label: 'Credit Report' },
]

export function documentTypeLabel(value) {
  return DOCUMENT_TYPES.find((type) => type.value === value)?.label || value
}
