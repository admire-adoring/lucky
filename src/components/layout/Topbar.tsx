import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { DRAG_REGION, PLATFORM } from '../../lib/desktop-window'
import { useUiStore } from '../../stores/ui-store'
import { IconButton } from '../ui/IconButton'
import { WindowControls } from './WindowControls'

/**
 * 顶栏 = 应用的操作栏 + 桌面窗口的标题栏。
 *
 * 原生标题栏关掉之后（`tauri.conf.json` 的 `decorations: false`），
 * 这条 60px 的横带同时承担两件事：应用自己的操作区（搜索 / 通知 / 账户）与窗口控制。
 * 这也意味着它**必须有真拖拽区**，否则窗口在桌面端根本推不动。
 *
 * 拖拽区只需要一处：`DRAG_REGION` 用的是 `deep` 档（认整棵子树），
 * 写在 <header> 上即可 —— 空白、文字、图标都能拖，
 * 而搜索框与按钮因为是"可点元素"，Tauri 会主动阻断，不必逐个排除。
 * 双击标题栏的缩放行为也由 Tauri 内置脚本接管，这里不重复实现。
 *
 * 窗口控制按平台分两侧放：
 *  - macOS 圆点在**侧栏品牌行**（窗口左上角才是原生位置），这里只补窄断点下的一份 ——
 *    ≤860px 时侧栏被收成抽屉、整组会跟着移出画面，不补就是"窗口关不掉"。
 *  - Windows / Linux 在右上角，且**贴齐窗口右边**（原生 caption 区就是顶到边的），
 *    所以非 macOS 时这条横带不收右内边距。
 *
 * 顶栏与内容的关系：顶栏是**实色**的（`bg-surface`）——内容从下面滚过去时被它盖住，
 * 不再靠 blur 把滚动内容糊开（纯色化把 backdrop-filter 去掉了）。
 * 厚度档与侧栏保持一致（都是 bg-surface），否则两块相邻的外壳会在交界处出现一道可辨的深浅差。
 */
export function Topbar({
  leading,
  search,
  actions,
}: {
  /** 顶栏最左的内容。不传时是默认的「打开导航」按钮（有侧栏的页面用）；
   *  工作台没有侧栏，改传品牌 + 面包屑 —— 复用同一条顶栏，不另起一套。 */
  leading?: ReactNode
  search?: ReactNode
  actions: ReactNode
}) {
  const openSidebar = useUiStore((state) => state.openSidebar)
  const isMac = PLATFORM === 'macos'

  return (
    <header
      {...DRAG_REGION}
      className={cn(
        'glass-bar z-20 flex h-[60px] shrink-0 items-center gap-4 border-b border-line pl-6 max-[1024px]:pl-4',
        // Windows / Linux：右内边距归零，让关闭键贴到窗口边（原生 caption 区如此）
        isMac ? 'pr-6 max-[1024px]:pr-4' : 'pr-0',
        'bg-surface',
        // ⚠️ 这里原本还有一条"贴顶上沿提亮"的白色渐变
        // （`bg-[linear-gradient(180deg,rgba(255,255,255,.1),transparent)]`），
        // 当时的作用是补玻璃的上沿高光（原注释："只留一点点上沿提亮，材质厚度交给
        // glass-bar 的 ::after 高光去交代"）。两条都随玻璃删掉了 ——
        // 实底上这道 10% 的白只在顶栏顶部 60px 内做出一层看不见的灰。
        // 窗口右上角归它。左上角只在 ≤860px 归它 —— 那时侧栏收成抽屉不占位，
        // 窗口左上角才是顶栏的左上角；≥861px 时那半个角属于侧栏，这里必须保持直角，
        // 否则两块的交界会露出一道缺角。
        'shell-frame-top-right shell-frame-top-left',
      )}
    >
      {/* macOS 窄断点的兜底：侧栏成抽屉后，圆点必须在顶栏重新出现一次。
          放在最前，位置仍在窗口左上角，与原生一致。
          ⚠️ 传了 `leading` 就不再兜底 —— 那时窗口控制由调用方自己摆在 leading 里
          （工作台没有侧栏，圆点在任何宽度下都归顶栏），这里再补一份就是两个。 */}
      {isMac && !leading ? <WindowControls className="hidden max-[860px]:flex" /> : null}
      {leading ?? <IconButton icon="i-hamburger" label="打开导航" variant="outline" onClick={openSidebar} />}
      {search}
      <div className="flex-1 self-stretch" />
      {actions}
      {isMac ? null : <WindowControls />}
    </header>
  )
}
