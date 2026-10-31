import { useEffect, useState } from 'react'
import { Navigate, Outlet, Route, BrowserRouter, Routes, useOutletContext } from 'react-router-dom'
import Header from './components/Header'
import { FinancialTwinProvider } from './context/FinancialTwinContext'
import Assistant from './pages/Assistant'
import Dashboard from './pages/Dashboard'
import ConvaiAdvisor from './pages/ConvaiAdvisor'
import Documents from './pages/Documents'
import FinancialTwin from './pages/FinancialTwin'
import HealthScore from './pages/HealthScore'
import Insights from './pages/Insights'
import Login from './pages/Login'
import Products from './pages/Products'
import Settings from './pages/Settings'
import Simulator from './pages/Simulator'
import Transactions from './pages/Transactions'
import { logout } from './services/apiService'
import { GEMINI_MODELS } from './services/geminiModels'

const STORAGE_KEY = 'finlens_user'
const GEMINI_MODEL_KEY = 'finlens_gemini_model'
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash'

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Every page reads { user, language } via this hook instead of props drilling. */
export function usePageContext() {
  return useOutletContext()
}

function AppLayout({ user, language, setLanguage, geminiModel, setGeminiModel, onLogout }) {
  return (
    <div className="flex min-h-screen flex-col bg-brand-beige">
      <Header
        user={user}
        language={language}
        onLanguageChange={setLanguage}
        geminiModel={geminiModel}
        onGeminiModelChange={setGeminiModel}
        onLogout={onLogout}
      />
      <Outlet context={{ user, language, geminiModel, setGeminiModel }} />
    </div>
  )
}

function App() {
  const [user, setUser] = useState(loadStoredUser)
  const [language, setLanguage] = useState('en')
  const [geminiModel, setGeminiModelState] = useState(() => {
    try {
      const storedModel = localStorage.getItem(GEMINI_MODEL_KEY)
      return GEMINI_MODELS.some(({ value }) => value === storedModel) ? storedModel : DEFAULT_GEMINI_MODEL
    } catch {
      return DEFAULT_GEMINI_MODEL
    }
  })

  useEffect(() => {
    const handleUnauthorized = () => handleLogout()
    window.addEventListener('finlens:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('finlens:unauthorized', handleUnauthorized)
  }, [])

  function handleLogin(loggedInUser) {
    setUser(loggedInUser)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedInUser))
    } catch {
      // localStorage may be unavailable (e.g. private browsing) - login still works for this session.
    }
  }

  function handleLogout() {
    logout()
    setUser(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  function setGeminiModel(model) {
    setGeminiModelState(model)
    try {
      localStorage.setItem(GEMINI_MODEL_KEY, model)
    } catch {
      // Keep the selection for this session when browser storage is unavailable.
    }
  }

  return (
    <FinancialTwinProvider userId={user?.id} userName={user?.name}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={user ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />}
          />
          {user ? (
            <Route
              element={
                <AppLayout
                  user={user}
                  language={language}
                  setLanguage={setLanguage}
                  geminiModel={geminiModel}
                  setGeminiModel={setGeminiModel}
                  onLogout={handleLogout}
                />
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/financial-twin" element={<FinancialTwin />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/health-score" element={<HealthScore />} />
              <Route path="/products" element={<Products />} />
              <Route path="/simulator" element={<Simulator />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/advisor" element={<ConvaiAdvisor />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          ) : (
            <Route path="*" element={<Navigate to="/login" replace />} />
          )}
        </Routes>
      </BrowserRouter>
    </FinancialTwinProvider>
  )
}

export default App
