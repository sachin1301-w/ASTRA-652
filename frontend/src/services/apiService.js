const RAW_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').trim()
const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '').replace(/\/api$/, '')
const TOKEN_KEY = 'finlens_access_token'

export function getAccessToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setAccessToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Authentication still works for the current page when storage is unavailable.
  }
}

export async function authenticatedFetch(url, options = {}) {
  const token = getAccessToken()
  const headers = new Headers(options.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(url, { ...options, headers })
  if (response.status === 401) {
    setAccessToken('')
    window.dispatchEvent(new Event('finlens:unauthorized'))
  }
  return response
}

async function authRequest(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message = data?.detail || data?.error || (typeof data === 'string' ? data : null)
    throw new Error(message || `Authentication failed (${response.status}). Please try again.`)
  }
  setAccessToken(data.access_token)
  return data
}

export function login(email, password) {
  return authRequest('/api/auth/login', { email: email.trim(), password })
}

export function register(name, email, password) {
  return authRequest('/api/auth/register', { name: name.trim(), email: email.trim(), password })
}

export function logout() {
  const token = getAccessToken()
  setAccessToken('')
  if (token) {
    fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
  }
}
