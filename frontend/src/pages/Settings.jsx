import { useEffect, useState } from 'react'
import { Cpu, ShieldCheck, User } from 'lucide-react'
import { motion } from 'framer-motion'

import { usePageContext } from '../App'
import { useFinancialTwin } from '../context/FinancialTwinContext'
import GeminiModelSelector from '../components/GeminiModelSelector'
import { authenticatedFetch } from '../services/apiService'

const PRIVACY_NOTICE =
  'Your Financial Twin data and uploaded document text are strictly isolated in your dedicated user memory dataset. ' +
  'No third-party training is conducted on your raw financial files.'

const DISCLAIMER =
  'FinLens AI provides educational financial information and personalized analysis for informational ' +
  'purposes only. It is not a substitute for certified financial, tax, or legal advisory services.'

const MODEL_LABELS = {
  embeddings: { name: 'Multilingual E5 Small', desc: 'Semantic search & cited document retrieval' },
  ner: { name: 'DistilBERT NER', desc: 'AI privacy & entity masking (English)' },
  docling: { name: 'Granite Docling 258M', desc: 'Offline scanned page OCR (vision-text)' },
  indic_translate_en_indic: { name: 'IndicTrans2 (EN->Indic)', desc: 'Indian language translation (MIT/Gated)' },
  indic_translate_indic_en: { name: 'IndicTrans2 (Indic->EN)', desc: 'Indian language translation (MIT/Gated)' },
  indic_asr: { name: 'IndicConformer 600M', desc: 'Indian multilingual speech-to-text (Gated)' },
  car_damage: { name: 'Car Damage ViT', desc: 'Motor claim photo triage classifier' },
  loan: { name: 'Loan Approval Model', desc: 'Calibrated credit assessment pipeline' },
  fraud: { name: 'Claim Fraud Flag', desc: 'Human-review fraud screening pipeline' },
}

export default function Settings() {
  const { user, geminiModel, setGeminiModel } = usePageContext()
  const { twin, updateTwin } = useFinancialTwin()
  const [mlStatus, setMlStatus] = useState(null)
  const [mlLoading, setMlLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    authenticatedFetch('/api/ml/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data) setMlStatus(data)
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setMlLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

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

      {/* AI Engine Status Card */}
      <div className="rounded-3xl border border-[#e3edf7] bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[#002970]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#002970]">AI Engine Status</h2>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
              mlStatus?.ml_enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {mlStatus?.ml_enabled ? 'ML Active' : 'ML Standby (Gemini Primary)'}
          </span>
        </div>
        <p className="mt-1 mb-4 text-xs text-[#64748b]">
          Local Hugging Face offline weights and embedded machine learning runtime diagnostics.
        </p>

        {mlLoading ? (
          <p className="text-xs text-[#64748b]">Loading AI engine status...</p>
        ) : (
          <div className="space-y-2.5">
            {mlStatus?.models &&
              Object.entries(mlStatus.models).map(([key, info]) => {
                const meta = MODEL_LABELS[key] || { name: key, desc: info.folder }
                const isOnline = info.available
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-xl border border-[#f0f4f8] bg-[#fbfdff] px-3.5 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          isOnline ? 'bg-emerald-500 shadow-xs shadow-emerald-400' : 'bg-slate-300'
                        }`}
                        title={isOnline ? 'Model available locally' : 'Model not present locally'}
                      />
                      <div>
                        <p className="font-semibold text-[#002970]">{meta.name}</p>
                        <p className="text-[11px] text-[#64748b]">{meta.desc}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-[11px] font-bold ${
                          isOnline ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      >
                        {isOnline ? (info.loaded ? 'Loaded (RAM)' : 'Available') : 'Unavailable'}
                      </span>
                      {info.revision && (
                        <p className="text-[10px] text-slate-400 font-mono">rev {info.revision.slice(0, 7)}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            {mlStatus?.ram_used_mb !== undefined && (
              <div className="mt-3 flex items-center justify-between border-t border-[#f0f4f8] pt-2 text-[11px] text-[#64748b]">
                <span>Host Device: <strong className="text-[#002970]">{mlStatus.device?.toUpperCase() || 'CPU'}</strong></span>
                <span>Process RAM: <strong className="text-[#002970]">{mlStatus.ram_used_mb} MB</strong></span>
              </div>
            )}
          </div>
        )}
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
