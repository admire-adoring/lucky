import { invoke } from '@tauri-apps/api/core'
import { call } from './error'

/* ============================================================================
   本机文件系统 · 前端绑定
   ----------------------------------------------------------------------------
   对面是 `src-tauri/src/server/localfs.rs`：真读磁盘，不存清单。

   部署页只有两条路要用它：填一个绝对路径看它在不在（`statLocal`），
   以及在选择器里展开一层目录（`listLocalDir`）。

   `mtime` 是 epoch 毫秒，展示文案由 `data/workspace/deploy.ts` 的 `mtimeText`
   拼 —— 时区与"今天"的边界只在前端判一次。

   这些命令只在 Tauri 窗口里可用；浏览器里 `vite dev` 时 `invoke` 会抛错，
   调用方按错误态处理（不是"文件不存在"）。
   ============================================================================ */

/** 一个路径探测出来的事实。`dir` 为真时 `size` 恒 0。 */
export interface LocalMeta {
  path: string
  name: string
  dir: boolean
  size: number
  /** epoch 毫秒 */
  mtime: number
}

export interface LocalEntry {
  name: string
  dir: boolean
  size: number
  mtime: number
}

export interface LocalDir {
  /** 实际读的那一层（`~` 已展开、软链已跟随） */
  path: string
  entries: LocalEntry[]
  /** 有项读不到时的说明（权限）；空串表示全读到了 */
  note: string
}

export const localFsKeys = {
  all: ['local-fs'] as const,
  home: () => [...localFsKeys.all, 'home'] as const,
  dir: (path: string) => [...localFsKeys.all, 'dir', path] as const,
  probe: (paths: readonly string[]) => [...localFsKeys.all, 'probe', paths.join('\u0000')] as const,
}

/** 本机家目录。为空路径的探测与选择器起点都以它为准。 */
export function fetchLocalHome(): Promise<string> {
  return call(() => invoke<string>('fs_home'))
}

/** 路径不存在回 `null`；权限不足是错（两者用户要做的动作相反）。 */
export function statLocal(path: string): Promise<LocalMeta | null> {
  return call(() => invoke<LocalMeta | null>('fs_stat', { path }))
}

/** 读一层目录。路径指向文件时报错。 */
export function listLocalDir(path: string): Promise<LocalDir> {
  return call(() => invoke<LocalDir>('fs_list', { path }))
}

/** 打开选择器时落在哪一层：目录取自己、文件取所在目录、不存在就往上退。 */
export function dirForLocal(path: string): Promise<string> {
  return call(() => invoke<string>('fs_dir_for', { path }))
}
