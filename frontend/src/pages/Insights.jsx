import { Activity, ArrowUpRight, BarChart3, Sliders, Sparkles, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const SECTIONS = [
  {
    to: '/health-score',
    icon: Activity,
    title: 'Financial Health Score',
    description: 'See your 0–100 wellness score with a factor-by-factor breakdown of debt and savings.',
    gradient: 'from-[#002970] to-[#0041a8]',
    badge: 'Telemetry',
  },
  {
    to: '/products',
    icon: Wallet,
    title: 'Loan & Product Evaluation',
    description: 'Evaluate loans, credit cards, and insurance policies against your live Financial Twin.',
    gradient: 'from-[#0041a8] to-[#00baf2]',
    badge: 'Affordability',
  },
  {
    to: '/simulator',
    icon: Sliders,
    title: 'What-If Simulator',
    description: 'Adjust income, rates, tenures, and prepayments to preview real-time impact.',
    gradient: 'from-[#00baf2] to-[#0284c7]',
    badge: 'Sandbox',
  },
  {
    to: '/transactions',
    icon: BarChart3,
    title: 'Transaction Analytics',
    description: 'Understand recurring charges, EMIs, and discretionary spending trends.',
    gradient: 'from-[#00b368] to-[#10b981]',
    badge: 'Cash Flow',
  },
]

export default function Insights() {
  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6"
    >
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black text-[#002970]">Paytm Financial Insights Hub</h1>
          <span className="rounded-full bg-[#f0f7fd] px-2.5 py-0.5 text-xs font-bold text-[#002970]">
            AI Intelligence
          </span>
        </div>
        <p className="mt-1 text-xs font-medium text-[#64748b]">
          Understand debt exposure, evaluate loan offers, and simulate future financial commitments.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => {
          const Icon = section.icon
          return (
            <motion.div
              key={section.to}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <Link
                to={section.to}
                className="group flex h-full items-start justify-between gap-4 rounded-3xl border border-[#e3edf7] bg-white p-6 shadow-xs transition-all hover:border-[#00baf2]/50 hover:shadow-md hover:shadow-[#00baf2]/10"
              >
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${section.gradient} text-white shadow-sm`}>
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-extrabold text-[#002970] group-hover:text-[#00baf2]">
                        {section.title}
                      </p>
                      <span className="rounded-md bg-[#f0f7fd] px-2 py-0.5 text-[10px] font-bold text-[#002970]">
                        {section.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-[#64748b]">{section.description}</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[#64748b] transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#00baf2]" />
              </Link>
            </motion.div>
          )
        })}
      </div>
    </motion.main>
  )
}
