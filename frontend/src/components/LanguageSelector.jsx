const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
]

export default function LanguageSelector({ language, onChange }) {
  return (
    <div role="radiogroup" aria-label="Select language" className="flex gap-2 rounded-full bg-brand-blue-light p-1">
      {LANGUAGES.map((lang) => {
        const selected = language === lang.code
        return (
          <button
            key={lang.code}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(lang.code)}
            className={`rounded-full px-4 py-2 text-base font-semibold transition-colors ${
              selected ? 'bg-brand-blue text-white shadow-sm' : 'text-brand-ink hover:bg-white/60'
            }`}
          >
            {lang.label}
          </button>
        )
      })}
    </div>
  )
}
