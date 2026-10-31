import { motion } from 'framer-motion'
import { Activity, AlertCircle, ArrowUpRight, CheckCircle2, Gauge, HeartPulse, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts'
import { useFinancialTwin } from '../context/FinancialTwinContext'
import { calculateHealthScore } from '../services/financeService'

export default function HealthScore() {
  const { twin, monthlySurplus } = useFinancialTwin()
  const health = calculateHealthScore({
    monthlyIncome: twin.monthlyIncome,
    monthlyExpenses: twin.monthlyExpenses,
    existingEmis: twin.existingEmis,
    savings: twin.savings,
  })

  const chartData = [{ name: 'Score', value: health.score, fill: '#00baf2' }]

  const statusLabel =
    health.score >= 75
      ? { text: 'Excellent Financial Health', color: 'text-[#00b368]', bg: 'bg-[#e8f9f1]', border: 'border-[#00b368]/30' }
      : health.score >= 50
        ? { text: 'Moderate Financial Buffer', color: 'text-[#f59e0b]', bg: 'bg-[#fef3c7]', border: 'border-[#f59e0b]/30' }
        : { text: 'Attention Required', color: 'text-[#ef4444]', bg: 'bg-red-50', border: 'border-red-200' }

  return (
    <motion.main
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-6"
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#002970]">Paytm Financial Health Score</h1>
            <span className="rounded-full bg-[#f0f7fd] px-2.5 py-0.5 text-xs font-bold text-[#002970]">
              Telemetry Engine
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-[#64748b]">
            Educational financial wellness telemetry evaluating your cash buffer, savings velocity, and debt commitments.
          </p>
        </div>

        <Link
          to="/simulator"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#002970] to-[#0041a8] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:shadow-md"
        >
          <span>Simulate What-If</span>
          <ArrowUpRight className="h-3.5 w-3.5 text-[#00baf2]" />
        </Link>
      </div>

      {/* Main Gauge Card */}
      <div className="flex flex-col items-center justify-center rounded-3xl border border-[#e3edf7] bg-white p-8 shadow-sm sm:p-10">
        <div className="relative flex h-56 w-56 items-center justify-center">
          <RadialBarChart
            width={240}
            height={240}
            innerRadius="75%"
            outerRadius="100%"
            data={chartData}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar
              dataKey="value"
              cornerRadius={16}
              background={{ fill: '#f0f5fa' }}
              max={100}
            />
          </RadialBarChart>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-5xl font-black tracking-tight text-[#002970]">{health.score}</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Out of 100</span>
          </div>
        </div>

        <div className={`mt-4 rounded-full border px-4 py-1.5 text-xs font-extrabold ${statusLabel.border} ${statusLabel.bg} ${statusLabel.color}`}>
          {statusLabel.text}
        </div>

        <p className="mt-2 text-center text-xs font-medium text-[#64748b]">
          Monthly Surplus: <strong className="text-[#00b368]">₹{Number(monthlySurplus).toLocaleString('en-IN')}</strong> | Liquid Savings: <strong className="text-[#002970]">₹{Number(twin.savings).toLocaleString('en-IN')}</strong>
        </p>
      </div>

      {/* Factor Breakdown Grid */}
      <div>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#002970]">Health Drivers &amp; Metrics</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FactorCard label="Income Stability" value={health.incomeStability} tone="brand" />
          <FactorCard label="Savings Buffer" value={health.savings} tone="success" />
          <FactorCard label="Debt Burden" value={health.debtBurden} tone="warning" />
          <FactorCard label="Cash Flow" value={health.cashFlow} tone="brand" />
        </div>
      </div>

      {/* Advisory Insight Card */}
      <div className="rounded-2xl border border-[#e3edf7] bg-gradient-to-br from-[#f8fbfe] to-white p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#002970] to-[#00baf2] text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#002970]">How to Boost Your Health Score</h3>
            <p className="mt-1 text-xs leading-relaxed text-[#526484]">
              To increase your score above 80, keep your total EMI debt below 35% of your gross monthly income and maintain an emergency fund covering at least 3 months of non-discretionary expenses.
            </p>
          </div>
        </div>
      </div>
    </motion.main>
  )
}

function FactorCard({ label, value, tone = 'brand' }) {
  const isPositive = typeof value === 'number' ? value >= 50 : true
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.02 }}
      className="rounded-2xl border border-[#e3edf7] bg-white p-4 text-center shadow-xs transition-all hover:border-[#00baf2]/40 hover:shadow-sm"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">{label}</p>
      <p className="mt-1.5 text-xl font-black text-[#002970]">{value}</p>
      <span className="mt-1 inline-block rounded-md bg-[#f0f7fd] px-1.5 py-0.5 text-[10px] font-bold text-[#00baf2]">
        Active Factor
      </span>
    </motion.div>
  )
}
