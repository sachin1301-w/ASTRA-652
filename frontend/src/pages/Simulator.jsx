import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useFinancialTwin } from '../context/FinancialTwinContext'
import {
  calculateAffordability,
  calculateDti,
  calculateEmi,
  calculateTotalInterest,
} from '../services/financeService'

function Slider({ label, value, onChange, min, max, step, format }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
        <label className="text-[#002970]">{label}</label>
        <span className="rounded-md bg-[#f0f7fd] px-2 py-0.5 font-mono text-xs font-bold text-[#00baf2]">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#e3edf7] accent-[#002970] focus:outline-none"
      />
    </div>
  )
}

export default function Simulator() {
  const { twin } = useFinancialTwin()
  const [income, setIncome] = useState(twin.monthlyIncome || 70000)
  const [expenses, setExpenses] = useState(twin.monthlyExpenses || 30000)
  const [rate, setRate] = useState(10.5)
  const [tenure, setTenure] = useState(48)
  const [existingEmi, setExistingEmi] = useState(twin.existingEmis || 10000)
  const [loanAmount, setLoanAmount] = useState(500000)
  const [prepayment, setPrepayment] = useState(0)

  const emi = useMemo(() => calculateEmi(loanAmount, rate, tenure), [loanAmount, rate, tenure])
  const totalInterest = useMemo(() => calculateTotalInterest(loanAmount, emi, tenure), [loanAmount, emi, tenure])
  const dti = useMemo(() => calculateDti(existingEmi, emi, income), [existingEmi, emi, income])
  const affordability = calculateAffordability(dti)
  const surplus = income - expenses - existingEmi - emi
  const effectiveTenure = prepayment > 0 ? Math.max(1, Math.round((loanAmount / (emi + prepayment)) * 1)) : tenure

  const cashFlowData = [
    { name: 'Income', value: income, fill: '#00b368' },
    { name: 'Living Exp', value: expenses, fill: '#64748b' },
    { name: 'Total EMIs', value: existingEmi + emi, fill: '#f59e0b' },
    { name: 'Surplus', value: Math.max(0, surplus), fill: '#00baf2' },
  ]
  const principalVsInterest = [
    { name: 'Principal', value: loanAmount, fill: '#002970' },
    { name: 'Interest', value: totalInterest, fill: '#00baf2' },
  ]

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6"
    >
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black text-[#002970]">Paytm What-If Life Simulator</h1>
          <span className="rounded-full bg-[#f0f7fd] px-2.5 py-0.5 text-xs font-bold text-[#002970]">
            Interactive Sandbox
          </span>
        </div>
        <p className="mt-1 text-xs font-medium text-[#64748b]">
          Test new loans, interest rates, salary hikes, or prepayments with real-time affordability calculations.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Slider Controls */}
        <div className="space-y-4 rounded-3xl border border-[#e3edf7] bg-white p-6 shadow-xs lg:col-span-6">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#002970]">Scenario Controls</h2>
          <Slider
            label="Monthly Gross Income"
            value={income}
            onChange={setIncome}
            min={10000}
            max={500000}
            step={2000}
            format={(v) => `₹${v.toLocaleString('en-IN')}`}
          />
          <Slider
            label="Monthly Non-Discretionary Expenses"
            value={expenses}
            onChange={setExpenses}
            min={0}
            max={300000}
            step={1000}
            format={(v) => `₹${v.toLocaleString('en-IN')}`}
          />
          <Slider
            label="Current Existing EMIs"
            value={existingEmi}
            onChange={setExistingEmi}
            min={0}
            max={150000}
            step={1000}
            format={(v) => `₹${v.toLocaleString('en-IN')}`}
          />
          <Slider
            label="Prospective Loan Principal"
            value={loanAmount}
            onChange={setLoanAmount}
            min={25000}
            max={10000000}
            step={25000}
            format={(v) => `₹${v.toLocaleString('en-IN')}`}
          />
          <Slider label="Annual Interest Rate" value={rate} onChange={setRate} min={4} max={28} step={0.25} format={(v) => `${v}% p.a.`} />
          <Slider label="Repayment Tenure" value={tenure} onChange={setTenure} min={6} max={360} step={6} format={(v) => `${v} months (${Math.round(v/12)} yrs)`} />
          <Slider
            label="Monthly Extra Prepayment"
            value={prepayment}
            onChange={setPrepayment}
            min={0}
            max={50000}
            step={1000}
            format={(v) => `₹${v.toLocaleString('en-IN')}`}
          />
        </div>

        {/* Right Metrics & Charts */}
        <div className="space-y-4 lg:col-span-6">
          {/* Result Cards Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ResultCard label="New Loan EMI" value={`₹${emi.toLocaleString('en-IN')}`} />
            <ResultCard label="Total Interest" value={`₹${totalInterest.toLocaleString('en-IN')}`} />
            <ResultCard label="Total DTI" value={`${dti}%`} />
            <ResultCard label="Affordability" value={affordability} />
          </div>

          {/* Cash Flow Distribution Chart */}
          <div className="rounded-3xl border border-[#e3edf7] bg-white p-5 shadow-xs">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#002970]">Cash Flow Breakdown</p>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f5fa" />
                  <XAxis dataKey="name" fontSize={11} stroke="#64748b" />
                  <YAxis fontSize={11} stroke="#64748b" />
                  <Tooltip formatter={(val) => `₹${Number(val).toLocaleString('en-IN')}`} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {cashFlowData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Principal vs Interest Pie Chart */}
          <div className="rounded-3xl border border-[#e3edf7] bg-white p-5 shadow-xs">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#002970]">Principal vs Interest Split</p>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={principalVsInterest} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70}>
                    {principalVsInterest.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} />
                  <Tooltip formatter={(val) => `₹${Number(val).toLocaleString('en-IN')}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {prepayment > 0 && (
            <div className="rounded-2xl border border-emerald-200 bg-[#e8f9f1] p-3.5 text-xs font-semibold text-emerald-950">
              With ₹{prepayment.toLocaleString('en-IN')}/mo extra prepayment, you close this loan in roughly{' '}
              <strong>{effectiveTenure} months</strong> instead of {tenure} months!
            </div>
          )}
        </div>
      </div>
    </motion.main>
  )
}

function ResultCard({ label, value }) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.02 }}
      className="rounded-2xl border border-[#e3edf7] bg-white p-3.5 text-center shadow-xs transition-all hover:border-[#00baf2]/40 hover:shadow-sm"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">{label}</p>
      <p className="mt-1 text-base font-black text-[#002970]">{value}</p>
    </motion.div>
  )
}
