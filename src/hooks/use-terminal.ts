import { useQuery } from '@tanstack/react-query'
import { fetchTermHistory, fetchTermSessions, termKeys } from '../api/terminal'

/* ============================================================================
   终端的数据钩子
   ----------------------------------------------------------------------------
   只有两条查询：命令历史（上/下方向键跨会话取它）与会话记录。
   会话本身是命令式的（连上 / 跑一条 / 断开），由页面用状态管，不进 React Query ——
   它是"流"，缓存它只会让已经断掉的会话在缓存里假装还活着。
   ============================================================================ */

/** 这台机器上敲过的命令，新的在前。 */
export function useTermHistory(host: string | undefined) {
  return useQuery({
    queryKey: termKeys.history(host ?? ''),
    queryFn: () => fetchTermHistory(host as string),
    enabled: Boolean(host),
    /* 每跑一条命令页面会主动刷新，别让它过一会儿自己再打一次 */
    staleTime: Infinity,
  })
}

/** 这台机器上的终端会话记录。 */
export function useTermSessions(host: string | undefined) {
  return useQuery({
    queryKey: termKeys.sessions(host ?? ''),
    queryFn: () => fetchTermSessions(host as string),
    enabled: Boolean(host),
    staleTime: 60 * 1000,
  })
}
