import { useQuery } from '@tanstack/react-query'
import {
  listRemoteDir,
  remoteFsKeys,
  statRemote,
  type RemoteDir,
  type RemoteMeta,
} from '../api/srv-remote'

/* ============================================================================
   服务器文件的钩子 —— 与 `use-local-fs.ts` 同构，只多一个 `host` 维度。

   缓存口径也照抄：一层目录每次打开都重读（刚发布过的目录，缓存里还是旧的），
   路径探测按这一批路径做 key。
   ============================================================================ */

/** 读远端一层目录。`path` 为 null 时不查（选择器没开服务器模式）。 */
export function useRemoteDir(host: string, path: string | null) {
  return useQuery<RemoteDir>({
    queryKey: remoteFsKeys.dir(host, path ?? ''),
    queryFn: () => listRemoteDir(host, path as string),
    enabled: Boolean(host && path),
    staleTime: 0,
    gcTime: 30 * 1000,
    refetchOnMount: 'always',
  })
}

/**
 * 批量探测远端路径。
 *
 * 与 `useLocalProbe` 同样的取舍：单条错误在这里当成"读不到即没有"，
 * 清单行只要一个 有/没有 的判定。要看到具体原因的是绑定那条路。
 */
export function useRemoteProbe(host: string, paths: readonly string[]) {
  const unique = Array.from(new Set(paths.filter(Boolean)))
  return useQuery<Record<string, RemoteMeta | null>>({
    queryKey: remoteFsKeys.probe(host, unique),
    queryFn: async () => {
      const list = await Promise.all(
        unique.map(async (path) => {
          try {
            return [path, await statRemote(host, path)] as const
          } catch {
            return [path, null] as const
          }
        }),
      )
      return Object.fromEntries(list)
    },
    enabled: Boolean(host) && unique.length > 0,
    staleTime: 0,
  })
}
