/**
 * 日历事件 hooks。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  calendarKeys,
  createEvent,
  deleteEvent,
  fetchAgenda,
  fetchEventsByRange,
  updateEvent,
  type CalendarEventInput,
} from '../api/calendar'
import { toast } from '../stores/toast-store'

export function useEventsByRange(start: string, end: string) {
  return useQuery({
    queryKey: calendarKeys.range(start, end),
    queryFn: () => fetchEventsByRange(start, end),
  })
}

export function useAgenda(limit = 100) {
  return useQuery({
    queryKey: calendarKeys.agenda(limit),
    queryFn: () => fetchAgenda(limit),
  })
}

export function useEventActions() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: calendarKeys.all })
  }
  return {
    create: useMutation({
      mutationFn: (input: CalendarEventInput) => createEvent(input),
      onSuccess: () => {
        invalidate()
        toast('已添加日程')
      },
      onError: (e: Error) => toast(`添加失败：${e.message}`),
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: CalendarEventInput }) => updateEvent(id, input),
      onSuccess: () => {
        invalidate()
        toast('已更新日程')
      },
      onError: (e: Error) => toast(`更新失败：${e.message}`),
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteEvent(id),
      onSuccess: () => {
        invalidate()
        toast('已删除日程')
      },
      onError: (e: Error) => toast(`删除失败：${e.message}`),
    }),
  }
}
