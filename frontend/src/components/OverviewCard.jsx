import { motion } from 'framer-motion'
import { ArrowUpRight, CheckCircle2, CircleAlert, DollarSign, HeartPulse, TrendingUp, Wallet } from 'lucide-react'

const TONE_CONFIG = {
  default: {
    text: 'text-[#0f172a]',
    bar: 'bg-gradient-to-r from-[#002970] to-[#00baf2]',
    badgeBg: 'bg-[#e7f6fd]',
    badgeText: 'text-[#002970]',
    icon: Wallet,
  },
  success: {
    text: 'text-[#00b368]',
    bar: 'bg-gradient-to-r from-[#00b368] to-[#10b981]',
    badgeBg: 'bg-[#e8f9f1]',
    badgeText: 'text-[#00b368]',
    icon: TrendingUp,
  },
  warning: {
    text: 'text-[#f59e0b]',
    bar: 'bg-gradient-to-r from-[#f59e0b] to-[#fbbf24]',
    badgeBg: 'bg-[#fef3c7]',
    badgeText: 'text-[#b45309]',
    icon: CircleAlert,
  },
  brand: {
    text: 'text-[#002970]',
    bar: 'bg-gradient-to-r from-[#002970] via-[#0041a8] to-[#00baf2]',
    badgeBg: 'bg-gradient-to-br from-[#002970]/10 to-[#00baf2]/10',
    badgeText: 'text-[#002970]',
    icon: HeartPulse,
  },
}

export default function OverviewCard({ label, value, suffix, tone = 'default' }) {
  const config = TONE_CONFIG[tone] ?? TONE_CONFIG.default
  const Icon = config.icon
  const formatted = suffix ? `${value}${suffix}` : `₹${Number(value).toLocaleString('en-IN')}`

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="relative overflow-hidden rounded-2xl border border-[#e3edf7] bg-white p-4 shadow-sm shadow-[#002970]/5 transition-all hover:border-[#00baf2]/40 hover:shadow-md hover:shadow-[#00baf2]/10"
    >
      <div className={`absolute left-0 right-0 top-0 h-1.5 ${config.bar}`} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[#64748b]">{label}</p>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${config.badgeBg} ${config.badgeText}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
      <p className={`mt-2 text-2xl font-black tracking-tight ${config.text}`}>{formatted}</p>
    </motion.div>
  )
}
