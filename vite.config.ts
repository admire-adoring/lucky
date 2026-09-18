import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import process from 'node:process'

// TAURI_DEV_HOST 由 Tauri CLI 注入（`tauri dev` / 移动端调试时才有值）
const host = process.env.TAURI_DEV_HOST

// 打包产物落在本工程内的 dist/（Vite 默认位置，无需指定 outDir）
// base 用相对路径，配合 HashRouter，产物既能被静态服务器托管，也能直接 file:// 打开，
// 还能被 Tauri 的 tauri:// 协议从归档里直接取。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  server: {
    // 1420 是 Tauri 官方约定的固定端口（避开 Vite 默认的 5173，防止与其他前端工程抢端口）
    port: 1420,
    // strictPort：端口被占直接失败，而不是悄悄换一个——否则 Tauri 会在错误的地址上等界面
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      // src-tauri（Tauri 外壳）由 cargo 自己监听，避免改 Rust 时 Vite 也重启一遍
      ignored: ['**/src-tauri/**'],
    },
  },
  // 让 cargo 的日志不被 Vite 清屏冲掉
  clearScreen: false,
})
