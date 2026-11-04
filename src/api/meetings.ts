import { invoke } from '@tauri-apps/api/core'
import { call } from './error'
import type { MeetingItem } from '../data/derive'

/**
 * 会议（`work_meeting` + 参会人）。
 *
 * 挂项目是可选的：`projectId` 为空 = 周会/复盘这类跨项目的会。
 * 时间在库里是 `startsAt`/`endsAt`（ISO），前端要的是"SEP / 20 / 14:00 / 60 分钟"那几格 ——
 * 换算全在这一层。
 */
export interface MeetingAttendee {
  userId: string
  name: string
}

export interface Meeting {
  id: string
  projectId: string | null
  title: string
  startsAt: string
  endsAt: string | null
  location: string
  status: 'planned' | 'done' | 'canceled'
  minutesDoc: string | null
  ownerId: string
  ownerName: string
  attendees: MeetingAttendee[]
}

export interface MeetingInput {
  projectId?: string | null
  title: string
  startsAt: string
  endsAt?: string | null
  location?: string
  status?: string
  minutesDoc?: string | null
  attendeeIds?: string[]
}

export const meetingKeys = {
  all: ['meetings'] as const,
  byProject: (projectId: string) => [...meetingKeys.all, 'project', projectId] as const,
  allList: () => [...meetingKeys.all, 'all'] as const,
}

const pad = (n: number) => String(n).padStart(2, '0')

export function toMeetingItem(raw: Meeting): MeetingItem {
  const start = new Date(raw.startsAt)
  const end = raw.endsAt ? new Date(raw.endsAt) : null
  const minutes = end ? Math.round((end.getTime() - start.getTime()) / 60_000) : null
  return {
    id: raw.id,
    month: start.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    day: String(start.getDate()),
    time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    title: raw.title,
    meta: [minutes ? `${minutes} 分钟` : null, raw.location || '线上'].filter(Boolean).join(' · '),
    attendees: raw.attendees.slice(0, 4).map((item) => item.name),
    more: Math.max(0, raw.attendees.length - 4),
  }
}

export function listMeetings(projectId?: string | null): Promise<Meeting[]> {
  return call(() => invoke<Meeting[]>('meeting_list', { projectId: projectId ?? null }))
}

export function createMeeting(input: MeetingInput): Promise<Meeting> {
  return call(() => invoke<Meeting>('meeting_create', { input }))
}

export function updateMeeting(id: string, input: MeetingInput): Promise<Meeting> {
  return call(() => invoke<Meeting>('meeting_update', { id, input }))
}

export function deleteMeeting(id: string): Promise<void> {
  return call(() => invoke('meeting_delete', { id }))
}
