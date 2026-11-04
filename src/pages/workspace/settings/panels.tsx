/**
 * settings 模块的面板。
 *
 * 原本是 `design/gen-workspace-pages.mjs` 生成的静态标记（文件头写着 `@generated —— 请勿手改`），
 * 生成器已不在了，现在改成手写：把硬编的「杨刘 yangliu@example.com」和一排静态开关
 * 换成真实后端数据。
 *
 * 数据走两条路：
 *   · 设置项（模块开关 / 外观 / 通知 / 集成 / 快捷键）—— `useSettingsByCategory(category)`
 *     取，`useSettingActions().setValue` / `.upsert` 写。
 *   · 账户信息 —— `useUsers()` 取本机用户（`isMe` 那一行），单机应用没有登录系统。
 *
 * 几个面板（数据/AI/隐私）保留静态 UI：备份/恢复是本地操作，AI 配置走 LlmConfigModal，
 * 隐私规则暂不入库。AccountPanel 在 SettingsWorkspace 里被手写的 AccountSettings 覆盖，
 * 这里仍保留一份作为兜底导出。
 *
 * 类名（`.card` / `.setting-row` / `.module-item` / `.shortcut-row` …）一个没动 ——
 * 那套是 `module-workspace.css` 的 settings 段在消费的接口。
 */
import { Switch, ThemeSwatches } from '../../../components/workspace/toggles'
import { useAppInfo, useUsers } from '../../../hooks/use-users'
import { useSettingActions, useSettingsByCategory } from '../../../hooks/use-settings'
import type { SettingItem } from '../../../api/settings'
import type { ModuleTab } from '../../../data/workspace/types'

/** Tab 定义（键 + 标签）。标签与原型顶栏面包屑的 titleMap 交叉校验过。 */
export const TABS: ModuleTab[] = [
  { key: 'account', label: '账户与安全' },
  { key: 'modules', label: '模块管理' },
  { key: 'appearance', label: '主题与外观' },
  { key: 'notifications', label: '通知提醒' },
  { key: 'data', label: '数据与备份' },
  { key: 'integrations', label: '集成与 API' },
  { key: 'ai', label: 'AI 设置' },
  { key: 'privacy', label: '权限与隐私' },
  { key: 'shortcuts', label: '快捷键' },
  { key: 'about', label: '关于' },
]

/** 本模块所有交互回调 —— 实现写在 <SettingsWorkspace /> 里。 */
export interface Handlers {
  notice: (arg0: string) => void
}

export const MODAL_SPECS = {
} as const

export type ModalKey = keyof typeof MODAL_SPECS

/* ------------------------------------------------------------------ *
 * 默认列表
 *
 * 数据库还没有任何设置项时显示的兜底：用户第一次打开设置页能看见完整的开关阵列，
 * 切换时调 `upsert` 把这一项写进库 —— 之后这一项就走 `setValue` 走了。
 * 颜色与原型那份静态标记保持一致（`.module-dot` 的内联色）。
 * ------------------------------------------------------------------ */

interface DefaultItem {
  itemKey: string
  label: string
  description: string
  color?: string
}

const DEFAULT_MODULES: DefaultItem[] = [
  { itemKey: 'workbench', label: '工作台', description: '九宫环首页', color: '#6366F1' },
  { itemKey: 'tasks', label: '任务清单', description: '任务与看板', color: '#F59E0B' },
  { itemKey: 'calendar', label: '日程', description: '日历与事件', color: '#0EA5E9' },
  { itemKey: 'life', label: '生活', description: '生活记录', color: '#10B981' },
  { itemKey: 'learning', label: '学习', description: '课程与笔记', color: '#D946EF' },
  { itemKey: 'knowledge', label: '知识库', description: '文档与卡片', color: '#14B8A6' },
  { itemKey: 'settings', label: '设置', description: '本页', color: '#64748B' },
]

const DEFAULT_APPEARANCE: DefaultItem[] = [
  { itemKey: 'diffuse_background', label: '弥散背景', description: '低饱和色团 + 毛玻璃' },
  { itemKey: 'animation', label: '动画效果', description: '色团漂移、悬停动效' },
  { itemKey: 'compact_mode', label: '紧凑模式', description: '减少间距，显示更多内容' },
]

const DEFAULT_NOTIFICATIONS: DefaultItem[] = [
  { itemKey: 'task_reminder', label: '任务提醒', description: '任务到期前提醒' },
  { itemKey: 'calendar_reminder', label: '日程提醒', description: '日程开始前 15 分钟' },
  { itemKey: 'habit_reminder', label: '习惯打卡提醒', description: '每天固定时间提醒' },
  { itemKey: 'review_reminder', label: '复习提醒', description: '有卡片到期时提醒' },
  { itemKey: 'milestone_reminder', label: '里程碑提醒', description: '项目里程碑临近时提醒' },
  { itemKey: 'pet_reminder', label: '宠物提醒', description: '疫苗、驱虫到期提醒' },
]

const DEFAULT_NOTIFICATION_CHANNELS: DefaultItem[] = [
  { itemKey: 'channel_in_app', label: '站内通知', description: '' },
  { itemKey: 'channel_email', label: '邮件通知', description: '' },
  { itemKey: 'channel_browser', label: '浏览器推送', description: '' },
  { itemKey: 'channel_mobile', label: '手机推送', description: '' },
]

const DEFAULT_INTEGRATIONS: DefaultItem[] = [
  { itemKey: 'github', label: 'GitHub', description: '关联仓库、提交记录' },
  { itemKey: 'google_calendar', label: 'Google Calendar', description: '同步日程' },
  { itemKey: 'notion', label: 'Notion', description: '导入笔记、数据库' },
  { itemKey: 'wecom_feishu', label: '企业微信 / 飞书', description: '消息通知' },
]

const DEFAULT_SHORTCUTS_GLOBAL: DefaultItem[] = [
  { itemKey: 'open_command_palette', label: '打开命令面板', description: '⌘ K' },
  { itemKey: 'quick_new', label: '快速新建', description: '⌘ N' },
  { itemKey: 'global_search', label: '全局搜索', description: '⌘ /' },
  { itemKey: 'toggle_theme', label: '切换主题', description: '⌘ ⇧ L' },
]

const DEFAULT_SHORTCUTS_MODULE: DefaultItem[] = [
  { itemKey: 'switch_module', label: '切换模块', description: '⌘ 1 ~ 9' },
  { itemKey: 'new_task', label: '新建任务', description: 'T' },
  { itemKey: 'new_note', label: '新建笔记', description: 'N' },
  { itemKey: 'new_event', label: '新建日程', description: 'E' },
]

/* ------------------------------------------------------------------ *
 * SettingSwitch —— 把 Switch 绑到一个设置项上
 *
 * 受控模式：`on` 来自后端 `value === 'true'`，refetch 后自动回正/回弹。
 * 切换时：
 *   · 已存在的设置项 → `setValue(key, value)`
 *   · 还没入库的默认项 → `upsert({ category, itemKey, label, value, description })`
 * ------------------------------------------------------------------ */

interface SettingSwitchProps {
  item: SettingItem | (DefaultItem & { value?: undefined })
  category: string
}

function SettingSwitch({ item, category }: SettingSwitchProps) {
  const actions = useSettingActions()
  const isPersisted = 'value' in item && typeof item.value === 'string'
  const on = isPersisted ? (item as SettingItem).value === 'true' : true

  const handleChange = (next: boolean) => {
    const value = String(next)
    if (isPersisted) {
      actions.setValue.mutate({ key: item.itemKey, value })
    } else {
      actions.upsert.mutate({
        category,
        itemKey: item.itemKey,
        label: item.label,
        value,
        description: item.description ?? '',
      })
    }
  }

  return <Switch on={on} onChange={handleChange} />
}

/* ------------------------------------------------------------------ *
 * 帮助：把 useSettingsByCategory 的结果与默认列表合并渲染。
 *
 * 后端有数据 → 用后端那一批；后端空 → 用默认列表（切换时 upsert 进库）。
 * ------------------------------------------------------------------ */

function useSettingList(category: string, defaults: DefaultItem[]) {
  const { data } = useSettingsByCategory(category)
  if (data && data.length > 0) return data
  return defaults
}

/* ------------------------------------------------------------------ *
 * 面板
 * ------------------------------------------------------------------ */

export function AccountPanel({ handlers: _handlers }: { handlers: Handlers }) {
  const users = useUsers()
  const me = users.find((u) => u.isMe)

  return (
    <>
      <section className="card">
        <div className="card-title">账户信息</div>
        {me ? (
          <>
            <div className="setting-row">
              <div className="avatar-lg">{me.code}</div>
              <div className="setting-info">
                <div className="setting-label">{me.displayName}</div>
                <div className="setting-desc">本机唯一使用者</div>
              </div>
              <button className="btn btn-ghost">编辑</button>
            </div>
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">昵称</div>
                <div className="setting-desc">显示在系统内</div>
              </div>
              <div className="setting-value">{me.displayName}</div>
            </div>
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">缩写</div>
                <div className="setting-desc">头像上那两个字母</div>
              </div>
              <div className="setting-value">{me.code}</div>
            </div>
          </>
        ) : (
          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-desc">未登录 —— 单机应用请在「账户」页设置本机用户名</div>
            </div>
          </div>
        )}
      </section>
      <section className="card">
        <div className="card-title">安全</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">密码</div>
            <div className="setting-desc">单机应用无登录密码</div>
          </div>
          <button className="btn btn-ghost">修改</button>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">两步验证</div>
            <div className="setting-desc">登录时需要额外验证</div>
          </div>
          <Switch />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">登录设备</div>
            <div className="setting-desc">当前有 1 台设备登录</div>
          </div>
          <button className="btn btn-ghost">管理</button>
        </div>
      </section>
    </>
  )
}

export function ModulesPanel({ handlers: _handlers }: { handlers: Handlers }) {
  const list = useSettingList('module', DEFAULT_MODULES)

  return (
    <>
      <section className="card">
        <div className="card-title">模块开关</div>
        {list.map((item) => (
          <div className="module-item" key={item.itemKey}>
            <div className="module-info">
              <div
                className="module-dot"
                style={{ background: 'color' in item ? (item as DefaultItem).color : '#64748B' }}
              />
              <div className="module-name">{item.label}</div>
            </div>
            <SettingSwitch item={item as SettingItem | (DefaultItem & { value?: undefined })} category="module" />
          </div>
        ))}
      </section>
    </>
  )
}

export function AppearancePanel({ handlers: _handlers }: { handlers: Handlers }) {
  const list = useSettingList('appearance', DEFAULT_APPEARANCE)

  return (
    <>
      <section className="card">
        <div className="card-title">主题</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">颜色模式</div>
            <div className="setting-desc">亮色 / 暗色 / 跟随系统</div>
          </div>
          <ThemeSwatches />
        </div>
        {list.map((item) => (
          <div className="setting-row" key={item.itemKey}>
            <div className="setting-info">
              <div className="setting-label">{item.label}</div>
              <div className="setting-desc">{item.description}</div>
            </div>
            <SettingSwitch item={item as SettingItem | (DefaultItem & { value?: undefined })} category="appearance" />
          </div>
        ))}
      </section>
      <section className="card">
        <div className="card-title">模块主题色</div>
        <div className="setting-row">
          <div className="setting-info"><div className="setting-label">工作台</div></div>
          <div className="setting-value" style={{ color: '#6366F1' }}>靛蓝 #6366F1</div>
        </div>
        <div className="setting-row">
          <div className="setting-info"><div className="setting-label">任务清单</div></div>
          <div className="setting-value" style={{ color: '#F59E0B' }}>琥珀 #F59E0B</div>
        </div>
        <div className="setting-row">
          <div className="setting-info"><div className="setting-label">日程</div></div>
          <div className="setting-value" style={{ color: '#0EA5E9' }}>天蓝 #0EA5E9</div>
        </div>
        <div className="setting-row">
          <div className="setting-info"><div className="setting-label">生活</div></div>
          <div className="setting-value" style={{ color: '#10B981' }}>翠绿 #10B981</div>
        </div>
        <div className="setting-row">
          <div className="setting-info"><div className="setting-label">学习</div></div>
          <div className="setting-value" style={{ color: '#D946EF' }}>粉紫 #D946EF</div>
        </div>
        <div className="setting-row">
          <div className="setting-info"><div className="setting-label">知识库</div></div>
          <div className="setting-value" style={{ color: '#14B8A6' }}>青色 #14B8A6</div>
        </div>
      </section>
    </>
  )
}

export function NotificationsPanel({ handlers: _handlers }: { handlers: Handlers }) {
  const list = useSettingList('notification', DEFAULT_NOTIFICATIONS)
  const channels = useSettingList('notification_channel', DEFAULT_NOTIFICATION_CHANNELS)

  return (
    <>
      <section className="card">
        <div className="card-title">通知</div>
        {list.map((item) => (
          <div className="setting-row" key={item.itemKey}>
            <div className="setting-info">
              <div className="setting-label">{item.label}</div>
              <div className="setting-desc">{item.description}</div>
            </div>
            <SettingSwitch item={item as SettingItem | (DefaultItem & { value?: undefined })} category="notification" />
          </div>
        ))}
      </section>
      <section className="card">
        <div className="card-title">提醒方式</div>
        {channels.map((item) => (
          <div className="setting-row" key={item.itemKey}>
            <div className="setting-info"><div className="setting-label">{item.label}</div></div>
            <SettingSwitch
              item={item as SettingItem | (DefaultItem & { value?: undefined })}
              category="notification_channel"
            />
          </div>
        ))}
      </section>
    </>
  )
}

export function DataPanel({ handlers }: { handlers: Handlers }) {
  const { data: info } = useAppInfo()

  return (
    <>
      <section className="card">
        <div className="card-title">数据</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">数据库</div>
            <div className="setting-desc">索引全在这一个文件里</div>
          </div>
          <div className="setting-value" title={info?.dbPath}>{info?.dbPath ?? '…'}</div>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">文档根</div>
            <div className="setting-desc">正文按宿主/项目两层分目录</div>
          </div>
          <div className="setting-value" title={info?.documentsRoot}>{info?.documentsRoot ?? '…'}</div>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">内容</div>
            <div className="setting-desc">库里的行数</div>
          </div>
          <div className="setting-value">
            {info ? `${info.projects} 项目 · ${info.tasks} 任务 · ${info.docs} 文档` : '…'}
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">云同步</div>
            <div className="setting-desc">同步到私有服务器（暂未实现）</div>
          </div>
          <Switch />
        </div>
      </section>
      <section className="card">
        <div className="card-title">导入导出</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">导出全部数据</div>
            <div className="setting-desc">JSON / Markdown / CSV</div>
          </div>
          <button className="btn btn-ghost" onClick={() => handlers.notice('导出数据（演示）')}>导出</button>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">从 Obsidian 导入</div>
            <div className="setting-desc">导入 Markdown 笔记</div>
          </div>
          <button className="btn btn-ghost" onClick={() => handlers.notice('导入（演示）')}>导入</button>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">从 Notion 导入</div>
            <div className="setting-desc">导入页面和数据库</div>
          </div>
          <button className="btn btn-ghost" onClick={() => handlers.notice('导入（演示）')}>导入</button>
        </div>
      </section>
      <section className="card danger-zone">
        <div className="card-title" style={{ color: 'var(--c-error)' }}>危险操作</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">清空所有数据</div>
            <div className="setting-desc">不可恢复，请先备份</div>
          </div>
          <button className="btn btn-danger" onClick={() => handlers.notice('请谨慎操作')}>清空</button>
        </div>
      </section>
    </>
  )
}

export function IntegrationsPanel({ handlers: _handlers }: { handlers: Handlers }) {
  const list = useSettingList('integration', DEFAULT_INTEGRATIONS)
  const icons: Record<string, string> = {
    github: '🐙',
    google_calendar: '📅',
    notion: '📝',
    wecom_feishu: '💬',
  }

  return (
    <>
      <section className="card">
        <div className="card-title">集成</div>
        {list.map((item) => (
          <div className="integration-item" key={item.itemKey}>
            <div className="integration-icon">{icons[item.itemKey] ?? '🔌'}</div>
            <div className="integration-info">
              <div className="integration-name">{item.label}</div>
              <div className="integration-meta">{item.description}</div>
            </div>
            <SettingSwitch
              item={item as SettingItem | (DefaultItem & { value?: undefined })}
              category="integration"
            />
          </div>
        ))}
      </section>
      <section className="card">
        <div className="card-title">API</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">API Token</div>
            <div className="setting-desc">用于外部调用</div>
          </div>
          <button className="btn btn-ghost">生成</button>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">Webhook</div>
            <div className="setting-desc">事件推送到指定 URL</div>
          </div>
          <button className="btn btn-ghost">配置</button>
        </div>
      </section>
    </>
  )
}

export function AiPanel({ handlers: _handlers }: { handlers: Handlers }) {
  return (
    <>
      <section className="card">
        <div className="card-title">AI 能力</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">启用 AI 助手</div>
            <div className="setting-desc">命令面板 Cmd + K、页面内嵌</div>
          </div>
          <Switch defaultOn />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">模型</div>
            <div className="setting-desc">通过下方「配置」选择默认模型</div>
          </div>
          <button className="btn btn-ghost">配置</button>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">API Key</div>
            <div className="setting-desc">不存明文，只存引用 —— 走 LlmConfigModal</div>
          </div>
          <button className="btn btn-ghost">配置</button>
        </div>
      </section>
      <section className="card">
        <div className="card-title">隐私</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">工作数据不进 AI</div>
            <div className="setting-desc">工作机密默认不进入上下文</div>
          </div>
          <Switch defaultOn />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">本次对话不记录</div>
            <div className="setting-desc">临时会话不写日志</div>
          </div>
          <Switch />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">AI 调用日志</div>
            <div className="setting-desc">记录调用，便于审计</div>
          </div>
          <Switch defaultOn />
        </div>
      </section>
    </>
  )
}

export function PrivacyPanel({ handlers: _handlers }: { handlers: Handlers }) {
  return (
    <>
      <section className="card">
        <div className="card-title">权限</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">生活数据</div>
            <div className="setting-desc">private / family</div>
          </div>
          <div className="setting-value">私有</div>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">工作数据</div>
            <div className="setting-desc">work-internal / confidential</div>
          </div>
          <div className="setting-value">工作内部</div>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">学习数据</div>
            <div className="setting-desc">private / public</div>
          </div>
          <div className="setting-value">私有</div>
        </div>
      </section>
      <section className="card">
        <div className="card-title">隐私</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">敏感信息脱敏</div>
            <div className="setting-desc">自动识别并脱敏</div>
          </div>
          <Switch defaultOn />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">审计日志</div>
            <div className="setting-desc">记录关键操作</div>
          </div>
          <Switch defaultOn />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">工作机密本地加密</div>
            <div className="setting-desc">本地文件加密存储</div>
          </div>
          <Switch defaultOn />
        </div>
      </section>
    </>
  )
}

function ShortcutRow({ item, category }: { item: DefaultItem; category: string }) {
  const combo = item.description ?? ''
  const keys = combo.split(' ').filter(Boolean)
  return (
    <div className="shortcut-row">
      <span>{item.label}</span>
      <span>
        {keys.map((k, i) => (
          <span key={i}>
            {i > 0 ? ' ' : ''}
            <span className="kbd">{k}</span>
          </span>
        ))}
      </span>
      <SettingSwitch item={item as SettingItem | (DefaultItem & { value?: undefined })} category={category} />
    </div>
  )
}

export function ShortcutsPanel({ handlers: _handlers }: { handlers: Handlers }) {
  const globalList = useSettingList('shortcut', DEFAULT_SHORTCUTS_GLOBAL)
  const moduleList = useSettingList('shortcut_module', DEFAULT_SHORTCUTS_MODULE)

  return (
    <>
      <section className="card">
        <div className="card-title">全局快捷键</div>
        {globalList.map((item) => (
          <ShortcutRow key={item.itemKey} item={item as DefaultItem} category="shortcut" />
        ))}
      </section>
      <section className="card">
        <div className="card-title">模块快捷键</div>
        {moduleList.map((item) => (
          <ShortcutRow key={item.itemKey} item={item as DefaultItem} category="shortcut_module" />
        ))}
      </section>
    </>
  )
}

export function AboutPanel({ handlers: _handlers }: { handlers: Handlers }) {
  const { data: info } = useAppInfo()

  return (
    <>
      <section className="card">
        <div className="card-title">关于</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">个人系统</div>
            <div className="setting-desc">生活 / 工作 / 学习 / 项目 / 知识库 / 设置</div>
          </div>
          <div className="setting-value">v1.0.0</div>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">技术栈</div>
            <div className="setting-desc">Tauri v2 + React 19 + TypeScript</div>
          </div>
          <div className="setting-value">-</div>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">本机用户</div>
            <div className="setting-desc">app_user 表行数</div>
          </div>
          <div className="setting-value">{info ? `${info.users} 人` : '…'}</div>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">最近更新</div>
            <div className="setting-desc">2026-09-20</div>
          </div>
          <div className="setting-value">-</div>
        </div>
      </section>
      <section className="card">
        <div className="card-title">更新日志</div>
        <div className="notice">
          v1.0.0 · 2026-09-20<br />
          初始版本，包含 9 模块、弥散风格、亮暗双模式。
        </div>
      </section>
    </>
  )
}

/**
 * 顶栏动作区 —— 设置页一个都没有（主题开关归外壳）。
 */
export function TopbarActions({ handlers: _handlers }: { handlers: Handlers }) {
  return null
}
