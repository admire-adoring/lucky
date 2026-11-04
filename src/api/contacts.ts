import { invoke } from '@tauri-apps/api/core'
import { call } from './error'

/**
 * 联系人（`work_contact`）。三类：客户 / 同事 / 合作方。
 *
 * 页面上的 `Role` 只有"客户 / 团队"两档（筛选是块级的）——
 * `partner`（合作方）归到 `team`，因为这一页没有第三个筛选块，
 * 硬造一个只会让"团队"那一块少人。
 */
export interface Contact {
  id: string
  ownerId: string
  name: string
  org: string
  roleCode: 'customer' | 'colleague' | 'partner'
  title: string
  phone: string | null
  email: string | null
  wechat: string | null
  note: string
  lastTouchAt: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface ContactInput {
  name: string
  org?: string
  roleCode?: string
  title?: string
  phone?: string | null
  email?: string | null
  wechat?: string | null
  note?: string
}

export const contactKeys = {
  all: ['contacts'] as const,
  list: (role?: string | null) => [...contactKeys.all, role ?? 'all'] as const,
}

export function listContacts(roleCode?: string | null): Promise<Contact[]> {
  return call(() => invoke<Contact[]>('contact_list', { roleCode: roleCode ?? null }))
}

export function createContact(input: ContactInput): Promise<Contact> {
  return call(() => invoke<Contact>('contact_create', { input }))
}

export function updateContact(id: string, input: ContactInput): Promise<Contact> {
  return call(() => invoke<Contact>('contact_update', { id, input }))
}

export function deleteContact(id: string): Promise<void> {
  return call(() => invoke('contact_delete', { id }))
}
