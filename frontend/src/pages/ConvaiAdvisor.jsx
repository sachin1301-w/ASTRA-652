import { ExternalLink, RefreshCw, ShieldCheck, Sparkles, UserCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import ConvaiAvatarEmbed from '../components/ConvaiAvatarEmbed'
import { fetchConvaiConfig } from '../services/convaiService'

export default function ConvaiAdvisor() {
  const [experienceId, setExperienceId] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function loadConfig() {
      setIsLoading(true)
      const config = await fetchConvaiConfig()
      if (isMounted) {
        setExperienceId(config?.experience_id || '')
        setIsLoading(false)
      }
    }
    loadConfig()
    return () => {
      isMounted = false
    }
  }, [])

  const shareUrl = experienceId ? `https://x.convai.com/experience/${experienceId}` : ''

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6"
    >
      {/* Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#002970] via-[#0041a8] to-[#00baf2] p-6 text-white shadow-xl shadow-[#002970]/15 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[32px] border-white/10" />

        <div className="relative z-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3.5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-bold tracking-wide text-white backdrop-blur-sm">
              <span>pay<span className="text-[#00baf2]">tm</span></span>
              <span className="animate-heart-pulse text-sm text-[#e01a59]">❤️</span>
              <span className="font-extrabold text-white">Ai</span>
              <span className="text-[#00baf2]">✨</span>
              <span className="text-white/60">•</span>
              <span className="text-white/90">3D Interactive Voice Advisor</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">Live 3D Conversational Advisor</h1>
            <p className="mt-1.5 max-w-2xl text-xs font-medium text-white/80 sm:text-sm">
              Engage in hands-free, voice-first financial guidance with real-time lip-sync powered by Convai.
            </p>
          </div>
          {shareUrl && (
            <motion.a
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold text-[#002970] shadow-md transition hover:bg-[#f0f7fd]"
            >
              <span>Launch External Window</span>
              <ExternalLink className="h-3.5 w-3.5 text-[#00baf2]" />
            </motion.a>
          )}
        </div>
      </section>

      {/* Security & Engine Status Pill */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e3edf7] bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <p className="text-xs font-semibold text-[#526484]">
            Sandbox voice sessions remain isolated from your sensitive banking documents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0f7fd] px-3 py-1 text-xs font-bold text-[#002970]">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#00baf2]" />
              Connecting to Backend...
            </span>
          ) : experienceId ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Advisor Online
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
              Advisor Offline
            </span>
          )}
        </div>
      </div>

      {/* Avatar Embed Area */}
      {isLoading ? (
        <div className="flex min-h-[480px] flex-col items-center justify-center rounded-3xl border border-[#e3edf7] bg-white p-12 text-center shadow-xs">
          <RefreshCw className="h-8 w-8 animate-spin text-[#00baf2]" />
          <p className="mt-4 text-sm font-extrabold text-[#002970]">Loading 3D Conversational Guide...</p>
          <p className="mt-1 text-xs text-[#64748b]">Fetching character profile from FinLens backend</p>
        </div>
      ) : experienceId ? (
        <ConvaiAvatarEmbed experienceId={experienceId} />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[#00baf2]/40 bg-white p-12 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#002970]/10 to-[#00baf2]/10 text-[#002970]">
            <Sparkles className="h-7 w-7 text-[#00baf2]" />
          </div>
          <h2 className="text-lg font-black text-[#002970]">3D Avatar Advisor Currently Offline</h2>
          <p className="mt-1 max-w-md text-xs font-medium text-[#64748b]">
            The 3D character experience ID has not been configured in the backend environment. Please check your backend configuration.
          </p>
        </div>
      )}
    </motion.main>
  )
}
