/**
 * 工作台磁贴的类串常量 —— 逐字对齐设计原型（`design/gen-modules.mjs` 的 §3 片段生成器）。
 *
 * 为什么抽成常量而不是在各组件里重写：
 *   磁贴与行是**同一套骨架的两种排布**，`HEAD_CHIP` 这类东西一旦在四处各写一遍，
 *   改一处就会漏三处 —— 而漏掉的那三处不会报错，只会"看着有点不一样"。
 *
 * ⚠️ 材质用 `wb-card`（模块工作区的卡片材质），**不再是** Prism 的 `.g` + `.g3`：
 *    磁贴的样式应当与「各工作区里的卡片」一致。`wb-card` 由
 *    `design/build-workspace-css.mjs` 从原型的 `.card` 规则反解出来（去掉它的
 *    内边距与过渡，见那边 §5b），所以 20px 圆角 / 白玻璃 / 卡片投影都跟着原型走，
 *    这里不写任何材质数值。
 *    ⚠️ 顺带的后果：磁贴不再吃 Prism 的 `--m-lt-*` 色团，因此**不再带当前模块的淡染色**
 *       —— 原型的卡片本来就是中性白玻璃，模块色只在底衬与强调色上出现。
 *    ⚠️ **悬停位移也交给 `wb-card`**（原型 `.card:hover` = 投影加深 + 上浮 2px）。
 *       这里不要再写 `hover:-translate-y-0.5`：那个值恰好也是 2px，两边都留会叠成 4px。
 */

/** 磁贴（KPI）：模块工作区的卡片材质（含它的悬停态） */
export const TILE_CLASS =
  'wb-card relative flex flex-col overflow-hidden p-5 transition-all duration-[220ms] ease-out'

/** 列表卡：同一份材质，但内边距交给行自己（行要通铺到边） */
export const LIST_CLASS =
  'wb-card relative flex flex-col overflow-hidden transition-all duration-[220ms] ease-out'

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
