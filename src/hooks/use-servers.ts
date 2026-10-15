import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createDeployDoc,
  createRelease,
  createServer,
  deleteDeployDoc,
  deleteRelease,
  deleteServer,
  deployDocKeys,
  getServer,
  lastRelease,
  listDeployDocs,
  listReleaseCounts,
  listReleases,
  listServers,
  releaseKeys,
  removeServer,
  serverKeys,
  updateDeployDoc,
  updateRelease,
  updateServer,
  type DeployDocInput,
  type DeployReleaseInput,
  type ServerInput,
} from '../api/servers'

/* ============================================================================
   服务器台账的数据钩子
   ----------------------------------------------------------------------------
   与 `use-projects.ts` 同一套写法：查询读 `srv_*` 命令，写操作收在一处失效上。

   注意：这些命令只在 Tauri 窗口里可用（`src/api/servers.ts` 的文件头写了）。
   在浏览器里跑 `vite dev` 时 `invoke` 会抛错，页面据此走错误态。
   ============================================================================ */

/** 在册机器（已从台账收走的不在其中）。 */
export function useServers() {
  return useQuery({
    queryKey: serverKeys.list(),
    queryFn: listServers,
    staleTime: 5 * 60 * 1000,
  })
}

/** 按机器名取一台，带项目 / 端口 / 标签 / 文件位置。 */
export function useServer(host: string | undefined) {
  return useQuery({
    queryKey: serverKeys.one(host ?? ''),
    queryFn: () => getServer(host as string),
    enabled: Boolean(host),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 增 / 改 / 移除 / 删除 —— 四个动作收在一处失效上。
 *
 * 只失效列表是不够的：详情页读的是 `['servers','one',host]`，改完机器名之后
 *    点进那台机器，Hero 上还挂着旧名字。
 */
export function useServerActions() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: serverKeys.all })

  return {
    create: useMutation({ mutationFn: createServer, onSuccess: invalidate }),
    save: useMutation({
      mutationFn: ({ host, input }: { host: string; input: ServerInput }) => updateServer(host, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: removeServer, onSuccess: invalidate }),
    destroy: useMutation({ mutationFn: deleteServer, onSuccess: invalidate }),
  }
}

/* ============================================================================
   发布记录 / 部署文档的数据钩子
   ----------------------------------------------------------------------------
   两条失效线：发布动 `['releases']`（counts / last 都挂在它下面），
   文档动 `['deployDocs']`。互不失效 —— 两张表各写各的。
   ============================================================================ */

/** 一个项目的发布记录，新的在前。 */
export function useReleases(projectId: string | undefined) {
  return useQuery({
    queryKey: releaseKeys.byProject(projectId ?? ''),
    queryFn: () => listReleases(projectId as string),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  })
}

/** 跨项目的最近一条（KPI「最近发布」）；空库时 data 为 null。 */
export function useLastRelease() {
  return useQuery({
    queryKey: releaseKeys.last(),
    queryFn: lastRelease,
    staleTime: 5 * 60 * 1000,
  })
}

/** 每台机器的发布条数（台账徽标），host → count 的那份。 */
export function useReleaseCounts() {
  return useQuery({
    queryKey: releaseKeys.counts(),
    queryFn: listReleaseCounts,
    staleTime: 5 * 60 * 1000,
  })
}

/** 增 / 改 / 删发布记录 —— 收在 `['releases']` 一处失效上。 */
export function useReleaseActions() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: releaseKeys.all })

  return {
    create: useMutation({ mutationFn: createRelease, onSuccess: invalidate }),
    save: useMutation({
      mutationFn: ({ id, input }: { id: string; input: DeployReleaseInput }) => updateRelease(id, input),
      onSuccess: invalidate,
    }),
    destroy: useMutation({ mutationFn: deleteRelease, onSuccess: invalidate }),
  }
}

/** 一个项目的部署文档（书架那一排），按登记顺序。 */
export function useDeployDocs(projectId: string | undefined) {
  return useQuery({
    queryKey: deployDocKeys.byProject(projectId ?? ''),
    queryFn: () => listDeployDocs(projectId as string),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  })
}

/** 增 / 改 / 删部署文档 —— 收在 `['deployDocs']` 一处失效上。 */
export function useDeployDocActions() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: deployDocKeys.all })

  return {
    create: useMutation({ mutationFn: createDeployDoc, onSuccess: invalidate }),
    save: useMutation({
      mutationFn: ({ id, input }: { id: string; input: DeployDocInput }) => updateDeployDoc(id, input),
      onSuccess: invalidate,
    }),
    destroy: useMutation({ mutationFn: deleteDeployDoc, onSuccess: invalidate }),
  }
}
