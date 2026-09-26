import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

/* ============================================================================
   macOS 风格窗口（窗框）
   ----------------------------------------------------------------------------
   它只做四件事：**画窗框**（标题栏 / 圆角 / 投影）、**拖动**、**最小化**、**全屏**，
   外加把"关闭"这件事交回调用方。正文是 `children`，贴在本窗口内的浮层是 `overlay`。

   目前唯一的使用者是日志页（`/logs/:id`）—— 那一页本来就是一个 `window.open`
   出来的独立窗口（原型 `工作-项目-项目详情-运维-日志-index.html`），之前落在应用里
   只剩一条自绘的 `.viewer-bar`，看不出"这是另一个窗口"。现在补上窗框。

   ============================================================================
   四条判据（都是"这么写而不是那样写"的理由）
   ============================================================================
   ① **拖动不用 CSS 的 `-webkit-app-region: drag`，也不用 Tauri 的 `data-tauri-drag-region`**。
      前者的拖动由浏览器合成器接管，`mousemove` 拿不到，也就没法做边界收束；
      后者会把整扇**真实 OS 窗口**拖走，而这一页在应用内是一个**页面**、不是新开的窗。
      这里要的是"页面里的一扇浮动窗口"，所以老老实实 mousedown → mousemove → mouseup。

   ② **偏移量走 CSS 变量（`--mac-x/--mac-y`）而不是行内 `transform` 字符串**。
      因为 `transform` 还要被三处用：拖动、最小化（往下缩走）、全屏（不动）。
      写成行内字符串就等于把"状态的表达"占死了，最小化只能改用 wrapper 或者
      `!important` 去抢。交给 CSS 之后，React 只负责说"我在哪"，怎么动由样式决定。

   ③ **拖动期间关掉过渡（`data-dragging`）**。否则 `transform` 那 240ms 的缓动会让窗口
      **追着鼠标跑**，手感像拖着一条橡皮筋。缩放动画要顺滑、拖动要即时 —— 这两件事互相
      矛盾，只能按状态切开。

   ④ **`position: fixed` 的浮层要放进窗口里**（`overlay`），别留在页面根上。
      窗框带 `transform`，按 CSS 规范它就成了后代 `position: fixed` 的**包含块** ——
      于是内核那套 `.modal-mask { position: fixed; inset: 0 }` 会正好盖住**窗口**
      而不是整个视口，自动得到"附在窗口上的弹窗"（macOS 的 sheet）。放外面就会盖住整屏，
      连窗框一起压黑，那就不像窗口了。

   ============================================================================
   与真实 macOS 的三处差异（都是有意的，别当 bug 修）
   ============================================================================
   · **绿钮 = 铺满视口，不调 Fullscreen API**。这一页里"屏幕"就是视口；真全屏 API 在
     嵌入预览 / 无用户手势时会静默失败，而且**退出不受我们控制**（Esc 也能退），
     状态会与按钮脱节。CSS 这条永远成立、也永远收得回来。
   · **黄钮 = 缩到"停靠位"**。浏览器里没有真正的"最小化到 Dock"，所以窗口往下方
     缩走、透明度归零，同时左下角浮出一颗"停靠位"胶囊；点它还原。焦点会跟着移过去，
     键盘用户不会掉在一个已经 `visibility: hidden` 的窗口里。
   · **绿钮的符号恒为 `+`**。真实 macOS 在全屏态会给绿钮换一个"缩回"的图形；
     这里按需求固定为 `+`，改的是 `title` 与 `aria-label`（"进入全屏"/"退出全屏"），
     按钮语义仍然说得清。
   ============================================================================ */

/** 拖动时至少留在视口里的横向像素数。窗口可以被拖到只剩一条边，但拖不丢。 */
const KEEP_X = 120
/**
 * 纵向至少留住的高度。
 * ⚠️ 必须 ≥ 标题栏高度（30px）：留得比标题栏还少，用户就再也抓不回来了 ——
 *    那是一条"拖一次就丢窗口"的路径。
 */
const KEEP_Y = 56

const clamp = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo), hi)

interface Bounds {
  loX: number
  hiX: number
  loY: number
  hiY: number
}

/**
 * 把"窗口不能整个离开视口"翻译成四个边界值。
 *
 * ⚠️ `rect` 必须是**已经带上 `ox/oy` 之后**量到的那个矩形（`getBoundingClientRect()`
 *    拿到的就是这个），`ox/oy` 是量它的那一刻正在生效的偏移。两者一起才等于"零偏移时的位置"，
 *    所以这一个函数能被两处复用，不必各自维护一份基准：
 *      · 拖动中：`rect` = 按下那一刻量的，`ox/oy` = 按下那一刻的偏移；
 *      · 视口缩放后：`rect` = 现在量的，`ox/oy` = 现在生效的。
 */
function boundsOf(rect: DOMRect, ox: number, oy: number): Bounds {
  const vw = window.innerWidth
  const vh = window.innerHeight
  return {
    loX: ox + KEEP_X - rect.right,
    hiX: ox + vw - KEEP_X - rect.left,
    loY: oy + KEEP_Y - rect.bottom,
    hiY: oy + vh - KEEP_Y - rect.top,
  }
}

const clampTo = (p: { x: number; y: number }, b: Bounds) => ({
  x: clamp(p.x, b.loX, b.hiX),
  y: clamp(p.y, b.loY, b.hiY),
})

interface DragState {
  /** 按下时的鼠标位置 */
  sx: number
  sy: number
  /** 按下时生效的偏移 */
  ox: number
  oy: number
  /** 按下时量到的窗口矩形（**含**上面那个偏移） */
  rect: DOMRect
}

export interface MacWindowProps {
  /** 标题栏正中的那行字 */
  title: string
  /** 标题右侧的次级说明（如当前服务器名）。可空 */
  subtitle?: string
  /** 最小化之后停在"停靠位"上的图标 */
  icon?: ReactNode
  /** 红钮（关闭）。窗口本身不知道关掉之后该去哪 —— 那是调用方的事 */
  onClose: () => void
  /** 窗口正文 */
  children: ReactNode
  /** 贴在本窗口内的浮层（弹窗等）。见文件头 ④ */
  overlay?: ReactNode
  className?: string
}

export function MacWindow({
  title,
  subtitle,
  icon = '▢',
  onClose,
  children,
  overlay,
  className,
}: MacWindowProps) {
  const winRef = useRef<HTMLDivElement | null>(null)
  const dockRef = useRef<HTMLButtonElement | null>(null)

  const [offset, setOffset] = useState({ x: 0, y: 0 })
  /** 与 `offset` 同步的镜像。拖动 / 缩放的回调在 React 之外读它，拿不到渲染期的新值 */
  const offsetRef = useRef(offset)
  const [dragging, setDragging] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [minimized, setMinimized] = useState(false)
  /** 全屏之前的偏移 —— 还原要回到原处，而不是回到屏幕正中 */
  const beforeZoom = useRef(offset)
  const drag = useRef<DragState | null>(null)

  const moveTo = (next: { x: number; y: number }) => {
    const cur = offsetRef.current
    /* 值没变就别 setState：视口缩放的回调每次都会算一遍，白渲染 */
    if (cur.x === next.x && cur.y === next.y) return
    offsetRef.current = next
    setOffset(next)
  }

  /* ---- 拖动。监听挂在 window 上（不是元素上）：鼠标甩出窗口也不能断 ---- */
  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const d = drag.current
      if (!d) return
      const raw = { x: d.ox + (event.clientX - d.sx), y: d.oy + (event.clientY - d.sy) }
      moveTo(clampTo(raw, boundsOf(d.rect, d.ox, d.oy)))
    }
    const onUp = () => {
      if (!drag.current) return
      drag.current = null
      setDragging(false)
      document.body.classList.remove('is-macwin-drag')
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    /* 拖到一半 Alt-Tab 走了，mouseup 永远不会来 —— 这一条不收，窗口会一直粘着鼠标 */
    window.addEventListener('blur', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('blur', onUp)
      document.body.classList.remove('is-macwin-drag')
    }
  }, [])

  /* ---- 视口变小后把窗口收回可视范围（否则缩放一次它就永远在外面了） ---- */
  useEffect(() => {
    const onResize = () => {
      const el = winRef.current
      if (!el || drag.current) return
      const cur = offsetRef.current
      moveTo(clampTo(cur, boundsOf(el.getBoundingClientRect(), cur.x, cur.y)))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /* ---- 最小化之后把焦点交给"停靠位"：窗口已经 visibility:hidden，焦点留不住 ---- */
  useEffect(() => {
    if (minimized) dockRef.current?.focus()
  }, [minimized])

  const onBarMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    /* 全屏态铺满视口，没有可拖的余地 */
    if (zoomed) return
    /* 三颗圆钮不参与拖动 —— 按下它们是要办事，不是要挪窗口 */
    if ((event.target as HTMLElement).closest('.macwin-dot')) return
    const el = winRef.current
    if (!el) return
    /* 阻止浏览器把标题选中：拖过一次之后标题会留一片蓝色高亮 */
    event.preventDefault()
    drag.current = {
      sx: event.clientX,
      sy: event.clientY,
      ox: offsetRef.current.x,
      oy: offsetRef.current.y,
      rect: el.getBoundingClientRect(),
    }
    setDragging(true)
    document.body.classList.add('is-macwin-drag')
  }

  const toggleZoom = () => {
    if (zoomed) {
      setZoomed(false)
      moveTo(beforeZoom.current)
      /* 还原之后窗口从"铺满"变回"浮动"，尺寸变了 —— 下一帧按新尺寸再收一次。
         同一帧里量到的还是全屏那个矩形，收出来的是错的值。 */
      requestAnimationFrame(() => {
        const el = winRef.current
        if (!el) return
        const cur = offsetRef.current
        moveTo(clampTo(cur, boundsOf(el.getBoundingClientRect(), cur.x, cur.y)))
      })
      return
    }
    beforeZoom.current = offsetRef.current
    setZoomed(true)
    /* 全屏时偏移必须归零：否则窗口是"铺满 + 平移出去" */
    moveTo({ x: 0, y: 0 })
  }

  const onBarDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.macwin-dot')) return
    toggleZoom()
  }

  return (
    <div className="macwin-stage">
      <div
        ref={winRef}
        className={cn('macwin', className, zoomed && 'is-zoomed', minimized && 'is-min')}
        data-dragging={dragging || undefined}
        style={{ ['--mac-x' as string]: `${offset.x}px`, ['--mac-y' as string]: `${offset.y}px` }}
      >
        {/* 标题栏整条都可拖。双击 = 全屏/还原（macOS 的默认绑定）。 */}
        <div className="macwin-bar" onMouseDown={onBarMouseDown} onDoubleClick={onBarDoubleClick}>
          <div className="macwin-dots" role="group" aria-label="窗口控制">
            <button
              type="button"
              className="macwin-dot close"
              title="关闭窗口"
              aria-label="关闭窗口"
              onClick={onClose}
            >
              <span className="macwin-glyph" aria-hidden="true">
                ×
              </span>
            </button>
            <button
              type="button"
              className="macwin-dot minimize"
              title="最小化"
              aria-label="最小化窗口"
              onClick={() => setMinimized(true)}
            >
              <span className="macwin-glyph" aria-hidden="true">
                −
              </span>
            </button>
            <button
              type="button"
              className="macwin-dot zoom"
              title={zoomed ? '退出全屏（还原窗口）' : '进入全屏'}
              aria-label={zoomed ? '退出全屏' : '进入全屏'}
              aria-pressed={zoomed}
              onClick={toggleZoom}
            >
              <span className="macwin-glyph" aria-hidden="true">
                +
              </span>
            </button>
          </div>

          <div className="macwin-title">
            <span className="macwin-title-text" title={title}>
              {title}
            </span>
            {subtitle ? <span className="macwin-subtitle">{subtitle}</span> : null}
          </div>
        </div>

        <div className="macwin-body">{children}</div>

        {overlay}
      </div>

      {minimized ? (
        <button
          ref={dockRef}
          type="button"
          className="macwin-dock"
          title={`还原「${title}」`}
          onClick={() => setMinimized(false)}
        >
          <span className="macwin-dock-ico" aria-hidden="true">
            {icon}
          </span>
          <span className="macwin-dock-label">{title}</span>
        </button>
      ) : null}
    </div>
  )
}
