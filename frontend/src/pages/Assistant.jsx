import { AlertTriangle, Bot, FileCheck2, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { usePageContext } from '../App'
import ChatPanel from '../components/ChatPanel'
import { useFinancialTwin } from '../context/FinancialTwinContext'
import { buildDocumentContextMessage, buildDynamicContext } from '../services/geminiService'
import { useFinLensConversation } from '../hooks/useFinLensConversation'
import GeminiModelSelector from '../components/GeminiModelSelector'
import { geminiModelLabel } from '../services/geminiModels'

export default function Assistant() {
  const { language, geminiModel, setGeminiModel } = usePageContext()
  const { twin } = useFinancialTwin()
  const conversation = useFinLensConversation(language, geminiModel)
  const { askFinLens } = conversation
  const location = useLocation()
  const navigate = useNavigate()
  const startedDocumentChat = useRef(false)
  const [document] = useState(() => location.state?.document)

  useEffect(() => {
    if (!document || startedDocumentChat.current) return
    startedDocumentChat.current = true
    navigate(location.pathname, { replace: true, state: null })
    const documentContext = buildDocumentContextMessage(document.summary, document.fields, document.risks)
    askFinLens(documentContext, {
      displayText: `Tell me what I should know about ${document.filename}.`,
      dynamicContext: buildDynamicContext({ twin, documentInsights: documentContext }),
    })
  }, [askFinLens, document, location.pathname, navigate, twin])

  function handleSendText(text) {
    conversation.askFinLens(text, { dynamicContext: buildDynamicContext({ twin }) })
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6"
    >
      {/* Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl bg-gradient-to-r from-[#002970] via-[#0041a8] to-[#00baf2] p-6 text-white shadow-lg shadow-[#002970]/15 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="text-xl font-black text-white">pay<span className="text-[#00baf2]">tm</span></span>
            <span className="animate-heart-pulse mx-0.5 text-base text-[#e01a59]">❤️</span>
            <span className="text-xl font-black text-white">Ai</span>
            <span className="text-sm text-[#00baf2]">✨</span>
            <span className="text-xs font-semibold text-white/70">• Conversational Guide</span>
          </div>
          <p className="text-xs font-medium text-white/80">
            Personalized answers grounded in your financial twin and cross-document Cognee memory.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-bold text-white backdrop-blur-sm">
          <Sparkles className="h-4 w-4 text-[#00baf2]" />
          <span>Gemini {geminiModelLabel(geminiModel)}</span>
        </div>
      </div>

      <GeminiModelSelector value={geminiModel} onChange={setGeminiModel} />

      {document && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-start gap-3 rounded-2xl border border-[#00baf2]/30 bg-[#e7f6fd] p-4 text-[#002970]"
        >
          <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-[#00baf2]" aria-hidden="true" />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-[#002970]">Active Document Context</p>
            <p className="text-xs font-semibold text-[#002970]/80">
              Reviewing <strong>{document.filename}</strong> alongside your complete financial profile.
            </p>
          </div>
        </motion.div>
      )}

      {conversation.error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
          <p className="text-xs font-semibold">{conversation.error}</p>
        </div>
      )}

      <div className="min-h-[560px] flex-1">
        <ChatPanel
          messages={conversation.messages}
          onSendText={handleSendText}
          disabled={conversation.status === 'thinking'}
          isSpeaking={conversation.isSpeaking}
          onStopSpeaking={conversation.stopSpeaking}
          isVoiceOutputEnabled={conversation.isVoiceOutputEnabled}
          onToggleVoiceOutput={conversation.setVoiceOutputEnabled}
          onToggleMic={conversation.toggleMic}
          isMicActive={conversation.isMicActive}
          isMicSupported={conversation.isMicSupported}
        />
      </div>
    </motion.main>
  )
}
