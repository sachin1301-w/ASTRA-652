import { AlertTriangle, HeartHandshake } from 'lucide-react'
import LoadingSpinner from './LoadingSpinner'

const LOADING_LABEL = {
  en: 'Sahayak is thinking...',
  hi: 'Sahayak सोच रहा है...',
}

const TITLE = {
  en: "Sahayak's Response",
  hi: 'Sahayak का उत्तर',
}

export default function ResponseCard({ answer, language, isLoading, error }) {
  if (!isLoading && !error && !answer) return null

  return (
    <section className="rounded-xl border-2 border-brand-blue-light bg-white p-6" aria-live="polite">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue-light text-brand-blue-dark">
          <HeartHandshake className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold text-brand-ink">{TITLE[language] ?? TITLE.en}</h2>
      </div>

      {isLoading && <LoadingSpinner label={LOADING_LABEL[language] ?? LOADING_LABEL.en} />}

      {!isLoading && error && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4 text-red-800">
          <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0" aria-hidden="true" />
          <p className="text-lg">{error}</p>
        </div>
      )}

      {!isLoading && !error && answer && (
        <p className="whitespace-pre-wrap text-lg leading-relaxed text-brand-ink">{answer}</p>
      )}
    </section>
  )
}
