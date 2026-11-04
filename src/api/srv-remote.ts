import { invoke } from '@tauri-apps/api/core'
import { call } from './error'

/* ============================================================================
   服务器那台机器上的文件与命令 · 前端绑定
   ----------------------------------------------------------------------------
   对面是 `src-tauri/src/server/srv/remote.rs`：走 SSH 真读远端磁盘，
   不是一张常量目录树。

   部署页有四条路要用它：
     · 选择器展开一层目录（`listRemoteDir`）
     · 表单里那条路径在不在（`statRemote`）
     · 打开选择器时该落在哪一层（`dirForRemote`）
     · 上传与启动命令（`runRemote` / `uploadRemote`）

   `mtime` 与 `fs_*` 同一口径：epoch 毫秒，文案交给 `mtimeText`。
   ============================================================================ */

export interface RemoteEntry {
  name: string
  dir: boolean
  size: number
  /** epoch 毫秒 */
  mtime: number
}

export interface RemoteDir {
  path: string
  entries: RemoteEntry[]
  /** 读不全时的说明（权限）；空串表示全读到了 */
  note: string
}

export interface RemoteMeta {
  name: string
  dir: boolean
  size: number
  mtime: number
}

export interface ExecOutcome {
  /** 远端命令的退出码。255 在 ssh 里是"连接层出错"，后端已经换成文字了 */
  code: number
  stdout: string
  stderr: string
  durationMs: number
  /** 这条命令带着输入跑的：远端开了 pty，stderr 已并进 stdout */
  fed: boolean
}

export interface UploadOutcome {
  /** 本机文件的总字节数 */
  bytes: number
  durationMs: number
  /** 远端落地后的字节数；与 `bytes` 不等时后端直接报错 */
  remoteSize: number
  /** 从第几个字节接着传的（0 = 从头传） */
  resumedFrom: number
}

export const remoteFsKeys = {
  all: ['srv-fs'] as const,
  dir: (host: string, path: string) => [...remoteFsKeys.all, 'dir', host, path] as const,
  probe: (host: string, paths: readonly string[]) =>
    [...remoteFsKeys.all, 'probe', host, paths.join('\u0000')] as const,
}

/** 读远端一层目录。目录不存在 / 连不上都是错（不是"空目录"）。 */
export function listRemoteDir(host: string, path: string): Promise<RemoteDir> {
  return call(() => invoke<RemoteDir>('srv_fs_list', { host, path }))
}

/** 路径不存在回 `null`；权限不足、连不上都是错。 */
export function statRemote(host: string, path: string): Promise<RemoteMeta | null> {
  return call(() => invoke<RemoteMeta | null>('srv_fs_stat', { host, path }))
}

/** 选择器起点：目录取自己、文件取所在目录、不存在就往上退。 */
export function dirForRemote(host: string, path: string): Promise<string> {
  return call(() => invoke<string>('srv_fs_dir_for', { host, path }))
}

/**
 * 在远端跑一条命令。`cwd` 为空时在登录目录里跑。
 *
 * `feed` 给交互式命令的输入（`su` 要密码、`read` 要答案）：给了它，
 * 后端会把命令改从 argv 送过去、stdin 留给输入、远端开伪终端 ——
 * 代价是 stderr 并进 stdout（`out.fed` 为真时前端要说明这一点）。
 */
export function runRemote(
  host: string,
  cwd: string,
  command: string,
  feed?: string,
): Promise<ExecOutcome> {
  return call(() => invoke<ExecOutcome>('srv_run', { host, cwd, command, feed: feed ?? null }))
}

/** 本机文件 → 远端路径。断点续传，字节数由后端核对。 */
export function uploadRemote(host: string, localPath: string, remotePath: string): Promise<UploadOutcome> {
  return call(() => invoke<UploadOutcome>('srv_upload', { host, localPath, remotePath }))
}
