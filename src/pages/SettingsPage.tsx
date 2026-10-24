import { useEffect, useState } from 'react'
import {
  Database,
  FlaskConical,
  Link2,
  RefreshCw,
  Save,
  Server,
  Settings2,
  ShieldCheck,
} from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/hooks/useAsyncAction'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Card,
  ConfirmDialog,
  Field,
  Input,
  SectionCard,
  Select,
  Toggle,
} from '@/components/ui'
import { Alert, Badge } from '@/components/ui/feedback'
import { DEFAULT_SETTINGS } from '@/services'
import { cn } from '@/lib/utils'
import type { AppSettings } from '@/types'

const modules = [
  { name: 'authService', label: '身份验证', endpoint: 'POST /auth/login · GET /auth/me' },
  { name: 'learnerService', label: '学员档案', endpoint: 'GET /learners · POST /learners' },
  { name: 'abilityProfileService', label: '能力画像', endpoint: 'POST /learners/{id}/profiles' },
  { name: 'trainingGoalService', label: '训练目标', endpoint: 'GET /training-goals · POST /training-goals' },
  { name: 'trainingScriptService', label: '训练脚本', endpoint: 'POST /training-scripts/generate' },
  { name: 'sceneGenerationService', label: '场景生成请求', endpoint: 'POST /scene-tasks' },
  { name: 'sceneTaskService', label: '任务状态查询', endpoint: 'GET /scene-tasks/{id}' },
  { name: 'sceneAssetService', label: '场景资产', endpoint: 'GET /scene-assets' },
  { name: 'uploadService', label: '文件上传', endpoint: 'POST /uploads · GET /uploads/{id}/content' },
]

export default function SettingsPage() {
  const { settings, updateSettings, resetDemoData } = useAppData()
  const { toast } = useToast()
  const [form, setForm] = useState<AppSettings>(settings)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    setForm(settings)
  }, [settings])

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }))
    if (errors[key as string]) setErrors((previous) => ({ ...previous, [key]: '' }))
  }

  const isUrl = (value: string) => /^https?:\/\/[^\s]+$/i.test(value.trim())

  const save = async () => {
    const nextErrors: Record<string, string> = {}
    if (form.apiMode === 'live') {
      if (!isUrl(form.apiBaseUrl)) nextErrors.apiBaseUrl = '请填写有效的 HTTP(S) 服务地址'
      if (!isUrl(form.uploadUrl)) nextErrors.uploadUrl = '请填写有效的上传服务地址'
    }
    if (form.requestTimeout < 5000 || form.requestTimeout > 120000) {
      nextErrors.requestTimeout = '请求超时需在 5000–120000 毫秒之间'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      toast({ tone: 'error', title: '请检查服务配置' })
      return
    }

    setSaving(true)
    const modeChanged = form.apiMode !== settings.apiMode
    updateSettings({ ...form, requestTimeout: Number(form.requestTimeout) })
    setSaving(false)
    toast({
      title: '系统配置已保存',
      description:
        form.apiMode === 'live'
          ? modeChanged
            ? '正在尝试连接真实 API 服务。'
            : '后续请求将使用新的服务地址。'
          : '当前使用演示数据与模拟服务。',
    })
  }

  const restoreDefaults = () => {
    setForm({ ...DEFAULT_SETTINGS })
    setErrors({})
    toast({ tone: 'info', title: '已恢复默认配置', description: '点击“保存配置”后生效。' })
  }

  const resetData = async () => {
    setResetting(true)
    try {
      await resetDemoData()
      setResetOpen(false)
      toast({ title: '演示数据已重置', description: '学员、脚本与场景任务已恢复为初始演示数据。' })
    } catch (cause) {
      toast({ tone: 'error', title: '重置失败', description: errorMessage(cause) })
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="系统设置"
        description="配置服务模式、接口地址与演示行为。页面不直接依赖具体 AI 服务实现，所有请求通过服务层统一处理。"
        actions={
          <>
            <Button variant="outline" onClick={restoreDefaults}>
              恢复默认
            </Button>
            <Button icon={<Save />} onClick={save} loading={saving}>
              保存配置
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <SectionCard
            title="服务模式"
            description="演示模式与真实 API 模式使用统一的数据接口，切换时页面逻辑保持一致。"
            icon={<Settings2 />}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  value: 'mock' as const,
                  title: '演示模式',
                  badge: '本地数据',
                  description: '使用虚构的本地演示数据，完整演示业务流程与任务状态变化。',
                  points: ['无需后端服务', '支持模拟成功与失败', '可一键重置演示数据'],
                  icon: FlaskConical,
                },
                {
                  value: 'live' as const,
                  title: '真实 API 模式',
                  badge: '外部服务',
                  description: '通过 HTTP 请求访问已配置的服务地址，由服务层统一处理错误与超时。',
                  points: ['支持异步任务状态查询', '可获取场景结果引用', '需可访问的服务地址'],
                  icon: Server,
                },
              ].map((option) => {
                const Icon = option.icon
                const selected = form.apiMode === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => update('apiMode', option.value)}
                    className={cn(
                      'rounded-xl border p-4 text-left transition',
                      selected
                        ? 'border-brand-300 bg-brand-50/40 ring-2 ring-brand-500/10'
                        : 'border-line hover:border-brand-200',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={cn(
                          'flex size-9 items-center justify-center rounded-lg',
                          selected ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-500',
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span
                        className={cn(
                          'mt-1 flex size-4 items-center justify-center rounded-full border',
                          selected ? 'border-brand-600' : 'border-line-strong',
                        )}
                      >
                        {selected && <span className="size-2 rounded-full bg-brand-600" />}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-ink-900">{option.title}</p>
                      <Badge tone={selected ? 'brand' : 'neutral'}>{option.badge}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-ink-400">{option.description}</p>
                    <ul className="mt-2 space-y-1">
                      {option.points.map((point) => (
                        <li key={point} className="flex gap-1.5 text-[10px] leading-5 text-ink-500">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-brand-400" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </button>
                )
              })}
            </div>
            {form.apiMode === 'live' && (
              <Alert
                tone="warning"
                title="切换到真实 API 模式"
                description="保存后需要登录后端账号，并重新加载工作区数据。若服务不可用，会显示连接错误页，可在其中切换回演示模式。建议先确认接口地址可访问。"
                className="mt-4"
              />
            )}
          </SectionCard>

          <SectionCard
            title="接口配置"
            description="服务地址由服务层统一读取，不会硬编码在页面组件中。"
            icon={<Link2 />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="API 基础地址"
                hint="例如：http://localhost:4000/api/v1"
                error={errors.apiBaseUrl}
                className="sm:col-span-2"
              >
                <Input
                  value={form.apiBaseUrl}
                  onChange={(event) => update('apiBaseUrl', event.target.value)}
                  placeholder="http://localhost:4000/api/v1"
                />
              </Field>
              <Field
                label="文件上传服务地址"
                hint="图片等大文件先上传，再将引用提交给生成服务。"
                error={errors.uploadUrl}
                className="sm:col-span-2"
              >
                <Input
                  value={form.uploadUrl}
                  onChange={(event) => update('uploadUrl', event.target.value)}
                  placeholder="http://localhost:4000/api/v1/uploads"
                />
              </Field>
              <Field
                label="请求超时（毫秒）"
                hint="建议 15000–60000 毫秒。"
                error={errors.requestTimeout}
              >
                <Input
                  type="number"
                  min={5000}
                  max={120000}
                  step={1000}
                  value={form.requestTimeout}
                  onChange={(event) => update('requestTimeout', Number(event.target.value))}
                />
              </Field>
              <Field label="当前生效状态">
                <div className="flex h-10 items-center gap-2 rounded-lg border border-line bg-ink-50/60 px-3.5">
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      settings.apiMode === 'mock' ? 'bg-warning-500' : 'bg-success-500',
                    )}
                  />
                  <span className="text-xs text-ink-600">
                    {settings.apiMode === 'mock' ? '演示模式运行中' : '真实 API 模式运行中'}
                  </span>
                </div>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="演示行为"
            description="这些选项仅在演示模式下影响本地模拟服务。"
            icon={<FlaskConical />}
          >
            <div className="space-y-4">
              <Toggle
                checked={form.simulateFailure}
                onChange={(checked) => update('simulateFailure', checked)}
                label="模拟场景生成失败"
                description="开启后，新提交的场景任务会在数秒后模拟失败，便于演示错误状态；在失败任务上点击重新生成可体验恢复流程。"
              />
              <div className="border-t border-line pt-4">
                <Field label="模拟服务响应延迟" hint="影响模拟服务的等待时间，便于演示加载状态。">
                  <Select
                    value={String(form.simulateDelay)}
                    onChange={(event) => update('simulateDelay', Number(event.target.value))}
                  >
                    <option value="400">快速（0.4 秒）</option>
                    <option value="900">标准（0.9 秒）</option>
                    <option value="1500">较慢（1.5 秒）</option>
                    <option value="2500">演示加载（2.5 秒）</option>
                  </Select>
                </Field>
              </div>
              <div className="border-t border-line pt-4">
                <Toggle
                  checked={form.showDemoBadge}
                  onChange={(checked) => update('showDemoBadge', checked)}
                  label="显示演示数据标识"
                  description="在场景结果、脚本与画像等位置显示“演示数据”标签，帮助区分模拟内容与真实服务结果。"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="服务模块与预留接口"
            description="演示模式与真实 API 模式通过同一服务层访问；生成服务模式由后端单独配置。"
            icon={<Database />}
          >
            <div className="overflow-hidden rounded-lg border border-line">
              {modules.map((module) => (
                <div
                  key={module.name}
                  className="flex flex-col gap-1 border-b border-line/70 px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-3"
                >
                  <span className="w-52 shrink-0 font-mono text-[11px] text-ink-700">
                    {module.name}
                  </span>
                  <span className="w-24 shrink-0 text-xs text-ink-500">{module.label}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink-400">
                    {module.endpoint}
                  </span>
                  <Badge tone="success">已接入</Badge>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-5 text-ink-400">
              接口路径与后端 /api/v1 保持一致。数据模式（演示 / 真实 API）与生成服务模式（mock / real）
              由前端设置和后端环境变量分别管理，两者互不绑定。
            </p>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <ShieldCheck className="size-3.5" />
              </span>
              <p className="text-[13px] font-semibold text-ink-900">数据与隐私</p>
            </div>
            <div className="mt-3 space-y-3 text-[11px] leading-5 text-ink-500">
              <p>· 演示模式中的姓名、编号、记录与案例均为虚构数据。</p>
              <p>· 学员档案遵循最小必要原则，仅收集支持训练所需的信息。</p>
              <p>· 上传图片限制为 JPG/PNG/WebP，单张不超过 2 MB。</p>
              <p>
                · {settings.apiMode === 'live'
                  ? '真实 API 模式下数据保存于后端 PostgreSQL，身份通过 HttpOnly Cookie 会话校验。生产环境必须启用 HTTPS 与 Secure Cookie。'
                  : '当前数据保存在浏览器本地存储中，仅用于演示。'}
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-[13px] font-semibold text-ink-900">演示数据管理</p>
            <p className="mt-1 text-[11px] leading-5 text-ink-400">
              重置后会恢复初始学员、能力记录、训练目标、脚本、场景任务与资产。此操作会清除当前修改。
            </p>
            <Button
              variant="outline"
              icon={<RefreshCw />}
              className="mt-3 w-full"
              onClick={() => setResetOpen(true)}
              disabled={settings.apiMode !== 'mock'}
            >
              重置演示数据
            </Button>
            {settings.apiMode !== 'mock' && (
              <p className="mt-2 text-[10px] text-ink-400">仅演示模式下可重置本地数据。</p>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-[13px] font-semibold text-ink-900">系统信息</p>
            <dl className="mt-3 space-y-2.5 text-xs">
              {[
                ['产品名称', '星耀童行 · 3D 场景辅助训练系统'],
                ['原型版本', 'v0.2.0'],
                ['运行模式', form.apiMode === 'mock' ? '演示模式' : '真实 API 模式'],
                ['数据存储', form.apiMode === 'mock' ? '浏览器本地存储' : 'PostgreSQL（后端 API）'],
                ['身份验证', form.apiMode === 'mock' ? '演示模式（无鉴权）' : 'HttpOnly Cookie 会话'],
                ['生成服务', '由后端环境变量配置（mock / real）'],
                ['当前请求超时', `${form.requestTimeout} 毫秒`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-ink-400">{label}</dt>
                  <dd className="text-right text-ink-700">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Alert
            tone="info"
            title="当前阶段说明"
            description="后端已提供登录、角色权限、数据持久化、文件上传与场景任务队列。真实 AI 分析、脚本生成与 3D 场景生成服务尚未接入，默认使用明确标记为演示数据的 mock Provider。"
          />
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="重置演示数据"
        description="所有当前修改（学员档案、能力记录、训练脚本、场景任务与资产）将恢复为初始演示数据，且无法撤销。"
        confirmLabel="确认重置"
        tone="danger"
        onConfirm={resetData}
        onClose={() => setResetOpen(false)}
        loading={resetting}
      />
    </div>
  )
}
