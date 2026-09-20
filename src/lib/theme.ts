/**
 * 主题与玻璃档位 —— 写在 `<html>` 上的两个属性。
 *
 * 为什么是两个属性、而不是一堆 CSS 变量：
 *   · `data-theme` 只切「亮/暗」两套令牌。prism.css 里 `:root` 是**暗色缺省**、
 *     `html[data-theme='light']` 是亮色覆盖，所以它必须是**显式**写出的，
 *     不能靠"不写就是默认"——不写会落到暗色，而本应用的默认是亮色。
 *   · `data-glass` 选玻璃档位（quiet / standard / strong），见 prism.css §2b。
 *     它和主题正交：三档 × 两主题 = 六种组合，每一种都过了对比度门禁。
 *
 * 为什么在**渲染之前**写（见 main.tsx）而不是走 React 状态：
 *   主题影响整页的颜色。走 React 会先渲染一帧亮色再跳到暗色，肉眼可见地闪一下 ——
 *   和窗口圆角是同一类问题（首帧必须就位）。React 侧只订阅"当前是什么"，不负责首帧。
 */

export type Theme = 'light' | 'dark'

/** 玻璃档位：安静 / 标准 / 通透。默认通透 —— 原型与验收基线都取这一档。 */
export type GlassPreset = 'quiet' | 'standard' | 'strong'

export const THEME_STORAGE_KEY = 'lucky-y/theme'
export const DEFAULT_THEME: Theme = 'light'
export const DEFAULT_GLASS: GlassPreset = 'strong'

const GLASS_PRESETS: readonly GlassPreset[] = ['quiet', 'standard', 'strong']

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

function isGlassPreset(value: unknown): value is GlassPreset {
  return GLASS_PRESETS.includes(value as GlassPreset)
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

/** 把玻璃档位落到 `<html>` 上。 */
export function applyGlass(glass: GlassPreset): void {
  document.documentElement.dataset.glass = glass
}

/** 首帧前调用一次：读出偏好并写到 `<html>`，返回当前主题供 store 初始化。 */
export function bootstrapTheme(): Theme {
  const theme = readStoredTheme()
  applyTheme(theme)
  applyGlass(DEFAULT_GLASS)
  return theme
}

/** 之后每次切换都调它：写 `<html>` + 持久化，两件事绑在一起，不会只做一半。 */
export function persistTheme(theme: Theme): void {
  applyTheme(theme)
  writeStoredTheme(theme)
}

/** 供设置页/调试用：校验一个外部传入的档位是否合法。 */
export function normalizeGlassPreset(value: unknown): GlassPreset {
  return isGlassPreset(value) ? value : DEFAULT_GLASS
}
