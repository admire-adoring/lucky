import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Icon } from '../icons/Icon'
import type { IconName } from '../../types'
import { Compass } from '../workbench/ModuleRing'

/**
 * 侧栏环形导航 —— 当前模块的 Tab 环。
 *
 * ============================================================================
 * 它**复用**工作台 Hero 那一套环，不是第二份实现
 * ============================================================================
 *
 * 类名（`.radial` / `.radial__item` / `.radial__label` / `.hub-door` / `.hub-dial` /
 * `.hub-arc` / `.hub-compass*` / `.hub-ripple` / `.hub-pin` / `.hub-name*`）与
 * 罗盘（`Compass`）都取自 `ModuleRing.tsx` + `styles/workbench-hero.css`。
 * 判据写在 `design/build-sidebar-css.mjs` 的 REUSE_RING 里，三条：
 *   ① 同一件东西（同族类名，同一套几何约定）；
 *   ② 侧栏原型那一份**代际更旧**（有 `hub-aura`/`hub-back`/`hub-name-flip`，
 *      没有 `hub-pin`/`hub-door__clip`/`hub-name__pad`）；
 *   ③ 用户已定的决策在里面（`hub-aura` 与"指针射线"是 09-19/09-21 明确撤掉的），
 *      重搬原型那一份会把它们原样复活。
 * 侧栏只是**覆盖刻度**：半径/表盘/瓦片尺寸/`--accent`，写在 `sidebar-shell.css` 的 `.sb-ring` 下。
 *
 * ============================================================================
 * 与工作台那个环的三处差异（都是"它在一个 300px 的侧栏里"造成的）
 * ============================================================================
 *
 * ① **没有三级**。原型的环有第二层（Tab → 子项，如「习惯 → 本周/连续记录/统计」）。
 *    应用里 Tab 没有子项 —— 硬搬就得**编**子项与计数，而那正是项目明令禁止的。
 *    所以这里只渲染一级：能力收在执行层，不在数据层伪造。
 *
 * ② **中心门改成"打开命令面板"**。原型那扇门的语义是「进入当前项」（它的右边还有一步），
 *    而应用里当前 Tab 的内容**已经在主区**了 —— "进入"指向一个不存在的地方。
 *    改成打开命令面板（⌘K），它仍然是"从这里出去"的那扇门，而且有真实功能：
 *    模块与 Tab 的全局跳转。⚠️ 这是一处**主动改动**，不是降级。
 *
 * ③ **`data-current` 而不是 `.active`**。工作台那一份用的是 `[data-current='true']`，
 *    侧栏跟着它 —— 两个环共用同一批样式，属性名不一致就等于其中一份永远不高亮。
 *
 * ============================================================================
 * 几何
 * ============================================================================
 *
 * 角度约定与 `ModuleRing.ringAngle` 相同：**12 点起、顺时针**（`-90 + step * i`）。
 * 半径/标签半径/表盘直径由 CSS 的 `--r` / `--rl` / `--dial` 给（`.sb-ring .radial`），
 * 这里只把"标签相对瓦片中心再外推 `rl - r`"算成 `--lx/--ly`。
 * ⚠️ 这三个数**彼此牵制**，改一个就要重量（与 ModuleRing 的 RING 注释同一条纪律）：
 *    瓦片 34 · r 76 · rl 118 · dial 62 —— 内圈要能塞下表盘（76 − 17 = 59 > 62/2），
 *    而相邻标签的中心间距是 `2 · rl · sin(π/n)`，n = 12 时约 61px，
 *    所以标签 `max-width` 必须 ≤ 58px（见 sidebar-shell.css），否则会叠字。
 */
const GEOMETRY = { r: 76, rl: 118, start: -90 }

const round1 = (v: number) => Math.round(v * 10) / 10

export interface RingNavItem {
  key: string
  label: string
  icon: IconName
}

interface RingNavProps {
  items: RingNavItem[]
  /** 当前项的 key */
  activeKey: string
  onSelect: (key: string) => void
  /** 打开命令面板（中心门的动作，见文件头 ②） */
  onEnter: () => void
  /** 无障碍名：「生活 分区」 */
  ariaLabel: string
}

export function RingNav({ items, activeKey, onSelect, onEnter, ariaLabel }: RingNavProps) {
  const [rippleKey, setRippleKey] = useState(0)
  const rippleRef = useRef<HTMLElement>(null)
  const reduceRef = useRef(false)

  // prefers-reduced-motion 只在挂载时读一次：这个动画是"一次性的扩散"，不必常驻订阅
  useEffect(() => {
    reduceRef.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  }, [])

  /**
   * 涟漪：换 Tab 时从中心扩散一圈。
   *
   * ⚠️ 用 `useState` 计数当 key 重放动画，而不是 `classList.remove/add` ——
   *    React 每次渲染都会重算 className，命令式加上的类会被原样覆盖掉
   *    （MEMORY 里那类"看起来加了、其实没生效"）。计数变化 = 重新挂载节点 = 动画重放。
   *
   * ⚠️ 动画由 WAAPI 播放、不在 CSS 里常驻（与工作台那一份一致）：常驻的话
   *    元素会一直占着一个合成层，而它 99% 的时间是 `opacity: 0`。
   */
  useEffect(() => {
    if (rippleKey === 0 || reduceRef.current) return
    rippleRef.current?.animate(
      [
        { transform: 'scale(0.4)', opacity: 0.7 },
        { transform: 'scale(2.6)', opacity: 0 },
      ],
      { duration: 700, easing: 'cubic-bezier(0.16, 0.9, 0.3, 1)' },
    )
  }, [rippleKey])

  const n = Math.max(items.length, 1)
  const step = 360 / n
  const activeIndex = Math.max(
    0,
    items.findIndex((i) => i.key === activeKey),
  )
  const activeItem = items[activeIndex]

  /**
   * 指针角度 —— **累加**找最近路，不是直接赋目标值。
   *
   * 直接赋 `deg` 的话，从最后一项切回第一项会**倒着绕一整圈**（360 − step）。
   * `@property --na` 已注册成 `<angle>`，所以插值是真的在转。
   * 与 `ModuleRing` 用的是同一个算法，只是它的角度由 9 项固定 40° 推出。
   */
  const targetAngle = GEOMETRY.start + step * activeIndex
  const [needle, setNeedle] = useState(targetAngle)
  useEffect(() => {
    setNeedle((prev) => {
      const target = targetAngle
      const delta = ((target - prev + 540) % 360) - 180
      return prev + delta
    })
  }, [targetAngle])

  return (
    <div className="sb-ring" data-ring-level="1">
      <div
        className="radial"
        role="group"
        aria-roledescription="环形菜单"
        aria-label={ariaLabel}
        style={{ ['--na' as string]: `${round1(needle)}deg` }}
      >
        <i className="hub-ripple" key={rippleKey} ref={rippleRef} aria-hidden="true" />

        {/* 门：表盘 + 中心名 = 打开命令面板（见文件头 ②） */}
        <button
          type="button"
          className="hub-door"
          onClick={() => {
            setRippleKey((k) => k + 1)
            onEnter()
          }}
          title="打开命令面板（⌘K）"
          aria-label={`打开命令面板，当前 ${activeItem?.label ?? ''}`}
        >
          <span className="hub-dial" aria-hidden="true">
            <i className="hub-arc" />
            <Compass />
            <i className="hub-pin" />
          </span>
          <span className="hub-name" aria-hidden="true">
            <i className="hub-name__pad" />
            <span>{activeItem?.label ?? ''}</span>
            <Icon name="i-arrow-right" className="hub-name__go h-3 w-3" />
          </span>
          <span className="hub-door__clip" aria-hidden="true" />
        </button>

        {items.map((item, i) => {
          const angle = GEOMETRY.start + step * i
          const rad = (angle * Math.PI) / 180
          const reach = GEOMETRY.rl - GEOMETRY.r
          const isCurrent = i === activeIndex
          return (
            <button
              key={item.key}
              type="button"
              className="radial__item flex items-center justify-center"
              style={{
                ['--a' as string]: `${round1(angle)}deg`,
                ['--lx' as string]: `${round1(reach * Math.cos(rad))}px`,
                ['--ly' as string]: `${round1(reach * Math.sin(rad))}px`,
                ['--i' as string]: String(i),
              }}
              data-current={isCurrent}
              aria-current={isCurrent}
              aria-label={item.label}
              title={item.label}
              onClick={() => {
                if (isCurrent) return
                setRippleKey((k) => k + 1)
                onSelect(item.key)
              }}
            >
              <span className="radial__label">{item.label}</span>
              <Icon name={item.icon} className={cn('h-[17px] w-[17px]')} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
