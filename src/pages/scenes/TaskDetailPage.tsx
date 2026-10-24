import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertCircle,
  Box,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Send,
  Target,
  UserRound,
} from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/hooks/useAsyncAction'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  InfoGrid,
  SectionCard,
} from '@/components/ui'
import { Alert, Badge, DemoBadge, ProgressBar } from '@/components/ui/feedback'
import {
  SourceTypeBadge,
  TaskStatusBadge,
} from '@/components/domain/StatusBadges'
import { ScenePreview } from '@/components/domain/ScenePreview'
import { formatDateTime, relativeTime } from '@/lib/utils'
import type { SceneTaskStatus } from '@/types'

const pipeline = ['已提交', '排队中', '生成中', '已完成']

export default function TaskDetailPage() {
  const { id } = useParams()
  const {
    tasks,
    learners,
    goals,
    scripts,
    assets,
    services,
    refreshAll,
    refreshTasks,
  } = useAppData()
  const { toast } = useToast()

  const [retryOpen, setRetryOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const statusRef = useRef<{ id?: string; status?: SceneTaskStatus }>({})

  const task = tasks.find((item) => item.id === id)

  useEffect(() => {
    if (!task) return
    const previous = statusRef.current
    if (previous.id === task.id && previous.status && previous.status !== task.status) {
      if (task.status === 'succeeded') {
        toast({
          title: '场景生成成功',
          description: '任务结果已返回，并已归入场景资产库。',
        })
      } else if (task.status === 'failed') {
        toast({
          tone: 'error',
          title: '场景生成失败',
          description: '任务未能完成，可查看错误信息后重新生成。',
        })
      }
    }
    statusRef.current = { id: task.id, status: task.status }
  }, [task, toast])

  if (!task) {
    return (
      <EmptyState
        icon={<Box />}
        title="未找到该场景任务"
        description="任务可能已被移除，或链接地址不正确。"
        action={
          <Link to="/scenes/tasks">
            <Button variant="outline">返回任务列表</Button>
          </Link>
        }
        className="rounded-card border border-line bg-white shadow-card"
      />
    )
  }

  const learner = task.learnerId ? learners.find((item) => item.id === task.learnerId) : undefined
  const goal = task.trainingGoalId ? goals.find((item) => item.id === task.trainingGoalId) : undefined
  const script = task.scriptId ? scripts.find((item) => item.id === task.scriptId) : undefined
  const asset = task.assetId ? assets.find((item) => item.id === task.assetId) : undefined
  const active = ['pending', 'queued', 'generating'].includes(task.status)
  const stageIndex =
    task.status === 'pending'
      ? 0
      : task.status === 'queued'
        ? 1
        : task.status === 'generating'
          ? 2
          : task.status === 'succeeded'
            ? 3
            : task.status === 'failed'
              ? 2
              : -1

  const submitDraft = async () => {
    if (task.sourceType === 'image' && task.imageReferences.length === 0) {
      toast({
        tone: 'error',
        title: '缺少参考图片',
        description: '图像驱动的任务需要先上传图片，请重新创建任务并补齐图片。',
      })
      return
    }
    setSubmitting(true)
    try {
      await services.tasks.submit(task.id)
      await refreshAll(true)
      toast({ title: '任务已提交', description: '场景生成服务正在处理，可在本页查看进度。' })
    } catch (cause) {
      toast({ tone: 'error', title: '提交失败', description: errorMessage(cause) })
    } finally {
      setSubmitting(false)
    }
  }

  const retry = async () => {
    setRetrying(true)
    try {
      await services.tasks.retry(task.id)
      await refreshAll(true)
      setRetryOpen(false)
      toast({ title: '任务已重新提交', description: '正在重新生成场景，请稍候。' })
    } catch (cause) {
      toast({ tone: 'error', title: '重新生成失败', description: errorMessage(cause) })
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={task.sceneName}
        description={`${task.code} · 创建于 ${relativeTime(task.createdAt)} · ${
          task.sourceType === 'text'
            ? '文本描述'
            : task.sourceType === 'image'
              ? '图像上传'
              : '训练脚本'
        }驱动`}
        breadcrumbs={[
          { label: '3D 场景生成', to: '/scenes' },
          { label: '生成任务', to: '/scenes/tasks' },
          { label: task.code },
        ]}
        meta={
          <>
            <TaskStatusBadge status={task.status} />
            {task.isDemo && <DemoBadge label="演示结果" />}
          </>
        }
        actions={
          <>
            <Link to="/scenes/tasks">
              <Button variant="outline">返回任务列表</Button>
            </Link>
            {active && (
              <Button
                variant="outline"
                icon={<RefreshCw />}
                onClick={() => void refreshTasks()}
              >
                刷新状态
              </Button>
            )}
            {task.status === 'draft' && (
              <Button
                icon={<Send />}
                onClick={submitDraft}
                loading={submitting}
              >
                提交生成
              </Button>
            )}
            {task.status === 'failed' && (
              <Button icon={<RefreshCw />} onClick={() => setRetryOpen(true)}>
                重新生成
              </Button>
            )}
            {task.status === 'succeeded' && (
              <>
                <Button
                  variant="outline"
                  icon={<RefreshCw />}
                  onClick={() => setRetryOpen(true)}
                >
                  重新生成
                </Button>
                <Link to={`/scenes/tasks/${task.id}/result`}>
                  <Button icon={<ImageIcon />}>查看结果</Button>
                </Link>
              </>
            )}
          </>
        }
      />

      <Card className="mb-5 overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <TaskStatusBadge status={task.status} />
                <SourceTypeBadge sourceType={task.sourceType} />
                <Badge tone="neutral">{task.sceneConfig.sceneType}</Badge>
                {task.isDemo && <DemoBadge />}
              </div>
              <h2 className="mt-3 text-lg font-semibold text-ink-900">{task.sceneName}</h2>
              <p className="mt-1 text-xs text-ink-400">
                {task.code} · 最近更新 {relativeTime(task.updatedAt)}
              </p>
            </div>
            <div className="rounded-xl border border-line bg-ink-50/50 px-4 py-3">
              <p className="text-[10px] text-ink-400">当前进度</p>
              <p className="tnum mt-0.5 text-2xl font-semibold text-ink-900">{task.progress}%</p>
            </div>
          </div>

          <div className="mt-5">
            <ProgressBar
              value={task.progress}
              tone={
                task.status === 'failed'
                  ? 'danger'
                  : task.status === 'succeeded'
                    ? 'success'
                    : 'brand'
              }
              animated={active}
            />
          </div>

          <div className="mt-5 grid grid-cols-4 gap-2">
            {pipeline.map((label, index) => {
              const done = task.status === 'succeeded' || index < stageIndex
              const current = index === stageIndex && task.status !== 'failed' && task.status !== 'succeeded'
              return (
                <div key={label} className="flex items-center gap-2">
                  <span
                    className={
                      task.status === 'failed' && index === stageIndex
                        ? 'flex size-6 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-500'
                        : done
                          ? 'flex size-6 shrink-0 items-center justify-center rounded-full bg-success-500 text-white'
                          : current
                            ? 'flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-2 ring-brand-500/20'
                            : 'flex size-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-400'
                    }
                  >
                    {task.status === 'failed' && index === stageIndex ? (
                      <AlertCircle className="size-3.5" />
                    ) : done ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <span className="text-[10px]">{index + 1}</span>
                    )}
                  </span>
                  <span
                    className={
                      done || current
                        ? 'text-[11px] font-medium text-ink-700'
                        : 'text-[11px] text-ink-300'
                    }
                  >
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {task.status === 'failed' && (
          <div className="border-t border-line px-5 py-4 sm:px-6">
            <Alert
              tone="danger"
              title={task.error?.code ?? '生成失败'}
              description={task.error?.message ?? '任务未能完成，请稍后重试。'}
              action={
                <Button size="sm" variant="outline" onClick={() => setRetryOpen(true)}>
                  重新生成
                </Button>
              }
            />
          </div>
        )}
        {task.status === 'succeeded' && (
          <div className="border-t border-line px-5 py-4 sm:px-6">
            <Alert
              tone="success"
              title="场景已生成"
              description="结果为演示数据，可在结果预览中查看，并已归入场景资产库。"
              action={
                <Link to={`/scenes/tasks/${task.id}/result`}>
                  <Button size="sm" variant="outline">
                    查看结果
                  </Button>
                </Link>
              }
            />
          </div>
        )}
        {task.status === 'draft' && (
          <div className="border-t border-line px-5 py-4 sm:px-6">
            <Alert
              tone="warning"
              title="任务尚未提交"
              description="当前配置已保存为草稿，提交后才会进入场景生成队列。"
              action={
                <Button size="sm" variant="outline" onClick={submitDraft} loading={submitting}>
                  提交生成
                </Button>
              }
            />
          </div>
        )}
        {active && (
          <div className="border-t border-line px-5 py-4 sm:px-6">
            <Alert
              tone="info"
              title="任务正在处理"
              description="页面会自动刷新任务状态。离开页面后任务仍会继续，可稍后从任务列表返回查看。"
            />
          </div>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <SectionCard title="输入内容" description="提交至场景生成服务的业务输入与配置。">
            <div>
              <p className="text-[10px] text-ink-400">场景用途</p>
              <p className="mt-1 text-xs text-ink-700">{task.scenePurpose || '未填写'}</p>
            </div>
            <div className="mt-4">
              <p className="text-[10px] text-ink-400">场景文字描述</p>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-ink-50/70 px-3.5 py-3 text-xs leading-6 text-ink-600">
                {task.prompt || '未填写场景描述'}
              </p>
            </div>

            <div className="mt-5 grid gap-x-8 gap-y-4 border-t border-line pt-4 sm:grid-cols-2">
              {[
                ['场景类型', task.sceneConfig.sceneType],
                ['场景主题', task.sceneConfig.theme || '—'],
                ['复杂程度', task.sceneConfig.complexity],
                ['角色需求', task.sceneConfig.characters || '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] text-ink-400">{label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-ink-700">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              {[
                ['视觉风格', task.sceneConfig.visualStyle, 'neutral'],
                ['感官与环境偏好', task.sceneConfig.sensoryPrefs, 'neutral'],
                ['关键环境元素', task.sceneConfig.keyElements, 'brand'],
                ['需要避免', task.sceneConfig.avoidElements, 'warning'],
              ].map(([label, values, tone]) => (
                <div key={String(label)}>
                  <p className="text-[10px] text-ink-400">{label}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(values as string[]).length ? (
                      (values as string[]).map((item) => (
                        <Badge
                          key={item}
                          tone={tone as 'neutral' | 'brand' | 'warning'}
                        >
                          {item}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[11px] text-ink-300">未设置</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {task.imageReferences.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <p className="text-[10px] text-ink-400">图像引用</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {task.imageReferences.map((reference) => (
                    <div
                      key={reference.id}
                      className="flex items-center gap-2.5 rounded-lg border border-line p-2.5"
                    >
                      {reference.previewUrl ? (
                        <img
                          src={reference.previewUrl}
                          alt={reference.name}
                          className="size-12 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-ink-50 text-ink-400">
                          <ImageIcon className="size-4" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[11px] text-ink-700">{reference.name}</p>
                        <p className="text-[10px] text-ink-400">
                          {(reference.size / 1024).toFixed(0)} KB · {reference.type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-ink-300">
                  图像仅保存引用信息，实际解析由外部服务完成。
                </p>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="生成结果"
            description="结果区域用于展示外部服务返回的图片、模型链接或场景访问地址。"
            actions={task.isDemo ? <DemoBadge /> : undefined}
            contentClassName="p-5 sm:p-6"
          >
            {task.status === 'succeeded' && task.result ? (
              <div>
                {task.result.previewUrl ? (
                  <img
                    src={task.result.previewUrl}
                    alt={task.sceneName}
                    className="aspect-[16/9] w-full rounded-xl object-cover"
                  />
                ) : (
                  <ScenePreview
                    seed={task.result.previewSeed}
                    sceneType={task.sceneConfig.sceneType}
                    className="aspect-[16/9] w-full rounded-xl"
                  />
                )}
                {!task.isDemo && (task.result.sceneUrl || task.result.modelUrl) && (
                  <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
                    {task.result.sceneUrl && (
                      <a
                        href={task.result.sceneUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brand-600 underline"
                      >
                        打开场景
                      </a>
                    )}
                    {task.result.modelUrl && (
                      <a
                        href={task.result.modelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-brand-600 underline"
                      >
                        打开模型文件
                      </a>
                    )}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2 text-[11px] text-ink-400">
                    <span>分辨率 {task.result.resolution}</span>
                    <span>· {formatDateTime(task.completedAt)}</span>
                  </div>
                  <div className="flex gap-2">
                    {task.assetId && (
                      <Link to={`/assets/${task.assetId}`}>
                        <Button size="sm" variant="outline">
                          查看场景资产
                        </Button>
                      </Link>
                    )}
                    <Link to={`/scenes/tasks/${task.id}/result`}>
                      <Button size="sm">结果预览</Button>
                    </Link>
                  </div>
                </div>
                <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-[10px] leading-5 text-ink-400">
                  {task.result.notes}
                </p>
              </div>
            ) : task.status === 'failed' ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-danger-100 bg-danger-50/40 px-6 py-10 text-center">
                <span className="flex size-10 items-center justify-center rounded-xl bg-white text-danger-500">
                  <AlertCircle className="size-5" />
                </span>
                <p className="mt-3 text-sm font-medium text-ink-800">生成失败</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-ink-500">
                  {task.error?.message ?? '任务未能完成，请重新生成。'}
                </p>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => setRetryOpen(true)}>
                  重新生成
                </Button>
              </div>
            ) : task.status === 'draft' ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-ink-50/40 px-6 py-10 text-center">
                <Box className="size-6 text-ink-300" />
                <p className="mt-3 text-sm font-medium text-ink-700">任务尚未提交</p>
                <p className="mt-1 text-xs text-ink-400">提交后才会开始生成场景。</p>
              </div>
            ) : (
              <div className="rounded-xl border border-line bg-ink-50/30 p-5">
                <div className="flex items-center gap-2">
                  <RefreshCw className="size-4 animate-spin text-brand-500" />
                  <p className="text-xs font-medium text-ink-700">
                    {task.status === 'pending'
                      ? '任务已进入待提交队列'
                      : task.status === 'queued'
                        ? '任务排队中'
                        : '场景生成中'}
                  </p>
                  <span className="tnum ml-auto text-xs text-ink-400">{task.progress}%</span>
                </div>
                <ProgressBar value={task.progress} className="mt-3" animated />
                <div className="mt-5 h-48 rounded-lg border border-dashed border-line-strong bg-white/60" />
                <p className="mt-3 text-[11px] text-ink-400">
                  生成结果返回后会显示在此处。演示模式下的状态变化由模拟服务驱动。
                </p>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="关联对象" contentClassName="p-0">
            {[
              {
                label: '关联学员',
                value: learner ? `${learner.name}（${learner.code}）` : '未关联',
                to: learner ? `/learners/${learner.id}` : undefined,
                icon: UserRound,
              },
              {
                label: '训练目标',
                value: goal?.title ?? '未关联',
                to: goal ? `/goals?learner=${goal.learnerId}` : undefined,
                icon: Target,
              },
              {
                label: '训练脚本',
                value: script?.name ?? '未关联',
                to: script ? `/scripts/${script.id}` : undefined,
                icon: FileText,
              },
              {
                label: '场景资产',
                value: asset?.name ?? '尚未生成',
                to: asset ? `/assets/${asset.id}` : undefined,
                icon: ImageIcon,
              },
            ].map((item) => {
              const Icon = item.icon
              const content = (
                <>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-500">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] text-ink-400">{item.label}</span>
                    <span className="block truncate text-xs text-ink-700">{item.value}</span>
                  </span>
                </>
              )
              return item.to ? (
                <Link
                  key={item.label}
                  to={item.to}
                  className="flex items-center gap-2.5 border-b border-line/70 px-5 py-3 transition last:border-0 hover:bg-ink-50/60"
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 border-b border-line/70 px-5 py-3 last:border-0"
                >
                  {content}
                </div>
              )
            })}
          </SectionCard>

          <SectionCard title="任务时间线">
            <InfoGrid
              columns={2}
              items={[
                { label: '创建时间', value: formatDateTime(task.createdAt) },
                {
                  label: '提交时间',
                  value: task.submittedAt ? formatDateTime(task.submittedAt) : '尚未提交',
                },
                {
                  label: '完成时间',
                  value: task.completedAt ? formatDateTime(task.completedAt) : '—',
                },
                { label: '最近更新', value: formatDateTime(task.updatedAt) },
              ]}
            />
          </SectionCard>

          <Alert
            tone="info"
            title="关于当前阶段"
            description="本阶段仅实现场景生成前的配置、任务提交、状态查询与结果引用展示，不包含 3D 场景内部交互、人物控制或场景编辑。"
          />
        </div>
      </div>

      <ConfirmDialog
        open={retryOpen}
        title={task.status === 'succeeded' ? '重新生成场景' : '重新提交任务'}
        description="将重置当前任务状态并重新提交至场景生成服务。原有结果会被新的生成结果替换。"
        confirmLabel="重新生成"
        onConfirm={retry}
        onClose={() => setRetryOpen(false)}
        loading={retrying}
      />
    </div>
  )
}
