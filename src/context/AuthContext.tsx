import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { authApi, type AuthUser } from '@/services/auth'
import { ApiError, UNAUTHORIZED_EVENT } from '@/services/http'
import {
  SETTINGS_CHANGED_EVENT,
  getSettings,
} from '@/services/settingsStore'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'disabled'

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  error: string | null
  login: (username: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialMode = getSettings().apiMode
  const [status, setStatus] = useState<AuthStatus>(
    initialMode === 'live' ? 'loading' : 'disabled',
  )
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lastMode = useRef(initialMode)

  const refresh = useCallback(async () => {
    const settings = getSettings()
    if (settings.apiMode !== 'live') {
      setStatus('disabled')
      setUser(null)
      setError(null)
      return
    }
    setStatus('loading')
    try {
      const result = await authApi.me()
      setUser(result.user)
      setStatus('authenticated')
      setError(null)
    } catch (cause) {
      setUser(null)
      setStatus('anonymous')
      setError(
        cause instanceof ApiError && cause.status !== 401 ? cause.message : null,
      )
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onUnauthorized = () => {
      setUser(null)
      setStatus('anonymous')
      setError('登录状态已失效，请重新登录')
    }
    const onSettingsChanged = () => {
      const mode = getSettings().apiMode
      if (mode === lastMode.current) return
      lastMode.current = mode
      void refresh()
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged)
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
      window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged)
    }
  }, [refresh])

  const login = useCallback(async (username: string, password: string) => {
    const result = await authApi.login(username, password)
    setUser(result.user)
    setStatus('authenticated')
    setError(null)
    return result.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, error, login, logout, refresh }),
    [status, user, error, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export function useIsAdmin() {
  const { user, status } = useAuth()
  return status === 'authenticated' && user?.role === 'ADMIN'
}
