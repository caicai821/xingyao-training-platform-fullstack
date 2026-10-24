import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { BrandMark } from '@/components/brand/BrandMark'
import { useAppData } from '@/context/AppDataContext'
import { useAuth } from '@/context/AuthContext'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import LearnersPage from '@/pages/learners/LearnersPage'
import LearnerFormPage from '@/pages/learners/LearnerFormPage'
import LearnerDetailPage from '@/pages/learners/LearnerDetailPage'
import AssessmentPage from '@/pages/learners/AssessmentPage'
import ProfilesPage from '@/pages/profiles/ProfilesPage'
import ProfilePage from '@/pages/profiles/ProfilePage'
import GoalsPage from '@/pages/goals/GoalsPage'
import GoalFormPage from '@/pages/goals/GoalFormPage'
import ScriptsPage from '@/pages/scripts/ScriptsPage'
import ScriptWizardPage from '@/pages/scripts/ScriptWizardPage'
import ScriptDetailPage from '@/pages/scripts/ScriptDetailPage'
import SceneCenterPage from '@/pages/scenes/SceneCenterPage'
import TextScenePage from '@/pages/scenes/TextScenePage'
import ImageScenePage from '@/pages/scenes/ImageScenePage'
import ScriptScenePage from '@/pages/scenes/ScriptScenePage'
import TasksPage from '@/pages/scenes/TasksPage'
import TaskDetailPage from '@/pages/scenes/TaskDetailPage'
import TaskResultPage from '@/pages/scenes/TaskResultPage'
import AssetsPage from '@/pages/assets/AssetsPage'
import AssetDetailPage from '@/pages/assets/AssetDetailPage'
import RecordsPage from '@/pages/RecordsPage'
import SettingsPage from '@/pages/SettingsPage'
import NotFoundPage from '@/pages/NotFoundPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

function AuthCheckingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app-atmosphere px-6">
      <div className="flex flex-col items-center text-center">
        <div className="relative flex size-16 items-center justify-center">
          <span className="absolute inset-1 rounded-full bg-accent-200/45 blur-2xl animate-pulse-soft" />
          <BrandMark className="relative size-14" />
        </div>
        <p className="mt-4 text-sm font-medium text-ink-800">正在确认登录状态</p>
        <p className="mt-1 text-xs text-ink-400">真实 API 模式需要先登录后访问训练工作区。</p>
      </div>
    </div>
  )
}

function WorkspaceGuard() {
  const { settings } = useAppData()
  const { status } = useAuth()
  const location = useLocation()

  if (settings.apiMode !== 'live') return <AppLayout />
  if (status === 'loading') return <AuthCheckingScreen />
  if (status !== 'authenticated') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }
  return <AppLayout />
}

function LoginRoute() {
  const { settings } = useAppData()
  const { status } = useAuth()
  if (settings.apiMode === 'live') {
    if (status === 'loading') return <AuthCheckingScreen />
    if (status === 'authenticated') return <Navigate to="/dashboard" replace />
  }
  return <LoginPage />
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="login" element={<LoginRoute />} />
        <Route element={<WorkspaceGuard />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="learners" element={<LearnersPage />} />
          <Route path="learners/new" element={<LearnerFormPage />} />
          <Route path="learners/:id" element={<LearnerDetailPage />} />
          <Route path="learners/:id/edit" element={<LearnerFormPage />} />
          <Route path="learners/:id/assessment" element={<AssessmentPage />} />
          <Route path="profiles" element={<ProfilesPage />} />
          <Route path="profiles/:learnerId" element={<ProfilePage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="goals/new" element={<GoalFormPage />} />
          <Route path="scripts" element={<ScriptsPage />} />
          <Route path="scripts/new" element={<ScriptWizardPage />} />
          <Route path="scripts/:id" element={<ScriptDetailPage />} />
          <Route path="scenes" element={<SceneCenterPage />} />
          <Route path="scenes/text" element={<TextScenePage />} />
          <Route path="scenes/image" element={<ImageScenePage />} />
          <Route path="scenes/script" element={<ScriptScenePage />} />
          <Route path="scenes/script/:scriptId" element={<ScriptScenePage />} />
          <Route path="scenes/tasks" element={<TasksPage />} />
          <Route path="scenes/tasks/:id" element={<TaskDetailPage />} />
          <Route path="scenes/tasks/:id/result" element={<TaskResultPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="assets/:id" element={<AssetDetailPage />} />
          <Route path="records" element={<RecordsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  )
}
