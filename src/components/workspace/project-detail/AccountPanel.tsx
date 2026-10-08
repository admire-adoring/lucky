import { useEffect, useReducer, useRef, useState } from 'react'
import {
  ACCOUNT_ENV_LABEL,
  ACCOUNT_TYPES,
  accountBadge,
  accountOverdue,
  accountPlatforms,
  accountRotatePlan,
  dueText,
  relativeDate,
  relativeDateShort,
  type AccountItem,
} from '../../../data/derive'
import { cn } from '../../../lib/cn'
import type { Toast } from '../../../types'
import { OpsIcon } from './ops-icon'
import { PanelCard, PanelModal } from './panel-shell'

/* ============================================================================
 * 项目详情 · 账户分区（原型 `工作-项目-项目详情-账户-index.html`，2026-09-27）
 *
 * 这一区回答的问题：这个项目要用的那些账号，在哪儿、还能不能用。
 * 与「运维」的分工是一句话 —— 运维管机器（连上去、传文件、看日志、发版），
 * 账户管身份（登录用的账号 / 密码 / 密钥）。服务器那台机器自己的 ssh 凭据属于
 * 那台机器的记录，不在这里第二遍登记。
 *
 * ----------------------------------------------------------------------------
 * 一条列表里颜色只能承载一种语义
 * ----------------------------------------------------------------------------
 * 这张清单的颜色只表示有效期紧急度（逾期 / 7 天内 / 30 天内 / 正常）；
 * 「这是生产环境」由 `.env-tag` 用文字说、凭据类型由行首那枚字形说（锁 / 钥匙）。
 * 形状留给身份，颜色留给状态。判据落在 `derive.ts` 的 `accountBadge()` 一处。
 *
 * 行分两层：第一行只放会变的状态（账号名 + 有效期胶囊），第二行放不变的身份
 * （环境 · 备注）。「上次轮换」不进第二行 —— 它和那颗胶囊说的是同一件事，
 * 展开面板里有确切日期。
 *
 * ----------------------------------------------------------------------------
 * 与原型有意不同的地方（"静态页 → 应用"必然要改的，不是审美）
 * ----------------------------------------------------------------------------
 * ① `.ops-page` 与 `.ac-page` 两个类都挂在页面根上。`.ops-page` 是
 *    项目详情分区页的公共根（先落地的运维页起的名字，两个分区页共用同一批
 *    卡片 / KPI 条 / 骨架屏 / 空态 / 徽标规则，原型里 57 条逐字一致 ⇒ 不抄第二份）；
 *    本页自己的规则一律挂 `.ac-page`（见 `styles/module-workspace.css` 账户段头）。
 * ② "最后检查 / 重新检查"这一行搬进分区内部。原型把它放在页头（`.hero-sync`），
 *    而这一页的页头是可折叠 Hero（另一个原型定的、两处共用）——
 *    往别人的头里塞一行状态，两处的头会越来越像两套。与运维分区同一条改法。
 * ③ 增 / 改 / 删 / 轮换是就地改池子（`POOL[scope].accounts`，见 `buildAccounts`）：
 *    应用里账户来自内容池，没有接口。与运维页的「文件位置清单」同一条纪律 ——
 *    真删（可撤销）、真停用（可恢复）、真轮换（改 `secret` 与到期日），
 *    不是"点一下只给回执"。刷新回到初值，这是演示池的既成口径。
 * ④ `hidden` 属性一个都没用 ⇒ 一律条件渲染（原型用 `hidden` 藏十来处）。
 * ⑤ 过滤方式是"渲染时筛"而不是"改已渲染 DOM 的 `hidden`"。原型那样做是为了
 *    不重建清单（保住展开态 / 焦点 / 滚动位置）；React 里 key 稳定 ⇒ 筛完不重建，
 *    同一个目的用更短的写法达到。
 * ⑥ 平台分组按数据现算（`accountPlatforms`），不是一张写死的表 —— 平台是自己
 *    输入的自由文本（原型 2026-09-27 用户定的）。连带：比"同名账号"要 `trim + 小写`。
 * ⑦ Escape 的优先级：抽屉 → 确认弹窗 → 生成器（原型只处理了前两个）。
 * ============================================================================ */

/** 凭据类型 → 行首那枚字形。锁 = 能回显（密码），钥匙 = 不回显（密钥） */
const TYPE_ICON: Record<AccountItem['type'], 'lock' | 'key'> = { password: 'lock', key: 'key' }

/* ------------------------------------------------------------------ *
 * 凭据生成器（原型 `GEN_TYPES` / `GEN_CHARS` / `GEN_WORDS`）
 * ------------------------------------------------------------------ */

/** 字符集里剔掉了 `l / 1 / O / 0` 这类看着像的 —— 抄错一位和生成弱密码一样糟 */
const GEN_CHARS = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower: 'abcdefghijkmnpqrstuvwxyz',
  digits: '23456789',
  symbols: '!@#$%^&*()-_=+',
}

const GEN_WORDS =
  ('amber anchor basket beacon bottle branch bridge bucket cactus camera candle canyon carrot castle ' +
    'cinder circus cobalt copper cotton crater cricket crystal dagger desert dolphin donkey dragon ember falcon ' +
    'feather forest fossil garden garnet ginger glacier granite guitar hammer harbor harvest helmet honey indigo ' +
    'ivory jasmine jungle kettle lantern lemon lilac lobster magnet mango marble meadow melon meteor mirror monkey ' +
    'mountain napkin needle nickel noodle olive orchid otter oyster paddle palace panda pebble pelican pepper pigeon ' +
    'pillar planet pocket pollen poppy prairie pretzel pumpkin quartz rabbit radish ranger ribbon rocket rubber saddle ' +
    'salmon satin scarlet sequoia shadow shovel signal silver socket spider spiral sparrow stencil sunset syrup tangle ' +
    'teapot tundra tunnel turtle velvet vessel violin wallet walnut willow winter wizard yellow zephyr zigzag').split(' ')

type GenKind = 'random' | 'words' | 'pin'

/**
 * 三段的选项、长度区间、默认值都在这一张表里 —— 标记里不写第二遍。
 * 结构不随凭据类型变（段的标题、位置、顺序都固定），能变的只有"哪些能选"。
 *    踩过：密钥类原来把"选择类型 + 自定义"两整块藏掉，于是从轮换计划点进去看到的框
 *    和从凭据行点进去的完全不一样，读起来像两个弹窗。
 */
const GEN_TYPES: Record<GenKind, { min: number; max: number; len: number; unit: string; switches: { key: string; label: string; on: boolean }[] }> = {
  random: {
    min: 8,
    max: 32,
    len: 17,
    unit: '字符',
    switches: [
      { key: 'digits', label: '数字', on: true },
      { key: 'symbols', label: '符号', on: true },
    ],
  },
  words: {
    min: 3,
    max: 8,
    len: 4,
    unit: '单词',
    switches: [
      { key: 'caps', label: '首字母大写', on: false },
      { key: 'full', label: '使用完整单词', on: true },
    ],
  },
  pin: { min: 4, max: 10, len: 6, unit: '位', switches: [] },
}

/** 平台签发的密钥长度由随机部分的位数决定，与密码的取值范围不同 */
const GEN_KEY_LEN = { min: 12, max: 32, len: 20 }

function randInt(max: number): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1)
    crypto.getRandomValues(buf)
    return buf[0] % max
  }
  return Math.floor(Math.random() * max)
}

const pickFrom = (pool: string) => pool[randInt(pool.length)]

function genAlnum(len: number, digits: boolean): string {
  const pool = GEN_CHARS.upper + GEN_CHARS.lower + (digits ? GEN_CHARS.digits : '')
  let out = ''
  for (let i = 0; i < len; i++) out += pickFrom(pool)
  return out
}

function genRandom(len: number, sw: Record<string, boolean>): string {
  const pools = [GEN_CHARS.upper, GEN_CHARS.lower]
  if (sw.digits) pools.push(GEN_CHARS.digits)
  if (sw.symbols) pools.push(GEN_CHARS.symbols)
  const all = pools.join('')
  const chars: string[] = []
  for (let i = 0; i < len; i++) chars.push(pickFrom(all))
  /* 勾了就至少给一位 —— 否则"含数字"可能一位数字都没有，那是骗人。
     补位不能用"换掉某一位"：两类同时缺位时后补的会把先补的换掉，所以先占位、再整体打乱。 */
  const need: string[] = []
  if (sw.digits) need.push(GEN_CHARS.digits)
  if (sw.symbols) need.push(GEN_CHARS.symbols)
  need.forEach((pool, k) => {
    if (!pool.split('').some((ch) => chars.indexOf(ch) >= 0)) chars[k] = pickFrom(pool)
  })
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    const t = chars[i]
    chars[i] = chars[j]
    chars[j] = t
  }
  return chars.join('')
}

function genWords(n: number, sw: Record<string, boolean>): string {
  const out: string[] = []
  while (out.length < n) {
    let w = GEN_WORDS[randInt(GEN_WORDS.length)]
    if (!sw.full) w = w.slice(0, Math.max(3, Math.round(w.length / 2)))
    if (sw.caps) w = w[0].toUpperCase() + w.slice(1)
    out.push(w)
  }
  return out.join('-')
}

const genPin = (n: number) => {
  let out = ''
  for (let i = 0; i < n; i++) out += pickFrom(GEN_CHARS.digits + '01')
  return out
}

/** 这一档的长度区间（密钥类只有随机那一段可用，长度按"随机部分"给） */
const genRange = (type: AccountItem['type'], kind: GenKind) =>
  type === 'password' ? { min: GEN_TYPES[kind].min, max: GEN_TYPES[kind].max } : GEN_KEY_LEN

function buildValue(type: AccountItem['type'], kind: GenKind, len: number, sw: Record<string, boolean>): string {
  /* 密钥不拼前缀：平台名是用户自己写的，系统不认识它 ⇒ 猜不出那边签发的形状。
     早先那张 `keyPrefix` 表（阿里云 LTAI5t… / GitLab glpat-…）是拿固定平台表当底座才成立的。 */
  if (type === 'key') return genAlnum(len, sw.digits)
  if (kind === 'pin') return genPin(len)
  if (kind === 'words') return genWords(len, sw)
  return genRandom(len, sw)
}

/** 熵只算给"人记的密码" —— 密钥的长度本来就由平台定，算出来也没人用 */
function genHint(type: AccountItem['type'], kind: GenKind, len: number, sw: Record<string, boolean>): string {
  if (type !== 'password') {
    return `${len} 位随机（${sw.digits ? '字母 + 数字' : '纯字母'}）—— ${ACCOUNT_TYPES[type].name}只在生成时出现一次，现在复制走，之后只能重置。`
  }
  if (kind === 'pin') return `${len} 位纯数字 · 约 ${Math.round(len * Math.log2(10))} bit —— 小程序、门禁这类只收数字的地方用它。`
  if (kind === 'words') return `${len} 个词 · 约 ${Math.round(len * Math.log2(GEN_WORDS.length))} bit —— 念得出来、抄得下来。`
  const pool =
    GEN_CHARS.upper.length + GEN_CHARS.lower.length + (sw.digits ? GEN_CHARS.digits.length : 0) + (sw.symbols ? GEN_CHARS.symbols.length : 0)
  return `${len} 字符 · ${sw.digits ? '含' : '不含'}数字 · ${sw.symbols ? '含' : '不含'}符号 · 约 ${Math.round(len * Math.log2(pool))} bit`
}

/** 复制。`file://` 下 `navigator.clipboard` 常常不可用 ⇒ 留一条 `execCommand` 兜底（与部署页同一条） */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 落到下面的兜底 */
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ *
 * 类型
 * ------------------------------------------------------------------ */

interface ConfirmSpec {
  title: string
  desc?: string
  /** 「影响：」那一块（原型 `.modal-warn`） */
  warn?: string
  confirmText: string
  danger?: boolean
  onConfirm: () => void
}

interface GenState {
  id: string
  kind: GenKind
  /** 真正参与生成的长度（已夹到区间内） */
  len: number
  /**
   * 数字框里显示的那串字符。
   * 与 `len` 分开是必须的：原型那条判据是"数字框那头先不夹"（输入 1 就被顶到 8 很难受），
   *    只在取值时夹。两者合一的话，用户刚敲下第一个字符，框里的数就被改掉了。
   */
  lenText: string
  sw: Record<string, boolean>
  value: string
}

/** 抽屉里的表单。`editing` 为 null = 添加 */
interface FormValues {
  user: string
  platform: string
  type: AccountItem['type']
  env: AccountItem['env']
  cycle: number
  note: string
  secret: string
}

/* ------------------------------------------------------------------ *
 * 一行凭据（含展开面板）
 * ------------------------------------------------------------------ */

function CredRow({
  acc,
  open,
  revealed,
  onToggle,
  onReveal,
  onCopy,
  onEdit,
  onToggleDisable,
  onDelete,
  onRotate,
}: {
  acc: AccountItem
  open: boolean
  revealed: boolean
  onToggle: () => void
  onReveal: () => void
  onCopy: (what: 'user' | 'secret') => void
  onEdit: () => void
  onToggleDisable: () => void
  onDelete: () => void
  onRotate: () => void
}) {
  const type = ACCOUNT_TYPES[acc.type]
  const off = !!acc.disabled
  /* 停用态先于"逾期"：一条已经停用的凭据不该再拿橙带催你轮换它 —— 那是两件事 */
  const badge = accountBadge(acc.dueDays, off)
  /* 行尾那个常驻动作 = 这条凭据最高频的一件事：把能拿走的东西拿走。
     停用之后它就不是"有效凭据"了 ⇒ 一起禁用，别留一个假入口。 */
  const lead = type.plain ? { icon: 'copy' as const, label: '复制密码', what: 'secret' as const } : { icon: 'copy' as const, label: '复制账号', what: 'user' as const }

  return (
    <div className={cn('ac-item', open && 'open')} id={`item-${acc.id}`}>
      {/* 整行可点（鼠标），但不声明 `role="button"`：行里嵌着 4 个真按钮，
          在 role=button 里套 button 是无效 ARIA。键盘入口交给行尾那枚展开按钮。 */}
      <div className={cn('ac-row', off && 'is-off', !off && acc.dueDays < 0 && 'alert', open && 'active')} onClick={onToggle}>
        <span className="ac-type" title={type.name} aria-hidden="true">
          <OpsIcon name={TYPE_ICON[acc.type]} size={15} />
        </span>
        <div className="ac-info">
          <div className="ac-name">
            {acc.user}
            <span className={cn('badge', badge.kind)}>{badge.text}</span>
          </div>
          {/* 第二行只放不变的身份：环境 + 备注。备注为空时不出现（不留空占位）；
              这里的文本会被截断，完整那句在 title 与展开面板里。 */}
          <div className="ac-meta">
            <span className="env-tag">{ACCOUNT_ENV_LABEL[acc.env]}</span>
            {acc.note ? (
              <span className="ac-note" title={acc.note}>
                {acc.note}
              </span>
            ) : null}
          </div>
        </div>
        <span className="ac-acts">
          <button
            type="button"
            className="ac-act ac-lead"
            title={lead.label}
            aria-label={lead.label}
            disabled={off}
            onClick={(event) => {
              event.stopPropagation()
              onCopy(lead.what)
            }}
          >
            <OpsIcon name={lead.icon} size={15} />
          </button>
          <button
            type="button"
            className="ac-act"
            title="编辑"
            aria-label="编辑"
            onClick={(event) => {
              event.stopPropagation()
              onEdit()
            }}
          >
            <OpsIcon name="edit" size={15} />
          </button>
          <button
            type="button"
            className="ac-act"
            title={off ? '恢复使用' : '停用'}
            aria-label={off ? '恢复使用' : '停用'}
            onClick={(event) => {
              event.stopPropagation()
              onToggleDisable()
            }}
          >
            <OpsIcon name={off ? 'undo' : 'ban'} size={15} />
          </button>
          <button
            type="button"
            className="ac-act danger"
            title="删除"
            aria-label="删除"
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
          >
            <OpsIcon name="trash" size={15} />
          </button>
          <button
            type="button"
            className="ac-expand"
            aria-expanded={open}
            aria-controls={`detail-${acc.id}`}
            aria-label={open ? '收起这条凭据' : '展开这条凭据'}
            onClick={(event) => {
              event.stopPropagation()
              onToggle()
            }}
          >
            <OpsIcon name="chevD" size={15} />
          </button>
        </span>
      </div>

      {/* 展开面板靠 `grid-template-rows: 0fr/1fr` 自己塌陷 ⇒ 一直渲染、显隐交给 CSS */}
      <div className="ac-detail" id={`detail-${acc.id}`}>
        <div className="ac-detail-inner">
          <div className="ac-detail-pad">
            {type.plain ? (
              <div className="ac-secret">
                <span className="ac-secret-label">{type.name}</span>
                <code className={cn('ac-secret-val', revealed && 'is-plain')}>{revealed ? acc.secret : '••••••••••••'}</code>
                <button type="button" className="btn btn-ghost btn-sm" disabled={off} onClick={onReveal}>
                  {revealed ? '隐藏' : '显示'}
                </button>
                <span className="ac-secret-tip">显示 30 秒后自动隐藏</span>
              </div>
            ) : (
              <div className="ac-secret">
                <span className="ac-secret-label">{type.name}</span>
                <span className="ac-secret-val">不回显</span>
                <span className="ac-secret-tip">{type.name}只在生成时出现一次，丢失请重置</span>
              </div>
            )}

            <div className="ac-detail-grid">
              <div className="ac-detail-item">
                <span className="label">凭据类型</span>
                <span className="value">{type.name}</span>
              </div>
              <div className="ac-detail-item">
                <span className="label">轮换周期</span>
                <span className="value">{acc.cycle} 天</span>
              </div>
              <div className="ac-detail-item">
                <span className="label">上次轮换</span>
                <span className="value">
                  {relativeDate(-acc.rotatedDays)} · {acc.rotatedBy}
                </span>
              </div>
              <div className="ac-detail-item">
                <span className="label">下次到期</span>
                <span className="value">{relativeDate(acc.dueDays)}</span>
              </div>
              <div className="ac-detail-item wide">
                <span className="label">备注</span>
                <span className="value small">{acc.note || '—'}</span>
              </div>
            </div>

            {/* 面板里只留"用这条凭据"的动作；编辑 / 停用 / 删除都在行尾，不在这儿开第二个入口 */}
            <div className="ac-detail-actions">
              <button type="button" className="btn btn-ghost btn-sm" disabled={off} onClick={() => onCopy('user')}>
                <OpsIcon name="copy" size={13} /> 复制账号
              </button>
              {type.plain ? (
                <button type="button" className="btn btn-ghost btn-sm" disabled={off} onClick={() => onCopy('secret')}>
                  <OpsIcon name="key" size={13} /> 复制密码
                </button>
              ) : null}
              <button type="button" className="btn btn-ghost btn-sm" disabled={off} onClick={onRotate}>
                <OpsIcon name="refresh" size={13} /> 轮换
              </button>
              <span className="spacer" />
              <span className="ac-detail-note">{off ? '已停用 · 在行尾点 ↺ 恢复' : '编辑 / 停用 / 删除在行尾'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 添加 / 编辑（右侧抽屉）
 *
 * 一张表单两种用法：差别只有两处 —— ① 编辑时密钥留空 = 不更换（添加时必须填）；
 * ② 标题与副标题。「上次轮换」整格不给（新增 = 今天、编辑 = 保持原值），
 * 「下次到期」机器算得出来 ⇒ 只回显。
 * ------------------------------------------------------------------ */

function CredDrawer({
  editing,
  accounts,
  onClose,
  onSave,
}: {
  /** null = 添加 */
  editing: AccountItem | null
  accounts: AccountItem[]
  onClose: () => void
  onSave: (values: FormValues, editing: AccountItem | null) => void
}) {
  const [user, setUser] = useState(editing?.user ?? '')
  const [platform, setPlatform] = useState(editing?.platform ?? '')
  const [type, setType] = useState<AccountItem['type']>(editing?.type ?? 'password')
  const [env, setEnv] = useState<AccountItem['env']>(editing?.env ?? 'prod')
  const [cycle, setCycle] = useState(editing?.cycle ?? 90)
  const [note, setNote] = useState(editing?.note ?? '')
  const [secret, setSecret] = useState('')
  /** 上一档的环境 —— 换环境时"当前周期还是上一档默认值吗"要靠它判 */
  const lastEnv = useRef<AccountItem['env']>(editing?.env ?? 'prod')
  const userRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    userRef.current?.focus()
  }, [])

  const platforms = accountPlatforms(accounts)
  /* 重名是跨条目检查（平台 + 账号），而且平台是自由文本 ⇒ 两边都要 trim + 小写，
     否则 `GitLab` 与 `gitlab` 会分成两个组，同名就能各存一条。 */
  const taken =
    !!user.trim() &&
    !!platform.trim() &&
    accounts.some(
      (c) =>
        c !== editing &&
        c.platform.trim().toLowerCase() === platform.trim().toLowerCase() &&
        c.user.trim().toLowerCase() === user.trim().toLowerCase(),
    )

  /* 换环境就把周期带到那一档的默认值 —— 但只在当前值还是上一档的默认值时才带
     （否则会把手填过的 180 悄悄改回 90）。 */
  const pickEnv = (next: AccountItem['env']) => {
    const def = next === 'prod' ? 90 : 180
    const prev = lastEnv.current === 'prod' ? 90 : 180
    if (!cycle || cycle === prev) setCycle(def)
    lastEnv.current = next
    setEnv(next)
  }

  const rotDays = editing ? editing.rotatedDays : 0
  const dueDays = cycle - rotDays
  const canSave = !!user.trim() && !!platform.trim() && !taken && cycle > 0 && (!!editing || !!secret.trim())

  return (
    <div className="ac-drawer">
      <div className="ac-drawer-mask" onClick={onClose} />
      <aside className="ac-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="cfTitle">
        <header className="ac-drawer-head">
          <div>
            <div className="ac-drawer-title" id="cfTitle">
              {editing ? '编辑账户' : '添加账户'}
            </div>
            <div className="ac-drawer-sub">
              {editing ? '改完立即生效。密码 / 密钥那一格留空表示不更换。' : '平台自己填（填过的会自动出现在候选里），类型 / 环境从已有的里选。'}
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            <OpsIcon name="x" size={15} />
          </button>
        </header>

        <div className="ac-drawer-body">
          <div className="field">
            <label className="field-label" htmlFor="cfUser">
              账号
            </label>
            <input
              ref={userRef}
              id="cfUser"
              className={cn('inp mono', taken && 'bad')}
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="ops@lucky.com"
              value={user}
              onChange={(event) => setUser(event.target.value)}
            />
            <div className={cn('field-hint', taken && 'bad')}>
              {taken ? `「${platform.trim()}」下已经有这个账号了` : '同一个平台下不能有两条同名账号'}
            </div>
          </div>

          <div className="field two">
            <div className="field">
              <label className="field-label" htmlFor="cfPlatform">
                平台
              </label>
              {/* 候选只来自"已经在用的那些" —— 给建议、不给约束：既不用背拼写，也不拦着填新的 */}
              <input
                id="cfPlatform"
                className="inp"
                type="text"
                autoComplete="off"
                spellCheck={false}
                list="cfPlatformList"
                placeholder="阿里云 / GitLab / 自建后台"
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
              />
              <datalist id="cfPlatformList">
                {platforms.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <span className="field-label" id="cfTypeLabel">
                凭据类型
              </span>
              <div className="chip-row" role="radiogroup" aria-labelledby="cfTypeLabel">
                {(['password', 'key'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={cn('chip', type === value && 'on')}
                    role="radio"
                    aria-checked={type === value}
                    onClick={() => setType(value)}
                  >
                    {ACCOUNT_TYPES[value].name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="field two">
            <div className="field">
              <span className="field-label" id="cfEnvLabel">
                环境
              </span>
              <div className="chip-row" role="radiogroup" aria-labelledby="cfEnvLabel">
                {(['prod', 'test', 'dev'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={cn('chip', env === value && 'on')}
                    role="radio"
                    aria-checked={env === value}
                    onClick={() => pickEnv(value)}
                  >
                    {ACCOUNT_ENV_LABEL[value]}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="cfCycle">
                轮换周期（天）
              </label>
              <input
                id="cfCycle"
                className="inp"
                type="number"
                min={1}
                step={1}
                value={cycle}
                onChange={(event) => setCycle(Number(event.target.value) || 0)}
              />
            </div>
          </div>

          {/* 到期日 = 上次轮换 + 周期，两个值都不用手填 ⇒ 只回显。
              开头的字把"这是它算出来的"说清楚，也让改周期的人立刻看见到期日被推到哪天。 */}
          <div className="field-hint">
            {cycle > 0
              ? `${rotDays > 0 ? `上次轮换 ${relativeDate(-rotDays)}` : '上次轮换记为今天'} · 下次到期 ${relativeDate(dueDays)}（${dueText(dueDays)}）`
              : '下次到期 = 上次轮换 + 轮换周期'}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="cfNote">
              备注
            </label>
            <input
              id="cfNote"
              className="inp"
              type="text"
              placeholder="换绑手机 / 只在发版流水线里用 / 到期前先通知谁"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="cfSecret">
              密码 / 密钥
            </label>
            <input
              id="cfSecret"
              className="inp mono"
              type="password"
              autoComplete="new-password"
              placeholder={editing ? '留空 = 不更换' : type === 'password' ? '登录密码' : '平台签发的密钥'}
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
            />
            {/* 这句跟着类型走 —— 不能是写死的一句：密码保存后是要回显的 */}
            <div className="field-hint">
              {type === 'password' ? '保存后可以回显 —— 展开这条就能看到明文，也能复制。' : '保存后不回显 —— 密钥只在生成那一次出现，之后只能重置。'}
            </div>
          </div>
        </div>

        <footer className="ac-drawer-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <span className="spacer" />
          <button type="button" className="btn btn-primary" disabled={!canSave} onClick={() => onSave({ user: user.trim(), platform: platform.trim(), type, env, cycle, note: note.trim(), secret: secret.trim() }, editing)}>
            保存
          </button>
        </footer>
      </aside>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 主组件
 * ------------------------------------------------------------------ */

export function AccountPanel({
  accounts,
  notice,
  onChanged,
}: {
  /** 池子里那一份（就地改，见 `buildAccounts`） */
  accounts: AccountItem[]
  notice: (text: string, action?: Toast['action']) => void
  /** 条数 / 到期风险变了 ⇒ 让上面的 Tab 计数重算 */
  onChanged: () => void
}) {
  /* 就地改池子之后要重算这一页 ⇒ 一个自增的重渲开关（与运维页同一条） */
  const [, forceRender] = useReducer((n: number) => n + 1, 0)

  const [collapsed, setCollapsed] = useState({ cred: false, rotate: false })
  const [openIds, setOpenIds] = useState<string[]>([])
  const [platform, setPlatform] = useState('all')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<{ editing: AccountItem | null } | null>(null)
  const [gen, setGen] = useState<GenState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [lastCheck, setLastCheck] = useState('最后检查：刚刚')
  const revealTimers = useRef<Record<string, number>>({})

  /* 抽屉开着时锁住主区滚动（原型 `.main.ac-lock`）。主区不在这一页的 DOM 里
     （它是外壳的 `.main`）⇒ 只能挂到那个元素上，与 `WorkspaceLayout` 的
     "切分区滚回顶部"同一处口径。 */
  useEffect(() => {
    if (!form) return
    const main = document.querySelector('.mw-root .main')
    main?.classList.add('ac-lock')
    return () => main?.classList.remove('ac-lock')
  }, [form])

  useEffect(() => () => Object.values(revealTimers.current).forEach((t) => window.clearTimeout(t)), [])

  /**
   * Escape 的优先级：抽屉 → 确认弹窗 → 生成器。
   * 三者不会同时开着，但抽屉里填了一半的东西最贵重，所以它排第一。
   * 原型只处理了"抽屉 → 生成器"，确认弹窗那条是本仓补的（别处弹窗都吃 Escape）。
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (form) {
        setForm(null)
        return
      }
      if (confirm) {
        setConfirm(null)
        return
      }
      if (gen) setGen(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [form, confirm, gen])

  /* ---------------- 派生 ---------------- */

  const platforms = accountPlatforms(accounts)
  /* 选中的平台没了（最后一条被删、或改了平台）⇒ 退回「全部」，
     否则会停在一个筛不出任何东西的状态上。 */
  const activePlatform = platform === 'all' || platforms.includes(platform) ? platform : 'all'
  const q = query.trim().toLowerCase()
  const credMatch = (acc: AccountItem) => {
    if (activePlatform !== 'all' && acc.platform !== activePlatform) return false
    if (!q) return true
    return `${acc.user} ${acc.note ?? ''} ${acc.platform}`.toLowerCase().includes(q)
  }
  const shown = accounts.filter(credMatch)
  const filtering = activePlatform !== 'all' || !!q
  const credBadge = `${filtering ? `筛出 ${shown.length} / ${accounts.length} 条` : `${accounts.length} 条`} · ${platforms.length} 个平台`

  const risk = accounts.filter((c) => !c.disabled && c.dueDays <= 7)
  const overdue = accountOverdue(accounts)
  const worst = overdue[0] ?? risk[0]
  /* 必须挡住"一条都没有"：这里是全页唯一没护栏的取值，把凭据删光会让 `recent`
     变 undefined ⇒ 抛错 ⇒ 后面所有派生停在旧值（页面还不显示哪里错了）。 */
  const recent = accounts.slice().sort((a, b) => a.rotatedDays - b.rotatedDays)[0]
  const plain = accounts.filter((c) => ACCOUNT_TYPES[c.type].plain).length
  const plan = accountRotatePlan(accounts)

  /* ---------------- 动作 ---------------- */

  const toggleCard = (key: 'cred' | 'rotate') => {
    const next = { ...collapsed, [key]: !collapsed[key] }
    setCollapsed(next)
    /* 折叠时把展开态收掉（原型 `closeDetails`）：再展开时不会停在一个"半开"的旧状态。
       这一步放在更新函数外面：`setState(prev => …)` 的更新函数在 StrictMode 下会跑两遍，
          把另一次 setState 塞进去就成了"副作用执行两次"（本仓踩过一次）。 */
    if (next[key]) setOpenIds([])
  }

  const toggleOpen = (id: string) => setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const toggleReveal = (acc: AccountItem) => {
    const isShown = !!revealed[acc.id]
    window.clearTimeout(revealTimers.current[acc.id])
    if (isShown) {
      setRevealed((prev) => ({ ...prev, [acc.id]: false }))
      return
    }
    setRevealed((prev) => ({ ...prev, [acc.id]: true }))
    notice('明文 30 秒后自动隐藏')
    revealTimers.current[acc.id] = window.setTimeout(() => setRevealed((prev) => ({ ...prev, [acc.id]: false })), 30000)
  }

  const copyCred = (acc: AccountItem, what: 'user' | 'secret') => {
    const type = ACCOUNT_TYPES[acc.type]
    if (what === 'secret' && !type.plain) {
      notice(`${type.name}不回显，请用「轮换」重新生成一个`)
      return
    }
    const text = what === 'secret' ? acc.secret : acc.user
    void copyText(text).then((ok) => notice(ok ? `已复制 ${what === 'secret' ? type.name : '账号'} · ${acc.user}` : '复制失败，请手动选中'))
  }

  /** 停用与删除是两件事：停用留在清单里、随时可恢复；删除从清单里移走（给撤销） */
  const toggleDisable = (acc: AccountItem) => {
    if (acc.disabled) {
      acc.disabled = false
      forceRender()
      onChanged()
      notice(`已恢复使用 ${acc.user}`)
      return
    }
    setConfirm({
      title: `停用 ${acc.user}？`,
      desc: '停用后这条凭据立刻失效，正在用它跑的任务会跟着失败。',
      warn: '凭据会留在清单里并标成「已停用」，也不再计入轮换计划；随时可以恢复使用。',
      confirmText: '停用',
      onConfirm: () => {
        acc.disabled = true
        forceRender()
        onChanged()
        notice(`已停用 ${acc.user}`)
      },
    })
  }

  const askDelete = (acc: AccountItem) =>
    setConfirm({
      title: `删除 ${acc.user}？`,
      desc: `这一条会从清单里移走，「${acc.platform}」组里少一条。`,
      warn: '密钥明文不会回显、也找不回来；正在用它跑的任务会在下次运行时失败。这一步可以撤销。',
      confirmText: '删除',
      danger: true,
      onConfirm: () => {
        const at = accounts.indexOf(acc)
        /* 守卫 `at >= 0`：`splice(-1, 1)` 会删掉最后一条，而它恰恰是"没找到"的返回值 */
        if (at < 0) return
        accounts.splice(at, 1)
        setOpenIds((prev) => prev.filter((x) => x !== acc.id))
        forceRender()
        onChanged()
        notice(`已删除 ${acc.user}`, {
          label: '撤销',
          onClick: () => {
            accounts.splice(at, 0, acc)
            forceRender()
            onChanged()
            notice(`已恢复 ${acc.user}`)
          },
        })
      },
    })

  /* ---------------- 生成器 ---------------- */

  const openGen = (acc: AccountItem) => {
    const isPwd = acc.type === 'password'
    const sw: Record<string, boolean> = isPwd ? { digits: true, symbols: true, caps: false, full: true } : { digits: true, symbols: false }
    const len = isPwd ? GEN_TYPES.random.len : GEN_KEY_LEN.len
    setGen({ id: acc.id, kind: 'random', len, lenText: String(len), sw, value: buildValue(acc.type, 'random', len, sw) })
  }

  const genAccount = gen ? accounts.find((c) => c.id === gen.id) : undefined

  const pickKind = (kind: GenKind) => {
    if (!gen || !genAccount) return
    const len = genAccount.type === 'password' ? GEN_TYPES[kind].len : GEN_KEY_LEN.len
    setGen({ ...gen, kind, len, lenText: String(len), value: buildValue(genAccount.type, kind, len, gen.sw) })
  }

  /** `text` 是框里显示的原文（滑块与数字框共用这一个入口），`len` 才是夹过的那一个 */
  const pickLen = (raw: number, text: string) => {
    if (!gen || !genAccount) return
    const range = genRange(genAccount.type, gen.kind)
    const len = Math.max(range.min, Math.min(range.max, raw || range.min))
    setGen({ ...gen, len, lenText: text, value: buildValue(genAccount.type, gen.kind, len, gen.sw) })
  }

  const toggleSw = (key: string, off: boolean) => {
    if (!gen || !genAccount || off) return
    const sw = { ...gen.sw, [key]: !gen.sw[key] }
    setGen({ ...gen, sw, value: buildValue(genAccount.type, gen.kind, gen.len, sw) })
  }

  const applyGen = () => {
    if (!gen || !genAccount) return
    genAccount.secret = gen.value
    genAccount.rotatedDays = 0
    genAccount.rotatedBy = '我'
    genAccount.dueDays = genAccount.cycle
    setGen(null)
    forceRender()
    onChanged()
    notice(`已轮换 ${genAccount.user} · 下次 ${relativeDate(genAccount.dueDays)} 到期`)
  }

  /* ---------------- 保存（添加 / 编辑） ---------------- */

  const saveForm = (values: FormValues, editing: AccountItem | null) => {
    /* 「上次轮换」不在这张表里：新增 = 今天（此刻），编辑 = 保持原值。
       要"我刚换过"就去走轮换流程 —— 那是它自己的动作，不是表单里改一个日期。 */
    const rotDays = editing ? editing.rotatedDays : 0
    const dueDays = values.cycle - rotDays
    const target = editing
    if (target) {
      Object.assign(target, {
        platform: values.platform,
        type: values.type,
        env: values.env,
        user: values.user,
        note: values.note || undefined,
        cycle: values.cycle,
        dueDays,
      })
      if (values.secret) target.secret = values.secret
      notice(`已保存 ${values.user} · 下次 ${relativeDate(dueDays)} 到期`)
    } else {
      /* id 只做内部键（`item-` / `detail-` 都用它）⇒ 不复用中文平台名 */
      accounts.push({
        id: `acc-${Date.now().toString(36)}`,
        platform: values.platform,
        type: values.type,
        env: values.env,
        user: values.user,
        note: values.note || undefined,
        cycle: values.cycle,
        rotatedDays: 0,
        rotatedBy: '我',
        dueDays,
        secret: values.secret || '—',
      })
      notice(`已添加 ${values.user} · 下次 ${relativeDate(dueDays)} 到期`)
    }
    /* 存完的那条若不在当前筛选里 ⇒ 先把筛选退回「全部」：否则它保存完当场消失，
       看着像根本没存上（改过平台的那一条尤其容易碰上）。 */
    const saved = target ?? accounts[accounts.length - 1]
    if (!credMatch(saved)) {
      setPlatform('all')
      setQuery('')
    }
    setForm(null)
    forceRender()
    onChanged()
  }

  const refresh = () => {
    if (refreshing) return
    setRefreshing(true)
    setLastCheck('正在同步…')
    /* 静态页：这里没有真接口可打。900ms 后回到真实时刻 —— 与运维分区同一节奏。 */
    window.setTimeout(() => {
      setRefreshing(false)
      const now = new Date()
      setLastCheck(`最后检查 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
      notice(`已重新检查 ${accounts.length} 条凭据`)
    }, 900)
  }

  return (
    <div className="ac-page ops-page">
      {/* 状态行（见文件头 ②） */}
      <div className="ops-head">
        <span className="last-sync">{lastCheck}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={refresh}>
          <OpsIcon name="refresh" size={14} /> 重新检查
        </button>
      </div>

      {/* ---------------- 页面级仪表 ----------------
          三格各自回答一件"动手前要确认的事"：哪条不能用了 / 最近换过没 / 我拿不拿得到明文。
          不是卡片徽标的复述 —— 徽标负责"这张卡里有多少"，这里负责"下一步动手前得知道什么"。 */}
      <div className="kpi-bar">
        <div className={cn('kpi', risk.length > 0 && 'warn')}>
          <div className="kpi-top">
            <span className="kpi-ico" aria-hidden="true">
              <OpsIcon name="alert" size={15} />
            </span>
            <span className="kpi-label">到期风险</span>
          </div>
          <div className="kpi-val">
            {risk.length}
            <span className="kpi-unit">条</span>
          </div>
          <div className={cn('kpi-sub', risk.length > 0 && 'warn-text')}>
            {worst ? `${worst.platform} · ${worst.user} ${dueText(worst.dueDays)}` : '没有 7 天内到期的凭据'}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" aria-hidden="true">
              <OpsIcon name="refresh" size={15} />
            </span>
            <span className="kpi-label">最近轮换</span>
          </div>
          <div className="kpi-val">{recent ? (recent.rotatedDays < 1 ? '今天' : `${recent.rotatedDays} 天前`) : '—'}</div>
          <div className="kpi-sub">{recent ? `${recent.platform} · ${recent.user} · ${recent.rotatedBy}` : '还没有登记凭据'}</div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" aria-hidden="true">
              <OpsIcon name="eye" size={15} />
            </span>
            <span className="kpi-label">可看明文</span>
          </div>
          <div className="kpi-val">
            {plain}
            <span className="kpi-unit">/ {accounts.length} 条</span>
          </div>
          <div className="kpi-sub">{accounts.length - plain} 条密钥不回显，只能重置</div>
        </div>
      </div>

      {/* ---------------- 凭据清单 ---------------- */}
      <PanelCard
        icon="key"
        title="凭据"
        badge={credBadge}
        bodyId="credCardBody"
        collapsed={collapsed.cred}
        onToggle={() => toggleCard('cred')}
        action={
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={(event) => {
              event.stopPropagation()
              setForm({ editing: null })
            }}
          >
            <OpsIcon name="plus" size={14} /> 添加账户
          </button>
        }
      >
        {/* 筛选条：两个控件而不是一个分段 —— 平台与关键词能同时成立（在阿里云里搜 bot），
            能同时成立的就该是两个控件。 */}
        <div className="ac-filter">
          <div className="chip-row" role="radiogroup" aria-label="按平台筛选">
            {[{ value: 'all', label: '全部', n: accounts.length }]
              .concat(platforms.map((name) => ({ value: name, label: name, n: accounts.filter((c) => c.platform === name).length })))
              .map((item) => {
                const on = activePlatform === item.value
                return (
                  <button key={item.value} type="button" className={cn('chip', on && 'on')} role="radio" aria-checked={on} onClick={() => setPlatform(item.value)}>
                    {item.label}
                    <span className="chip-n">{item.n}</span>
                  </button>
                )
              })}
          </div>
          {/* 外层 label 里只有一枚图标 ⇒ 它没有可访问名，必须显式给 aria-label */}
          <label className="ac-search">
            <OpsIcon name="search" size={14} />
            <input
              type="search"
              placeholder="搜账号 / 备注"
              autoComplete="off"
              aria-label="搜索凭据"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') return
                setQuery('')
              }}
            />
          </label>
        </div>

        {shown.length ? null : (
          /* 两种"空"不是一回事：一条都没有（该去添加）≠ 筛不出来（该改条件）。
             同一句话套两种场景，就会在真没数据时叫人"换个词"。 */
          <div className="ac-empty">
            {accounts.length === 0 ? '这个项目还没有登记凭据 —— 点卡头的「＋ 添加账户」开始。' : '没有匹配的凭据 —— 换个词，或者点回「全部」。'}
          </div>
        )}

        {/* 分组与行都由数据现算 —— 计数写在标记里就一定会说旧话 */}
        {platforms.map((name) => {
          const rows = accounts.filter((c) => c.platform === name).filter(credMatch)
          if (!rows.length) return null
          const bad = rows.filter((c) => !c.disabled && c.dueDays <= 7).length
          return (
            <div key={name} className="ac-group">
              <div className="ac-group-head">
                <span className="ac-group-name">{name}</span>
                {/* 组头这两个数按可见的那些算：筛出 2 条却写着"3 条"，两处当场打架 */}
                <span className="ac-group-count">{rows.length} 条</span>
                {bad ? (
                  <span className="ac-group-alert">
                    <OpsIcon name="alert" size={12} /> <span className="ac-group-alert-n">{bad}</span> 条待处理
                  </span>
                ) : null}
              </div>
              <div className="ac-group-list">
                {rows.map((acc) => (
                  <CredRow
                    key={acc.id}
                    acc={acc}
                    open={openIds.includes(acc.id)}
                    revealed={!!revealed[acc.id]}
                    onToggle={() => toggleOpen(acc.id)}
                    onReveal={() => toggleReveal(acc)}
                    onCopy={(what) => copyCred(acc, what)}
                    onEdit={() => setForm({ editing: acc })}
                    onToggleDisable={() => toggleDisable(acc)}
                    onDelete={() => askDelete(acc)}
                    onRotate={() => openGen(acc)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </PanelCard>

      {/* ---------------- 轮换计划 ---------------- */}
      <PanelCard
        icon="refresh"
        title="轮换计划"
        badge={`未来 90 天 ${plan.length} 条${overdue.length ? ` · ${overdue.length} 条逾期` : ''}`}
        bodyId="rotateCardBody"
        collapsed={collapsed.rotate}
        onToggle={() => toggleCard('rotate')}
        action={
          /* 策略不是界面上能自证的事，所以给一个 ? 而不是一段常驻说明。
             卡头整条本身是"点开折叠"的按钮 ⇒ 这里要拦住冒泡。 */
          <button
            type="button"
            className="ac-help"
            aria-label="轮换策略"
            title="生产环境凭据 90 天强制轮换，测试 / 开发环境 180 天。逾期未轮换的凭据会在发版前的检查里被拦下，并在这里置顶标红。"
            onClick={(event) => event.stopPropagation()}
          >
            ?
          </button>
        }
      >
        <div className="ac-time">
          {plan.map((acc) => {
            const cls = acc.dueDays < 0 ? 'overdue' : acc.dueDays <= 7 ? 'soon' : undefined
            return (
              <div key={acc.id} className={cn('ac-time-item', cls)}>
                <div className="ac-time-when">
                  <span className="ac-time-date">{relativeDateShort(acc.dueDays)}</span>
                  <span className="ac-time-rel">{dueText(acc.dueDays)}</span>
                </div>
                <div className="ac-time-body">
                  <div className="ac-time-title">
                    {acc.user}
                    {acc.dueDays < 0 ? <span className="badge danger">已逾期</span> : acc.dueDays <= 7 ? <span className="badge warn">{acc.dueDays} 天后</span> : null}
                  </div>
                  <div className="ac-time-meta">
                    {acc.platform} · {ACCOUNT_TYPES[acc.type].name} · 周期 {acc.cycle} 天
                  </div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => openGen(acc)}>
                  <OpsIcon name="refresh" size={13} /> 轮换
                </button>
              </div>
            )
          })}
        </div>
      </PanelCard>

      {/* ---------------- 抽屉：添加 / 编辑 ---------------- */}
      {form ? (
        <CredDrawer
          key={form.editing?.id ?? 'add'}
          editing={form.editing}
          accounts={accounts}
          onClose={() => setForm(null)}
          onSave={saveForm}
        />
      ) : null}

      {/* ---------------- 生成器：两个入口（展开面板 / 轮换计划）同一张 -------- */}
      {gen && genAccount ? (
        <PanelModal
          title={`轮换 ${genAccount.user}`}
          variant="gen"
          onCancel={() => setGen(null)}
          bar={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => void copyText(gen.value).then((ok) => notice(ok ? '已复制新密码 —— 记得「用它轮换」之后再关掉' : '复制失败，请手动选中'))}>
                <OpsIcon name="copy" size={14} /> 复制{ACCOUNT_TYPES[genAccount.type].plain ? '密码' : ACCOUNT_TYPES[genAccount.type].name}
              </button>
              <span className="spacer" />
              <button type="button" className="btn btn-ghost" onClick={() => setGen({ ...gen, value: buildValue(genAccount.type, gen.kind, gen.len, gen.sw) })}>
                <OpsIcon name="refresh" size={14} /> 换一个
              </button>
              <button type="button" className="btn btn-primary" onClick={applyGen}>
                用它轮换
              </button>
            </>
          }
        >
          <div className="gen-sec">
            {/* 段的标题不随类型变（「选择生成方式」对密码与密钥都成立）——
                只有"必须指名对象"的地方才跟着类型走：标题里的账号名、复制按钮指名的对象。 */}
            <div className="gen-sec-label">选择生成方式</div>
            <div className="seg" role="tablist" aria-label="选择生成方式">
              {(Object.keys(GEN_TYPES) as GenKind[]).map((kind) => {
                const off = genAccount.type !== 'password' && kind !== 'random'
                return (
                  <button
                    key={kind}
                    type="button"
                    className="seg-btn"
                    role="tab"
                    aria-selected={gen.kind === kind}
                    disabled={off}
                    title={off ? '平台签发的密钥只能是随机串，选不了这一种' : undefined}
                    onClick={() => pickKind(kind)}
                  >
                    {kind === 'random' ? '随机' : kind === 'words' ? '容易记住' : 'PIN'}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="gen-sec">
            <div className="gen-sec-label">调整参数</div>
            <div className="gen-row">
              <span className="gen-row-label">{genAccount.type === 'password' ? GEN_TYPES[gen.kind].unit : '字符'}</span>
              <input
                className="rng"
                type="range"
                min={genRange(genAccount.type, gen.kind).min}
                max={genRange(genAccount.type, gen.kind).max}
                step={1}
                value={gen.len}
                aria-label="长度"
                onChange={(event) => pickLen(Number(event.target.value), event.target.value)}
              />
              <input
                className="num-box"
                type="number"
                min={genRange(genAccount.type, gen.kind).min}
                max={genRange(genAccount.type, gen.kind).max}
                step={1}
                value={gen.lenText}
                aria-label="长度（数字）"
                onChange={(event) => pickLen(Number(event.target.value), event.target.value)}
              />
            </div>
            {/* 开关随类型换：随机 = 数字/符号，容易记住 = 首字母大写/完整单词，PIN = 没有 */}
            {GEN_TYPES[gen.kind].switches.length ? (
              <div className="gen-switches">
                {GEN_TYPES[gen.kind].switches.map((item) => {
                  /* 密钥类不收符号：开关留着（同一个位置、同一个形状），但置灰并写明原因 */
                  const off = genAccount.type !== 'password' && item.key === 'symbols'
                  const on = !!gen.sw[item.key] && !off
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className="sw"
                      role="switch"
                      aria-checked={on}
                      disabled={off}
                      title={off ? '平台签发的密钥只收字母和数字' : undefined}
                      onClick={() => toggleSw(item.key, off)}
                    >
                      <span className="sw-track" aria-hidden="true" />
                      <span className="sw-label">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>

          <div className="gen-sec">
            <div className="gen-sec-label">生成结果</div>
            <div className="gen-out">
              {/* 逐字符染数字与符号（颜色在这里只说一件事：这一位是哪类字符）。
                  PIN 与密钥类不染色 —— 那里没有"类别"可言，靠字号 / 等宽表达就够。 */}
              {genAccount.type === 'password' && gen.kind !== 'pin' ? (
                <code>
                  {gen.value.split('').map((ch, i) => (
                    <span key={i} className={GEN_CHARS.digits.includes(ch) || GEN_CHARS.symbols.includes(ch) ? 'b' : undefined}>
                      {ch}
                    </span>
                  ))}
                </code>
              ) : (
                <code className={genAccount.type === 'password' && gen.kind === 'pin' ? 'big' : undefined}>{gen.value}</code>
              )}
            </div>
            <div className="gen-hint">{genHint(genAccount.type, gen.kind, gen.len, gen.sw)}</div>
          </div>
        </PanelModal>
      ) : null}

      {/* ---------------- 二次确认 ---------------- */}
      {confirm ? (
        <PanelModal
          title={confirm.title}
          onCancel={() => setConfirm(null)}
          footer={
            <button
              type="button"
              className={cn('btn', confirm.danger ? 'btn-danger' : 'btn-primary')}
              onClick={() => {
                confirm.onConfirm()
                setConfirm(null)
              }}
            >
              {confirm.confirmText}
            </button>
          }
        >
          {confirm.desc ? <p>{confirm.desc}</p> : null}
          {confirm.warn ? (
            <div className="modal-warn" role="note">
              <strong>影响：</strong>
              <span>{confirm.warn}</span>
            </div>
          ) : null}
        </PanelModal>
      ) : null}
    </div>
  )
}
