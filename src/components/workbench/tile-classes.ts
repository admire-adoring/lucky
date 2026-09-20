/**
 * 工作台磁贴的类串常量 —— 逐字对齐设计原型（`design/gen-modules.mjs` 的 §3 片段生成器）。
 *
 * 为什么抽成常量而不是在各组件里重写：
 *   磁贴与行是**同一套骨架的两种排布**，`HEAD_CHIP` 这类东西一旦在四处各写一遍，
 *   改一处就会漏三处 —— 而漏掉的那三处不会报错，只会"看着有点不一样"。
 *
 * ⚠️ 材质用的是 Prism 的 `.g` + `.g3` / `.g1`（而不是旧的 `glass-*` 工具类）：
 *    规范要求材质本体与档位**必须成对出现**，档位是"一次选型"
 *    （α + 模糊 + 饱和度 + 投影绑在一起），工具类表达不了。
 */

/** 磁贴（KPI）：抬升一档的玻璃 + 悬停微抬 */
export const TILE_CLASS =
  'g g3 g--refr relative flex flex-col overflow-hidden rounded-xl border border-line p-5 transition-all duration-[220ms] ease-out hover:-translate-y-0.5'

/** 列表卡：同一档材质，但内边距交给行自己（行要通铺到边） */
export const LIST_CLASS =
  'g g3 g--refr relative flex flex-col overflow-hidden rounded-xl border border-line transition-all duration-[220ms] ease-out hover:-translate-y-0.5'

/** 标题左侧的图标底托 */
export const HEAD_CHIP = 'g g1 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-line text-ink-500'

/** 「更多操作」：常态无边框、悬停才出现底色 —— 它是"次要动作"，不该常驻视觉 */
export const MORE_BUTTON =
  'inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-sm border border-transparent text-ink-300 transition-colors duration-150 hover:bg-ink-50 hover:text-ink-700'

/** 行尾箭头：整行是链接，箭头在悬停时右移一点点 */
export const ROW_ARROW = 'icon h-[13px] w-[13px] shrink-0 text-ink-300 transition-transform duration-150 group-hover:translate-x-0.5'

/** 列表行：通铺 + 末行不画分隔线（否则卡片底边会多一条） */
export const ROW_BASE =
  'group flex items-center gap-3 border-b border-line px-5 py-3.5 transition-colors duration-150 last:border-b-0 hover:bg-ink-50'
