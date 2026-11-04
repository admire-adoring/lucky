import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createMeeting,
  deleteMeeting,
  listMeetings,
  meetingKeys,
  toMeetingItem,
  updateMeeting,
  type MeetingInput,
} from '../api/meetings'
import type { MeetingItem } from '../data/derive'

/** 一个项目的会议（项目详情「会议」分区与概览卡）。 */
export function useProjectMeetings(projectId: string | undefined): MeetingItem[] {
  const { data } = useQuery({
    queryKey: meetingKeys.byProject(projectId ?? ''),
    queryFn: () => listMeetings(projectId),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
  })
  return (data ?? []).map(toMeetingItem)
}

/** 全部会议（跨项目，工作模块那一页用）。 */
export function useAllMeetings(): MeetingItem[] {
  const { data } = useQuery({
    queryKey: meetingKeys.allList(),
    queryFn: () => listMeetings(null),
    staleTime: 60 * 1000,
  })
  return (data ?? []).map(toMeetingItem)
}

export function useMeetingMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: meetingKeys.all })

  return {
    create: useMutation({ mutationFn: (input: MeetingInput) => createMeeting(input), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: MeetingInput }) => updateMeeting(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => deleteMeeting(id), onSuccess: invalidate }),
  }
}
