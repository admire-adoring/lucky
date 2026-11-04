import { invoke } from '@tauri-apps/api/core'
import { call } from './error'

/**
 * 成员名单 + 本机数据。单机应用没有"登录账户"—— 这一页回答两件事：
 * 我是谁（名字会出现在所有负责人 / 作者位上）、库和文档落在哪。
 */

export interface UserRefs {
  projects: number
  tasks: number
  docs: number
  activities: number
}

export interface User {
  id: string
  code: string
  displayName: string
  createdAt: string
  isMe: boolean
  refs: UserRefs
}

export interface UserInput {
  id?: string
  code?: string
  displayName: string
}

export interface AppInfo {
  dbPath: string
  documentsRoot: string
  projects: number
  tasks: number
  docs: number
  users: number
}

export const userKeys = {
  all: ['users'] as const,
  list: () => [...userKeys.all, 'list'] as const,
}

export const appKeys = {
  all: ['app'] as const,
  info: () => [...appKeys.all, 'info'] as const,
}

export function listUsers(): Promise<User[]> {
  return call(() => invoke<User[]>('user_list'))
}

export function saveUser(input: UserInput): Promise<User> {
  return call(() => invoke<User>('user_save', { input }))
}

export function deleteUser(id: string): Promise<void> {
  return call(() => invoke<void>('user_delete', { id }))
}

export function fetchAppInfo(): Promise<AppInfo> {
  return call(() => invoke<AppInfo>('app_info'))
}
