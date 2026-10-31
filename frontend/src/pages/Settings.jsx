import { ShieldCheck, User, Sparkles, Sliders } from 'lucide-react'
import { motion } from 'framer-motion'
import { usePageContext } from '../App'
import { useFinancialTwin } from '../context/FinancialTwinContext'
import GeminiModelSelector from '../components/GeminiModelSelector'

const PRIVACY_NOTICE =
  'Your Financial Twin data and uploaded document text are strictly isolated in your dedicated user memory dataset. ' +
  'No third-party training is conducted on your raw financial files.'

const DISCLAIMER =
  'FinLens AI provides educational financial information and personalized analysis for informational ' +
  'purposes only. It is not a substitute for certified financial, tax, or legal advisory services.'

export default function Settings() {
  const { user, geminiModel, setGeminiModel } = usePageContext()
  const { twin, updateTwin } = useFinancialTwin()

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6"
    >
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-black text-[#002970]">Account &amp; System Settings</h1>
          <span className="rounded-full bg-[#f0f7fd] px-2.5 py-0.5 text-xs font-bold text-[#002970]">Preferences</span>
        </div>
        <p className="mt-1 text-xs font-medium text-[#64748b]">Configure your profile details and default AI reasoning tier.</p>
      </div>

      <div className="rounded-3xl border border-[#e3edf7] bg-white p-6 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#002970] to-[#00baf2] text-white">
            <User className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#64748b]">Active Account</p>
            <p className="text-base font-black text-[#002970]">{user?.name}</p>
            <p className="text-xs font-medium text-[#526484]">{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[#e3edf7] bg-white p-6 shadow-xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#002970]">Default Intelligence Tier</h2>
        <p className="mt-1 mb-3 text-xs text-[#64748b]">
          Select the active Gemini model for multimodal document extraction and financial memory retrieval.
        </p>
        <GeminiModelSelector value={geminiModel} onChange={setGeminiModel} />
      </div>

      <div className="rounded-3xl border border-[#e3edf7] bg-white p-6 shadow-xs">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#002970]">Employment Category</label>
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

      <div className="flex items-start gap-3 rounded-2xl border border-[#00baf2]/20 bg-[#f0f7fd] p-4 text-xs font-medium text-[#002970]">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#00baf2]" aria-hidden="true" />
        <p>{PRIVACY_NOTICE}</p>
      </div>

      <div className="rounded-2xl border border-[#e3edf7] bg-[#f8fbfe] p-4 text-xs leading-relaxed text-[#64748b]">
        {DISCLAIMER}
      </div>
    </motion.main>
  )
}
