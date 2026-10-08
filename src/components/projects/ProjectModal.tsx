import { useEffect, useMemo, useRef, useState } from 'react'
import { WorkspaceModal } from '../workspace/WorkspaceModal'
import { Icon } from '../icons/Icon'
import { useProjects } from '../../hooks/use-projects'
import { ownerPool, tagPool } from '../../lib/filter-projects'
import { FORM_PRIORITIES, FORM_SCOPES, FORM_STATUSES, STATUS_LABEL } from './project-meta'
import { toast } from '../../stores/toast-store'
import type { ProjectPatch } from '../../api/projects'
import type { Priority, Project, ProjectStatus, Scope } from '../../types'

/**
 * 项目弹窗：新建 / 编辑（同一张表单）与删除确认。
 *
 * 新建与编辑共用一套字段，按模式换词的只有标题与底部那个提交键 ——
 *    分开写两份的话，加了字段只加一边、改了校验忘改另一个，这类不一致用户第一次就会遇到。
 *
 * 正文里只放要填的字段（说明交给 placeholder 与弹窗标题），唯一的例外是
 * 删除确认里那段"影响范围" —— 破坏性动作的说明不是废话。
 *
 * 与原型的三处差异，都是"静态页 → 应用"必然的：
 *    · 显隐不靠 `.open` 类：`WorkspaceModal` 是条件渲染，开着就是渲染着；
 *    · 表单是受控的（原型读 `input.value`）。同一个组件换个项目再开时，
 *      state 靠 `key` 重建（见调用处），不需要在打开时"填一遍值"。
 *    · 目录选择器不是"把表单摘下来存着再放回"（原型那样做），
 *      而是一个 `picking` 开关切正文 —— 表单 state 一直在组件里，天然不会丢。
 */
export type ProjectFormValue = ProjectPatch

/* ============================================================
   目录选择器的目录树
   ------------------------------------------------------------
   ① 已登记的各项目 `path`（每一级都要在）+ ② 一张装饰表补"机器上确实有、
   只是还没登记项目"的同级项。
   不手写第二份主清单：项目改了路径而树里还留着旧的，浏览里就永远看不到
      刚登记的那个目录。装饰表只负责"让树看起来像一台真机器的家目录"。
   ============================================================ */
const FS_DECOR: Record<string, string[]> = {
  '~': ['Code', 'Documents', 'Downloads', 'Pictures', 'Craft', 'tmp'],
  '~/Code': ['work', 'oss', 'sandbox', 'learn', 'rust'],
  '~/Code/work': ['legacy-billing', 'infra-scripts'],
  '~/Code/oss': ['dotfiles', 'cli-kit'],
  '~/Code/learn': ['vue-notes', 'd3-course'],
  '~/Code/rust': ['book-examples', 'tokio-notes'],
  '~/Documents': ['笔记', '发票', '合同', '健康'],
  '~/Documents/旅行': ['2025-京都'],
  '~/Craft': ['riding-fancy', 'scratch'],
  '~/Craft/riding-fancy': ['docs', 'lucky-y'],
  '~/Downloads': ['design-refs', 'installers'],
  '~/Pictures': ['screenshots', 'wallpapers'],
}

type Tree = Record<string, string[]>

function buildTree(paths: string[]): Tree {
  const kids: Tree = {}
  const add = (parent: string, name: string) => {
    if (!kids[parent]) kids[parent] = []
    if (kids[parent].indexOf(name) < 0) kids[parent].push(name)
    const child = `${parent}/${name}`
    if (!kids[child]) kids[child] = []
  }

  Object.keys(FS_DECOR).forEach((dir) => FS_DECOR[dir].forEach((name) => add(dir, name)))
  paths.filter(Boolean).forEach((full) => {
    const parts = full.split('/').filter(Boolean)
    /* 原型里的树只有家目录这一支 */
    if (parts[0] !== '~') return
    let cursor = '~'
    for (let i = 1; i < parts.length; i += 1) {
      add(cursor, parts[i])
      cursor = `${cursor}/${parts[i]}`
    }
  })
  if (!kids['~']) kids['~'] = []
  return kids
}

function childrenOf(tree: Tree, dir: string, keyword: string): string[] {
  const all = tree[dir] ?? []
  const query = keyword.trim().toLowerCase()
  return query ? all.filter((name) => name.toLowerCase().includes(query)) : all
}

/** 落点：默认落在当前值那一级（不是家目录）—— 答案最可能在的地方。
 *  值不在树里也吃得下：退到最长存在前缀，都没有才回家目录
 *  （"找不到就回根目录"会把用户扔到一个无关的地方）。 */
function initialCwd(tree: Tree, raw: string): string {
  const parts = raw.trim().split('/').filter(Boolean)
  if (parts[0] !== '~') return '~'

  let cursor = '~'
  for (let i = 1; i < parts.length; i += 1) {
    if (childrenOf(tree, cursor, '').indexOf(parts[i]) < 0) break
    cursor = `${cursor}/${parts[i]}`
  }
  return cursor
}

/**
 * 多值字段 = 一排可多选的胶囊 + 行尾一个虚线 ＋。
 *
 * 这一轮新建出来的值先并进候选再渲染（`extra`）：否则"新建并选中"之后
 *    那一枚会立刻消失（它还没有任何项目用过），看起来像没建成。
 * ＋ 换成输入框是在原位替换，不是"多长出来一个字段"；空名 = 取消
 *    （点开又后悔是常事，不该因此建出一个空值）。
 * 输入框里的 Esc 必须 stopPropagation —— `WorkspaceModal` 的 Escape 监听在
 *    document 上，不拦的话会顺手把整张弹窗关掉（连带刚填的一屏字段）。
 */
function ChipField({
  noun,
  pool,
  selected,
  onChange,
}: {
  noun: string
  pool: string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')

  const extra = selected.filter((value) => pool.indexOf(value) < 0)

  const commit = (raw: string) => {
    const name = raw.trim()
    /* 撞名复用已有那一枚，不补第二枚同名胶囊（并排两枚同名会让人以为"新建没生效"） */
    if (name && selected.indexOf(name) < 0) onChange([...selected, name])
    setAdding(false)
    setText('')
  }

  return (
    <div className="tag-picker">
      {extra.concat(pool).map((value) => {
        const on = selected.indexOf(value) > -1
        return (
          <button
            key={value}
            type="button"
            className={on ? 'tag-chip is-on' : 'tag-chip'}
            aria-pressed={on}
            title={value}
            onClick={() => onChange(on ? selected.filter((item) => item !== value) : [...selected, value])}
          >
            {value}
          </button>
        )
      })}

      {adding ? (
        <input
          className="tag-new"
          type="text"
          maxLength={12}
          placeholder={noun}
          aria-label={`新建${noun}`}
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation()
              commit('')
            } else if (event.key === 'Enter') {
              event.preventDefault()
              commit(text)
            }
          }}
          onBlur={() => commit(text)}
        />
      ) : (
        <button
          type="button"
          className="tag-chip is-add"
          aria-label={`新建${noun}`}
          title={`新建${noun}`}
          onClick={() => setAdding(true)}
        >
          <Icon name="i-plus" />
        </button>
      )}
    </div>
  )
}

export function ProjectFormModal({
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit'
  /** 表单初值。新建时是 `blankProjectPatch()`，编辑时由那条项目映射而来 */
  initial: ProjectFormValue
  onClose: () => void
  onSubmit: (value: ProjectFormValue) => void
}) {
  const isCreate = mode === 'create'
  const [draft, setDraft] = useState<ProjectFormValue>(initial)
  const [picking, setPicking] = useState(false)
  const [filter, setFilter] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const pathRef = useRef<HTMLInputElement>(null)
  /** 是否进过选择器 —— 只有从选择器退回来才把焦点送到目录框
   *（首次挂载时要留给名称输入框的 `autoFocus`） */
  const wasPicking = useRef(false)

  useEffect(() => {
    if (picking) {
      wasPicking.current = true
      return
    }
    if (wasPicking.current) {
      wasPicking.current = false
      pathRef.current?.focus()
    }
  }, [picking])

  const { data: projects = [] } = useProjects()
  const tree = useMemo(() => buildTree(projects.map((project) => project.path ?? '')), [projects])
  /* 落点算一次就定住：之后在树里走动由 `cwd` 说了算，不再回头看输入框 */
  const [cwd, setCwd] = useState(() => initialCwd(tree, initial.path))

  const tags = useMemo(() => tagPool(projects), [projects])
  const owners = useMemo(() => ownerPool(projects), [projects])

  const set = <K extends keyof ProjectFormValue>(key: K, value: ProjectFormValue[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  /* 名称是唯一的必填项 —— 卡片、看板、详情页的 Hero 全靠它认人。
     空名不提交，并把焦点送回输入框（原型同此：提示只是回执，焦点才是"该改哪里"）。 */
  const submit = () => {
    const trimmed = draft.name.trim()
    if (!trimmed) {
      toast('名称不能为空')
      nameRef.current?.focus()
      return
    }
    onSubmit({
      ...draft,
      name: trimmed,
      description: draft.description.trim(),
      milestone: draft.milestone.trim(),
      path: draft.path.trim(),
    })
  }

  const list = childrenOf(tree, cwd, filter)

  /**
   * ✕ / Esc / 点遮罩 —— 三者走同一个回调（`WorkspaceModal` 就是这么接的）。
   *
   * 在选择器态里它是「退一层」而不是关窗（原型对 Esc 是这么做的，✕ 那条是它的疏漏）：
   *    弹窗这时只有一屏——"目录选择器"，而在这一屏上"退出"最自然的含义就是回到表单。
   *    真关窗要连刚填的一屏字段一起扔掉，那不该是一次 ✕ 的后果。
   */
  const backOrClose = () => {
    if (picking) {
      setPicking(false)
      return
    }
    onClose()
  }

  const foot = picking ? (
    <>
      {/* 「返回」只退回表单，不关窗 —— 关掉的话刚填的一屏字段一起没了 */}
      <button type="button" className="btn btn-ghost" onClick={() => setPicking(false)}>
        返回
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          set('path', cwd)
          setPicking(false)
        }}
      >
        用这个目录
      </button>
    </>
  ) : (
    <>
      <button type="button" className="btn btn-ghost" onClick={onClose}>
        取消
      </button>
      <button type="button" className="btn btn-primary" onClick={submit}>
        {isCreate ? '创建' : '保存'}
      </button>
    </>
  )

  return (
    <WorkspaceModal
      /* 标题也说"现在在干什么"：切到选择器时它跟着换 */
      title={picking ? '选择本地目录' : isCreate ? '新建项目' : '编辑项目'}
      onClose={backOrClose}
      actions={foot}
    >
      {picking ? (
        <>
          <div className="dsel-path">
            {cwd
              .split('/')
              .filter(Boolean)
              .map((name, index, all) => {
                const target = index === 0 ? '~' : all.slice(0, index + 1).join('/')
                const last = index === all.length - 1
                return (
                  <span key={target} className="dsel-part">
                    {index > 0 ? (
                      <span className="dsel-sep" aria-hidden="true">
                        ›
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="dsel-crumb"
                      aria-current={last ? 'true' : undefined}
                      onClick={() => {
                        setCwd(target)
                        setFilter('')
                      }}
                    >
                      {name}
                    </button>
                  </span>
                )
              })}
          </div>

          <input
            className="form-input dsel-filter"
            /* `key={cwd}`：换一级目录就重挂载一次 —— 于是 `autoFocus` 每次都会生效，
               焦点落在筛选框上（原型在 `enterDir` 里手动 focus 的就是它）。
               不这么做的话，点一行进下一级之后焦点会掉到 body 上，键盘用户得再 Tab 回来。 */
            key={cwd}
            type="search"
            placeholder="筛选当前目录"
            autoComplete="off"
            autoFocus
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />

          <div className="dsel-list">
            {list.length ? (
              list.map((name) => {
                const full = `${cwd}/${name}`
                const count = childrenOf(tree, full, '').length
                return (
                  <button
                    key={full}
                    type="button"
                    className="dsel-row"
                    onClick={() => {
                      setCwd(full)
                      setFilter('')
                    }}
                  >
                    <Icon name="i-chevron-right" />
                    <span className="dsel-name">{name}</span>
                    <span className="dsel-count">{count ? `${count} 项` : '空'}</span>
                  </button>
                )
              })
            ) : (
              <div className="dsel-empty">
                {filter ? '这个目录下没有匹配的子目录' : '这个目录下没有子目录'}
              </div>
            )}
          </div>

          <div className="dsel-note">
            当前：<code>{cwd}</code> · 点目录进入下一级，「用这个目录」选定它
          </div>
        </>
      ) : (
        <>
          <div className="form-field">
            <label className="form-label" htmlFor="projName">
              名称
            </label>
            <input
              id="projName"
              ref={nameRef}
              className="form-input"
              type="text"
              value={draft.name}
              maxLength={40}
              autoComplete="off"
              autoFocus
              placeholder="例：马尔代夫家庭旅行"
              onChange={(event) => set('name', event.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="projDesc">
              描述
            </label>
            <textarea
              id="projDesc"
              className="form-textarea"
              placeholder="一句话说清这个项目要做什么"
              value={draft.description}
              onChange={(event) => set('description', event.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="projScope">
                类型
              </label>
              <select
                id="projScope"
                className="form-select"
                value={draft.scope}
                onChange={(event) => set('scope', event.target.value as Scope)}
              >
                {FORM_SCOPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="projPrio">
                优先级
              </label>
              <select
                id="projPrio"
                className="form-select"
                value={draft.priority}
                onChange={(event) => set('priority', event.target.value as Priority)}
              >
                {FORM_PRIORITIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="projStatus">
                状态
              </label>
              <select
                id="projStatus"
                className="form-select"
                value={draft.status}
                onChange={(event) => set('status', event.target.value as ProjectStatus)}
              >
                {FORM_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="projDue">
                截止日期
              </label>
              <input
                id="projDue"
                className="form-input"
                type="date"
                value={draft.dueDate}
                onChange={(event) => set('dueDate', event.target.value)}
              />
            </div>
          </div>

          {/* 标签：候选来自所有项目已用过的标签并集（`tagPool`），不另存一份清单。
              负责人用同一个组件 —— 人也是"少而固定、选比自己敲准"的值。 */}
          <div className="form-field">
            <span className="form-label" id="projTagsLabel">
              标签
            </span>
            <div role="group" aria-labelledby="projTagsLabel">
              <ChipField noun="标签" pool={tags} selected={draft.tags} onChange={(next) => set('tags', next)} />
            </div>
          </div>

          <div className="form-field">
            <span className="form-label" id="projOwnersLabel">
              负责人
            </span>
            <div role="group" aria-labelledby="projOwnersLabel">
              <ChipField
                noun="负责人"
                pool={owners}
                selected={draft.owners}
                onChange={(next) => set('owners', next)}
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="projMilestone">
              里程碑
            </label>
            <input
              id="projMilestone"
              className="form-input"
              type="text"
              value={draft.milestone}
              autoComplete="off"
              placeholder="当前推进到哪一步，例：灰度发布"
              onChange={(event) => set('milestone', event.target.value)}
            />
          </div>

          {/* 本地目录：值可以敲，也可以选。入口紧贴它所属的字段标签 ——
              路径这种东西是"只能认出来、记不住"的值，让人凭空敲是本末倒置。 */}
          <div className="form-field">
            <div className="form-labelrow">
              <label className="form-label" htmlFor="projPath">
                本地目录
              </label>
              <button type="button" className="form-link" onClick={() => setPicking(true)}>
                浏览本地目录
              </button>
            </div>
            <input
              id="projPath"
              ref={pathRef}
              className="form-input"
              type="text"
              value={draft.path}
              autoComplete="off"
              placeholder="项目的根目录，例：~/Code/my-project（没有就留空）"
              onChange={(event) => set('path', event.target.value)}
            />
          </div>
        </>
      )}
    </WorkspaceModal>
  )
}

export function ProjectDeleteModal({
  project,
  onClose,
  onConfirm,
}: {
  project: Project
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <WorkspaceModal
      title="删除项目"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          {/* 动词用「删除」而不是「确定」：按钮自己说清它要干什么 */}
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            删除
          </button>
        </>
      }
    >
      <div className="proj-del-target">「{project.name}」</div>
      <div className="proj-del-note">
        这个项目下的任务 / Bug / 文档 / 服务器会一并消失。当前还没有后端，删除只是内存里的改动
        —— 关掉这条提示之前，可以用它上面的「撤销」找回来。
      </div>
    </WorkspaceModal>
  )
}
