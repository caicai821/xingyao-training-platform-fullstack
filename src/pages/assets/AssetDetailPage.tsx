import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Box,
  Image as ImageIcon,
  Pencil,
  Plus,
  Save,
} from 'lucide-react'
import { useAppData } from '@/context/AppDataContext'
import { useToast } from '@/context/ToastContext'
import { errorMessage } from '@/hooks/useAsyncAction'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Button,
  Card,
  EmptyState,
  Field,
  InfoGrid,
  Input,
  Modal,
  SectionCard,
  TagInput,
  Textarea,
} from '@/components/ui'
import { Alert, Badge, DemoBadge } from '@/components/ui/feedback'
import { SourceTypeBadge } from '@/components/domain/StatusBadges'
import { AssociationTrail } from '@/components/domain/WorkflowChain'
import { ScenePreview } from '@/components/domain/ScenePreview'
import { latestProfileFor } from '@/lib/selectors'
import { formatDateTime, relativeTime } from '@/lib/utils'
import type { SceneAsset } from '@/types'

interface EditForm {
  name: string
  description: string
  tags: string[]
  note: string
}

export default function AssetDetailPage() {
  const { id } = useParams()
  const { assets, tasks, learners, goals, scripts, profiles, services, refreshAll } = useAppData()
  const { toast } = useToast()
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)

  const asset = assets.find((item) => item.id === id)

  if (!asset) {
    return (
      <EmptyState
        icon={<ImageIcon />}
        title="未找到该场景资产"
        description="资产可能已被移除，或链接地址不正确。"
        action={
          <Link to="/assets">
            <Button variant="outline">返回场景资产库</Button>
          </Link>
        }
        className="rounded-card border border-line bg-white shadow-card"
      />
    )
  }

  const task = tasks.find((item) => item.id === asset.taskId)
  const learner = asset.learnerId ? learners.find((item) => item.id === asset.learnerId) : undefined
  const goal = asset.trainingGoalId
    ? goals.find((item) => item.id === asset.trainingGoalId)
    : undefined
  const script = asset.scriptId ? scripts.find((item) => item.id === asset.scriptId) : undefined
  const profile = learner ? latestProfileFor(profiles, learner.id) : undefined

  const startEdit = (target: SceneAsset) => {
    setEditForm({
      name: target.name,
      description: target.description,
      tags: [...target.tags],
      note: target.note,
    })
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editForm) return
    if (!editForm.name.trim()) {
      toast({ tone: 'error', title: '请填写资产名称' })
      return
    }
    setSaving(true)
    try {
      await services.assets.update(asset.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        tags: editForm.tags,
        note: editForm.note,
      })
      await refreshAll(true)
      setEditOpen(false)
      setEditForm(null)
      toast({ title: '场景资产信息已更新' })
    } catch (cause) {
      toast({ tone: 'error', title: '保存失败', description: errorMessage(cause) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={asset.name}
        description={`${asset.sceneType} · 生成于 ${relativeTime(asset.createdAt)}`}
        breadcrumbs={[
          { label: '场景资产库', to: '/assets' },
          { label: asset.name },
        ]}
        meta={
          <>
            <Badge tone="success">已生成</Badge>
            <SourceTypeBadge sourceType={asset.sourceType} />
            {asset.isDemo && <DemoBadge label="演示资产" />}
          </>
        }
        actions={
          <>
            <Link to="/assets">
              <Button variant="outline">返回资产库</Button>
            </Link>
            {task && (
              <Link to={`/scenes/tasks/${task.id}`}>
                <Button variant="outline" icon={<Box />}>
                  查看生成任务
                </Button>
              </Link>
            )}
            <Button icon={<Pencil />} onClick={() => startEdit(asset)}>
              编辑信息
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
              <p className="text-[13px] font-medium text-ink-800">场景预览</p>
              {asset.isDemo ? (
                <Badge tone="neutral" className="border-dashed">
                  非真实生成结果
                </Badge>
              ) : (
                <Badge tone="success">真实生成结果</Badge>
              )}
            </div>
            {asset.previewUrl ? (
              <img
                src={asset.previewUrl}
                alt={asset.name}
                className="aspect-[16/10] w-full object-cover"
              />
            ) : (
              <ScenePreview
                seed={asset.previewSeed}
                sceneType={asset.sceneType}
                className="aspect-[16/10] w-full"
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3.5 text-[11px] text-ink-400">
              <span>关联任务 {task?.code ?? '—'}</span>
              {asset.sceneUrl && (
                <a
                  href={asset.sceneUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-brand-600 underline"
                >
                  打开场景
                </a>
              )}
              <span>生成时间 {formatDateTime(asset.createdAt)}</span>
            </div>
          </Card>

          <SectionCard title="资产说明" description="用于场景库检索与训练情境说明。">
            <p className="text-[13px] leading-7 text-ink-600">{asset.description}</p>
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
              {asset.tags.map((tag) => (
                <Badge key={tag} tone="neutral">
                  {tag}
                </Badge>
              ))}
            </div>
            {asset.note && (
              <p className="mt-4 rounded-lg bg-ink-50 px-3.5 py-3 text-[11px] leading-5 text-ink-500">
                备注：{asset.note}
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="关联链路"
            description="从学员档案到场景资产的完整关联关系，便于追踪生成依据。"
          >
            <AssociationTrail
              nodes={[
                {
                  label: '学员',
                  value: learner?.name,
                  to: learner ? `/learners/${learner.id}` : undefined,
                },
                {
                  label: '能力画像',
                  value: profile
                    ? profile.status === 'confirmed'
                      ? '已确认'
                      : '待确认'
                    : '未生成',
                  to: learner ? `/profiles/${learner.id}` : undefined,
                },
                {
                  label: '训练目标',
                  value: goal?.title,
                  to: goal ? `/goals?learner=${goal.learnerId}` : undefined,
                },
                {
                  label: '训练脚本',
                  value: script?.name,
                  to: script ? `/scripts/${script.id}` : undefined,
                },
                {
                  label: '生成任务',
                  value: task?.code,
                  to: task ? `/scenes/tasks/${task.id}` : undefined,
                },
                { label: '场景资产', value: asset.name },
              ]}
            />
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="资产信息">
            <InfoGrid
              columns={2}
              items={[
                { label: '场景类型', value: asset.sceneType },
                { label: '输入来源', value: <SourceTypeBadge sourceType={asset.sourceType} /> },
                { label: '关联任务', value: task?.code ?? '—' },
                { label: '资产状态', value: <Badge tone="success">可用</Badge> },
                { label: '创建时间', value: formatDateTime(asset.createdAt) },
                { label: '更新时间', value: relativeTime(asset.updatedAt) },
                {
                  label: '关联学员',
                  value: learner ? (
                    <Link
                      to={`/learners/${learner.id}`}
                      className="font-medium text-brand-600 hover:text-brand-700"
                    >
                      {learner.name}
                    </Link>
                  ) : (
                    '未关联'
                  ),
                },
                {
                  label: '训练目标',
                  value: goal ? (
                    <Link
                      to={`/goals?learner=${goal.learnerId}`}
                      className="text-brand-600 hover:text-brand-700"
                    >
                      {goal.title}
                    </Link>
                  ) : (
                    '未关联'
                  ),
                },
                {
                  label: '训练脚本',
                  value: script ? (
                    <Link
                      to={`/scripts/${script.id}`}
                      className="text-brand-600 hover:text-brand-700"
                    >
                      {script.name}
                    </Link>
                  ) : (
                    '未关联'
                  ),
                  icon: undefined,
                },
              ]}
            />
          </SectionCard>

          <Card className="p-5">
            <p className="text-xs font-medium text-ink-700">后续操作</p>
            <p className="mt-1 text-[11px] leading-5 text-ink-400">
              可基于当前场景继续创建新的生成任务，或在方案记录中查看完整关联链路。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/scenes/text">
                <Button size="sm" icon={<Plus />}>
                  创建新场景
                </Button>
              </Link>
              <Link to="/records">
                <Button size="sm" variant="outline">
                  方案与记录
                </Button>
              </Link>
            </div>
          </Card>

          <Alert
            tone="info"
            title="演示资产说明"
            description="该场景资产由模拟生成服务创建，预览为非真实渲染输出。接入真实服务后，将以服务返回的模型文件或场景访问地址替换。"
          />

          <Card className="p-5">
            <p className="text-xs font-medium text-ink-700">资产维护</p>
            <p className="mt-1 text-[11px] leading-5 text-ink-400">
              当前阶段支持维护资产名称、说明、标签与备注；不包含模型编辑、材质编辑或场景内操作能力。
            </p>
            <Button size="sm" variant="outline" className="mt-3" icon={<Save />} onClick={() => startEdit(asset)}>
              维护基础信息
            </Button>
          </Card>
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => {
          setEditOpen(false)
          setEditForm(null)
        }}
        title="编辑场景资产信息"
        description="修改名称、说明与标签，不会影响已生成的场景内容。"
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false)
                setEditForm(null)
              }}
            >
              取消
            </Button>
            <Button onClick={saveEdit} loading={saving}>
              保存更改
            </Button>
          </>
        }
      >
        {editForm && (
          <div className="space-y-4">
            <Field label="资产名称" required>
              <Input
                value={editForm.name}
                onChange={(event) =>
                  setEditForm((previous) =>
                    previous ? { ...previous, name: event.target.value } : previous,
                  )
                }
              />
            </Field>
            <Field label="资产说明">
              <Textarea
                value={editForm.description}
                onChange={(event) =>
                  setEditForm((previous) =>
                    previous ? { ...previous, description: event.target.value } : previous,
                  )
                }
              />
            </Field>
            <Field label="标签">
              <TagInput
                value={editForm.tags}
                onChange={(value) =>
                  setEditForm((previous) => (previous ? { ...previous, tags: value } : previous))
                }
                placeholder="例如：低干扰、需求表达"
              />
            </Field>
            <Field label="备注">
              <Textarea
                value={editForm.note}
                onChange={(event) =>
                  setEditForm((previous) =>
                    previous ? { ...previous, note: event.target.value } : previous,
                  )
                }
                className="min-h-[80px]"
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  )
}
