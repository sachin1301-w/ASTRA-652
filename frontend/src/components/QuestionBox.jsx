const PLACEHOLDERS = {
  en: 'Ask your health-related question here...',
  hi: 'अपना स्वास्थ्य संबंधी प्रश्न यहां लिखें...',
}

export default function QuestionBox({ question, onChange, language }) {
  return (
    <textarea
      value={question}
      onChange={(event) => onChange(event.target.value)}
      placeholder={PLACEHOLDERS[language] ?? PLACEHOLDERS.en}
      rows={5}
      maxLength={1000}
      aria-label="Your health-related question"
      className="w-full rounded-xl border-2 border-brand-blue-dark/30 bg-white p-4 text-lg text-brand-ink placeholder:text-brand-ink/50 focus:border-brand-blue focus:outline-none"
    />
  )
}
