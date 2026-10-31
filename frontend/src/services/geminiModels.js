export const GEMINI_MODELS = [
  { value: 'gemini-3.8-flash', label: '3.8 Flash', hint: 'Newest' },
  { value: 'gemini-3.6-flash', label: '3.6 Flash', hint: 'Recommended' },
  { value: 'gemini-3.5-flash', label: '3.5 Flash', hint: 'Balanced' },
  { value: 'gemini-3.5-flash-lite', label: '3.5 Flash-Lite', hint: 'Lowest cost' },
]

export function geminiModelLabel(value) {
  return GEMINI_MODELS.find((model) => model.value === value)?.label || value
}
