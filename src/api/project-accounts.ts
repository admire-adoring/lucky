import { invoke } from '@tauri-apps/api/core'
import { call } from './error'
import type { AccountItem } from '../data/derive'

/**
 * 项目账户（凭据）。**元信息在库、明文在本机钥匙串** —— 库文件里没有任何密码。
 *
 * 一条映射上的取舍：`AccountItem.secret` 这个字段在真实数据里永远是空串，
 * 因为明文不在库里。要看/复制密码得走 `fetchAccountSecret`（异步、可能要系统授权）。
 * 组件里凡是读到 `acc.secret` 的地方都要先问 `hasSecret`。
 */
export interface ProjectAccount {
  id: string
  projectId: string
  platform: string
  account: string
  kind: 'password' | 'key'
  env: 'prod' | 'test' | 'dev'
  note: string
  cycleDays: number
  /** 上次轮换（YYYY-MM-DD） */
  rotatedAt: string
  rotatedBy: string | null
  rotatedByName: string
  /** 钥匙串里有没有这份密码 */
  hasSecret: boolean
  disabled: boolean
  sortOrder: number
  updatedAt: string
}

export interface ProjectAccountInput {
  platform: string
  account: string
  kind: 'password' | 'key'
  env: 'prod' | 'test' | 'dev'
  note: string
  cycleDays: number
  rotatedAt: string
  rotatedBy?: string | null
  disabled: boolean
  /** 三态：不给 = 不动，'' = 清空，有值 = 覆盖 */
  secret?: string
}

export const accountKeys = {
  all: ['projectAccounts'] as const,
  list: (projectId: string) => [...accountKeys.all, projectId] as const,
}

const DAY_MS = 86_400_000

/** `2026-10-18` → 距今几天（负数 = 过去）。按本地零点算，跨时区不会差一天。 */
function daysSince(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return 0
  const then = new Date(y, m - 1, d).getTime()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - then) / DAY_MS)
}

/**
 * 后端行 → 组件用的 `AccountItem`（形状与演示池一致，组件里一行不用改）。
 *
 * `dueDays` 在这里算：`cycle_days - 距今`。存在库里会漂（改了周期、到期日没跟着变）。
 */
export function toAccountItem(raw: ProjectAccount): AccountItem {
  const rotatedDays = Math.max(0, daysSince(raw.rotatedAt))
  return {
    id: raw.id,
    platform: raw.platform,
    user: raw.account,
    type: raw.kind,
    env: raw.env,
    note: raw.note || undefined,
    cycle: raw.cycleDays,
    rotatedDays,
    rotatedBy: raw.rotatedByName,
    dueDays: raw.cycleDays - rotatedDays,
    /* 明文不在库里 —— 空串是"取不到"，不是"密码是空的"（见文件头） */
    secret: '',
    disabled: raw.disabled,
  }
}

export interface RawAccount extends ProjectAccount {}

export function listProjectAccounts(projectId: string): Promise<ProjectAccount[]> {
  return call(() => invoke<ProjectAccount[]>('account_list', { projectId }))
}

export function createProjectAccount(projectId: string, input: ProjectAccountInput): Promise<ProjectAccount> {
  return call(() => invoke<ProjectAccount>('account_create', { projectId, input }))
}

export function updateProjectAccount(id: string, input: ProjectAccountInput): Promise<ProjectAccount> {
  return call(() => invoke<ProjectAccount>('account_update', { id, input }))
}

export function deleteProjectAccount(id: string): Promise<void> {
  return call(() => invoke('account_delete', { id }))
}

/** 读明文（本机钥匙串）。没存密码会 reject 并说明原因。 */
export function fetchAccountSecret(id: string): Promise<string> {
  return call(() => invoke<string>('account_secret', { id }))
}
