import { Bot, FileText, Gauge, LayoutDashboard, LogOut, MessagesSquare, ScanLine, Sparkles, UserRound } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import LanguageSelector from './LanguageSelector'
import GeminiModelSelector from './GeminiModelSelector'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/financial-twin', label: 'My Money', icon: Gauge },
  { to: '/insights', label: 'Insights', icon: Sparkles },
  { to: '/assistant', label: 'AI Guide', icon: Bot },
  { to: '/advisor', label: 'Convai Advisor', icon: MessagesSquare },
]

export default function Header({ user, language, onLanguageChange, geminiModel, onGeminiModelChange, onLogout }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#e3edf7] bg-white/95 shadow-sm shadow-[#002970]/5 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#002970] via-[#0041a8] to-[#00baf2] text-white shadow-md shadow-[#002970]/20">
            <ScanLine className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black tracking-tight text-[#002970]">pay<span className="text-[#00baf2]">tm</span></span>
              <span className="animate-heart-pulse mx-0.5 text-xl text-[#e01a59]">❤️</span>
              <span className="bg-gradient-to-r from-[#002970] via-[#0041a8] to-[#00baf2] bg-clip-text text-2xl font-black tracking-tight text-transparent">Ai</span>
              <span className="animate-sparkle-float text-sm text-[#00baf2]">✨</span>
            </div>
            <p className="text-[11px] font-semibold tracking-wide text-[#526484]">FinLens • Financial Command Centre</p>
          </div>
        </div>

        <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto rounded-2xl bg-[#f0f5fa] p-1.5 md:order-none md:w-auto">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors duration-200 ${
                  isActive ? 'text-white' : 'text-[#526484] hover:text-[#002970]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="activeNavIndicator"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#002970] to-[#0041a8] shadow-md shadow-[#002970]/20"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <link.icon className="h-4 w-4" aria-hidden="true" />
                    {link.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <GeminiModelSelector value={geminiModel} onChange={onGeminiModelChange} compact />
          <LanguageSelector language={language} onChange={onLanguageChange} />
          <div className="hidden items-center gap-2 rounded-xl border border-[#e3edf7] bg-[#f0f7fd] px-3 py-2 sm:flex">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#002970] text-white">
              <UserRound className="h-3 w-3" aria-hidden="true" />
            </div>
            <span className="max-w-28 truncate text-xs font-bold text-[#002970]">{user?.name}</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Logout"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e3edf7] bg-white text-[#526484] transition-all hover:border-[#e01a59]/30 hover:bg-[#fff0f4] hover:text-[#e01a59]"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}
