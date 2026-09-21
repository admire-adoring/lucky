/**
 * 极光底衬 —— 三团弥散色块。
 *
 * 9 个原型的 `.aurora-bg` + `.blob-1/2/3` 逐字一致，这里只渲染一次。
 *
 * 三团的颜色来自 `--mw-m1/--mw-m2/--mw-m3`（= 当前模块那一组的 `--a-<模块>-1/2/3`），
 * 所以**换模块 = 换整页色调**，不需要 React 传任何颜色进来。
 *
 * ⚠️ 结构不能合并：`.blob` 自己带 `filter: blur()` 与 `animation: mw-drift`，
 *    而 `.aurora-bg` 负责定位与裁剪（`position:fixed; inset:0; overflow:hidden`）。
 *    把两者合并到一层，blur 会把裁剪边界一起糊掉，色团会溢出到视口外缘。
 */
export function AuroraBackdrop() {
  return (
    <div className="aurora-bg" aria-hidden="true">
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
    </div>
  )
}
