import { Loader2 } from 'lucide-react'

export default function LoadingSpinner({ label }) {
  return (
    <div className="flex items-center justify-center gap-3 py-4 text-brand-blue-dark" role="status">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      <span className="text-lg font-medium">{label}</span>
    </div>
  )
}
