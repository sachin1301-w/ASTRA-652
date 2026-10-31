import { HeartPulse, LogOut } from 'lucide-react'

export default function Navbar({ userName, onLogout }) {
  return (
    <header className="border-b-2 border-brand-blue-light bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-blue text-white">
            <HeartPulse className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xl font-bold text-brand-ink">Sahayak</p>
            <p className="text-sm text-brand-ink/70">Welcome, {userName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 rounded-lg border-2 border-brand-blue-dark/30 px-4 py-2 text-base font-medium text-brand-ink hover:border-brand-blue hover:text-brand-blue-dark"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          Logout
        </button>
      </div>
    </header>
  )
}
