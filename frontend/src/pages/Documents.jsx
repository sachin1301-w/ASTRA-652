import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Download,
  FileWarning,
  FolderPlus,
  History,
  Languages,
  Loader2,
  ShieldCheck,
  Sparkles,
  Square,
  Upload,
  Volume2,
  WalletCards,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePageContext } from '../App'
import DocumentHistory from '../components/DocumentHistory'
import ImageUploader from '../components/ImageUploader'
import { DOCUMENT_TYPES } from '../constants/documentTypes'
import {
  analyzeDocument,
  downloadDocument,
  getHindiDocumentExplanation,
  uploadDocument,
} from '../services/financeService'
import { isSpeechSynthesisSupported, speak, stopSpeaking } from '../services/speechService'
import { useFinancialTwin } from '../context/FinancialTwinContext'

const STAGE_LABELS = {
  uploading: 'Uploading document to server...',
  analyzing: 'Extracting text and scanning with Gemini Vision...',
  generating: 'Parsing financial fields & clauses into memory...',
}

export default function Documents() {
  const { language, geminiModel } = usePageContext()
  const navigate = useNavigate()
  const { saveAssetToProfile } = useFinancialTwin()

  const [activeTab, setActiveTab] = useState('upload')
  const [documentType, setDocumentType] = useState('bank_statement')
  const [image, setImage] = useState(null)
  const [stage, setStage] = useState(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [savedToProfile, setSavedToProfile] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hindiExplanation, setHindiExplanation] = useState(null)
  const [loadingHindi, setLoadingHindi] = useState(false)
  const [isSpeakingHindi, setIsSpeakingHindi] = useState(false)

  useEffect(() => {
    return () => {
      stopSpeaking()
    }
  }, [])

  async function handleSelect(file) {
    setError('')
    setResult(null)
    setHindiExplanation(null)
    setIsSpeakingHindi(false)
    stopSpeaking()
    setSavedToProfile(false)
    setImage({ file, previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null })

    setStage('uploading')
    let uploadResult
    try {
      uploadResult = await uploadDocument({ documentType, file })
    } catch (err) {
      setError(err.message || 'Unable to upload this document. Please try another file.')
      setStage(null)
      return
    }

    setStage('analyzing')
    try {
      const analysis = await analyzeDocument(uploadResult.id, geminiModel)
      setStage('generating')
      setResult(analysis)
      if (language === 'hi') {
        handleFetchHindiExplanation(analysis.id)
      }
    } catch (err) {
      setError(err.message || 'Unable to analyze this document right now.')
    } finally {
      setStage(null)
    }
  }

  function handleRemove() {
    stopSpeaking()
    setIsSpeakingHindi(false)
    if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl)
    setImage(null)
    setResult(null)
    setHindiExplanation(null)
    setSavedToProfile(false)
    setError('')
  }

  async function handleFetchHindiExplanation(docId = result?.id) {
    if (!docId) return
    setLoadingHindi(true)
    setError('')
    try {
      const data = await getHindiDocumentExplanation(docId, geminiModel)
      setHindiExplanation(data)
    } catch (err) {
      setError(err.message || 'Unable to generate Hindi explanation right now.')
    } finally {
      setLoadingHindi(false)
    }
  }

  async function handleToggleHindiSpeech() {
    if (isSpeakingHindi) {
      stopSpeaking()
      setIsSpeakingHindi(false)
      return
    }

    if (!hindiExplanation) return

    const speechText = hindiExplanation.spoken_text || hindiExplanation.hindi_summary
    if (!speechText) return

    setIsSpeakingHindi(true)
    try {
      await speak(speechText, 'hi')
    } catch (err) {
      console.error('Speech error:', err)
    } finally {
      setIsSpeakingHindi(false)
    }
  }

  async function handleSaveToProfile() {
    if (!result) return
    const record = {
      id: result.id,
      filename: result.filename || image?.file?.name || 'Financial document',
      documentType: result.document_type || documentType,
      summary: result.summary,
      fields: result.fields || {},
      risks: result.risks || [],
      savedAt: new Date().toISOString(),
    }
    if (!['loan_agreement', 'insurance_policy'].includes(documentType)) {
      setError('This document is already saved in My Documents. Only loans and insurance policies feed into the Financial Twin totals.')
      return
    }
    setIsSaving(true)
    setError('')
    try {
      await saveAssetToProfile(documentType, record)
      setSavedToProfile(true)
    } catch (err) {
      setError(err.message || 'Unable to save this document to your profile.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleAskAboutDocument() {
    if (!result) return
    navigate('/assistant', {
      state: {
        document: {
          filename: result.filename || image?.file?.name || 'Uploaded document',
          documentType: result.document_type || documentType,
          summary: result.summary,
          fields: result.fields || {},
          risks: result.risks || [],
        },
      },
    })
  }

  const profileDestination = documentType === 'loan_agreement'
    ? 'Loans'
    : documentType === 'insurance_policy'
      ? 'Insurance'
      : 'Documents'
  const ProfileIcon = documentType === 'loan_agreement'
    ? WalletCards
    : documentType === 'insurance_policy'
      ? ShieldCheck
      : FolderPlus
  const canSaveToProfile = ['loan_agreement', 'insurance_policy'].includes(documentType)

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6"
    >
      {/* Header Title Section */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#002970]">Paytm Document Intelligence</h1>
            <span className="rounded-full border border-[#00baf2]/30 bg-[#e7f6fd] px-2.5 py-0.5 text-xs font-bold text-[#002970]">
              PyMuPDF &amp; Gemini
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-[#64748b]">
            Upload ITR, bank statements, salary slips, or loan agreements to receive deep extraction, risk detection, and Hindi voice readouts.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex w-fit gap-1 rounded-2xl bg-[#f0f5fa] p-1.5 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all ${
              activeTab === 'upload'
                ? 'bg-white text-[#002970] shadow-sm'
                : 'text-[#64748b] hover:text-[#002970]'
            }`}
          >
            <Upload className="h-4 w-4 text-[#00baf2]" aria-hidden="true" />
            Upload &amp; Scan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all ${
              activeTab === 'history'
                ? 'bg-white text-[#002970] shadow-sm'
                : 'text-[#64748b] hover:text-[#002970]'
            }`}
          >
            <History className="h-4 w-4 text-[#002970]" aria-hidden="true" />
            My Documents
          </button>
        </div>
      </div>

      {activeTab === 'history' && <DocumentHistory geminiModel={geminiModel} />}

      {activeTab === 'upload' && (
        <>
          {/* Document Type Selector */}
          <div className="rounded-3xl border border-[#e3edf7] bg-white p-5 shadow-xs">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#002970]">
              Select Document Category
            </label>
            <select
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              className="w-full rounded-xl border border-[#e3edf7] bg-[#f8fbfe] p-3 text-sm font-semibold text-[#002970] transition-all focus:border-[#00baf2] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#00baf2]/20"
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
              <p className="text-xs font-semibold">{error}</p>
            </motion.div>
          )}

          <ImageUploader
            image={image}
            onSelect={handleSelect}
            onRemove={handleRemove}
            onError={setError}
            isProcessing={Boolean(stage)}
            statusLabel={stage ? STAGE_LABELS[stage] : undefined}
          />

          {/* Analysis Results Card */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 rounded-3xl border border-[#e3edf7] bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-[#e3edf7] pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#002970] to-[#00baf2] text-white">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <h2 className="text-lg font-black text-[#002970]">AI Analysis Summary</h2>
                </div>

                <button
                  type="button"
                  onClick={() => downloadDocument(result.id, result.filename || image?.file?.name).catch((err) => setError(err.message))}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#e3edf7] bg-white px-3 py-1.5 text-xs font-bold text-[#002970] transition-all hover:border-[#00baf2] hover:bg-[#f0f7fd]"
                >
                  <Download className="h-3.5 w-3.5 text-[#00baf2]" aria-hidden="true" />
                  <span>Download Original</span>
                </button>
              </div>

              <p className="rounded-2xl bg-[#f8fbfe] p-4 text-sm leading-relaxed text-[#334155]">
                {result.summary}
              </p>

              {/* Extracted Key Details Grid */}
              {Object.keys(result.fields || {}).length > 0 && (
                <div>
                  <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[#002970]">Extracted Key Figures</h3>
                  <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(result.fields).map(
                      ([key, value]) =>
                        value && (
                          <div key={key} className="rounded-2xl border border-[#e3edf7] bg-[#f8fbfe] p-3 transition-all hover:border-[#00baf2]/40">
                            <dt className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
                              {key.replace(/_/g, ' ')}
                            </dt>
                            <dd className="mt-1 text-sm font-extrabold text-[#002970]">{value}</dd>
                          </div>
                        ),
                    )}
                  </dl>
                </div>
              )}

              {/* Risk Clauses */}
              {result.risks?.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900">
                    <FileWarning className="h-4 w-4 text-amber-600" aria-hidden="true" />
                    Important Clauses &amp; Potential Risks
                  </h3>
                  <ul className="space-y-1.5 pl-5 list-disc text-xs font-medium text-amber-950">
                    {result.risks.map((risk, i) => (
                      <li key={i}>{risk}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Hindi Reading & HD Audio Voice Readout */}
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 p-5 shadow-xs">
                <div className="flex flex-col justify-between gap-3 border-b border-emerald-100 pb-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                      <Languages className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-black text-emerald-950">
                        <span>हिंदी में समझें और सुनें</span>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800">
                          HD Audio
                        </span>
                      </h3>
                      <p className="text-[11px] font-medium text-emerald-900/70">
                        दस्तावेज़ का सरल सारांश, आंकड़े और Google TTS आवाज में सुनने की सुविधा
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!hindiExplanation ? (
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={() => handleFetchHindiExplanation()}
                        disabled={loadingHindi}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {loadingHindi ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>हिंदी तैयार हो रही है...</span>
                          </>
                        ) : (
                          <>
                            <Languages className="h-3.5 w-3.5" />
                            <span>हिंदी विवरण देखें</span>
                          </>
                        )}
                      </motion.button>
                    ) : (
                      <div className="flex items-center gap-2">
                        {isSpeechSynthesisSupported && (
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            type="button"
                            onClick={handleToggleHindiSpeech}
                            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition-all ${
                              isSpeakingHindi
                                ? 'bg-[#e01a59] hover:bg-[#c2185b]'
                                : 'bg-emerald-600 hover:bg-emerald-700'
                            }`}
                          >
                            {isSpeakingHindi ? (
                              <>
                                <div className="flex items-center gap-0.5">
                                  <span className="w-1 bg-white animate-bar-1" />
                                  <span className="w-1 bg-white animate-bar-2" />
                                  <span className="w-1 bg-white animate-bar-3" />
                                </div>
                                <Square className="h-3.5 w-3.5 fill-current" />
                                <span>रोकें (Stop)</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="h-3.5 w-3.5" />
                                <span>हिंदी में सुनें</span>
                              </>
                            )}
                          </motion.button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {loadingHindi && !hindiExplanation && (
                  <div className="py-6 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-600" />
                    <p className="mt-2 text-xs font-bold text-emerald-950">
                      Gemini आपके दस्तावेज़ को सरल Devanagari हिंदी में तैयार कर रहा है...
                    </p>
                  </div>
                )}

                {hindiExplanation && (
                  <div className="mt-4 space-y-3.5">
                    <div>
                      <h4 className="text-sm font-black text-emerald-950">
                        {hindiExplanation.hindi_title}
                      </h4>
                      <p className="mt-1 text-xs font-semibold leading-relaxed text-emerald-950/90">
                        {hindiExplanation.hindi_summary}
                      </p>
                    </div>

                    {hindiExplanation.key_points?.length > 0 && (
                      <div>
                        <h5 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                          मुख्य बिंदु (Key Highlights)
                        </h5>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {hindiExplanation.key_points.map((point, index) => (
                            <div
                              key={index}
                              className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-white/90 p-2.5 shadow-xs"
                            >
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                              <span className="text-xs font-semibold leading-snug text-[#0f172a]/90">
                                {point}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {hindiExplanation.risks?.length > 0 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
                        <h5 className="mb-1 flex items-center gap-1.5 text-xs font-bold text-amber-900">
                          <FileWarning className="h-3.5 w-3.5 text-amber-700" />
                          जरूरी सावधानियां एवं शर्तें
                        </h5>
                        <ul className="space-y-1 pl-5 list-disc text-xs font-medium text-amber-950">
                          {hindiExplanation.risks.map((risk, index) => (
                            <li key={index}>{risk}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Destinations */}
              <div className="border-t border-[#e3edf7] pt-4">
                <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[#00baf2]/20 bg-[#f0f7fd] p-3 text-xs font-medium text-[#002970]">
                  <FolderPlus className="mt-0.5 h-4 w-4 shrink-0 text-[#00baf2]" aria-hidden="true" />
                  <span>
                    This document is saved to{' '}
                    <button type="button" onClick={() => setActiveTab('history')} className="font-bold underline">
                      My Documents
                    </button>
                    {' '}and indexed into your isolated Cognee financial memory in the background.
                  </span>
                </div>

                <div className={`grid gap-3.5 ${canSaveToProfile ? 'sm:grid-cols-2' : ''}`}>
                  {canSaveToProfile && (
                    <div className="flex flex-col justify-between rounded-2xl border border-[#e3edf7] bg-[#f8fbfe] p-4.5">
                      <div>
                        <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#002970] shadow-xs">
                          <ProfileIcon className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <h4 className="text-sm font-extrabold text-[#002970]">Add to My {profileDestination}</h4>
                        <p className="mt-1 text-xs leading-relaxed text-[#64748b]">
                          Incorporate these figures into your Financial Twin's EMI and premium calculations for future affordability projections.
                        </p>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={handleSaveToProfile}
                        disabled={savedToProfile || isSaving}
                        className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-[#002970]/20 bg-white px-4 py-2.5 text-xs font-bold text-[#002970] shadow-xs transition-all hover:border-[#00baf2] hover:bg-[#f0f7fd] disabled:text-[#00b368]"
                      >
                        {savedToProfile ? <Check className="h-4 w-4" /> : <FolderPlus className="h-4 w-4" />}
                        {savedToProfile ? `Added to ${profileDestination}` : isSaving ? 'Saving...' : `Add to ${profileDestination}`}
                      </motion.button>
                    </div>
                  )}

                  <div className="flex flex-col justify-between rounded-2xl bg-gradient-to-br from-[#002970] to-[#0041a8] p-4.5 text-white shadow-md shadow-[#002970]/15">
                    <div>
                      <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
                        <Bot className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <h4 className="text-sm font-extrabold text-white">Consult AI Guide</h4>
                      <p className="mt-1 text-xs leading-relaxed text-white/80">
                        Ask questions about this specific document. FinLens connects it with your live profile and past records.
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={handleAskAboutDocument}
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#00baf2] px-4 py-2.5 text-xs font-bold text-[#002970] shadow-md transition-all hover:bg-white active:scale-95"
                    >
                      <Bot className="h-4 w-4" />
                      <span>Open AI Conversation</span>
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}
    </motion.main>
  )
}
