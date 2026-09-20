import { Icon } from '../icons/Icon'
import { useThemeStore } from '../../stores/theme-store'

/**
 * 主题切换（顶栏）。
 *
 * 图标显示的是**将要切到的那一边**，不是当前那一边：
 * 亮色下显示月亮（点了变暗），暗色下显示太阳。这与"按钮写着结果"一致 ——
 * 显示当前状态会让人以为它是状态指示而不是开关。
 *
 * ⚠️ 生产判定必须在 JS 侧，不能只用 CSS 显示/隐藏两个图标：
 *    暗色是 **`data-theme` 缺省**（prism.css 的 `:root`），没有属性也是暗色。
 *    如果 CSS 写成 `[data-theme='dark']` 来藏图标，那"没有属性"时两个图标都会露出来。
 *    这里直接用 store 的真实值判断，不存在这个盲区。
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)
  const toDark = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={toDark ? '切换到暗色主题' : '切换到亮色主题'}
      title={toDark ? '切换到暗色主题' : '切换到亮色主题'}
      className={
        className ??
        'inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-sm border border-transparent text-ink-500 transition-all duration-150 ease-out hover:bg-ink-50 hover:text-ink-900'
      }
    >
      <Icon name={toDark ? 'i-moon' : 'i-sun'} className="h-[17.5px] w-[17.5px]" />
    </button>
  )
}
