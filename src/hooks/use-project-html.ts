import { useQuery } from '@tanstack/react-query'
import { listProjectHtml } from '../api/project-html'

/**
 * 项目目录里的 HTML。`enabled` 由调用方控制 —— 这一份只在弹窗打开时才扫目录
 * （项目详情页每进一次都扫一遍磁盘没有必要，而且没填目录的项目会直接报错）。
 */
export function useProjectHtml(projectId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['projectHtml', projectId ?? ''],
    queryFn: () => listProjectHtml(projectId as string),
    enabled: Boolean(projectId) && enabled,
    staleTime: 30 * 1000,
  })
}
