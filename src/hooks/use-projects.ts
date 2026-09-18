import { useQuery } from '@tanstack/react-query'
import { fetchProjectDetail, fetchProjects, projectKeys } from '../api/projects'

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: fetchProjects,
    staleTime: 5 * 60 * 1000,
  })
}

export function useProjectDetail(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? ''),
    queryFn: () => fetchProjectDetail(id),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  })
}
