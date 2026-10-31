import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bot, Square, Volume2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { isSpeechSynthesisSupported, speak, stopSpeaking } from '../services/speechService'

export default function MessageBubble({ message }) {
  const fromUser = message.role === 'user'
  const [isPlaying, setIsPlaying] = useState(false)
  const isHindi = /[\u0900-\u097F]/.test(message.content)

  async function handleToggleSpeech() {
    if (isPlaying) {
      stopSpeaking()
      setIsPlaying(false)
      return
    }

    stopSpeaking()
    setIsPlaying(true)
    const lang = isHindi ? 'hi' : 'en'
    try {
      await speak(message.content, lang)
    } finally {
      setIsPlaying(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex ${fromUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] rounded-3xl px-5 py-3.5 text-sm leading-relaxed shadow-sm transition-all ${
          fromUser
            ? 'rounded-br-sm bg-gradient-to-r from-[#002970] to-[#0041a8] text-white shadow-[#002970]/15'
            : 'rounded-bl-sm border border-[#e3edf7] bg-white text-[#0f172a] shadow-[#002970]/5'
        }`}
      >
        {fromUser ? (
          <p className="whitespace-pre-wrap font-medium">{message.content}</p>
        ) : (
          <div className="prose-sm max-w-none text-[#0f172a]">
            {/* Paytm Ai Message Header Badge */}
            <div className="mb-2.5 flex items-center justify-between border-b border-[#e3edf7] pb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-[#002970] to-[#00baf2] text-white">
                  <Bot className="h-3 w-3" />
                </div>
                <div className="flex items-center text-xs font-black">
                  <span className="text-[#002970]">pay<span className="text-[#00baf2]">tm</span></span>
                  <span className="animate-heart-pulse mx-0.5 text-[10px] text-[#e01a59]">❤️</span>
                  <span className="text-[#002970]">Ai</span>
                </div>
              </div>
              <span className="rounded-md bg-[#f0f7fd] px-1.5 py-0.5 text-[10px] font-bold text-[#526484]">
                Verified Analysis
              </span>
            </div>

            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-2 font-normal leading-relaxed last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-extrabold text-[#002970]">{children}</strong>,
                ul: ({ children }) => <ul className="my-2 space-y-1 pl-5 list-disc">{children}</ul>,
                ol: ({ children }) => <ol className="my-2 space-y-1 pl-5 list-decimal">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                h1: ({ children }) => <h1 className="mb-1.5 mt-3 text-base font-black text-[#002970]">{children}</h1>,
                h2: ({ children }) => <h2 className="mb-1 mt-2.5 text-sm font-bold text-[#002970]">{children}</h2>,
                h3: ({ children }) => <h3 className="mb-1 mt-2 text-xs font-bold text-[#002970]">{children}</h3>,
                table: ({ children }) => (
                  <div className="my-2 overflow-x-auto rounded-xl border border-[#e3edf7]">
                    <table className="min-w-full divide-y divide-[#e3edf7] text-xs">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="bg-[#f0f7fd] px-3 py-2 text-left font-bold text-[#002970]">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border-t border-[#e3edf7] px-3 py-2 text-[#0f172a]/90">
                    {children}
                  </td>
                ),
                code: ({ children }) => (
                  <code className="rounded bg-[#f0f5fa] px-1.5 py-0.5 font-mono text-xs font-semibold text-[#002970]">
                    {children}
                  </code>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>

            {isSpeechSynthesisSupported && (
              <div className="mt-3 flex items-center justify-between border-t border-[#e3edf7] pt-2 text-xs">
                <button
                  type="button"
                  onClick={handleToggleSpeech}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1 font-bold transition-all hover:bg-[#f0f7fd] active:scale-95"
                >
                  {isPlaying ? (
                    <>
                      <div className="flex items-center gap-0.5">
                        <span className="w-1 bg-[#e01a59] animate-bar-1" />
                        <span className="w-1 bg-[#e01a59] animate-bar-2" />
                        <span className="w-1 bg-[#e01a59] animate-bar-3" />
                      </div>
                      <Square className="h-3 w-3 fill-[#e01a59] text-[#e01a59]" />
                      <span className="font-extrabold text-[#e01a59]">{isHindi ? 'रोकें (Stop)' : 'Stop Audio'}</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3.5 w-3.5 text-[#00baf2]" />
                      <span className="text-[#002970]">{isHindi ? 'हिंदी में सुनें' : 'Listen Aloud'}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
