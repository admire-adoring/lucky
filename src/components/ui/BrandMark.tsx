import { cn } from '../../lib/cn'

/**
 * 品牌标记（原型三个页面共用同一枚 32×32 徽标）。
 *
 * ⚠️ **尺寸由调用方给**：这里只有 `shrink-0`，没有 `h-*` / `w-*`。
 *    不传尺寸时，SVG 在一个 flex 容器里会撑满可用空间 ——
 *    实测过 1392×1392（整块 Hero 被一个巨大的圆盖住），而且**不报错**。
 *    刻意**不**在这里补一个默认尺寸：`cn()` 只做字符串拼接、不做冲突消解，
 *    默认值与调用方传的值会同时出现在 class 上，谁赢取决于 CSS 里的产出顺序 ——
 *    那是个比"忘传尺寸"更难查的问题。所有调用点都显式给尺寸：
 *      `className="h-7 w-7"` / `"h-[38px] w-[38px] rounded-[11px]"` …
 *
 * ⚠️ **2026-09-25 纯色化**：底座原本是一条 `<linearGradient>`（#6366f1 → #7c3aed），
 *    现在是一块实色 `--brand-solid`（与侧栏 logo / 头像同源，见 design-tokens.css）。
 *
 * ⚠️ 实色走 `style` 而**不是** `fill="var(--brand-solid)"`：SVG 的**表现属性**里
 *    用 `var()` 各引擎支持不一致（Safari 上历来不认）。而这一步静默失败的后果很具体 ——
 *    `fill` 落回初始值 `black`，徽标变成一块黑圆，页面不报任何错。
 *    走 `style` 就是普通的 CSS 声明，`var()` 的解析与其他地方完全一致。 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('shrink-0', className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" style={{ fill: 'var(--brand-solid)' }} />
      <path d="M16 7.5A8.5 8.5 0 0 1 23.36 20.25" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M23.36 20.25A8.5 8.5 0 0 1 8.64 20.25" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".6" />
      <path d="M8.64 20.25A8.5 8.5 0 0 1 16 7.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".32" />
      <circle cx="16" cy="16" r="2.3" fill="#fff" />
    </svg>
  )
}
