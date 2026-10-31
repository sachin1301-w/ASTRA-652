import { Cpu } from 'lucide-react'
import { GEMINI_MODELS } from '../services/geminiModels'

export default function GeminiModelSelector({ value, onChange, compact = false }) {
  return (
    <label className={`flex items-center gap-2 ${compact ? '' : 'rounded-xl border border-brand-blue-light bg-white p-3'}`}>
      <Cpu className="h-4 w-4 shrink-0 text-brand-blue" aria-hidden="true" />
      {!compact && <span className="text-sm font-semibold text-brand-ink">Gemini model</span>}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Gemini model"
        className={`${compact ? 'max-w-32 bg-brand-blue-light px-2 py-1.5 text-xs' : 'ml-auto bg-brand-beige px-3 py-2 text-sm'} rounded-lg font-semibold text-brand-blue-dark outline-none ring-brand-blue focus:ring-2`}
      >
        {GEMINI_MODELS.map((model) => (
          <option key={model.value} value={model.value}>
            {model.label}{compact ? '' : ` — ${model.hint}`}
          </option>
        ))}
      </select>
    </label>
  )
}
