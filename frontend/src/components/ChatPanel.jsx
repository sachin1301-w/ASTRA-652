import { motion } from 'framer-motion'
import { Bot, Mic, MicOff, Send, Sparkles, Square, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import MessageBubble from './MessageBubble'

const SUGGESTED_QUESTIONS = [
  'Can I afford this loan with my current EMI?',
  'What are my biggest non-discretionary expenses?',
  'What hidden charges or penalties exist in my documents?',
  'How can I improve my financial health score?',
]

export default function ChatPanel({
  messages,
  onSendText,
  disabled,
  isSpeaking,
  onStopSpeaking,
  isVoiceOutputEnabled,
  onToggleVoiceOutput,
  onToggleMic,
  isMicActive = false,
  isMicSupported = true,
}) {
  const [draft, setDraft] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  function submitText(text) {
    if (!text || disabled) return
    onStopSpeaking?.()
    onSendText(text)
    setDraft('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    submitText(draft.trim())
  }

  function handleInputChange(event) {
    setDraft(event.target.value)
    if (isSpeaking) {
      onStopSpeaking?.()
    }
  }

  return (
    <section className="flex h-full flex-col rounded-3xl border border-[#e3edf7] bg-white shadow-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[#e3edf7] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#002970] to-[#00baf2] text-white">
            <Bot className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-extrabold text-[#002970]">Paytm AI Conversational Guide</h2>
        </div>

        <div className="flex items-center gap-2">
          {isSpeaking && (
            <button
              type="button"
              onClick={onStopSpeaking}
              className="flex items-center gap-1.5 rounded-full bg-[#e01a59] px-3 py-1 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#c2185b] active:scale-95"
              title="Stop speaking"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>Stop Speaking</span>
            </button>
          )}

          {onToggleVoiceOutput && (
            <button
              type="button"
              onClick={() => onToggleVoiceOutput(!isVoiceOutputEnabled)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                isVoiceOutputEnabled
                  ? 'border border-[#00baf2]/30 bg-[#e7f6fd] text-[#002970] hover:bg-[#d6f0fc]'
                  : 'bg-[#f0f5fa] text-[#64748b] hover:bg-[#e3edf7]'
              }`}
              title={isVoiceOutputEnabled ? 'Voice readout is ON' : 'Voice readout is MUTED'}
            >
              {isVoiceOutputEnabled ? <Volume2 className="h-3.5 w-3.5 text-[#00baf2]" /> : <VolumeX className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{isVoiceOutputEnabled ? 'Voice On' : 'Voice Muted'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages viewport */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {messages.length === 0 && (
          <div className="my-6 space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7f6fd] text-[#002970]">
              <Sparkles className="h-6 w-6 text-[#00baf2]" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-[#002970]">How can Paytm AI assist your finances today?</p>
              <p className="text-xs text-[#64748b]">
                Ask questions about your uploaded agreements, salary breakdown, or financial twin metrics.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {SUGGESTED_QUESTIONS.map((question) => (
                <motion.button
                  key={question}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => submitText(question)}
                  disabled={disabled}
                  className="rounded-full border border-[#e3edf7] bg-[#f8fbfe] px-3.5 py-1.5 text-xs font-semibold text-[#002970] transition-all hover:border-[#00baf2] hover:bg-white hover:shadow-xs disabled:opacity-50"
                >
                  {question}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id || message.created_at || message.content} message={message} />
        ))}

        {disabled && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-2xl border border-[#e3edf7] bg-[#f8fbfe] px-4 py-3 text-xs font-bold text-[#002970]"
          >
            <div className="flex space-x-1">
              <span className="h-2 w-2 rounded-full bg-[#002970] animate-bounce" />
              <span className="h-2 w-2 rounded-full bg-[#0041a8] animate-bounce [animation-delay:0.2s]" />
              <span className="h-2 w-2 rounded-full bg-[#00baf2] animate-bounce [animation-delay:0.4s]" />
            </div>
            <span>Gemini is recalling memory &amp; formulating advice...</span>
          </motion.div>
        )}
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="border-t border-[#e3edf7] p-4">
        {/* Active Listening Soundwave Banner */}
        {isMicActive && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-2.5 flex items-center justify-between rounded-2xl border border-[#e01a59]/30 bg-gradient-to-r from-rose-50 to-[#fff1f5] px-4 py-2.5 shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e01a59] opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[#e01a59]" />
              </span>
              <div className="flex items-center gap-1.5 text-xs font-black text-[#e01a59]">
                <span>Listening to your voice...</span>
                <div className="flex items-center gap-0.5 ml-1">
                  <span className="h-3 w-1 rounded-full bg-[#e01a59] animate-pulse" />
                  <span className="h-4 w-1 rounded-full bg-[#e01a59] animate-pulse [animation-delay:0.2s]" />
                  <span className="h-2 w-1 rounded-full bg-[#e01a59] animate-pulse [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleMic}
              className="rounded-lg bg-white/90 px-2.5 py-1 text-xs font-bold text-[#e01a59] shadow-xs transition-all hover:bg-white"
            >
              Cancel
            </button>
          </motion.div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={handleInputChange}
            placeholder={
              isMicActive
                ? '🎙️ Listening... Speak your question now'
                : 'Type your financial question (English or हिंदी)...'
            }
            disabled={disabled || isMicActive}
            className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-medium text-[#0f172a] transition-all focus:outline-none focus:ring-3 ${
              isMicActive
                ? 'border-[#e01a59] bg-rose-50/50 text-[#e01a59] placeholder-[#e01a59] ring-2 ring-[#e01a59]/20'
                : 'border-[#e3edf7] bg-[#f8fbfe] focus:border-[#00baf2] focus:bg-white focus:ring-[#00baf2]/20'
            } disabled:opacity-50`}
          />

          {/* Ask in Voice Button */}
          {onToggleMic && isMicSupported && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              disabled={disabled}
              onClick={onToggleMic}
              title={isMicActive ? 'Click to stop listening' : 'Ask with Voice (English or हिंदी)'}
              aria-label={isMicActive ? 'Stop voice recording' : 'Ask with Voice'}
              className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all shadow-xs ${
                isMicActive
                  ? 'bg-[#e01a59] text-white shadow-md shadow-[#e01a59]/30 ring-4 ring-[#e01a59]/20 animate-pulse'
                  : 'border border-[#e3edf7] bg-[#f0f7fd] text-[#002970] hover:border-[#00baf2] hover:bg-white hover:text-[#00baf2]'
              } disabled:opacity-40`}
            >
              {isMicActive ? (
                <MicOff className="h-5 w-5 animate-bounce" />
              ) : (
                <Mic className="h-5 w-5 text-[#00baf2]" />
              )}
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={disabled || !draft.trim() || isMicActive}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-[#002970] to-[#0041a8] text-white shadow-md shadow-[#002970]/20 transition-all hover:shadow-lg disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </motion.button>
        </div>
      </form>
    </section>
  )
}
