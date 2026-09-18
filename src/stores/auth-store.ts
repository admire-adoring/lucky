import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEMO_ACCOUNT } from '../api/projects'
import type { AuthUser } from '../types'

const SESSION_USER: AuthUser = { name: '刘 阳', email: 'me@lucky-y.app', initials: 'LY' }

interface SignInPayload {
  email: string
  password: string
  remember: boolean
}

interface AuthState {
  user: AuthUser | null
  /** 提交中（按钮转圈、禁用重复提交） */
  pending: boolean
  signIn: (payload: SignInPayload) => Promise<void>
  signInWithGithub: () => Promise<void>
  signOut: () => void
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * 登录态。占位实现：不校验密码，按原型节奏延迟后写入会话用户。
 * 会话用户持久化到 localStorage，刷新后仍停留在项目列表。
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      pending: false,
      async signIn(payload) {
        set({ pending: true })
        await wait(760)
        set({ pending: false, user: { ...SESSION_USER, email: payload.email || DEMO_ACCOUNT.email } })
      },
      async signInWithGithub() {
        set({ pending: true })
        await wait(520)
        set({ pending: false, user: SESSION_USER })
      },
      signOut() {
        set({ user: null, pending: false })
      },
    }),
    {
      name: 'lucky-y/auth',
      partialize: (state) => ({ user: state.user }),
    },
  ),
)
