import { AlertTriangle, ArrowUpRight, Bot, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { usePageContext } from '../App'
import { useFinLensConversation } from '../hooks/useFinLensConversation'

const CATEGORY_KEYWORDS = {
  EMIs: ['emi', 'loan'],
  Rent: ['rent'],
  Utilities: ['electricity', 'water bill', 'gas bill', 'utility', 'broadband', 'recharge'],
  Food: ['restaurant', 'zomato', 'swiggy', 'grocery', 'food'],
  Transport: ['uber', 'ola', 'fuel', 'petrol', 'metro', 'transport'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'shopping', 'mall'],
  Entertainment: ['netflix', 'prime video', 'hotstar', 'spotify', 'movie', 'entertainment'],
  Healthcare: ['pharmacy', 'hospital', 'clinic', 'medical', 'health'],
  Investments: ['mutual fund', 'sip', 'stocks', 'investment', 'zerodha', 'groww'],
}
const CATEGORY_COLORS = ['#002970', '#0041a8', '#00baf2', '#00b368', '#f59e0b', '#e01a59', '#7b2cbf', '#0ea5e9', '#10b981']

function categorize(description) {
  const lower = description.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category
  }
  return 'Other'
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  const rows = lines.slice(1).map((line) => {
    const [date, description = '', amountRaw = '0', typeRaw = ''] = line.split(',')
    let amount = parseFloat(amountRaw.replace(/[^0-9.-]/g, '')) || 0
    const type = typeRaw.trim().toLowerCase()
    if (type.startsWith('cr')) amount = Math.abs(amount)
    else if (type.startsWith('dr')) amount = -Math.abs(amount)
    return { date: date?.trim(), description: description.trim(), amount, category: categorize(description) }
  })
  return rows.filter((row) => row.description)
}

export default function Transactions() {
  const { language } = usePageContext()
  const conversation = useFinLensConversation(language)
  const inputRef = useRef(null)
  const [transactions, setTransactions] = useState([])
  const [error, setError] = useState('')

  const summary = useMemo(() => {
    const income = transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
    const expenses = transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
    const byCategory = {}
    for (const t of transactions) {
      if (t.amount >= 0) continue
      byCategory[t.category] = (byCategory[t.category] || 0) + Math.abs(t.amount)
    }
    const categoryData = Object.entries(byCategory).map(([name, value], i) => ({
      name,
      value: Math.round(value),
      fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }))
    const large = transactions.filter((t) => Math.abs(t.amount) > 20000)
    const descriptionCounts = {}
    for (const t of transactions) descriptionCounts[t.description] = (descriptionCounts[t.description] || 0) + 1
    const recurring = Object.entries(descriptionCounts).filter(([, count]) => count >= 2)

    return { income, expenses, categoryData, large, recurring }
  }, [transactions])

  function handleFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result))
        if (rows.length === 0) throw new Error('empty')
        setTransactions(rows)
      } catch {
        setError('Unable to parse CSV structure. Ensure headers include Date, Description, and Amount.')
      }
    }
    reader.onerror = () => setError('Unable to process this file. Please try again.')
    reader.readAsText(file)
  }

  function handleAskAi() {
    const top3 = [...summary.categoryData].sort((a, b) => b.value - a.value).slice(0, 3)
    const question =
      `Based on my transactions, my top spending categories are: ${top3.map((c) => `${c.name} (₹${c.value})`).join(', ')}. ` +
      'Where am I spending the most, and how can I reduce my monthly expenses?'
    conversation.askFinLens(question)
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6"
    >
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black text-[#002970]">Paytm Statement &amp; Transaction Analytics</h1>
          <span className="rounded-full bg-[#f0f7fd] px-2.5 py-0.5 text-xs font-bold text-[#002970]">
            Cash Flow Engine
          </span>
        </div>
        <p className="mt-1 text-xs font-medium text-[#64748b]">
          Upload bank statement CSV files to analyze spending categories, recurring debits, and surplus velocity.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
          <p className="text-xs font-semibold">{error}</p>
        </div>
      )}

      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-[#00baf2]/40 bg-white p-8 text-center transition-all hover:border-[#00baf2] hover:bg-[#f0f7fd]"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#002970] to-[#00baf2] text-white shadow-md">
          <Upload className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <p className="text-base font-black text-[#002970]">Upload Bank Statement CSV</p>
          <p className="text-xs text-[#64748b]">Supports standard 3-column and 4-column bank exports</p>
        </div>
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
      </motion.button>

      {transactions.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Income Credits" value={summary.income} tone="success" />
            <StatCard label="Total Outflows" value={summary.expenses} tone="warning" />
            <StatCard label="Large Debits" value={summary.large.length} isCount />
            <StatCard label="Recurring Charges" value={summary.recurring.length} isCount />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="paytm-card rounded-3xl p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#002970]">Category Breakdown</p>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={summary.categoryData} dataKey="value" nameKey="name" outerRadius={75} label>
                      {summary.categoryData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => `₹${Number(val).toLocaleString('en-IN')}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="paytm-card rounded-3xl p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#002970]">Monthly Spending by Category</p>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.categoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f5fa" />
                    <XAxis dataKey="name" fontSize={10} stroke="#64748b" />
                    <YAxis fontSize={10} stroke="#64748b" />
                    <Tooltip formatter={(val) => `₹${Number(val).toLocaleString('en-IN')}`} />
                    <Bar dataKey="value" fill="#002970" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleAskAi}
            disabled={conversation.status === 'thinking'}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#002970] to-[#0041a8] px-5 py-2.5 text-xs font-extrabold text-white shadow-md disabled:opacity-60"
          >
            <Bot className="h-4 w-4 text-[#00baf2]" />
            <span>Ask Paytm AI About Spending Optimization</span>
          </motion.button>

          {conversation.messages.length > 0 && (
            <div className="space-y-3 rounded-3xl border border-[#e3edf7] bg-white p-5 shadow-xs">
              {conversation.messages.map((message) => (
                <div
                  key={message.id || message.content}
                  className={`rounded-2xl p-3 text-xs leading-relaxed ${
                    message.role === 'user' ? 'bg-[#f0f7fd] font-bold text-[#002970]' : 'bg-[#f8fbfe] text-[#334155]'
                  }`}
                >
                  {message.content}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </motion.main>
  )
}

function StatCard({ label, value, tone, isCount }) {
  const toneClass = tone === 'success' ? 'text-[#00b368]' : tone === 'warning' ? 'text-[#f59e0b]' : 'text-[#002970]'
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.02 }}
      className="rounded-2xl border border-[#e3edf7] bg-white p-4 text-center shadow-xs transition-all hover:border-[#00baf2]/40"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">{label}</p>
      <p className={`mt-1.5 text-lg font-black ${toneClass}`}>
        {isCount ? value : `₹${Math.round(value).toLocaleString('en-IN')}`}
      </p>
    </motion.div>
  )
}
