/**
 * Local, browser-only voice layer using the Web Speech API.
 *
 * Speech-to-text uses SpeechRecognition (mic input). Text-to-speech uses
 * speechSynthesis to read the AI's real text response aloud - this is the
 * browser's own synthesized voice, not Gemini-generated audio (that
 * required the streaming/LiveKit integrations this app no longer uses).
 * Both are feature-detected; callers should check `isSpeechRecognitionSupported`
 * / `isSpeechSynthesisSupported` before offering mic/voice-output controls.
 */
const SpeechRecognitionImpl = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

export const isSpeechRecognitionSupported = Boolean(SpeechRecognitionImpl)
export const isSpeechSynthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

const RECOGNITION_LOCALES = { en: 'en-IN', hi: 'hi-IN' }
const SYNTHESIS_LOCALES = { en: 'en-IN', hi: 'hi-IN' }

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices()
  }
}

let recognizer = null
let currentSpeechResolver = null

/**
 * Resolves the most natural voice available in the browser for the given language.
 * Prioritizes native Hindi voices on Windows/Chrome/Edge/Android/macOS.
 *
 * @param {'en' | 'hi'} [language='en']
 * @returns {SpeechSynthesisVoice | null}
 */
export function getBestVoice(language = 'en') {
  if (!isSpeechSynthesisSupported) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices || voices.length === 0) return null

  if (language === 'hi') {
    // 1. High-quality natural Hindi voices (Google हिन्दी, Microsoft Kalpana/Hemant)
    const hiNatural = voices.find(
      (v) =>
        (v.lang?.toLowerCase() === 'hi-in' || v.lang?.toLowerCase() === 'hi_in') &&
        (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Kalpana') || v.name.includes('Hemant'))
    )
    if (hiNatural) return hiNatural

    // 2. Any exact hi-IN locale voice
    const hiExact = voices.find((v) => v.lang?.toLowerCase() === 'hi-in' || v.lang?.toLowerCase() === 'hi_in')
    if (hiExact) return hiExact

    // 3. Language code prefix matching
    const hiPrefix = voices.find((v) => v.lang?.toLowerCase().startsWith('hi'))
    if (hiPrefix) return hiPrefix

    // 4. Name containing Hindi or हिन्दी
    const hiName = voices.find((v) => /hindi|हिन्दी/i.test(v.name))
    if (hiName) return hiName
  }

  const targetLocale = SYNTHESIS_LOCALES[language] ?? SYNTHESIS_LOCALES.en
  return (
    voices.find((v) => v.lang?.toLowerCase() === targetLocale.toLowerCase()) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith(language)) ||
    null
  )
}

/**
 * Strips raw markdown syntax, asterisks, bullet markers, and formatting symbols
 * so SpeechSynthesis reads text cleanly and naturally without saying "asterisk" or "star".
 * Also formats Indian financial terminology (₹, %, p.a., EMI) for smooth pronunciation.
 *
 * @param {string} text
 * @param {'en' | 'hi'} [language='en']
 * @returns {string}
 */
export function formatTextForSpeech(text, language = 'en') {
  if (!text) return ''

  let clean = text
    // Remove markdown code blocks and inline code
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    // Remove markdown links but keep anchor text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold and italic markers (asterisks and underscores)
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Remove strikethrough
    .replace(/~~([^~]+)~~/g, '$1')
    // Remove blockquotes and list markers
    .replace(/^>\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Replace Rupee symbols with natural spoken words
    .replace(/(?:₹|Rs\.?|INR)\s*([0-9,]+(?:\.[0-9]+)?)/gi, language === 'hi' ? '$1 रुपये' : '$1 rupees')
    .replace(/₹/g, language === 'hi' ? 'रुपये ' : 'rupees ')
    // Replace percent symbol
    .replace(/%/g, language === 'hi' ? ' प्रतिशत' : ' percent')
    // Replace recurring financial frequency abbreviations
    .replace(/\b(p\.a\.|per annum)\b/gi, language === 'hi' ? 'प्रति वर्ष' : 'per annum')
    .replace(/\b(p\.m\.|per month)\b/gi, language === 'hi' ? 'प्रति माह' : 'per month')
    .replace(/\bEMI\b/g, language === 'hi' ? 'ईएमआई' : 'EMI')
    // Strip any remaining asterisks, hashes, backticks, tildes, pipes, brackets
    .replace(/[*#`~|>\[\]{}]/g, ' ')
    // Normalize spaces and line breaks
    .replace(/\s+/g, ' ')
    .trim()

  return clean
}

/**
 * Starts listening once and resolves with the final transcript.
 * @param {'en' | 'hi'} language
 * @param {{ onStart?: () => void, onEnd?: () => void }} [callbacks]
 * @returns {Promise<string>}
 */
export function listenOnce(language, callbacks = {}) {
  return new Promise((resolve, reject) => {
    if (!isSpeechRecognitionSupported) {
      reject(new Error('Speech recognition is not supported in this browser.'))
      return
    }
    stopListening()

    recognizer = new SpeechRecognitionImpl()
    recognizer.lang = RECOGNITION_LOCALES[language] ?? RECOGNITION_LOCALES.en
    recognizer.interimResults = false
    recognizer.maxAlternatives = 1

    recognizer.onstart = () => callbacks.onStart?.()
    recognizer.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      resolve(transcript)
    }
    recognizer.onerror = (event) => {
      reject(new Error(mapRecognitionError(event.error)))
    }
    recognizer.onend = () => {
      callbacks.onEnd?.()
      recognizer = null
    }

    recognizer.start()
  })
}

export function stopListening() {
  recognizer?.abort()
  recognizer = null
}

function mapRecognitionError(code) {
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return 'Microphone permission was denied. Please allow microphone access and try again.'
  }
  if (code === 'no-speech') {
    return "Didn't catch that - please try speaking again."
  }
  return `Speech recognition error: ${code}`
}

const RAW_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').trim()
const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '').replace(/\/api$/, '')
let currentAudio = null

/**
 * Plays high-definition speech audio generated by the backend Sarvam TTS engine.
 * Guaranteed to work on all devices, even when Windows does not have a Hindi voice installed.
 *
 * @param {string} text
 * @param {'en' | 'hi'} [language='hi']
 * @returns {Promise<void>}
 */
export function playServerTts(text, language = 'hi') {
  return new Promise(async (resolve) => {
    stopSpeaking()

    try {
      const response = await fetch(`${API_BASE_URL}/api/speech/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      })

      if (!response.ok) {
        throw new Error('TTS server error')
      }

      const blob = await response.blob()
      const audioUrl = URL.createObjectURL(blob)
      const audio = new Audio(audioUrl)
      currentAudio = audio

      currentSpeechResolver = () => {
        audio.pause()
        audio.currentTime = 0
        URL.revokeObjectURL(audioUrl)
        currentAudio = null
        resolve()
      }

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        currentAudio = null
        currentSpeechResolver = null
        resolve()
      }

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl)
        currentAudio = null
        currentSpeechResolver = null
        resolve()
      }

      await audio.play()
    } catch (err) {
      console.warn('[TTS] Server audio failed, falling back to local speech synthesis:', err)
      speakLocal(text, language).then(resolve).catch(resolve)
    }
  })
}

/**
 * Transcribes a recorded audio blob with the configured server speech provider.
 *
 * @param {Blob} audio
 * @param {'en' | 'hi'} [language='hi']
 * @returns {Promise<string>}
 */
export async function transcribeAudio(audio, language = 'hi') {
  const formData = new FormData()
  formData.append('audio', audio, 'recording.webm')
  formData.append('language', language)

  const response = await fetch(`${API_BASE_URL}/api/speech/stt`, {
    method: 'POST',
    body: formData,
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.detail || result.error || 'Speech transcription failed.')
  }
  return result.transcript || ''
}

function speakLocal(cleanText, language) {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported || !cleanText) {
      resolve()
      return
    }

    const utterance = new SpeechSynthesisUtterance(cleanText)
    const targetLocale = SYNTHESIS_LOCALES[language] ?? SYNTHESIS_LOCALES.en
    utterance.lang = targetLocale
    const bestVoice = getBestVoice(language)
    if (bestVoice) utterance.voice = bestVoice

    currentSpeechResolver = resolve

    utterance.onend = () => {
      if (currentSpeechResolver === resolve) {
        currentSpeechResolver = null
      }
      resolve()
    }
    utterance.onerror = () => {
      if (currentSpeechResolver === resolve) {
        currentSpeechResolver = null
      }
      resolve()
    }

    window.speechSynthesis.speak(utterance)
  })
}

/**
 * Reads text aloud through Sarvam on the backend, falling back to browser speech
 * synthesis if the server provider is unavailable.
 *
 * @param {string} text
 * @param {'en' | 'hi'} language
 * @returns {Promise<void>}
 */
export function speak(text, language = 'en') {
  stopSpeaking()

  const cleanText = formatTextForSpeech(text, language)
  if (!cleanText) return Promise.resolve()

  return playServerTts(cleanText, language)
}

export function stopSpeaking() {
  if (currentAudio) {
    try {
      currentAudio.pause()
      currentAudio.currentTime = 0
    } catch {}
    currentAudio = null
  }
  if (currentSpeechResolver) {
    const r = currentSpeechResolver
    currentSpeechResolver = null
    r()
  }
  if (isSpeechSynthesisSupported) {
    try {
      window.speechSynthesis.cancel()
    } catch {
      // Ignore
    }
  }
}

export function isSpeechActive() {
  return Boolean(currentSpeechResolver || currentAudio)
}
