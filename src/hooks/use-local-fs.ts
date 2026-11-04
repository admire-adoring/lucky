import { useQuery } from '@tanstack/react-query'
import { fetchLocalHome, listLocalDir, localFsKeys, statLocal, type LocalDir, type LocalMeta } from '../api/local-fs'

/* ============================================================================
   本机文件系统的数据钩子
   ----------------------------------------------------------------------------
   与 `use-servers.ts` 同一套写法：页面只 import 这里，不直接 invoke。

   三条查询各有各的缓存口径：
     · 家目录 —— 一个进程内不会变，永久缓存；
     · 一层目录 —— 每次打开都重读（构建产物刚换过，缓存里还是旧的）；
     · 一批路径的探测 —— key 就是这批路径，新增一条就换一把 key，天然重查。
   ============================================================================ */

/** 本机家目录。查询还没回来时给 `/`，不让调用方等 —— 它只用于占位与起点。 */
export function useLocalHome(): string {
  const { data } = useQuery({
    queryKey: localFsKeys.home(),
    queryFn: fetchLocalHome,
    staleTime: Infinity,
    gcTime: Infinity,
  })
  return data ?? '/'
}

/**
 * 读一层目录。`path` 为 null 时不查（选择器没开本机模式）。
 * 每次打开都重读：目录内容变了还拿缓存，选择器里就会少一个刚打出来的包。
 */
export function useLocalDir(path: string | null) {
  return useQuery<LocalDir>({
    queryKey: localFsKeys.dir(path ?? ''),
    queryFn: () => listLocalDir(path as string),
    enabled: Boolean(path),
    staleTime: 0,
    gcTime: 30 * 1000,
    refetchOnMount: 'always',
  })
}

/**
 * 批量探测：路径 → 事实（不存在为 null）。
 *
 * 单条权限错误在这里当成"读不到即没有"——清单行只需要一个 有/没有 的判定；
 * 要看到具体原因的是「绑定」那条路（`probeLocalFile` 不吞错，会把后端的文案摆出来）。
 */
export function useLocalProbe(paths: readonly string[]) {
  const unique = Array.from(new Set(paths.filter(Boolean)))
  return useQuery<Record<string, LocalMeta | null>>({
    queryKey: localFsKeys.probe(unique),
    queryFn: async () => {
      const list = await Promise.all(
        unique.map(async (path) => {
          try {
            return [path, await statLocal(path)] as const
          } catch {
            return [path, null] as const
          }
        }),
      )
      return Object.fromEntries(list)
    },
    enabled: unique.length > 0,
    staleTime: 0,
  })
}

/** 事件处理里的一次性探测（绑定、失焦、边打边查）。错误原样抛给调用方展示。 */
export function probeLocalFile(path: string): Promise<LocalMeta | null> {
  return statLocal(path)
}
