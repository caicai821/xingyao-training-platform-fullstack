import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  AbilityAssessment,
  AbilityProfile,
  Activity,
  AppSettings,
  Learner,
  SceneAsset,
  SceneTask,
  TrainingGoal,
  TrainingScript,
} from '@/types'
import { createServices, getSettings, saveSettings, type TrainingServices } from '@/services'
import { useAuth } from './AuthContext'

interface AppDataState {
  learners: Learner[]
  assessments: AbilityAssessment[]
  profiles: AbilityProfile[]
  goals: TrainingGoal[]
  scripts: TrainingScript[]
  tasks: SceneTask[]
  assets: SceneAsset[]
  activities: Activity[]
}

interface AppDataContextValue extends AppDataState {
  services: TrainingServices
  settings: AppSettings
  loading: boolean
  initialized: boolean
  error: string | null
  refreshAll: (silent?: boolean) => Promise<void>
  refreshTasks: () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => void
  resetDemoData: () => Promise<void>
}

const emptyState: AppDataState = {
  learners: [],
  assessments: [],
  profiles: [],
  goals: [],
  scripts: [],
  tasks: [],
  assets: [],
  activities: [],
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth()
  const [settings, setSettings] = useState<AppSettings>(() => getSettings())
  const [data, setData] = useState<AppDataState>(emptyState)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const services = useMemo(() => createServices(settings), [settings.apiMode])

  const refreshAll = useCallback(
    async (silent = false) => {
      if (settings.apiMode === 'live' && authStatus !== 'authenticated') {
        setLoading(authStatus === 'loading')
        setError(null)
        return
      }
      if (!silent) setLoading(true)
      setError(null)
      try {
        const [learners, assessments, profiles, goals, scripts, tasks, assets, activities] =
          await Promise.all([
            services.learners.list(),
            services.assessments.list(),
            services.profiles.list(),
            services.goals.list(),
            services.scripts.list(),
            services.tasks.list(),
            services.assets.list(),
            services.activities.list(),
          ])
        setData({ learners, assessments, profiles, goals, scripts, tasks, assets, activities })
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '数据加载失败，请稍后重试')
      } finally {
        setLoading(false)
        setInitialized(true)
      }
    },
    [services, settings.apiMode, authStatus],
  )

  const refreshTasks = useCallback(async () => {
    try {
      await services.tasks.sync()
      const [tasks, assets, activities] = await Promise.all([
        services.tasks.list(),
        services.assets.list(),
        services.activities.list(),
      ])
      setData((previous) => ({ ...previous, tasks, assets, activities }))
    } catch {
      // Polling failures should not interrupt the workspace; the next tick retries.
    }
  }, [services])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll, authStatus])

  const hasActiveTasks = data.tasks.some((task) =>
    ['pending', 'queued', 'generating'].includes(task.status),
  )

  useEffect(() => {
    if (!hasActiveTasks) return
    const timer = window.setInterval(() => {
      void refreshTasks()
    }, 1600)
    return () => window.clearInterval(timer)
  }, [hasActiveTasks, refreshTasks])

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      const next = saveSettings(patch)
      setSettings(next)
      if (patch.apiMode && patch.apiMode !== settings.apiMode) {
        setInitialized(false)
        setLoading(true)
      }
    },
    [settings.apiMode],
  )

  const resetDemoData = useCallback(async () => {
    await services.settings.resetDemoData()
    const next = getSettings()
    setSettings(next)
    setInitialized(false)
    setLoading(true)
    setData(emptyState)
    await refreshAll()
  }, [services, refreshAll])

  const value: AppDataContextValue = {
    ...data,
    services,
    settings,
    loading,
    initialized,
    error,
    refreshAll,
    refreshTasks,
    updateSettings,
    resetDemoData,
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const context = useContext(AppDataContext)
  if (!context) throw new Error('useAppData must be used within AppDataProvider')
  return context
}

export function useLearnerMap() {
  const { learners } = useAppData()
  return useMemo(() => new Map(learners.map((learner) => [learner.id, learner])), [learners])
}

export function useGoalMap() {
  const { goals } = useAppData()
  return useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals])
}

export function useScriptMap() {
  const { scripts } = useAppData()
  return useMemo(() => new Map(scripts.map((script) => [script.id, script])), [scripts])
}
