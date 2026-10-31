const RAW_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').trim()
const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '').replace(/\/api$/, '')

/**
 * Fetch Convai 3D avatar configuration from backend API.
 * Gracefully falls back to client environment variable if backend is unreachable.
 *
 * @returns {Promise<{ experience_id: string, configured: boolean }>}
 */
export async function fetchConvaiConfig() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/convai/config`)
    if (response.ok) {
      const data = await response.json()
      if (data?.experience_id) {
        return data
      }
    }
  } catch {
    // Network or API failure fallback
  }

  const fallbackId = (import.meta.env.VITE_CONVAI_EXPERIENCE_ID || '').trim()
  return {
    experience_id: fallbackId,
    configured: Boolean(fallbackId),
  }
}
