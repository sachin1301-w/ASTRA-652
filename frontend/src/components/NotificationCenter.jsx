import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bell, CheckCircle2, X } from 'lucide-react'
import { useFinancialTwin } from '../context/FinancialTwinContext'
import { calculateHealthScore, listDocuments } from '../services/financeService'

export default function NotificationCenter() {
  const { twin, monthlySurplus } = useFinancialTwin()
  const [documents, setDocuments] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true
    listDocuments()
      .then((result) => {
        if (active) setDocuments(result.documents || [])
      })
      .catch(() => {
        if (active) setDocuments([])
      })
    return () => { active = false }
  }, [])

  const alerts = useMemo(() => {
    const items = []
    const health = calculateHealthScore({
      monthlyIncome: twin.monthlyIncome,
      monthlyExpenses: twin.monthlyExpenses,
      existingEmis: twin.existingEmis,
      savings: twin.savings,
    })
    const dti = twin.monthlyIncome > 0
      ? ((twin.existingEmis / twin.monthlyIncome) * 100)
      : 100

    if (dti > 50) {
      items.push({ id: 'dti', title: 'Debt burden is high', detail: `Your existing EMIs use ${dti.toFixed(0)}% of monthly income.`, tone: 'warning' })
    }
    if (monthlySurplus < 0) {
      items.push({ id: 'surplus', title: 'Monthly cash flow is negative', detail: 'Expenses and EMIs are higher than your monthly income.', tone: 'warning' })
    }
    if (health.score < 45) {
      items.push({ id: 'health', title: 'Review your financial health', detail: `Your current wellness score is ${health.score}/100.`, tone: 'warning' })
    }
    documents
      .filter((document) => document.risks_count > 0 || (document.risks || []).length > 0)
      .slice(0, 3)
      .forEach((document) => {
        items.push({
          id: `document-${document.id}`,
          title: `Risk flagged in ${document.filename}`,
          detail: (document.risks || []).slice(0, 2).join(' • ') || `${document.risks_count} item(s) need review.`,
          tone: 'warning',
        })
      })
    if (!items.length) {
      items.push({ id: 'healthy', title: 'No urgent alerts', detail: 'Your current profile and documents need no immediate action.', tone: 'success' })
    }
    return items
  }, [documents, monthlySurplus, twin])

  const urgentCount = alerts.filter((alert) => alert.tone === 'warning').length

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`${urgentCount} financial notifications`}
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#e3edf7] bg-white text-[#526484] transition hover:border-[#00baf2]/50 hover:text-[#002970]"
      >
        <Bell className="h-4 w-4" />
        {urgentCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e01a59] px-1 text-[10px] font-black text-white">
            {urgentCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-[#e3edf7] bg-white p-3 shadow-xl shadow-[#002970]/15">
          <div className="mb-2 flex items-center justify-between border-b border-[#e3edf7] pb-2">
            <p className="text-sm font-black text-[#002970]">Financial alerts</p>
            <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="text-[#64748b] hover:text-[#002970]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className={`flex gap-2 rounded-xl p-2.5 ${alert.tone === 'warning' ? 'bg-[#fff7ed]' : 'bg-[#ecfdf5]'}`}>
                {alert.tone === 'warning'
                  ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#ea580c]" />
                  : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00b368]" />}
                <div>
                  <p className="text-xs font-bold text-[#002970]">{alert.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[#526484]">{alert.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-[#94a3b8]">Informational guidance only. Review important decisions with a qualified professional.</p>
        </div>
      )}
    </div>
  )
}
