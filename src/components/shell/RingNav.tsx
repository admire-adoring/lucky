import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Icon } from '../icons/Icon'
import type { IconName } from '../../types'
import { Compass } from '../workbench/ModuleRing'

/**
 * 侧栏环形导航 —— 当前模块的 Tab 环。**环上不写字，名称走悬停名称条。**
 *
 * ============================================================================
 * 它**复用**工作台 Hero 那一套环，不是第二份实现
 * ============================================================================
 *
 * 类名（`.radial` / `.radial__item` / `.hub-door` / `.hub-dial` /
 * `.hub-arc` / `.hub-compass*` / `.hub-ripple` / `.hub-pin`）与
 * 罗盘（`Compass`）都取自 `ModuleRing.tsx` + `styles/workbench-hero.css`。
 * 侧栏只是**覆盖刻度**：半径/表盘/瓦片尺寸/`--accent`，写在 `sidebar-shell.css`
 * 的 `.sb-ring` 下。
 *
 * ============================================================================
 * 与工作台那个环的四处差异（都是"它在一个 300px 的侧栏里"造成的）
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
 * ④ **环上不写字，门里也不写字**（2026-09-25 对齐导航-v5）。
 *    原型的主张：瓦片只放图标，圆盘里只有刻度弧 + 罗盘 + 指针；名字**统一由环下方
 *    的 `.radial-caption` 承担，悬停/聚焦才出现**。
 *    工作台那一份的「环上九个标签当图例 + 中心 hub-name 当状态」是另一套读法，
 *    侧栏不用它，两个理由：
 *      · 侧栏的分区最多 10 个、标签又是中文长词，环上那圈标签必然互相挤
 *        （上一版就得靠「弦长 vs 边界取小」两处算式压着才不叠字）；
 *      · 中心名与**侧栏副标题**（`.sidebar-subtitle`）是同一个词、相隔 40px 说两遍，
 *        而"我在哪个分区"这件事只该有一处文字回执。
 *    ⚠️ 名称条**不参与布局**（常驻占位，只切 opacity/translateY），
 *       所以悬停时下面的槽面板一格都不会动。
 *
 * ============================================================================
 * 几何
 * ============================================================================
 *
 * 角度约定与 `ModuleRing.ringAngle` 相同：**12 点起、顺时针**（-90 + step * i）。
 * ⚠️ 半径、表盘直径**全部由 CSS 给**（`.sb-ring .radial` 的 `--r` / `--dial`）；
 *    JS 不再参与定位 —— 环上不写字之后，这里唯一算得出来的东西（标签相对瓦片
 *    外推的 `--lx/--ly`）也一并消失了。所以本文件里**没有一个尺寸常量**，
 *    改环的大小去改 CSS 那一条，不要在这里加偏移。
 */

/** 起始角：12 点方向（与 ModuleRing 同一约定） */
const START = -90

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

  /**
   * 名称条的状态。
   *
   * ⚠️ 拆成 `text` + `on` 两个字段，而不是"null 表示不显示"：
   *    隐藏时必须**留着上一个名字**，否则淡出的那 160ms 里会看到一条**空胶囊**
   *    （原型同处理：hideCaption 只摘 is-on，不动 textContent）。
   */
  const [caption, setCaption] = useState<{ text: string; on: boolean }>({ text: '', on: false })

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

  /**
   * 换模块时把名称条复位。
   *
   * 为什么需要：瓦片卸载时**不会**触发 `mouseleave`（DOM 移除不产生鼠标事件），
   * 所以"指针还压着环、同时换了模块"会留下上一个模块的名字。
   *
   * ⚠️ 依赖不能写成 `[items]` —— `WorkspaceLayout` 每次渲染都会重建那个数组，
   *    于是每次渲染都复位（光标停在环上时名字永远不出现）。
   *    所以取一个**内容签名**：项的 key 串 + 无障碍名（后者含模块名）。
   */
  const itemsKey = items.map((item) => item.key).join('|')
  useEffect(() => {
    setCaption({ text: '', on: false })
  }, [itemsKey, ariaLabel])

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
  const targetAngle = START + step * activeIndex
  const [needle, setNeedle] = useState(targetAngle)
  useEffect(() => {
    setNeedle((prev) => {
      const target = targetAngle
      const delta = ((target - prev + 540) % 360) - 180
      return prev + delta
    })
  }, [targetAngle])

  /** 悬停/聚焦时把名字写到名称条；同一个名字重复触发时不重渲染 */
  const showCaption = (text: string) =>
    setCaption((current) => (current.on && current.text === text ? current : { text, on: true }))

  const hideCaption = () =>
    setCaption((current) => (current.on ? { text: current.text, on: false } : current))

  return (
    <div className="sb-ring" data-ring-level="1" onMouseLeave={hideCaption}>
      <div
        className="radial"
        role="group"
        aria-roledescription="环形菜单"
        aria-label={ariaLabel}
        style={{
          ['--na' as string]: `${round1(needle)}deg`,
        }}
      >
        <i className="hub-ripple" key={rippleKey} ref={rippleRef} aria-hidden="true" />

        {/* 门：表盘（刻度弧 + 罗盘 + 指针）= 打开命令面板（见文件头 ②）。
            ⚠️ 门里**不放文字**（见文件头 ④）：可访问名由 aria-label 给，
               视觉上的"可以进去"由 :hover 的表盘反馈与 title 承担。 */}
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
          <span className="hub-door__clip" aria-hidden="true" />
        </button>

        {items.map((item, i) => {
          const angle = START + step * i
          const isCurrent = i === activeIndex
          return (
            <button
              key={item.key}
              type="button"
              className="radial__item flex items-center justify-center"
              style={{
                ['--a' as string]: `${round1(angle)}deg`,
                ['--i' as string]: String(i),
              }}
              data-current={isCurrent}
              aria-current={isCurrent}
              aria-label={item.label}
              /* ⚠️ 这里**不写 `title`**：原生 tooltip 会和下面的名称条同时冒出来
                 （两个框、同一句话、位置还不一样）。可访问名归 `aria-label`，
                 视觉提示归名称条 —— 与收起态图标列同一条判据。 */
              onMouseEnter={() => showCaption(item.label)}
              onMouseLeave={hideCaption}
              /* 键盘路径与指针同待遇：Tab 到哪一格，名称条就说哪一格。
                 ⚠️ 用 `focus`/`blur` 而不是 `focus-visible`：后者在点击时也常常成立，
                    会把名称条在鼠标路径上又点亮一次。 */
              onFocus={() => showCaption(item.label)}
              onBlur={hideCaption}
              onClick={() => {
                if (isCurrent) return
                setRippleKey((k) => k + 1)
                onSelect(item.key)
              }}
            >
              <Icon name={item.icon} className={cn('h-[17px] w-[17px]')} />
            </button>
          )
        })}
      </div>

      {/* 名称条：位置固定在圆盘正下方（见文件头 ④）。aria-hidden 是刻意的 ——
          每一格瓦片自己带 aria-label，这一条对读屏是重复的。 */}
      <div className={cn('radial-caption', caption.on && 'is-on')} aria-hidden="true">
        {caption.text}
      </div>
    </div>
  )
}
