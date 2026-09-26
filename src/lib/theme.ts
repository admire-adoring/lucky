/**
 * 主题 —— 写在 `<html>` 上的属性。
 *
 * 为什么是属性、而不是一堆 CSS 变量：
 *   · `data-theme` 只切「亮/暗」两套令牌。prism.css 里 `:root` 是**暗色缺省**、
 *     `html[data-theme='light']` 是亮色覆盖，所以它必须是**显式**写出的，
 *     不能靠"不写就是默认"——不写会落到暗色，而本应用的默认是亮色。
 *
 * ⚠️ 这里曾经还有第二套正交维度：`data-glass` 选玻璃档位（quiet / standard / strong），
 *   三档 × 两主题 = 六种组合。**2026-09-25 纯色化把材质换成实色后，"档位"没有可调的东西了**
 *   （α / 模糊 / 饱和度三支旋钮全部不存在），`prism.css` §2b 那一整块已删。
 *   于是 `data-glass` 属性、`GlassPreset` 类型、`applyGlass()`、`DEFAULT_GLASS`、
 *   `normalizeGlassPreset()` 一起删掉 —— 它们会往 `<html>` 上写一个**没有任何 CSS 读**的属性，
 *   属于"看着还在工作"的死代码。
 *   ⚠️ 副作用一处：`design/debug/shot-app.mjs --glass <档>` 从此不产生任何差异
 *   （脚本仍然会写那个属性，只是没人读）。要出图时别拿"两张图字节数一样"当异常。
 *
 * 为什么在**渲染之前**写（见 main.tsx）而不是走 React 状态：
 *   主题影响整页的颜色。走 React 会先渲染一帧亮色再跳到暗色，肉眼可见地闪一下 ——
 *   和窗口圆角是同一类问题（首帧必须就位）。React 侧只订阅"当前是什么"，不负责首帧。
 */

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'lucky-y/theme'
export const DEFAULT_THEME: Theme = 'light'

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

/**
 * 读取已保存的主题。
 *
 * ⚠️ localStorage 在隐私模式 / 被禁用时会**直接抛异常**（不是返回 null），
 * 而这里运行在首帧之前 —— 抛出去就是整页白屏。所以读写都要兜住。
 * 读不到就回默认值，这是"首屏可渲染"优先于"记住偏好"的一处刻意取舍。
 */
export function readStoredTheme(): Theme {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(raw) ? raw : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/** 写入偏好；失败只影响"下次记住"，不影响本次渲染，所以静默吞掉。 */
function writeStoredTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* 忽略：隐私模式下不持久化，但本次会话仍然生效 */
  }
}

/** 把主题落到 `<html>` 上（CSS 的唯一入口）。 */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

/** 首帧前调用一次：读出偏好并写到 `<html>`，返回当前主题供 store 初始化。 */
export function bootstrapTheme(): Theme {
  const theme = readStoredTheme()
  applyTheme(theme)
  return theme
}

/** 之后每次切换都调它：写 `<html>` + 持久化，两件事绑在一起，不会只做一半。 */
export function persistTheme(theme: Theme): void {
  applyTheme(theme)
  writeStoredTheme(theme)
}
