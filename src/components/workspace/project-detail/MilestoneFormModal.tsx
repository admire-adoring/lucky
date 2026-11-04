import { useEffect, useState } from 'react'
import { WorkspaceModal } from '../WorkspaceModal'
import { cn } from '../../../lib/cn'
import { errorText } from '../../../api/error'
import { toast } from '../../../stores/toast-store'
import { useMilestoneActions } from '../../../hooks/use-projects'
import type { Milestone, MilestoneState } from '../../../types'
import type { MilestonePatch } from '../../../api/projects'

/**
 * 里程碑编辑/新增弹窗。
 *
 * 表结构与后端 `MilestonePatch` 一一对应：name / state / dueDate / detail。
 * state 走胶囊三选（待启动 / 进行中 / 已完成）—— 不给输入框，
 * 因为 `now` 在后端是唯一索引（`ux_milestone_now`），同一项目最多一个进行中，
 * 让用户填字符会撞这个约束而后端报错时回不到人话。
 *
 * 编辑模式下底部多一颗「删除」—— 与 ProjectFormModal 的形态一致。
 */

const STATE_OPTIONS: { value: MilestoneState; label: string; hint: string }[] = [
  { value: 'todo', label: '待启动', hint: '排在前序里程碑之后' },
  { value: 'now', label: '进行中', hint: '当前所处阶段（每项目唯一）' },
  { value: 'done', label: '已完成', hint: '不再参与计算剩余' },
]

const STATE_LABEL: Record<MilestoneState, string> = {
  todo: '待启动',
  now: '进行中',
  done: '已完成',
}

export interface MilestoneDraft {
  name: string
  state: MilestoneState
  dueDate: string
  detail: string
}

function emptyDraft(): MilestoneDraft {
  return { name: '', state: 'todo', dueDate: '', detail: '' }
}

function draftOf(m: Milestone): MilestoneDraft {
  return { name: m.name, state: m.state, dueDate: m.date, detail: m.detail }
}

function toPatch(d: MilestoneDraft): MilestonePatch {
  return {
    name: d.name.trim(),
    state: d.state,
    dueDate: d.dueDate.trim() ? d.dueDate.trim() : null,
    detail: d.detail.trim(),
  }
}

export function MilestoneFormModal({
  mode,
  projectId,
  target,
  onClose,
}: {
  mode: 'add' | 'edit'
  projectId: string
  target?: Milestone
  onClose: () => void
}) {
  const [draft, setDraft] = useState<MilestoneDraft>(() => (target ? draftOf(target) : emptyDraft()))
  const [errors, setErrors] = useState<{ name?: string }>({})
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const actions = useMilestoneActions()

  useEffect(() => {
    if (!target) return
    setDraft(draftOf(target))
  }, [target])

  const submit = () => {
    const name = draft.name.trim()
    if (!name) {
      setErrors({ name: '名称不能为空' })
      return
    }
    const patch = toPatch({ ...draft, name })
    if (mode === 'add') {
      actions.create.mutate(
        { projectId, patch },
        {
          onSuccess: () => {
            toast(`已添加里程碑「${patch.name}」`)
            onClose()
          },
          onError: (error) => toast(`添加失败：${errorText(error)}`),
        },
      )
    } else if (target) {
      actions.save.mutate(
        { id: target.id, patch },
        {
          onSuccess: () => {
            toast(`已保存「${patch.name}」`)
            onClose()
          },
          onError: (error) => toast(`保存失败：${errorText(error)}`),
        },
      )
    }
  }

  const remove = () => {
    if (!target) return
    actions.remove.mutate(target.id, {
      onSuccess: () => {
        toast(`已删除「${target.name}」`)
        onClose()
      },
      onError: (error) => toast(`删除失败：${errorText(error)}`),
    })
  }

  return (
    <WorkspaceModal
      title={mode === 'add' ? '添加里程碑' : `编辑里程碑`}
      label={mode === 'add' ? '添加里程碑' : '编辑里程碑'}
      onClose={onClose}
      actions={
        <div className="modal-actions-row">
          {mode === 'edit' && !confirmingDelete ? (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => setConfirmingDelete(true)}
            >
              删除
            </button>
          ) : null}
          {confirmingDelete ? (
            <>
              <span className="modal-confirm-hint">删除后不可恢复，确认？</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmingDelete(false)}>
                取消
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={remove}>
                确认删除
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={actions.create.isPending || actions.save.isPending}
                onClick={submit}
              >
                {mode === 'add' ? '添加' : '保存'}
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="milestone-form">
        <div className="fld">
          <label className="fld-label" htmlFor="msName">
            名称
          </label>
          <input
            id="msName"
            className="fld-inp"
            type="text"
            autoComplete="off"
            placeholder="例如：技术方案定稿"
            value={draft.name}
            aria-invalid={errors.name ? 'true' : 'false'}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          {errors.name ? <span className="fld-err">{errors.name}</span> : null}
        </div>

        <div className="fld">
          <span className="fld-label">状态</span>
          <div className="chip-group" role="group" aria-label="里程碑状态">
            {STATE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn('chip', draft.state === opt.value && 'active')}
                aria-pressed={draft.state === opt.value}
                title={opt.hint}
                onClick={() => setDraft({ ...draft, state: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="fld-hint">{STATE_OPTIONS.find((o) => o.value === draft.state)?.hint}</span>
        </div>

        <div className="fld">
          <label className="fld-label" htmlFor="msDate">
            计划日期（选填）
          </label>
          <input
            id="msDate"
            className="fld-inp"
            type="text"
            autoComplete="off"
            placeholder="2026-12-15 或 12 月"
            value={draft.dueDate}
            onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}
          />
          <span className="fld-hint">只作展示用，不会触发提醒</span>
        </div>

        <div className="fld">
          <label className="fld-label" htmlFor="msDetail">
            说明（选填）
          </label>
          <textarea
            id="msDetail"
            className="fld-inp"
            rows={3}
            placeholder="这个里程碑要交付什么 / 完成判据"
            value={draft.detail}
            onChange={(event) => setDraft({ ...draft, detail: event.target.value })}
          />
        </div>

        {target ? (
          <div className="fld-hint-block">
            当前：{target.name} · {STATE_LABEL[target.state]}
            {target.date ? ` · ${target.date}` : ''}
          </div>
        ) : null}
      </div>
    </WorkspaceModal>
  )
}
