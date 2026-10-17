/**
 * 宿主判定。`__TAURI_INTERNALS__` 是 Tauri v2 注入的全局，比嗅探 userAgent 或端口号都可靠
 * ——与 `lib/desktop-window.ts` 同一条判据，那边判"窗口能力能不能调"，这边判"数据从哪来"。
 *
 * 浏览器（`vite dev` / `dist` 预览）里没有它 ⇒ `api/*.ts` 回落演示数据，
 * 界面能整页走通；Tauri 窗口里走的始终是真实库。
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
