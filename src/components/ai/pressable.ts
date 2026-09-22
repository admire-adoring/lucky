import type { KeyboardEvent, MouseEvent } from 'react'

/**
 * 把原型里的"可点的 div / span"变成可访问的。
 *
 * ============================================================================
 * 为什么需要它
 * ============================================================================
 * 原型是静态页：`.session-item`、`.tool-chip`、`.ai-suggestion-item`、`.tc-open-panel`
 * 这些都是 `<div>` / `<span>` 加脚本挂的 click，键盘按不到、读屏也读不出。
 * 移植时**不能改成 `<button>` 了事** —— 那几个类名的样式（`display` / `padding` /
 * `border` / 字体继承）都是按 div 写的，换成 button 会带进浏览器默认外观，
 * 而生成的 CSS 是忠实照搬原型的、没有 reset 它们。
 *
 * 所以：**标签保持原型原样，补上 role / tabIndex / 键盘**。
 * ⚠️ `role="button"` 必须配键盘处理 —— 只加 role 是"读屏说有按钮、键盘按不动"，
 *    比不加更糟（那是明确的可访问性 bug）。所以两者写在同一处，不许拆开用。
 *
 * @param onClick 回调。**需要拿到事件**（例如要读被点元素的矩形去定位浮层）就声明参数，
 *                不需要的直接写 `() => …` 也能用。
 * @param stop    是否 `stopPropagation()` —— 嵌在另一个可点区域里的按钮要传 `true`
 *                （例如会话项里那颗「⋯」在整行可点的区域内部，两个动作不能一起触发）
 */
export function pressable(
  onClick: (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => void,
  stop = false,
) {
  const fire = (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    if (stop) event.stopPropagation()
    onClick(event)
  }
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: (event: MouseEvent<HTMLElement>) => fire(event),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        fire(event)
      }
    },
  }
}
