import { Icon } from '../icons/Icon'
import type { WorkbenchModule } from '../../types/workbench'

/**
 * 环的几何常量 —— 与生成器 `gen-modules.mjs` 的 `RING` 逐字一致。
 *
 * ⚠️ 这五个数**彼此牵制**，改任何一个都要重新量：
 *     r   92   瓦片中心的半径
 *     rl  130  标签半径 —— 必须比 r 更外一圈，否则 40° 间隔下标签会撞到邻座瓦片
 *     step 40  九项铺满 360°
 *     dial 82  表盘直径（要能塞进 r − item/2 = 70 的内圈里）
 *     所以它们**不是令牌**（没有跨页面复用的含义），是这一屏的一次性空间关系。
 */
const RING = { r: 92, rl: 130, step: 40, start: -90, item: 44, dial: 82, mark: 1.12 }

const r1 = (v: number) => Math.round(v * 10) / 10

/** 第 i 项的**固定**角度（12 点起顺时针）。不随当前项变化 —— 地图不动，只有指针转 */
export const ringAngle = (i: number) => RING.start + RING.step * i

/** 标签相对瓦片中心的偏移：沿同一方向再外推 rl − r */
function ringLabelOffset(angle: number) {
  const rad = (angle * Math.PI) / 180
  return { lx: r1((RING.rl - RING.r) * Math.cos(rad)), ly: r1((RING.rl - RING.r) * Math.sin(rad)) }
}

/* ---------- 罗盘（表盘内的八芒星 + 花瓣花环）---------- */

const PV = (deg: number, R: number): [number, number] => {
  const t = ((deg - 90) * Math.PI) / 180
  return [r1(50 + R * Math.cos(t)), r1(50 + R * Math.sin(t))]
}

/** 花瓣：根部 r0、尖在 r1，两侧各一段二次贝塞尔；胖瘦由 half 决定，不是靠拖曲线 */
const PETAL = { n: 12, r0: 33, r1: 45, half: 7.5, rm: 39 }

const PETAL_PATH = (() => {
  const [x0, y0] = PV(0, PETAL.r0)
  const [x1, y1] = PV(0, PETAL.r1)
  const [lx, ly] = PV(-PETAL.half, PETAL.rm)
  const [rx, ry] = PV(PETAL.half, PETAL.rm)
  return `M${x0} ${y0} Q${lx} ${ly} ${x1} ${y1} Q${rx} ${ry} ${x0} ${y0} Z`
})()

/** 一根星芒。主针 len 24、副针 21、对角 12 —— 罗盘玫瑰本来就有主次，等长会读成"风向标"。
 *  旋转写在 `transform` 属性上，不进 `d` —— 与生成器一致。 */
const spikePath = (len: number, half: number) => `M50 50 L${50 - half} 50 L50 ${50 - len} L${50 + half} 50 Z`

function Compass() {
  const spikes: Array<{ len: number; half: number; rot: number; main: boolean }> = [
    { len: 24, half: 3.6, rot: 0, main: true },
    ...[90, 180, 270].map((rot) => ({ len: 21, half: 3.2, rot, main: false })),
    ...[45, 135, 225, 315].map((rot) => ({ len: 12, half: 2.4, rot, main: false })),
  ]
  return (
    <svg className="hub-compass" viewBox="0 0 100 100" aria-hidden="true">
      <g className="hub-compass__petals">
        {Array.from({ length: PETAL.n }, (_, k) => (
          <path key={k} d={PETAL_PATH} transform={`rotate(${r1((360 / PETAL.n) * k)} 50 50)`} />
        ))}
      </g>
      <g className="hub-compass__star">
        {spikes.map((s, i) => (
          <path
            key={i}
            className={s.main ? 'is-main' : undefined}
            d={spikePath(s.len, s.half)}
            transform={`rotate(${s.rot} 50 50)`}
          />
        ))}
      </g>
    </svg>
  )
}

/* ---------- 环 ---------- */

interface ModuleRingProps {
  modules: WorkbenchModule[]
  /** 当前模块的 key */
  current: string
  onSelect: (key: string) => void
  /** 「进门」：进入当前模块的主页面。**跳不跳得成由调用方决定** ——
   *  路由存在于 `docs/模块设计.md`，但代码里未必已经实现，
   *  所以这里只上报意图，不自己 navigate。 */
  onEnter: (module: WorkbenchModule) => void
}

/**
 * 模块径向菜单 —— 九个模块**全部**在环上，指针指向当前项，表盘 + 中心名合成"进门"按钮。
 *
 * 三处分工，互不重复（这是它能成立的关键）：
 *   环上被标记的那一格 —— 我是谁 ｜ 指针 —— 我在哪 ｜ 中心名 —— 叫什么
 *
 * ⚠️ `data-accent` 挂在**最外层**（由页面写在 section 上），环本身**不挂**。
 *    因为 `[data-accent]` 的默认规则会把强调色写回品牌紫，环上再挂一份就会盖掉继承来的域色。
 *    这里只消费 `--s`（由上层 [data-series] 提供的模块色槽）。
 */
export function ModuleRing({ modules, current, onSelect, onEnter }: ModuleRingProps) {
  const active = modules.find((m) => m.key === current) ?? modules[0]
  /* 指针角度 = 当前项在环上的角度。生成器里也是"累加"的（见 @property --na 的注释），
     差值小于半圈就顺时针走近路，否则逆时针 —— 否则从"设置"切回"工作台"会绕一整圈。 */
  const activeIndex = modules.findIndex((m) => m.key === active.key)
  const pointerAngle = ringAngle(activeIndex < 0 ? 0 : activeIndex)

  return (
    <div
      className="radial"
      role="group"
      aria-roledescription="环形菜单"
      aria-label="模块切换"
      style={{ ['--na' as string]: `${pointerAngle}deg` }}
    >
      <span className="hub-aura" aria-hidden="true" />
      <i className="hub-ripple" aria-hidden="true" />

      {/* 门：表盘 + 中心名 = 进入当前模块的主页面。
          self 态（工作台）保留按钮但置灰 —— 藏了它 Hero 会时而高矮变化。 */}
      <button
        type="button"
        className="hub-door"
        disabled={active.enter.self}
        onClick={() => {
          if (!active.enter.self) onEnter(active)
        }}
        title={`目标：${active.enter.path}`}
        aria-label={`${active.enter.text}（${active.enter.path}）`}
      >
        <span className="hub-dial" aria-hidden="true">
          <i className="hub-arc" />
          <Compass />
          <i className="hub-pin" />
        </span>
        <span className="hub-name text-13 font-bold leading-none tracking-[-0.01em] text-ink-900" aria-hidden="true">
          <i className="hub-name__pad" />
          <span>{active.label}</span>
          <Icon name="i-arrow-right" className="hub-name__go h-3 w-3" />
        </span>
        <span className="hub-door__clip" aria-hidden="true" />
      </button>

      {modules.map((m, i) => {
        const angle = ringAngle(i)
        const { lx, ly } = ringLabelOffset(angle)
        const isCurrent = m.key === current
        return (
          <button
            key={m.key}
            type="button"
            /* `mod-tile` 提供"本模块的颜色"（薄染 + 域色发丝 + 域色文字），
               所以九个入口不选中也认得出是哪个模块 */
            className="radial__item g g1 mod-tile flex items-center justify-center transition-colors duration-150"
            style={{
              ['--a' as string]: `${angle}deg`,
              ['--lx' as string]: `${lx}px`,
              ['--ly' as string]: `${ly}px`,
              ['--i' as string]: String(i),
            }}
            data-module={m.key}
            data-current={isCurrent}
            aria-current={isCurrent}
            aria-label={`切换到${m.label}`}
            onClick={() => onSelect(m.key)}
          >
            <span className="radial__label text-11 font-medium text-ink-400">{m.label}</span>
            <Icon name={m.icon} className="h-[22px] w-[22px]" />
          </button>
        )
      })}
    </div>
  )
}

/** 环下方的摘要行。位置指示已经有两处（中心名 + 顶栏面包屑），所以这行只讲数据 */
export function ModuleSummary({ summary }: { summary: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2">
      <span className="text-11-5 font-medium text-ink-400" aria-live="polite">
        {summary}
      </span>
    </div>
  )
}
