/**
 * 日历事件数据访问层。全部走真实后端。
 */
import { invoke } from '@tauri-apps/api/core'
import { call } from './error'

export interface CalendarEvent {
  id: string
  title: string
  detail: string
  startAt: string
  endAt: string
  allDay: boolean
  location: string
  color: string
  scope: string
  projectId: string | null
  ownerId: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CalendarEventInput {
  title: string
  detail: string
  startAt: string
  endAt: string
  allDay: boolean
  location: string
  color: string
  scope: string
  projectId: string | null
  ownerId: string | null
}

export const calendarKeys = {
  all: ['calendar'] as const,
  range: (start: string, end: string) => [...calendarKeys.all, 'range', start, end] as const,
  agenda: (limit: number) => [...calendarKeys.all, 'agenda', limit] as const,
}

export function fetchEventsByRange(start: string, end: string): Promise<CalendarEvent[]> {
  return call(() => invoke<CalendarEvent[]>('event_list_range', { start, end }))
}

export function fetchAgenda(limit = 100): Promise<CalendarEvent[]> {
  return call(() => invoke<CalendarEvent[]>('event_list_all', { limit }))
}

export function createEvent(input: CalendarEventInput): Promise<CalendarEvent> {
  return call(() => invoke<CalendarEvent>('event_create', { input }))
}

export function updateEvent(id: string, input: CalendarEventInput): Promise<CalendarEvent> {
  return call(() => invoke<CalendarEvent>('event_update', { id, input }))
}

export function deleteEvent(id: string): Promise<void> {
  return call(() => invoke<void>('event_delete', { id }))
}
