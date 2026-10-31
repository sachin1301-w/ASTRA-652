import { createContext, useContext, useEffect, useState } from 'react'
import { getProfile, saveProfileAsset, updateProfile } from '../services/financeService'

const STORAGE_KEY = 'finlens_financial_twin'

const DEFAULT_TWIN = {
  name: 'Rahul Sharma',
  monthlyIncome: 70833,
  monthlyExpenses: 32000,
  existingEmis: 14000,
  savings: 150000,
  investments: 0,
  creditScore: null,
  goals: '',
  riskTolerance: 'Moderate',
  employmentType: 'Salaried',
  loans: [],
  insurancePolicies: [],
  monthlyInsurancePremiums: 0,
}

const FinancialTwinContext = createContext(null)

function loadTwin() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_TWIN, ...JSON.parse(raw) } : DEFAULT_TWIN
  } catch {
    return DEFAULT_TWIN
  }
}

function mapProfile(profile) {
  return {
    name: profile.name,
    monthlyIncome: profile.monthly_income,
    monthlyExpenses: profile.monthly_expenses,
    existingEmis: profile.existing_emis,
    savings: profile.savings,
    investments: profile.investments,
    creditScore: profile.credit_score,
    goals: profile.goals,
    riskTolerance: profile.risk_tolerance,
    employmentType: profile.employment_type,
    monthlyInsurancePremiums: profile.monthly_insurance_premiums,
    loans: (profile.loans || []).map((item) => ({ ...item, id: item.document_id })),
    insurancePolicies: (profile.insurance_policies || []).map((item) => ({ ...item, id: item.document_id })),
  }
}

const PROFILE_FIELD_MAP = {
  name: 'name',
  monthlyIncome: 'monthly_income',
  monthlyExpenses: 'monthly_expenses',
  existingEmis: 'existing_emis',
  savings: 'savings',
  investments: 'investments',
  creditScore: 'credit_score',
  goals: 'goals',
  riskTolerance: 'risk_tolerance',
  employmentType: 'employment_type',
}

export function FinancialTwinProvider({ children, userId, userName }) {
  const [twin, setTwin] = useState(loadTwin)
  const [isProfileLoading, setIsProfileLoading] = useState(Boolean(userId))
  const [profileError, setProfileError] = useState('')

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setIsProfileLoading(true)
    getProfile(userId)
      .then(async (profile) => {
        const migrationKey = `finlens_profile_db_synced_${userId}`
        let hasMigrated = false
        try {
          hasMigrated = localStorage.getItem(migrationKey) === 'true'
        } catch {
          // Continue with the database profile when browser storage is unavailable.
        }

        let resolvedProfile = profile
        if (!hasMigrated) {
          const storedTwin = loadTwin()
          const migrationPatch = Object.fromEntries(
            Object.entries(storedTwin)
              .filter(([key]) => PROFILE_FIELD_MAP[key])
              .map(([key, value]) => [PROFILE_FIELD_MAP[key], value]),
          )
          if (!migrationPatch.name && userName) migrationPatch.name = userName
          resolvedProfile = await updateProfile(userId, migrationPatch)
          try {
            localStorage.setItem(migrationKey, 'true')
          } catch {
            // The migration is still valid for this session.
          }
        } else if (!profile.name && userName) {
          resolvedProfile = await updateProfile(userId, { name: userName })
        }
        if (!cancelled) setTwin((previous) => ({ ...previous, ...mapProfile(resolvedProfile) }))
      })
      .catch((error) => {
        if (!cancelled) setProfileError(error.message)
      })
      .finally(() => {
        if (!cancelled) setIsProfileLoading(false)
      })
    return () => { cancelled = true }
  }, [userId, userName])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(twin))
    } catch {
      // localStorage unavailable (e.g. private browsing) - twin still works for this session.
    }
  }, [twin])

  function updateTwin(patch) {
    setTwin((prev) => ({ ...prev, ...patch }))
    if (userId) {
      const backendPatch = Object.fromEntries(
        Object.entries(patch)
          .filter(([key]) => PROFILE_FIELD_MAP[key])
          .map(([key, value]) => [PROFILE_FIELD_MAP[key], value]),
      )
      if (Object.keys(backendPatch).length > 0) {
        updateProfile(userId, backendPatch).catch((error) => setProfileError(error.message))
      }
    }
  }

  async function saveAssetToProfile(assetType, asset) {
    if (!userId) throw new Error('Please log in before saving this document.')
    const profile = await saveProfileAsset(userId, assetType, asset)
    setTwin((previous) => ({ ...previous, ...mapProfile(profile) }))
    setProfileError('')
  }

  const monthlySurplus = twin.monthlyIncome - twin.monthlyExpenses - twin.existingEmis

  return (
    <FinancialTwinContext.Provider value={{
      twin,
      updateTwin,
      saveAssetToProfile,
      monthlySurplus,
      isProfileLoading,
      profileError,
    }}>
      {children}
    </FinancialTwinContext.Provider>
  )
}

export function useFinancialTwin() {
  const ctx = useContext(FinancialTwinContext)
  if (!ctx) throw new Error('useFinancialTwin must be used within FinancialTwinProvider')
  return ctx
}
