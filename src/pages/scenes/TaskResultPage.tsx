import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  Copy,
  FileText,
  Image as ImageIcon,
  Target,
  UserRound,
} from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { useToast } from '@/context/ToastContext'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Card,
  EmptyState,
  InfoGrid,
  SectionCard,
} from '@/components/ui'
import { Alert, Badge, DemoBadge } from '@/components/ui/feedback'
import { SourceTypeBadge, TaskStatusBadge } from '@/components/domain/StatusBadges'
import { ScenePreview } from '@/components/domain/ScenePreview'
import { formatDateTime, relativeTime } from '@/lib/utils'

export default function TaskResultPage() {
  const { id } = useParams()
  const { tasks, learners, goals, scripts, assets } = useAppData()
  const { toast } = useToast()

  const task = tasks.find((item) => item.id === id)

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

  if (task.status !== 'succeeded' || !task.result) {
    return (
      <EmptyState
        icon={<ImageIcon />}
        title="结果尚未生成"
        description="当前任务还没有可预览的生成结果，请先查看任务状态。"
        action={
          <Link to={`/scenes/tasks/${task.id}`}>
            <Button variant="outline">返回任务详情</Button>
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

  const isDemoResult = task.result.isDemo || task.isDemo
  const previewReference =
    task.result.previewUrl ?? task.result.sceneUrl ?? `demo://scene-preview/${task.id}`

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(previewReference)
      toast({ title: '结果引用已复制', description: previewReference })
    } catch {
      toast({ tone: 'error', title: '复制失败', description: '浏览器未授予剪贴板权限。' })
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={task.sceneName}
        description={`${task.code} · 生成完成于 ${relativeTime(task.completedAt)}`}
        breadcrumbs={[
          { label: '3D 场景生成', to: '/scenes' },
          { label: '生成任务', to: '/scenes/tasks' },
          { label: task.code, to: `/scenes/tasks/${task.id}` },
          { label: '结果预览' },
        ]}
        meta={
          <>
            <TaskStatusBadge status={task.status} />
            <SourceTypeBadge sourceType={task.sourceType} />
            {isDemoResult && <DemoBadge label="演示结果" />}
          </>
        }
        actions={
          <>
            <Link to={`/scenes/tasks/${task.id}`}>
              <Button variant="outline" icon={<ArrowLeft />}>
                返回任务详情
              </Button>
            </Link>
            {task.assetId && (
              <Link to={`/assets/${task.assetId}`}>
                <Button icon={<ImageIcon />}>查看场景资产</Button>
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-success-50 text-success-600">
                  <CheckCircle2 className="size-4" />
                </span>
                <p className="text-[13px] font-medium text-ink-800">场景结果预览</p>
              </div>
              {isDemoResult ? (
                <Badge tone="neutral" className="border-dashed">
                  演示数据 · 非真实渲染
                </Badge>
              ) : (
                <Badge tone="success">真实生成结果</Badge>
              )}
            </div>
            {task.result.previewUrl ? (
              <img
                src={task.result.previewUrl}
                alt={task.sceneName}
                className="aspect-[16/10] w-full object-cover"
              />
            ) : (
              <ScenePreview
                seed={task.result.previewSeed}
                sceneType={task.sceneConfig.sceneType}
                className="aspect-[16/10] w-full"
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-400">
                <span>分辨率 {task.result.resolution}</span>
                <span>生成于 {formatDateTime(task.completedAt)}</span>
                <span>来源 {task.sourceType === 'script' ? '训练脚本' : task.sourceType === 'image' ? '图像上传' : '文本描述'}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                icon={<Copy />}
                onClick={copyReference}
              >
                复制结果引用
              </Button>
            </div>
          </Card>

          <Alert
            tone="info"
            title="结果说明"
            description={
              <>
                {task.result.notes}
                <br />
                {isDemoResult
                  ? '当前展示为原型演示画面，不代表真实 3D 渲染输出。'
                  : '结果由外部 3D 场景生成服务返回；可在右侧结果引用中打开场景地址或模型链接。'}
              </>
            }
          />

          <SectionCard title="输入内容摘要" description="生成该场景时提交的主要描述与配置。">
            <div>
              <p className="text-[10px] text-ink-400">场景描述</p>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-ink-50/70 px-3.5 py-3 text-xs leading-6 text-ink-600">
                {task.prompt}
              </p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
              {[...task.sceneConfig.visualStyle, ...task.sceneConfig.keyElements].map((item) => (
                <Badge key={item} tone="neutral">
                  {item}
                </Badge>
              ))}
              {task.sceneConfig.avoidElements.map((item) => (
                <Badge key={item} tone="warning">
                  避免：{item}
                </Badge>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="结果信息">
            <InfoGrid
              columns={2}
              items={[
                { label: '任务编号', value: task.code },
                { label: '结果分辨率', value: task.result.resolution },
                { label: '创建时间', value: formatDateTime(task.createdAt) },
                { label: '完成时间', value: formatDateTime(task.completedAt) },
                {
                  label: '场景资产',
                  value: asset ? (
                    <Link
                      to={`/assets/${asset.id}`}
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      {asset.name}
                    </Link>
                  ) : (
                    '尚未归入资产库'
                  ),
                },
                { label: '数据属性', value: '演示数据' },
              ]}
            />
          </SectionCard>

          <SectionCard title="关联记录" contentClassName="p-0">
            {[
              {
                label: '关联学员',
                value: learner?.name ?? '未关联',
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

          <Card className="p-5">
            <p className="text-xs font-medium text-ink-700">
              结果引用{isDemoResult ? '（演示）' : ''}
            </p>
            <div className="mt-2 space-y-2 rounded-lg bg-ink-950 p-3 font-mono text-[10px] leading-5 text-ink-200">
              <p className="break-all">
                <span className="text-ink-400">taskId: </span>
                {task.code}
              </p>
              <p className="break-all">
                <span className="text-ink-400">preview: </span>
                {previewReference}
              </p>
              <p className="break-all">
                <span className="text-ink-400">modelUrl: </span>
                {task.result.modelUrl ? (
                  <a
                    href={task.result.modelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-300 underline"
                  >
                    {task.result.modelUrl}
                  </a>
                ) : (
                  'null'
                )}
              </p>
              <p className="break-all">
                <span className="text-ink-400">sceneUrl: </span>
                {task.result.sceneUrl ? (
                  <a
                    href={task.result.sceneUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-300 underline"
                  >
                    {task.result.sceneUrl}
                  </a>
                ) : (
                  'null'
                )}
              </p>
            </div>
            <p className="mt-2 text-[10px] leading-5 text-ink-400">
              {isDemoResult
                ? '演示结果不包含真实场景地址。'
                : '链接由 3D 场景生成服务提供，请确认浏览器可直接访问。'}
            </p>
          </Card>

          <Alert
            tone="warning"
            title="使用边界"
            description="场景结果仅用于支持训练情境演示，不包含场景内部交互或人物控制能力。请勿将演示预览作为真实生成结果对外使用。"
          />
        </div>
      </div>
    </div>
  )
}
