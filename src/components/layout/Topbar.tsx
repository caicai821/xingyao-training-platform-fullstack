import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  Box,
  ChevronDown,
  FileText,
  History,
  Image as ImageIcon,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Target,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { useAuth } from '@/context/AuthContext'
import { roleLabel } from '@/services/auth'
import { Badge, Modal } from '@/components/ui'
import { Button, IconButton } from '@/components/ui/Button'
import { relativeTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface SearchResult {
  group: string
  title: string
  subtitle: string
  to: string
}

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { learners, scripts, assets, tasks, activities, settings } = useAppData()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isLive = settings.apiMode === 'live'
  const displayName = isLive ? (user?.displayName ?? '未登录') : '星耀童行管理员'
  const roleName = isLive ? (user ? roleLabel[user.role] : '') : '系统管理员'
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const activeTasks = tasks.filter((task) =>
    ['pending', 'queued', 'generating'].includes(task.status),
  ).length

  const groups = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return [] as { label: string; items: SearchResult[] }[]
    const learnerMap = new Map(learners.map((learner) => [learner.id, learner]))
    const match = (...values: (string | undefined)[]) =>
      values.some((value) => value?.toLowerCase().includes(keyword))

    const learnerResults: SearchResult[] = learners
      .filter((learner) => match(learner.name, learner.code, learner.currentGoalText, ...learner.traits))
      .slice(0, 4)
      .map((learner) => ({
        group: '学员档案',
        title: learner.name,
        subtitle: `${learner.code} · ${learner.ageGroup}`,
        to: `/learners/${learner.id}`,
      }))

    const scriptResults: SearchResult[] = scripts
      .filter((script) => match(script.name, script.code, script.objective))
      .slice(0, 4)
      .map((script) => ({
        group: '训练脚本',
        title: script.name,
        subtitle: `${script.code} · ${learnerMap.get(script.learnerId)?.name ?? '未关联学员'}`,
        to: `/scripts/${script.id}`,
      }))

    const taskResults: SearchResult[] = tasks
      .filter((task) => match(task.sceneName, task.code, task.prompt))
      .slice(0, 3)
      .map((task) => ({
        group: '场景任务',
        title: task.sceneName,
        subtitle: `${task.code} · ${task.sceneConfig.sceneType}`,
        to: `/scenes/tasks/${task.id}`,
      }))

    const assetResults: SearchResult[] = assets
      .filter((asset) => match(asset.name, asset.sceneType, asset.description))
      .slice(0, 3)
      .map((asset) => ({
        group: '场景资产',
        title: asset.name,
        subtitle: `${asset.sceneType} · ${asset.description.slice(0, 24)}`,
        to: `/assets/${asset.id}`,
      }))

    return [
      { label: '学员档案', items: learnerResults },
      { label: '训练脚本', items: scriptResults },
      { label: '场景任务', items: taskResults },
      { label: '场景资产', items: assetResults },
    ].filter((group) => group.items.length > 0)
  }, [assets, learners, query, scripts, tasks])

  const go = (to: string) => {
    setSearchOpen(false)
    setQuery('')
    setMenuOpen(false)
    setNotificationsOpen(false)
    setAccountOpen(false)
    navigate(to)
  }

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-line/60 bg-white/75 px-4 backdrop-blur-xl sm:px-5 lg:px-8">
      <IconButton label="打开导航" className="lg:hidden" onClick={onOpenSidebar}>
        <Menu />
      </IconButton>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="hidden h-10 w-full max-w-[460px] items-center gap-2.5 rounded-xl border border-line/80 bg-white/70 px-3.5 text-[13px] text-ink-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:border-brand-200 hover:bg-white hover:text-ink-500 md:flex"
      >
        <Search className="size-4 text-ink-400" />
        <span className="flex-1 text-left">搜索学员、脚本、场景、任务...</span>
        <kbd className="rounded-md border border-line/80 bg-ink-50/80 px-1.5 py-0.5 font-sans text-[10px] text-ink-400">
          Ctrl K
        </kbd>
      </button>
      <IconButton label="搜索" className="md:hidden" onClick={() => setSearchOpen(true)}>
        <Search />
      </IconButton>

      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <Link
          to="/settings"
          className="mr-1 hidden h-8 items-center gap-1.5 rounded-full border border-warning-100 bg-warning-50/90 px-3 text-[11px] font-medium text-warning-600 transition hover:border-warning-200 hover:bg-warning-50 sm:inline-flex"
          aria-label="当前为演示模式，前往接口配置"
        >
          <Sun className="size-3.5" strokeWidth={1.8} />
          <span className="size-1.5 rounded-full bg-warning-500" />
          {settings.apiMode === 'mock' ? '演示模式' : '真实 API'}
          <ChevronDown className="size-3 opacity-60" />
        </Link>

        <div className="relative">
          <IconButton
            label="通知"
            onClick={() => {
              setNotificationsOpen((open) => !open)
              setMenuOpen(false)
            }}
          >
            <Bell />
            {activeTasks > 0 && (
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-danger-500 ring-2 ring-white" />
            )}
          </IconButton>
          {notificationsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-[336px] overflow-hidden rounded-2xl border border-line/80 bg-white/95 shadow-float backdrop-blur-xl animate-fade-up">
                <div className="flex items-center justify-between border-b border-line/70 bg-ink-50/40 px-4 py-3">
                  <p className="text-[13px] font-semibold text-ink-900">最近动态</p>
                  {activeTasks > 0 && <Badge tone="brand">{activeTasks} 个任务进行中</Badge>}
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {activities.slice(0, 6).map((activity) => (
                    <button
                      key={activity.id}
                      type="button"
                      onClick={() => activity.link && go(activity.link)}
                      className="flex w-full items-start gap-2.5 border-b border-line/60 px-4 py-3 text-left last:border-0 hover:bg-brand-50/40"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-ink-800">{activity.title}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-ink-400">{activity.detail}</span>
                      </span>
                      <span className="shrink-0 text-[10px] text-ink-300">{relativeTime(activity.at)}</span>
                    </button>
                  ))}
                  {activities.length === 0 && (
                    <p className="px-4 py-8 text-center text-xs text-ink-400">暂无动态</p>
                  )}
                </div>
                <Link
                  to="/records"
                  onClick={() => setNotificationsOpen(false)}
                  className="block border-t border-line/70 bg-ink-50/40 px-4 py-2.5 text-center text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  查看全部记录
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <span className="ml-1 hidden sm:inline-flex">
            <Button
              size="md"
              icon={<Plus />}
              onClick={() => {
                setMenuOpen((open) => !open)
                setNotificationsOpen(false)
                setAccountOpen(false)
              }}
              className="rounded-[10px] px-4"
            >
              新建
              <ChevronDown className={cn('size-3 transition', menuOpen && 'rotate-180')} />
            </Button>
          </span>
          <IconButton
            label="新建"
            className="ml-1 sm:hidden"
            onClick={() => {
              setMenuOpen((open) => !open)
              setNotificationsOpen(false)
              setAccountOpen(false)
            }}
          >
            <Plus />
          </IconButton>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-line/80 bg-white/95 py-1.5 shadow-float backdrop-blur-xl animate-fade-up">
                <p className="px-4 pb-1 pt-1.5 text-[10px] font-medium tracking-[0.12em] text-ink-300">
                  快速新建
                </p>
                {[
                  { label: '新增学员', to: '/learners/new', icon: UserPlus },
                  { label: '创建训练目标', to: '/goals/new', icon: Target },
                  { label: '生成训练脚本', to: '/scripts/new', icon: FileText },
                  { label: '创建 3D 场景', to: '/scenes/text', icon: Box },
                  { label: '查看场景资产库', to: '/assets', icon: ImageIcon },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => go(item.to)}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-ink-600 hover:bg-brand-50/50 hover:text-brand-700"
                    >
                      <Icon className="size-4 text-ink-400" />
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="mx-1 hidden h-6 w-px bg-line/80 sm:block" />

        <div className="relative">
          <button
            type="button"
            aria-label="账号菜单"
            aria-expanded={accountOpen}
            onClick={() => {
              setAccountOpen((open) => !open)
              setMenuOpen(false)
              setNotificationsOpen(false)
            }}
            className="flex items-center gap-2 rounded-xl p-1 pr-1 transition hover:bg-white/80 sm:pr-2"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-violet-50 text-violet-600 ring-1 ring-violet-100">
              <UserRound className="size-[15px]" strokeWidth={1.8} />
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block text-xs font-medium leading-4 text-ink-800">{displayName}</span>
              <span className="block text-[10px] leading-4 text-ink-400">{roleName}</span>
            </span>
            <ChevronDown
              className={cn('hidden size-3 text-ink-400 transition sm:block', accountOpen && 'rotate-180')}
            />
          </button>
          {accountOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-line/80 bg-white/95 shadow-float backdrop-blur-xl animate-fade-up">
                <div className="flex items-center gap-2.5 border-b border-line/70 bg-ink-50/40 px-4 py-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-violet-50 text-violet-600 ring-1 ring-violet-100">
                    <UserRound className="size-4" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink-900">{displayName}</p>
                    <p className="mt-0.5 text-[10px] text-ink-400">
                      {isLive ? roleName : '系统管理员 · 演示环境'}
                    </p>
                  </div>
                </div>
                <div className="py-1.5">
                  <Link
                    to="/settings"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ink-600 transition hover:bg-brand-50/50 hover:text-brand-700"
                  >
                    <Settings className="size-4 text-ink-400" strokeWidth={1.8} />
                    系统设置
                  </Link>
                  <Link
                    to="/records"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ink-600 transition hover:bg-brand-50/50 hover:text-brand-700"
                  >
                    <History className="size-4 text-ink-400" strokeWidth={1.8} />
                    查看方案与记录
                  </Link>
                </div>
                <div className="border-t border-line/70 py-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false)
                      if (isLive) {
                        void logout().finally(() => navigate('/login'))
                      } else {
                        go('/login')
                      }
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-ink-500 transition hover:bg-ink-50 hover:text-ink-700"
                  >
                    <LogOut className="size-4 text-ink-400" strokeWidth={1.8} />
                    退出登录
                  </button>
                </div>
                <div className="flex items-center gap-2 border-t border-line/70 px-4 py-2.5 text-[10px] text-ink-400">
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      isLive ? 'bg-success-500' : 'bg-warning-500',
                    )}
                  />
                  {isLive ? '真实 API · 数据库持久化' : '演示模式 · 本地模拟数据'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        open={searchOpen}
        onClose={() => {
          setSearchOpen(false)
          setQuery('')
        }}
        title="全局搜索"
        description="搜索学员档案、训练脚本、场景任务与场景资产"
        size="lg"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="输入姓名、编号、脚本名称或场景关键词"
            className="h-11 w-full rounded-xl border border-line-strong bg-white pl-10 pr-10 text-sm text-ink-800 outline-none placeholder:text-ink-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-ink-700"
              aria-label="清空"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="mt-4 max-h-[52vh] overflow-y-auto">
          {!query.trim() ? (
            <div className="py-10 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                <Sparkles className="size-4" />
              </div>
              <p className="mt-3 text-xs text-ink-400">
                可搜索学员姓名、档案编号、脚本名称或场景主题
              </p>
            </div>
          ) : groups.length === 0 ? (
            <div className="py-10 text-center text-xs text-ink-400">
              未找到与“{query}”相关的内容
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="mb-1 px-2 text-[10px] font-medium tracking-wide text-ink-300">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => go(item.to)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-brand-50/60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink-800">
                          {item.title}
                        </span>
                        <span className="block truncate text-[11px] text-ink-400">{item.subtitle}</span>
                      </span>
                      <span className="shrink-0 text-[10px] text-ink-300">打开</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </header>
  )
}
