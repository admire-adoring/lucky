/**
 * 「我是谁」—— 全站唯一一份。
 *
 * 事实源是库里 `app_user` 里 `id='me'` 那一行（`user_list` 命令，`is_me` 由后端标出）。
 * 选了这条源，改名的效果才是一致的：在「账户与安全」写库之后，顶栏账户菜单、
 * AI 助手的称呼同时变成新名字 —— 而 `auth-store` 里的那份是登录页的占位会话，
 * 名字写死在 `SESSION_USER`，改了库它不会动。
 *
 * 会话只作兜底：浏览器预览没有 Tauri 运行时（读不到 SQLite），这一步给它一个
 * 能显示的身份，免得顶栏出现一个空头像。`fromDb` 就是用来区分这两种情况的。
 */
import { isDesktopShell } from '../lib/desktop-window'
import { useAuthStore } from '../stores/auth-store'
import { useUsers } from './use-users'

export interface Me {
  /** 空串 = 既没有库、也没有会话（未登录） */
  name: string
  /** 头像上的那两个字母 */
  initials: string
  /** 名字底下的那行小字：有库时说身份，没库时退回登录邮箱 */
  note: string
  /** 名字是否来自库 */
  fromDb: boolean
}

export function useMe(): Me {
  const session = useAuthStore((state) => state.user)
  /* 浏览器预览里不发这个请求：invoke 在那里必然失败，只会给每一页刷一堆重试日志 */
  const users = useUsers({ enabled: isDesktopShell() })
  const row = users.find((user) => user.isMe)

  return {
    name: row?.displayName ?? session?.name ?? '',
    initials: row?.code ?? session?.initials ?? '',
    note: row ? '本机唯一使用者' : (session?.email ?? ''),
    fromDb: Boolean(row),
  }
}
