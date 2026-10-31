import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Gauge,
  MessagesSquare,
  ScanLine,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Upload,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePageContext } from '../App'
import ChatPanel from '../components/ChatPanel'
import OverviewCard from '../components/OverviewCard'
import { useFinancialTwin } from '../context/FinancialTwinContext'
import { buildDynamicContext } from '../services/geminiService'
import { calculateHealthScore } from '../services/financeService'
import { useFinLensConversation } from '../hooks/useFinLensConversation'
import { geminiModelLabel } from '../services/geminiModels'

const DISCLAIMER =
  'FinLens AI provides educational financial analysis and AI-driven document interpretations for informational ' +
  'purposes only. It is not a substitute for certified financial, legal, or tax advisory services.'

const QUICK_SERVICES = [
  {
    to: '/documents',
    title: 'Scan & Analyze',
    desc: 'ITR, Loan, Salary & Bank OCR',
    icon: ScanLine,
    gradient: 'from-[#002970] to-[#0041a8]',
    badge: 'Vision AI',
  },
  {
    to: '/health-score',
    title: 'Health Score',
    desc: 'DTI, Cash Surplus & Score',
    icon: Gauge,
    gradient: 'from-[#0041a8] to-[#00baf2]',
    badge: '0-100 Score',
  },
  {
    to: '/simulator',
    title: 'What-If Sandbox',
    desc: 'Simulate Loans & Life Events',
    icon: TrendingUp,
    gradient: 'from-[#00baf2] to-[#0284c7]',
    badge: 'Predictive',
  },
  {
    to: '/assistant',
    title: 'AI Financial Guide',
    desc: 'Grounded in your documents',
    icon: Bot,
    gradient: 'from-[#002970] to-[#00baf2]',
    badge: 'Cognee Memory',
  },
  {
    to: '/advisor',
    title: '3D Voice Advisor',
    desc: 'Live interactive consultation',
    icon: MessagesSquare,
    gradient: 'from-[#7b2cbf] to-[#9d4edd]',
    badge: 'Convai 3D',
  },
  {
    to: '/insights',
    title: 'Smart Insights',
    desc: 'Savings & debt recommendations',
    icon: Sparkles,
    gradient: 'from-[#00b368] to-[#10b981]',
    badge: 'Automated',
  },
]

export default function Dashboard() {
  const { language, user, geminiModel } = usePageContext()
  const { twin, monthlySurplus } = useFinancialTwin()
  const conversation = useFinLensConversation(language, geminiModel)
  const health = calculateHealthScore({
    monthlyIncome: twin.monthlyIncome,
    monthlyExpenses: twin.monthlyExpenses,
    existingEmis: twin.existingEmis,
    savings: twin.savings,
  })

  function handleSendText(text) {
    const dynamicContext = buildDynamicContext({ twin })
    conversation.askFinLens(text, { dynamicContext })
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.07 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  }

  return (
    <motion.main
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6"
    >
      {/* Paytm Hero Banner */}
      <motion.section
        variants={itemVariants}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#002970] via-[#0041a8] to-[#00baf2] p-6 text-white shadow-xl shadow-[#002970]/15 sm:p-8"
      >
        {/* Subtle geometric watermark rings */}
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border-[32px] border-white/10" />
        <div className="pointer-events-none absolute -bottom-16 right-36 h-48 w-48 rounded-full border-[20px] border-white/5" />

        <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3.5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-bold tracking-wide text-white backdrop-blur-sm">
              <span>pay<span className="text-[#00baf2]">tm</span></span>
              <span className="animate-heart-pulse text-sm text-[#e01a59]">❤️</span>
              <span className="font-extrabold text-white">Ai</span>
              <span className="text-[#00baf2]">✨</span>
              <span className="text-white/60">•</span>
              <span className="text-white/90">Personal Command Centre</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Welcome back, {user?.name?.split(' ')[0] || 'User'}!
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-white/80 sm:text-base">
              Understand financial agreements in plain language, check your loan health score, and simulate future life scenarios.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/documents"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-[#002970] shadow-lg shadow-[#002970]/20 transition-all hover:bg-[#f0f7fd] hover:shadow-xl active:scale-95"
            >
              <ScanLine className="h-4 w-4 text-[#00baf2]" />
              Analyze Document
            </Link>
            <Link
              to="/assistant"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95"
            >
              <Bot className="h-4 w-4" />
              Ask AI
            </Link>
          </div>
        </div>
      </motion.section>

      {conversation.error && (
        <motion.div
          variants={itemVariants}
          className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <p className="text-sm font-medium">{conversation.error}</p>
        </motion.div>
      )}

      {/* Financial Twin Telemetry Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        <OverviewCard label="Monthly Income" value={twin.monthlyIncome} tone="success" />
        <OverviewCard label="Monthly Expenses" value={twin.monthlyExpenses} tone="default" />
        <OverviewCard label="Existing EMIs" value={twin.existingEmis} tone="warning" />
        <OverviewCard label="Available Surplus" value={monthlySurplus} tone="success" />
        <OverviewCard label="Health Score" value={health.score} suffix="/100" tone="brand" />
      </motion.div>

      {/* Paytm Quick Services Grid */}
      <motion.section variants={itemVariants} className="rounded-3xl border border-[#e3edf7] bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black tracking-tight text-[#002970]">Paytm Financial Services &amp; AI Tools</h2>
            <p className="text-xs font-semibold text-[#526484]">Quick access to all FinLens intelligent modules</p>
          </div>
          <span className="rounded-full bg-[#f0f7fd] px-3 py-1 text-xs font-bold text-[#002970]">6 AI Services</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {QUICK_SERVICES.map((service) => {
            const Icon = service.icon
            return (
              <motion.div
                key={service.to}
                whileHover={{ y: -5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Link
                  to={service.to}
                  className="group flex h-full flex-col justify-between rounded-2xl border border-[#e3edf7] bg-[#f8fbfe] p-3.5 transition-all hover:border-[#00baf2]/50 hover:bg-white hover:shadow-md hover:shadow-[#00baf2]/10"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${service.gradient} text-white shadow-sm`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#526484] shadow-xs">
                        {service.badge}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-extrabold text-[#002970] group-hover:text-[#00baf2]">
                      {service.title}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-tight text-[#64748b]">
                      {service.desc}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center text-xs font-bold text-[#00baf2] opacity-80 group-hover:opacity-100">
                    <span>Open</span>
                    <ArrowUpRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </motion.section>

      {/* AI Financial Chat Section */}
      <motion.section variants={itemVariants} className="min-h-[430px]">
        <div className="mb-3.5 flex items-center justify-between rounded-2xl border border-[#e3edf7] bg-white px-5 py-3.5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#002970] to-[#00baf2] text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-extrabold text-[#002970]">Ask Gemini with Cognee Financial Memory</p>
              <p className="text-xs font-medium text-[#64748b]">Answers are grounded across your uploaded documents and live profile.</p>
            </div>
          </div>
          <span className="hidden rounded-full border border-[#00baf2]/30 bg-[#e7f6fd] px-3 py-1 text-xs font-bold text-[#002970] sm:block">
            Gemini {geminiModelLabel(geminiModel)}
          </span>
        </div>

        <ChatPanel
          messages={conversation.messages}
          onSendText={handleSendText}
          disabled={conversation.status === 'thinking'}
          isSpeaking={conversation.isSpeaking}
          onStopSpeaking={conversation.stopSpeaking}
          isVoiceOutputEnabled={conversation.isVoiceOutputEnabled}
          onToggleVoiceOutput={conversation.setVoiceOutputEnabled}
          onToggleMic={conversation.toggleMic}
          isMicActive={conversation.isMicActive}
          isMicSupported={conversation.isMicSupported}
        />
      </motion.section>

      {/* Upload Document Prompt */}
      <motion.div variants={itemVariants}>
        <Link
          to="/documents"
          className="group flex flex-col items-center justify-between gap-4 rounded-3xl border-2 border-dashed border-[#00baf2]/40 bg-gradient-to-br from-white to-[#f0f7fd] p-6 transition-all hover:border-[#00baf2] hover:shadow-lg hover:shadow-[#00baf2]/10 sm:flex-row"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#002970] to-[#00baf2] text-white shadow-md shadow-[#002970]/15">
              <Upload className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-black text-[#002970]">Upload New Financial Documents</p>
              <p className="text-sm font-medium text-[#64748b]">
                Loan agreements, ITR returns, salary slips, insurance policies, and bank statements
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-xl bg-[#002970] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all group-hover:bg-[#0041a8]">
            <span>Open Document Hub</span>
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </Link>
      </motion.div>

      {/* Disclaimer Footer */}
      <motion.footer variants={itemVariants} className="flex items-start gap-3 rounded-2xl border border-[#e3edf7] bg-[#f0f5fa] p-4 text-[#526484]">
        <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#002970]" aria-hidden="true" />
        <p className="text-xs leading-relaxed">{DISCLAIMER}</p>
      </motion.footer>
    </motion.main>
  )
}
