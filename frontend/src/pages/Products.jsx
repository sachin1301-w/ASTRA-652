import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowUpRight, CheckCircle2, DollarSign, Shield, Sparkles, Wallet } from 'lucide-react'
import { useFinancialTwin } from '../context/FinancialTwinContext'
import {
  AFFORDABILITY_COLOR,
  calculateAffordability,
  calculateDti,
  calculateEmi,
} from '../services/financeService'

const PRODUCTS = [
  { id: 'personal-loan', name: 'Personal Loan', kind: 'loan', amount: 500000, rate: 12, tenureMonths: 48, processingFee: '2%', benefits: 'No collateral required', risks: 'Higher interest than secured loans' },
  { id: 'car-loan', name: 'Car Loan', kind: 'loan', amount: 800000, rate: 9, tenureMonths: 60, processingFee: '1%', benefits: 'Lower interest, vehicle as collateral', risks: 'Vehicle can be repossessed on default' },
  { id: 'home-loan', name: 'Home Loan', kind: 'loan', amount: 3500000, rate: 8.5, tenureMonths: 240, processingFee: '0.5%', benefits: 'Tax benefits under Section 80C/24', risks: 'Long-term commitment, property as collateral' },
  { id: 'credit-card', name: 'Credit Card', kind: 'card', amount: 100000, rate: 36, processingFee: 'Annual fee applies', benefits: 'Rewards, short-term interest-free credit', risks: 'Very high interest if not paid in full' },
  { id: 'health-insurance', name: 'Health Insurance', kind: 'insurance', amount: 500000, rate: 0, premium: 12000, tenureMonths: 12, benefits: 'Covers hospitalization costs', risks: 'Exclusions and waiting periods apply' },
  { id: 'term-insurance', name: 'Term Insurance', kind: 'insurance', amount: 5000000, rate: 0, premium: 9000, tenureMonths: 12, benefits: 'High cover at low premium', risks: 'No maturity benefit if outlived' },
]

export default function Products() {
  const { twin } = useFinancialTwin()
  const [analyzedId, setAnalyzedId] = useState(null)

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6"
    >
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black text-[#002970]">Paytm Loan &amp; Product Evaluation</h1>
          <span className="rounded-full bg-[#f0f7fd] px-2.5 py-0.5 text-xs font-bold text-[#002970]">
            Affordability Engine
          </span>
        </div>
        <p className="mt-1 text-xs font-medium text-[#64748b]">
          Test market loans, credit cards, and insurance policies against your live Financial Twin before signing.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((product) => {
          const isLoan = product.kind === 'loan'
          const isInsurance = product.kind === 'insurance'
          const emi = isLoan ? calculateEmi(product.amount, product.rate, product.tenureMonths) : 0
          const dti = isLoan ? calculateDti(twin.existingEmis, emi, twin.monthlyIncome) : 0
          const affordability = isLoan ? calculateAffordability(dti) : null
          const showAnalysis = analyzedId === product.id

          return (
            <motion.div
              key={product.id}
              whileHover={{ y: -4, scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="paytm-card flex flex-col justify-between rounded-3xl p-5"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-[#f0f7fd] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#002970]">
                    {product.kind}
                  </span>
                  <span className="text-xs font-bold text-[#00baf2]">
                    ₹{product.amount.toLocaleString('en-IN')}
                  </span>
                </div>

                <p className="mt-2 text-base font-extrabold text-[#002970]">{product.name}</p>
                <p className="text-xs text-[#64748b]">
                  {isInsurance ? 'Sum Assured' : product.kind === 'card' ? 'Credit Limit' : 'Sanctioned Amount'}
                </p>

                <div className="mt-3 space-y-1 rounded-2xl border border-[#e3edf7] bg-[#f8fbfe] p-3 text-xs">
                  {isLoan && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-[#64748b]">Interest Rate:</span>
                        <span className="font-bold text-[#002970]">{product.rate}% p.a.</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748b]">Tenure:</span>
                        <span className="font-bold text-[#002970]">{product.tenureMonths} Mos</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-[#e3edf7]">
                        <span className="font-bold text-[#002970]">Monthly EMI:</span>
                        <span className="font-black text-[#00baf2]">₹{emi.toLocaleString('en-IN')}</span>
                      </div>
                    </>
                  )}
                  {isInsurance && (
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">Annual Premium:</span>
                      <span className="font-black text-[#002970]">₹{product.premium.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {product.kind === 'card' && (
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">APR:</span>
                      <span className="font-black text-[#002970]">{product.rate}%</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[11px] text-[#64748b]">
                    <span>Fee:</span>
                    <span>{product.processingFee ?? '-'}</span>
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-xs">
                  <p className="text-[#00b368] font-medium">✓ {product.benefits}</p>
                  <p className="text-[#b45309] font-medium">⚠️ {product.risks}</p>
                </div>
              </div>

              <div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setAnalyzedId(showAnalysis ? null : product.id)}
                  className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#002970] to-[#0041a8] py-2.5 text-xs font-bold text-white shadow-xs transition-all hover:shadow-md"
                >
                  {showAnalysis ? 'Hide Evaluation' : 'Analyze For My Profile'}
                </motion.button>

                {showAnalysis && isLoan && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2.5 rounded-2xl border border-[#e3edf7] bg-[#f0f7fd] p-3 text-xs"
                  >
                    <div className="flex justify-between">
                      <span className="text-[#64748b]">Resulting DTI:</span>
                      <strong className="text-[#002970]">{dti}%</strong>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[#64748b]">Affordability:</span>
                      <strong className={AFFORDABILITY_COLOR[affordability]}>{affordability}</strong>
                    </div>
                    <p className="mt-1.5 text-[10px] text-[#64748b] leading-tight">
                      Educational projection based on ₹{twin.monthlyIncome.toLocaleString('en-IN')}/mo gross income.
                    </p>
                  </motion.div>
                )}

                {showAnalysis && isInsurance && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2.5 rounded-2xl border border-[#e3edf7] bg-[#f0f7fd] p-3 text-xs text-[#002970]"
                  >
                    This premium represents{' '}
                    <strong>{((product.premium / 12 / (twin.monthlyIncome || 1)) * 100).toFixed(1)}%</strong> of your monthly earnings.
                  </motion.div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.main>
  )
}
