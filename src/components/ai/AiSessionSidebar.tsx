import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '../icons/Icon'
import { cn } from '../../lib/cn'
import { toast } from '../../stores/toast-store'
import { AI_SESSION_GROUPS } from '../../data/ai/types'
import type { AiSession } from '../../data/ai/types'
import { nowTime, useAiStore } from '../../stores/ai-store'
import { GlyphChat, GlyphPin, GlyphTrash } from './ai-glyphs'
import { pressable } from './pressable'
import { useExportSession } from './use-export-session'

/* ============================================================
   会话列表（原型 `.sidebar` → `.ai-sidebar`）
   ============================================================ */

interface AiSessionSidebarProps {
  /** 新建会话时开场白要用的称呼（登录态给） */
  userName: string
  /** ≤768px 抽屉是否打开（复用外壳的 ui-store，见页面注释） */
  drawerOpen: boolean
}

function SessionItem({
  session,
  active,
  menuActive,
  onSelect,
  onMore,
}: {
  session: AiSession
  active: boolean
  menuActive: boolean
  onSelect: () => void
  onMore: (anchor: HTMLElement) => void
}) {
  return (
    <div
      className={cn('session-item', active && 'active', session.pinned && 'pinned')}
      {...pressable(onSelect)}
      aria-current={active ? 'true' : undefined}
    >
      <span className="s-icon">
        <GlyphChat />
      </span>
      <span className="s-text">{session.title}</span>
      {/* 生成中的会话挂一颗脉动小圆点（原型 `.s-dot`）。
          有了它，"我切走了但那边还在生成"才看得出来 —— 而切走不丢正是
          "生成中进消息数据"换来的能力，得让人看见。 */}
      {session.messages.some((message) => message.generating) ? <span className="s-dot" /> : null}
      <span
        className={cn('s-more', menuActive && 'active')}
        title="更多"
        {...pressable((event) => onMore(event.currentTarget as HTMLElement), true)}
      >
        <Icon name="i-more" />
      </span>
    </div>
  )
}

export function AiSessionSidebar({ userName, drawerOpen }: AiSessionSidebarProps) {
  const sessions = useAiStore((state) => state.sessions)
  const activeId = useAiStore((state) => state.activeId)
  const select = useAiStore((state) => state.select)
  const createSession = useAiStore((state) => state.createSession)
  const togglePin = useAiStore((state) => state.togglePin)
  const rename = useAiStore((state) => state.rename)
  const remove = useAiStore((state) => state.remove)

  /* ---------- 会话菜单（原型 `#sessionMenu`，fixed 定位贴着那一颗「⋯」） ---------- */
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLElement | null>(null)

  const openMenu = useCallback((id: string, anchor: HTMLElement) => {
    anchorRef.current = anchor
    /* 先给一个"大致对"的位置把菜单挂上去，再在 layout effect 里按真实尺寸校正。
       为什么要两步：菜单没显示时量不出尺寸（display:none → 0×0），
       而原型的顺序正是"先 show 再量"。useLayoutEffect 在绘制前跑完，
       所以用户看不到那次校正。 */
    const rect = anchor.getBoundingClientRect()
    setMenu({ id, top: rect.bottom + 6, left: rect.left })
  }, [])

  useLayoutEffect(() => {
    if (!menu) return
    const el = menuRef.current
    const anchor = anchorRef.current
    if (!el || !anchor) return
    const rect = anchor.getBoundingClientRect()
    const box = el.getBoundingClientRect()
    let top = rect.bottom + 6
    let left = rect.left - box.width + rect.width
    /* 贴到视口底/左边时翻转 —— 与原型同一处置（否则菜单会被切掉一半） */
    if (top + box.height > window.innerHeight - 10) top = rect.top - box.height - 6
    if (left < 10) left = 10
    /* ⚠️ 值没变时必须**返回原引用**：返回新对象会让 store 认为状态变了 → 重渲染 →
       依赖里的 `menu` 跟着变 → 效果再跑一次 —— 无限循环。
       依赖只写 `menu?.id` 也是为此（写整个 `menu` 同样会绕进去）。 */
    setMenu((current) => {
      if (!current || (current.top === top && current.left === left)) return current
      return { ...current, top, left }
    })
  }, [menu?.id])

  useEffect(() => {
    if (!menu) return
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  /* ---------- 重命名 / 删除 ---------- */
  const [renaming, setRenaming] = useState<AiSession | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleting, setDeleting] = useState<AiSession | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!renaming) return
    renameInputRef.current?.focus()
    renameInputRef.current?.select()
  }, [renaming])

  useEffect(() => {
    if (!renaming && !deleting) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setRenaming(null)
      setDeleting(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [renaming, deleting])

  const exportSession = useExportSession()
  const pinned = sessions.filter((session) => session.pinned)
  const menuSession = menu ? sessions.find((session) => session.id === menu.id) : undefined
  const grouped = AI_SESSION_GROUPS.map((group) => ({
    group,
    items: sessions.filter((session) => !session.pinned && session.group === group),
  })).filter((bucket) => bucket.items.length > 0)

  return (
    <aside className={cn('ai-sidebar', drawerOpen && 'is-open')} aria-label="会话列表">
      <div className="ai-sidebar-head">
        <button type="button" className="new-chat" onClick={() => createSession(userName, nowTime())}>
          <Icon name="i-plus" />
          新对话
        </button>
      </div>

      <div className="session-group">
        {pinned.length ? (
          <div className="session-label">
            <span className="pinned-mark">📌</span>置顶
          </div>
        ) : null}
        {pinned.map((session) => (
          <SessionItem
            key={session.id}
            session={session}
            active={session.id === activeId}
            menuActive={menu?.id === session.id}
            onSelect={() => select(session.id)}
            onMore={(anchor) => openMenu(session.id, anchor)}
          />
        ))}

        {grouped.map((bucket) => (
          <div key={bucket.group}>
            <div className="session-label">{bucket.group}</div>
            {bucket.items.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                active={session.id === activeId}
                menuActive={menu?.id === session.id}
                onSelect={() => select(session.id)}
                onMore={(anchor) => openMenu(session.id, anchor)}
              />
            ))}
          </div>
        ))}

        {!sessions.length ? <div className="stat-desc">还没有会话 —— 上面那颗「新对话」可以开一个</div> : null}
      </div>

      {/* ---------- 会话菜单 ---------- */}
      <div
        ref={menuRef}
        className={cn('session-menu', menu && 'show')}
        style={menu ? { top: menu.top, left: menu.left } : undefined}
        role="menu"
      >
        <div
          className="session-menu-item"
          {...pressable(() => {
            if (!menuSession) return
            togglePin(menuSession.id)
            setMenu(null)
            toast(menuSession.pinned ? '已取消置顶' : '已置顶')
          })}
        >
          <GlyphPin />
          <span>{menuSession?.pinned ? '取消置顶' : '置顶'}</span>
        </div>
        <div
          className="session-menu-item"
          {...pressable(() => {
            if (!menuSession) return
            setRenaming(menuSession)
            setRenameValue(menuSession.title)
            setMenu(null)
          })}
        >
          <Icon name="i-edit" />
          重命名
        </div>
        <div
          className="session-menu-item"
          {...pressable(() => {
            if (!menuSession) return
            void exportSession(menuSession)
            setMenu(null)
          })}
        >
          <Icon name="i-download" />
          导出
        </div>
        <div className="session-menu-divider" />
        <div
          className="session-menu-item danger"
          {...pressable(() => {
            setDeleting(menuSession ?? null)
            setMenu(null)
          })}
        >
          <GlyphTrash />
          删除
        </div>
      </div>

      {/* ---------- 重命名 ---------- */}
      <div className={cn('rename-modal', renaming && 'show')}>
        <div className="rename-box">
          <h3>重命名会话</h3>
          <input
            ref={renameInputRef}
            type="text"
            className="rename-input"
            placeholder="输入新名称"
            maxLength={30}
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              if (!renaming) return
              if (!renameValue.trim()) {
                toast('名称不能为空')
                return
              }
              rename(renaming.id, renameValue)
              setRenaming(null)
              toast('已重命名')
            }}
          />
          <div className="rename-actions">
            <button type="button" className="rename-btn" onClick={() => setRenaming(null)}>
              取消
            </button>
            <button
              type="button"
              className="rename-btn primary"
              onClick={() => {
                if (!renaming) return
                if (!renameValue.trim()) {
                  toast('名称不能为空')
                  return
                }
                rename(renaming.id, renameValue)
                setRenaming(null)
                toast('已重命名')
              }}
            >
              确定
            </button>
          </div>
        </div>
      </div>

      {/* ---------- 删除确认 ---------- */}
      <div className={cn('confirm-modal', deleting && 'show')}>
        <div className="confirm-box">
          <div className="confirm-icon">
            <GlyphTrash />
          </div>
          <h3>删除这个会话？</h3>
          <p>删除后无法恢复，该会话的所有消息记录都会被清除。</p>
          <div className="confirm-actions">
            <button type="button" className="confirm-btn" onClick={() => setDeleting(null)}>
              取消
            </button>
            <button
              type="button"
              className="confirm-btn danger"
              onClick={() => {
                if (!deleting) return
                remove(deleting.id)
                setDeleting(null)
                toast('已删除会话')
              }}
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
