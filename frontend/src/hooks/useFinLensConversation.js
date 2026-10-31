import { useEffect, useState } from 'react'
import { sendMessage } from '../services/geminiService'
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  listenOnce,
  speak,
  stopListening,
  stopSpeaking,
} from '../services/speechService'

let nextMessageId = 1
function makeMessage(role, content) {
  return { id: nextMessageId++, role, content }
}

const VOICE_PREF_KEY = 'finlens_voice_output'

/**
 * Shared conversation state for both Dashboard's avatar/chat panel and the
 * dedicated Assistant page - same session, same message list, so asking a
 * question on one page and continuing on the other feels like one
 * conversation, not two.
 */
export function useFinLensConversation(language, model) {
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('idle') // 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'
  const [isMicActive, setIsMicActive] = useState(false)
  const [error, setError] = useState('')
  const [isVoiceOutputEnabled, setIsVoiceOutputEnabledState] = useState(() => {
    try {
      return localStorage.getItem(VOICE_PREF_KEY) !== 'false'
    } catch {
      return true
    }
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking()
      stopListening()
    }
  }, [])

  function setVoiceOutputEnabled(enabled) {
    setIsVoiceOutputEnabledState(enabled)
    try {
      localStorage.setItem(VOICE_PREF_KEY, String(enabled))
    } catch {
      // Ignore
    }
    if (!enabled) {
      handleStopSpeaking()
    }
  }

  function handleStopSpeaking() {
    stopSpeaking()
    setStatus((prev) => (prev === 'speaking' ? 'idle' : prev))
  }

  async function askFinLens(question, { dynamicContext, displayText } = {}) {
    handleStopSpeaking()
    setMessages((prev) => [...prev, makeMessage('user', displayText ?? question)])
    setStatus('thinking')
    setError('')
    try {
      const result = await sendMessage({ question, language, dynamicContext, model })
      setMessages((prev) => [...prev, makeMessage('assistant', result.text)])

      if (isVoiceOutputEnabled && isSpeechSynthesisSupported) {
        setStatus('speaking')
        await speak(result.text, language).catch(() => {})
      }
      setStatus('idle')
    } catch (err) {
      console.error('[Gemini] Error', err)
      setError(err.message || 'FinLens AI is unavailable right now. Please try again.')
      setStatus('error')
    }
  }

  async function toggleMic() {
    handleStopSpeaking()
    if (isMicActive) {
      stopListening()
      setIsMicActive(false)
      setStatus('idle')
      return
    }

    setIsMicActive(true)
    setStatus('listening')
    setError('')
    try {
      const transcript = await listenOnce(language, { onEnd: () => setIsMicActive(false) })
      if (transcript.trim()) {
        await askFinLens(transcript.trim())
      } else {
        setStatus('idle')
      }
    } catch (err) {
      console.error('[Speech] Error', err)
      setError(err.message)
      setStatus('error')
      setIsMicActive(false)
    }
  }

  function resetConversation() {
    handleStopSpeaking()
    setMessages([])
    setError('')
    setStatus('idle')
  }

  return {
    messages,
    status,
    isMicActive,
    error,
    askFinLens,
    toggleMic,
    resetConversation,
    stopSpeaking: handleStopSpeaking,
    isSpeaking: status === 'speaking',
    isVoiceOutputEnabled,
    setVoiceOutputEnabled,
    isMicSupported: isSpeechRecognitionSupported,
    isSpeechOutputSupported: isSpeechSynthesisSupported,
  }
}
