import { AlertTriangle, Loader2, Lock, Mail, ScanLine, ShieldCheck, Sparkles, User } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { login, register } from '../services/apiService'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState('login')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handleFillDemo() {
    setEmail('demo@finlens.ai')
    setPassword('123456')
    setMode('login')
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) return

    if (!email.trim() || !password.trim() || (mode === 'register' && !name.trim())) {
      setError('Please complete all required fields.')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      const data = mode === 'register'
        ? await register(name, email, password)
        : await login(email, password)
      onLogin(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f8fc] px-4 py-10">
      {/* Floating Animated Background Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 30, 0],
          y: [0, -20, 0],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -left-20 top-10 h-80 w-80 rounded-full bg-[#002970]/10 blur-3xl"
      />
      <motion.div
        animate={{
          scale: [1, 1.25, 1],
          x: [0, -40, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -right-20 bottom-10 h-96 w-96 rounded-full bg-[#00baf2]/15 blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative w-full max-w-md rounded-3xl border border-[#e3edf7] bg-white p-8 shadow-xl shadow-[#002970]/10 sm:p-9"
      >
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#002970] via-[#0041a8] to-[#00baf2] text-white shadow-md shadow-[#002970]/20">
            <ScanLine className="h-7 w-7" aria-hidden="true" />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-3xl font-black tracking-tight text-[#002970]">pay<span className="text-[#00baf2]">tm</span></span>
            <span className="animate-heart-pulse mx-0.5 text-2xl text-[#e01a59]">❤️</span>
            <span className="bg-gradient-to-r from-[#002970] via-[#0041a8] to-[#00baf2] bg-clip-text text-3xl font-black tracking-tight text-transparent">Ai</span>
            <span className="animate-sparkle-float text-base text-[#00baf2]">✨</span>
          </div>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[#526484]">FinLens Command Centre</p>
        </div>

        {/* Tab Switcher with Framer Motion Sliding Pill */}
        <div className="mb-6 grid grid-cols-2 rounded-2xl bg-[#f0f5fa] p-1.5">
          {['login', 'register'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setMode(item)
                setError('')
              }}
              className={`relative rounded-xl py-2.5 text-sm font-extrabold capitalize transition-colors duration-200 ${
                mode === item ? 'text-[#002970]' : 'text-[#64748b] hover:text-[#002970]'
              }`}
            >
              {mode === item && (
                <motion.div
                  layoutId="authTabIndicator"
                  className="absolute inset-0 rounded-xl bg-white shadow-sm shadow-[#002970]/10"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              <span className="relative z-10">{item === 'login' ? 'Sign In' : 'Create Account'}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="name" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#002970]">
                Full Name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-[#64748b]" />
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-[#e3edf7] bg-[#f8fbfe] py-3 pl-11 pr-4 text-sm font-medium text-[#0f172a] transition-all focus:border-[#00baf2] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#00baf2]/20"
                  placeholder="Rahul Sharma"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#002970]">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-[#64748b]" />
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[#e3edf7] bg-[#f8fbfe] py-3 pl-11 pr-4 text-sm font-medium text-[#0f172a] transition-all focus:border-[#00baf2] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#00baf2]/20"
                placeholder="demo@finlens.ai"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#002970]">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-[#64748b]" />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[#e3edf7] bg-[#f8fbfe] py-3 pl-11 pr-4 text-sm font-medium text-[#0f172a] transition-all focus:border-[#00baf2] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#00baf2]/20"
                placeholder={mode === 'register' ? 'Minimum 6 characters' : '••••••'}
              />
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <p className="text-xs font-semibold">{error}</p>
            </motion.div>
          )}

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#002970] to-[#0041a8] py-3.5 text-sm font-extrabold text-white shadow-md shadow-[#002970]/20 transition-all hover:shadow-lg hover:shadow-[#002970]/30 disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {isSubmitting ? 'Authenticating...' : mode === 'register' ? 'Create Account' : 'Sign In Securely'}
          </motion.button>
        </form>

        {/* 1-Click Fill Demo Account Pill */}
        {mode === 'login' && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={handleFillDemo}
              className="group inline-flex items-center gap-2 rounded-xl border border-[#00baf2]/40 bg-[#f0f7fd] px-4 py-2 text-xs font-bold text-[#002970] transition-all hover:border-[#00baf2] hover:bg-[#e7f6fd] hover:shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#00baf2] transition-transform group-hover:scale-125" />
              <span>Fill Preloaded Demo Account (Rahul)</span>
            </button>
          </div>
        )}

        <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-[#e3edf7] bg-[#f8fbfe] p-3 text-xs font-medium text-[#526484]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#00b368]" />
          <p>
            {mode === 'login'
              ? 'Multi-tenant isolation: All financial documents and profile datasets are encrypted per user.'
              : 'Passwords are securely hashed. Your financial twin data is isolated in your dedicated memory dataset.'}
          </p>
        </div>
      </motion.div>
    </div>
  )
}
