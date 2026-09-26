import { useState } from 'react'
import { cn } from '../../../lib/cn'
import type { Handlers } from '../../../pages/workspace/work/panels'

/* ============================================================================
   客户与联系人 —— 工作模块的「客户与联系人」分区（`/work/contacts`）
   ----------------------------------------------------------------------------
   2026-09-25 由两个分区合并：`clients`（客户资料）＋ `contacts`（联系人）。
   合并后分区 key 仍是 `contacts` —— 沿用旧 key 是有意的：它保住了
   `/work/contacts` 这条地址（老书签、以及"从别处跳进来"都不用改）。
   而 `/work/clients` 随 `clients` 分区一起撤掉，会静默落到工作台（见 `panels.tsx` 文件头）。

   ============================================================================
   为什么这一块是**手写组件**而不是留在 `panels.tsx`（那里全是静态标记）
   ============================================================================
   用户给这一项的口径里有一句「非相关角色可隐藏」—— 那是**状态**（选中的筛选项），
   而静态标记表达不了状态。判据与 `ProjectShelf` 同一条：
   「要状态、或要按数据渲染 ⇒ 手写组件」。登记在 `WorkWorkspace.tsx` 的 `PANELS`。

   ============================================================================
   筛选器**复用了内核的 `.tabs` / `.tab`**，没有新造类名
   ============================================================================
   先查过产物：内核里 `module-workspace.css` 只有一条 `.mw-root .tabs`
   （`display:flex; gap:4px; padding:6px; border-radius:14px`）与
   `.mw-root .tab` / `.tab:hover` / `.tab.active` —— **没有** sticky、
   没有 `margin: 0 -24px`（那两条只存在于原型里，因为原型的 `.tabs` 是通栏的页面导航条；
   收进内核时被 8 份原型的共识筛掉了）。所以搬进卡片里用是干净的药丸行。
   为什么不复用 `.client-tag`：那个是**只读**标签，没有选中态；
   要给它加 `.active` 就得动生成的那份 CSS，而新造资产解决不了任何真问题。

   ⚠️ 筛选的粒度是**块**不是**人**：这一页只有两类角色（客户 / 团队），
      点「客户」就藏起团队联系人、点「团队」就藏起客户资料块。
      没有做"按人头隐藏"——那需要每条记录了角色之外的"相关性"字段，
      而现有数据里没有这个字段，硬编一个筛选维度就是**造数据**。
   ============================================================================ */

type Role = 'client' | 'team'
type Filter = 'all' | Role

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'client', label: '客户' },
  { key: 'team', label: '团队' },
]

/**
 * 客户资料库。原样取自 `design/work/work_index.html` 的 `.client-card` 四张卡，
 * 一个数字没改 —— 这里只是把标题/元信息/标签/文件数从标记里提出成数据，
 * 好让下面的筛选能按块开关。
 */
const CLIENTS: { name: string; avatar: string; meta: string; tags: string[]; count: number }[] = [
  {
    name: '星辰科技',
    avatar: '星',
    meta: '32 个文件 · 最近更新 2 小时前',
    tags: ['需求 12', '数据 8', '原型 6'],
    count: 32,
  },
  {
    name: '云启网络',
    avatar: '云',
    meta: '18 个文件 · 最近更新 昨天',
    tags: ['需求 8', '参考 5'],
    count: 18,
  },
  {
    name: '蓝海数据',
    avatar: '蓝',
    meta: '46 个文件 · 最近更新 3 天前',
    tags: ['数据 24', '合同 4'],
    count: 46,
  },
  {
    name: '微光传媒',
    avatar: '微',
    meta: '12 个文件 · 最近更新 5 天前',
    tags: ['需求 6', '原型 4'],
    count: 12,
  },
]

/** 联系人。四个人都是团队角色 —— 这是原型里的事实，没有为了"让筛选有东西可藏"而编人。 */
const CONTACTS: { name: string; avatar: string; meta: string; role: Role }[] = [
  { name: '张工', avatar: '张', meta: '技术负责人', role: 'team' },
  { name: '李工', avatar: '李', meta: '前端同事', role: 'team' },
  { name: '王产品', avatar: '王', meta: '产品经理', role: 'team' },
  { name: '赵测试', avatar: '赵', meta: '测试同事', role: 'team' },
]

/** 最近资料。挂在客户那一块下（它是客户资料库的"新增"，不是联系人的）。 */
const RECENT_FILES: { icon: string; name: string; meta: string }[] = [
  { icon: '📊', name: '需求清单 v3.xlsx', meta: '星辰科技 · 2 小时前 · 1.2 MB' },
  { icon: '📄', name: '接口说明.md', meta: '云启网络 · 昨天 · 24 KB' },
  { icon: '📕', name: '数据字典.pdf', meta: '蓝海数据 · 3 天前 · 3.4 MB' },
  { icon: '🖼️', name: '首页原型.png', meta: '微光传媒 · 5 天前 · 860 KB' },
]

export function ClientsContacts({ handlers }: { handlers: Handlers }) {
  const [filter, setFilter] = useState<Filter>('all')

  const showClients = filter === 'all' || filter === 'client'
  const showTeam = filter === 'all' || filter === 'team'

  return (
    <>
      {/* 角色筛选。`role="tablist"` 而不是 `radiogroup`：它切换的是**下面显示哪一块**，
          与内核 `.tab` 的语义（分区）一致，键盘用左右方向键在这族里是通行做法。 */}
      <nav className="tabs" role="tablist" aria-label="按角色筛选">
        {FILTERS.map((item) => {
          const isActive = filter === item.key
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              className={cn('tab', isActive && 'active')}
              aria-selected={isActive}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          )
        })}
      </nav>

      {showClients ? (
        <>
          <section className="grid-3">
            <div className="card">
              <div className="card-title">客户数</div>
              <div className="stat">8</div>
              <div className="stat-desc">本周新增 2 个</div>
              <div className="progress-bar" style={{ marginTop: '8px' }}>
                <div className="progress-fill" style={{ width: '60%' }} />
              </div>
            </div>
            <div className="card">
              <div className="card-title">资料文件</div>
              <div className="stat">126</div>
              <div className="stat-desc">Excel 48 · MD 32 · PDF 26</div>
              <div className="progress-bar" style={{ marginTop: '8px' }}>
                <div className="progress-fill" style={{ width: '72%' }} />
              </div>
            </div>
            <div className="card">
              <div className="card-title">待整理</div>
              <div className="stat">5</div>
              <div className="stat-desc">未归类 / 未解读</div>
              <div className="progress-bar" style={{ marginTop: '8px' }}>
                <div className="progress-fill" style={{ width: '30%' }} />
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-title">客户资料库</div>
            {CLIENTS.map((client) => (
              <div
                key={client.name}
                className="client-card"
                role="button"
                tabIndex={0}
                onClick={() => handlers.openClient(client.name)}
                onKeyDown={(event) => {
                  if (event.key === ' ' || event.key === 'Enter') {
                    event.preventDefault()
                    handlers.openClient(client.name)
                  }
                }}
              >
                <div className="client-avatar">{client.avatar}</div>
                <div className="client-info">
                  <div className="client-name">{client.name}</div>
                  <div className="client-meta">{client.meta}</div>
                  <div className="client-tags">
                    {client.tags.map((tag) => (
                      <span key={tag} className="client-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="client-right">
                  <div className="client-amount">{client.count}</div>
                  <div className="client-status">文件</div>
                </div>
              </div>
            ))}
          </section>

          <section className="card">
            <div className="card-title">最近资料</div>
            {RECENT_FILES.map((file) => (
              <div key={file.name} className="doc-item">
                <div className="doc-icon">{file.icon}</div>
                <div className="doc-info">
                  <div className="doc-name">{file.name}</div>
                  <div className="doc-meta">{file.meta}</div>
                </div>
              </div>
            ))}
          </section>
        </>
      ) : null}

      {showTeam ? (
        <section className="card">
          <div className="card-title">联系人</div>
          {CONTACTS.filter((contact) => filter === 'all' || contact.role === filter).map((contact) => (
            <div key={contact.name} className="contact-item">
              <div className="avatar">{contact.avatar}</div>
              <div className="contact-info">
                <div className="contact-name">{contact.name}</div>
                <div className="contact-meta">{contact.meta}</div>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </>
  )
}
