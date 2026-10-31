import axios from 'axios'

const RAW_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').trim()
const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '').replace(/\/api$/, '')

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

function extractErrorMessage(error, fallback) {
  if (error.response?.data?.error) return error.response.data.error
  if (error.response?.data?.detail) {
    const { detail } = error.response.data
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
  }
  if (error.code === 'ECONNABORTED') return 'The request took too long. Please try again.'
  if (!error.response) return 'Could not reach the Sahayak server. Please check your connection and try again.'
  return fallback
}

export async function login(email, password) {
  try {
    const { data } = await api.post('/api/auth/login', { email, password })
    return data
  } catch (error) {
    throw new Error(extractErrorMessage(error, 'Login failed. Please try again.'))
  }
}

export async function analyzeQuestion({ image, question, language }) {
  const formData = new FormData()
  formData.append('image', image)
  formData.append('question', question)
  formData.append('language', language)

  try {
    const { data } = await api.post('/api/assistant/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  } catch (error) {
    throw new Error(extractErrorMessage(error, 'Sahayak could not process your request. Please try again.'))
  }
}
