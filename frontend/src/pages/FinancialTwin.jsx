import { Download, ShieldCheck, User, WalletCards } from 'lucide-react'
import { motion } from 'framer-motion'
import { usePageContext } from '../App'
import DocumentHistory from '../components/DocumentHistory'
import { useFinancialTwin } from '../context/FinancialTwinContext'
import { calculateHealthScore, downloadDocument } from '../services/financeService'

const NUMBER_FIELDS = [
  { key: 'monthlyIncome', label: 'Monthly Income (₹)' },
  { key: 'monthlyExpenses', label: 'Monthly Living Expenses (₹)' },
  { key: 'existingEmis', label: 'Existing Loan EMIs (₹)' },
  { key: 'savings', label: 'Liquid Savings (₹)' },
  { key: 'investments', label: 'Long-Term Investments (₹)' },
]

export default function FinancialTwin() {
  const { geminiModel } = usePageContext()
  const { twin, updateTwin, monthlySurplus, isProfileLoading, profileError } = useFinancialTwin()
  const health = calculateHealthScore({
    monthlyIncome: twin.monthlyIncome,
    monthlyExpenses: twin.monthlyExpenses,
    existingEmis: twin.existingEmis,
    savings: twin.savings,
  })

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-6"
    >
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black text-[#002970]">Paytm Financial Twin</h1>
          <span className="rounded-full bg-[#f0f7fd] px-2.5 py-0.5 text-xs font-bold text-[#002970]">
            Live Cash Flow Model
          </span>
        </div>
        <p className="mt-1 text-xs font-medium text-[#64748b]">
          Your real-time financial twin feeds into every AI answer, health score evaluation, and loan affordability check.
        </p>
      </div>

      {profileError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          {profileError}
        </div>
      )}
      {isProfileLoading && (
        <div className="rounded-2xl border border-[#00baf2]/30 bg-[#e7f6fd] p-3.5 text-xs font-bold text-[#002970]">
          Loading your synchronized profile data...
        </div>
      )}

      {/* Summary Highlight Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#002970] via-[#0041a8] to-[#00baf2] p-6 text-white shadow-lg shadow-[#002970]/15">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full border-[20px] border-white/10" />
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <User className="h-5 w-5" />
          </div>
          <div>
            <p className="text-base font-black">{twin.name || 'Rahul Sharma'}</p>
            <p className="text-xs font-medium text-white/80">Active FinLens Financial Twin</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Monthly Surplus" value={`₹${Number(monthlySurplus).toLocaleString('en-IN')}`} />
          <Stat label="Total Savings" value={`₹${Number(twin.savings).toLocaleString('en-IN')}`} />
          <Stat
            label="Health Status"
            value={health.score >= 70 ? 'Healthy' : health.score >= 45 ? 'Moderate' : 'Stretched'}
          />
          <Stat
            label="Insurance / Mo"
            value={`₹${Number(twin.monthlyInsurancePremiums || 0).toLocaleString('en-IN')}`}
          />
        </div>
      </div>

      {/* Profile Form Card */}
      <div className="rounded-3xl border border-[#e3edf7] bg-white p-6 shadow-xs">
        <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-[#002970]">Personal Cash Flow Parameters</h2>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#64748b]">Profile Name</label>
          <input
            value={twin.name}
            onChange={(event) => updateTwin({ name: event.target.value })}
            className="w-full rounded-xl border border-[#e3edf7] bg-[#f8fbfe] p-3 text-sm font-semibold text-[#002970] transition-all focus:border-[#00baf2] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#00baf2]/20"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {NUMBER_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#64748b]">{field.label}</label>
              <input
                type="number"
                min={0}
                value={twin[field.key]}
                onChange={(event) => updateTwin({ [field.key]: Number(event.target.value) || 0 })}
                className="w-full rounded-xl border border-[#e3edf7] bg-[#f8fbfe] p-3 text-sm font-semibold text-[#002970] transition-all focus:border-[#00baf2] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#00baf2]/20"
              />
            </div>
          ))}

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#64748b]">Employment Type</label>
            <select
              value={twin.employmentType}
              onChange={(event) => updateTwin({ employmentType: event.target.value })}
              className="w-full rounded-xl border border-[#e3edf7] bg-[#f8fbfe] p-3 text-sm font-semibold text-[#002970] transition-all focus:border-[#00baf2] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#00baf2]/20"
            >
              <option>Salaried</option>
              <option>Self-Employed</option>
              <option>Business Owner</option>
              <option>Retired</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#64748b]">Risk Tolerance</label>
            <select
              value={twin.riskTolerance}
              onChange={(event) => updateTwin({ riskTolerance: event.target.value })}
              className="w-full rounded-xl border border-[#e3edf7] bg-[#f8fbfe] p-3 text-sm font-semibold text-[#002970] transition-all focus:border-[#00baf2] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#00baf2]/20"
            >
              <option>Conservative</option>
              <option>Moderate</option>
              <option>Aggressive</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#64748b]">Primary Financial Goals</label>
          <textarea
            value={twin.goals}
            onChange={(event) => updateTwin({ goals: event.target.value })}
            rows={2}
            placeholder="e.g. Buy a home in 4 years, build a 6-month emergency reserve"
            className="w-full rounded-xl border border-[#e3edf7] bg-[#f8fbfe] p-3 text-sm font-medium text-[#0f172a] transition-all focus:border-[#00baf2] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#00baf2]/20"
          />
        </div>
      </div>

      <ProfileCollection
        icon={WalletCards}
        title="Active Loans"
        emptyText="Loan agreements saved after document analysis appear here automatically."
        items={twin.loans || []}
      />

      <ProfileCollection
        icon={ShieldCheck}
        title="Insurance Policies"
        emptyText="Insurance policies saved after document analysis appear here automatically."
        items={twin.insurancePolicies || []}
      />

      <section className="rounded-3xl border border-[#e3edf7] bg-white p-6 shadow-xs">
        <div className="mb-4">
          <h2 className="text-base font-black text-[#002970]">My Document Memory Hub</h2>
          <p className="text-xs text-[#64748b]">All uploaded records indexed in your personal Cognee memory graph.</p>
        </div>
        <DocumentHistory geminiModel={geminiModel} />
      </section>
    </motion.main>
  )
}

function ProfileCollection({ icon: Icon, title, emptyText, items }) {
  return (
    <section className="rounded-3xl border border-[#e3edf7] bg-white p-6 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0f7fd] text-[#002970]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-black text-[#002970]">{title}</h2>
            <p className="text-xs font-semibold text-[#64748b]">{items.length} active records</p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl bg-[#f8fbfe] p-4 text-xs font-medium text-[#64748b]">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl border border-[#e3edf7] bg-[#f8fbfe] p-4 transition-all hover:border-[#00baf2]/40">
              <p className="text-sm font-extrabold text-[#002970]">{item.filename}</p>
              <p className="mt-1 text-xs text-[#475569] leading-relaxed">{item.summary}</p>
              {item.monthly_impact > 0 && (
                <p className="mt-2 text-xs font-bold text-[#002970]">
                  Monthly Impact: <span className="text-[#00baf2]">₹{Number(item.monthly_impact).toLocaleString('en-IN')}</span>
                </p>
              )}
              <button
                type="button"
                onClick={() => downloadDocument(item.document_id || item.id, item.filename)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#002970] hover:text-[#00baf2]"
              >
                <Download className="h-3.5 w-3.5" /> Download Agreement
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">{label}</p>
      <p className="mt-0.5 text-lg font-black text-white">{value}</p>
    </div>
  )
}
