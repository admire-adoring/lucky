/**
 * 设置项数据访问层。全部走真实后端。
 */
import { invoke } from '@tauri-apps/api/core'
import { call } from './error'

export interface SettingItem {
  id: string
  category: string
  itemKey: string
  label: string
  value: string
  description: string
  sortOrder: number
  updatedAt: string
}

export interface SettingItemInput {
  category: string
  itemKey: string
  label: string
  value: string
  description: string
}

export const settingKeys = {
  all: ['settings'] as const,
  list: () => [...settingKeys.all, 'list'] as const,
  category: (cat: string) => [...settingKeys.all, 'category', cat] as const,
}

export function fetchSettings(): Promise<SettingItem[]> {
  return call(() => invoke<SettingItem[]>('setting_list'))
}

export function fetchSettingsByCategory(category: string): Promise<SettingItem[]> {
  return call(() => invoke<SettingItem[]>('setting_list_by_category', { category }))
}

export function fetchSettingValue(key: string): Promise<string | null> {
  return call(() => invoke<string | null>('setting_get_value', { key }))
}

export function upsertSetting(input: SettingItemInput): Promise<SettingItem> {
  return call(() => invoke<SettingItem>('setting_upsert', { input }))
}

export function setSettingValue(key: string, value: string): Promise<void> {
  return call(() => invoke<void>('setting_set_value', { key, value }))
}

export function deleteSetting(id: string): Promise<void> {
  return call(() => invoke<void>('setting_delete', { id }))
}
