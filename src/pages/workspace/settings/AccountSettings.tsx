import { useState } from 'react'
import { errorText } from '../../../api/error'
import { useAppInfo, useUserMutations, useUsers } from '../../../hooks/use-users'
import { isDesktopShell } from '../../../lib/desktop-window'
import type { User } from '../../../api/user'
import type { Handlers } from './panels'

/* ============================================================================
   账户页（`/settings/account`）—— **手写面板**，覆盖生成的那一份
   ----------------------------------------------------------------------------
   `panels.tsx` 是 `design/gen-workspace-pages.mjs` 生成的（文件头写着"请勿手改"），
   它给的 `AccountPanel` 是原型的静态标记：硬编"杨刘 / yangliu@example.com"，还有
   **密码 / 两步验证 / 登录设备** —— 单机应用没有登录，这三样是原型从企业后台抄来的，
   在这儿既没有数据也没有意义。

   这一页回答的是三个真问题：

     ① 我是谁 —— `app_user` 里 `id='me'` 那一行。**名字是真数据**：项目负责人、
        任务指派、文档作者显示的都是它，改了全站跟着变。
     ② 还有谁 —— 成员名单。项目成员与任务按 `code` 引用，不在名单里的人无法被指派；
        删人之前先看引用数，被用着就挡住并说明。
     ③ 数据在哪 —— 库文件与文档根的**实际路径**（取 `Store` 里记的那份，不是重新读
        config），外加三个计数。用户反复问"我的东西存哪了"，这一格就是答案。

   视觉沿用设置模块的卡片刻度（`.card` / `.setting-row` / `.avatar-lg`），
   那套类此前一条样式都没写，2026-10-18 一并补在 `module-workspace.css` 的 settings 段。
   ============================================================================ */

/** `2026-10-17T06:07:17Z` → `2026-10-17`；空串给「—」（浏览器预览里没有真时间）。 */
function dateOf(iso: string): string {
  return iso ? iso.slice(0, 10) : '—'
}

/** 一个人被多少处引用。全零时说「未被引用」，不要摆一排 0。 */
function refsText(user: User): string {
  const { projects, tasks, docs, activities } = user.refs
  if (projects + tasks + docs + activities === 0) return '未被引用'
  return [`项目 ${projects}`, `任务 ${tasks}`, `文档 ${docs}`, `动态 ${activities}`].join(' · ')
}

export function AccountSettings({ handlers }: { handlers: Handlers }) {
  const users = useUsers()
  const { data: info } = useAppInfo()
  const actions = useUserMutations()
  const me = users.find((user) => user.isMe)
  const others = users.filter((user) => !user.isMe)

  /* 行内编辑：一次只开一行（改名与加成员互斥）—— 与文档弹窗"一次只允许一维在编辑"同一条口径 */
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [adding, setAdding] = useState<{ code: string; name: string } | null>(null)

  const saveName = () => {
    if (!editing) return
    const name = editing.name.trim()
    if (!name) return
    actions.save.mutate(
      { id: editing.id, displayName: name },
      {
        onSuccess: (user) => {
          handlers.notice(`已改名为「${user.displayName}」`)
          setEditing(null)
        },
        onError: (error) => handlers.notice(`改名失败：${errorText(error)}`),
      },
    )
  }

  const addMember = () => {
    if (!adding) return
    actions.save.mutate(
      { code: adding.code.trim(), displayName: adding.name.trim() },
      {
        onSuccess: (user) => {
          handlers.notice(`已添加「${user.displayName}」`)
          setAdding(null)
        },
        onError: (error) => handlers.notice(`添加失败：${errorText(error)}`),
      },
    )
  }

  const removeMember = (user: User) => {
    actions.remove.mutate(user.id, {
      onSuccess: () => handlers.notice(`已删除「${user.displayName}」`),
      /* 被引用时后端会挡，并把"被谁用着"说清楚 —— 这里只转述 */
      onError: (error) => handlers.notice(`删除失败：${errorText(error)}`),
    })
  }

  /* 更名行复用了三次（我 / 成员 / 新增），抽一支 —— 免得三处各写一遍输入框 */
  const nameEditor = (
    value: string,
    onChange: (next: string) => void,
    onSave: () => void,
    onCancel: () => void,
  ) => (
    <div className="setting-actions">
      <input
        className="setting-input"
        value={value}
        autoFocus
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSave()
          if (event.key === 'Escape') onCancel()
        }}
      />
      <button type="button" className="btn btn-primary" onClick={onSave}>
        保存
      </button>
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        取消
      </button>
    </div>
  )

  return (
    <>
      {/* ① 我 */}
      <section className="card">
        <div className="card-title">我</div>
        {me ? (
          <>
            <div className="setting-row">
              <div className="avatar-lg">{me.code}</div>
              <div className="setting-info">
                <div className="setting-label">{me.displayName}</div>
                <div className="setting-desc">本机唯一使用者 · 项目负责人、任务指派、文档作者显示的都是这个名字</div>
              </div>
              {editing?.id === me.id ? (
                nameEditor(
                  editing.name,
                  (next) => setEditing({ id: me.id, name: next }),
                  saveName,
                  () => setEditing(null),
                )
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setEditing({ id: me.id, name: me.displayName })}
                >
                  改名
                </button>
              )}
            </div>
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">缩写</div>
                <div className="setting-desc">头像上那两个字母；任务按它引用，所以不跟着改名走</div>
              </div>
              <div className="setting-value">{me.code}</div>
            </div>
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">加入</div>
                <div className="setting-desc">这一份名单是本机的，跟账号系统无关</div>
              </div>
              <div className="setting-value">{dateOf(me.createdAt)}</div>
            </div>
          </>
        ) : (
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-desc">
                {/* 浏览器预览读不到 SQLite，一直显示"还在加载"会像卡死 ——
                    这里说清楚是宿主没有库，而不是这一页没做 */}
                {isDesktopShell()
                  ? '名单还在加载…'
                  : '名单存在本机数据库里，浏览器预览读不到 —— 请在桌面应用中打开。'}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ② 成员 */}
      <section className="card">
        <div className="card-title">成员</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-desc">
              项目的负责人、任务的指派、文档的作者都从这里选；不在名单里的人无法被指派。
            </div>
          </div>
        </div>
        {others.map((user) => (
          <div className="setting-row" key={user.id}>
            <div className="avatar-lg">{user.code}</div>
            <div className="setting-info">
              <div className="setting-label">{user.displayName}</div>
              <div className="setting-desc">{refsText(user)}</div>
            </div>
            {editing?.id === user.id ? (
              nameEditor(
                editing.name,
                (next) => setEditing({ id: user.id, name: next }),
                saveName,
                () => setEditing(null),
              )
            ) : (
              <div className="setting-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setEditing({ id: user.id, name: user.displayName })}
                >
                  改名
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => removeMember(user)}>
                  删除
                </button>
              </div>
            )}
          </div>
        ))}

        {adding ? (
          <div className="setting-row">
            <input
              className="setting-input"
              style={{ maxWidth: 76 }}
              placeholder="LY"
              value={adding.code}
              autoFocus
              maxLength={3}
              onChange={(event) => setAdding({ ...adding, code: event.target.value.toUpperCase() })}
            />
            <div className="setting-info">
              <input
                className="setting-input"
                placeholder="名字"
                value={adding.name}
                onChange={(event) => setAdding({ ...adding, name: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addMember()
                  if (event.key === 'Escape') setAdding(null)
                }}
              />
            </div>
            <div className="setting-actions">
              <button type="button" className="btn btn-primary" onClick={addMember}>
                添加
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setAdding(null)}>
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-desc">还没有添加其他人 —— 只有自己在用也可以。</div>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setAdding({ code: '', name: '' })}
            >
              添加成员
            </button>
          </div>
        )}
      </section>

      {/* ③ 本机数据 */}
      <section className="card">
        <div className="card-title">本机数据</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">数据库</div>
            <div className="setting-desc">索引全在这一个文件里（项目、任务、文档的元信息）</div>
          </div>
          <div className="setting-value" title={info?.dbPath}>
            {info?.dbPath ?? '…'}
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">文档根</div>
            <div className="setting-desc">正文是 `.md` 文件，按「宿主 / 项目」两层分目录</div>
          </div>
          <div className="setting-value" title={info?.documentsRoot}>
            {info?.documentsRoot ?? '…'}
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">内容</div>
            <div className="setting-desc">库里的行数，不是估算</div>
          </div>
          <div className="setting-value">
            {info ? `${info.projects} 个项目 · ${info.tasks} 个任务 · ${info.docs} 篇文档` : '…'}
          </div>
        </div>
      </section>
    </>
  )
}
