import { create } from 'zustand'

/**
 * 外部 LLM 配置。
 *
 * AI 助手默认走规则引擎（基于本地项目数据生成回复）—— 它能答的就答、
 * 答不了的诚实说"答不了"。这一份配置是**独立通道**：
 * 启用之后，规则引擎命中不了的提问会转发给外部 LLM（OpenAI 兼容接口），
 * 命中了的仍走本地（速度更快、不耗 token、口径可回溯）。
 *
 * 持久化在 localStorage —— 这与 ai-store 不持久化是两件事：
 * ai-store 存的是"这次会话说了什么"，会话是临时态；
 * 这一份是"用哪个模型、哪个 key"，是配置项，下次打开还在。
 */

export interface LlmConfig {
  enabled: boolean
  /** OpenAI 兼容接口的 base URL，例如 `https://api.openai.com/v1` 或自建网关 */
  endpoint: string
  apiKey: string
  /** 模型名，例如 `gpt-4o-mini` / `deepseek-chat` */
  model: string
  /** 系统提示词（选填）—— 不填用默认 */
  systemPrompt: string
}

const STORAGE_KEY = 'lucky-y.llm-config.v1'

const DEFAULT: LlmConfig = {
  enabled: false,
  endpoint: '',
  apiKey: '',
  model: 'gpt-4o-mini',
  systemPrompt: '',
}

function load(): LlmConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT }
    const parsed = JSON.parse(raw) as Partial<LlmConfig>
    return { ...DEFAULT, ...parsed }
  } catch {
    return { ...DEFAULT }
  }
}

function persist(config: LlmConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    /* localStorage 在某些环境（隐私模式 / Tauri webview 沙箱）会抛，
       失败不致命 —— 配置只活到本次会话也够用 */
  }
}

interface LlmState extends LlmConfig {
  setEnabled: (enabled: boolean) => void
  setEndpoint: (endpoint: string) => void
  setApiKey: (apiKey: string) => void
  setModel: (model: string) => void
  setSystemPrompt: (prompt: string) => void
  /** 一次性更新多字段（配置弹窗"保存"按钮用） */
  update: (patch: Partial<LlmConfig>) => void
  clear: () => void
}

export const useLlmStore = create<LlmState>()((set) => ({
  ...load(),

  setEnabled: (enabled) =>
    set((state) => {
      const next = { ...state, enabled }
      persist(next)
      return { enabled }
    }),
  setEndpoint: (endpoint) =>
    set((state) => {
      const next = { ...state, endpoint }
      persist(next)
      return { endpoint }
    }),
  setApiKey: (apiKey) =>
    set((state) => {
      const next = { ...state, apiKey }
      persist(next)
      return { apiKey }
    }),
  setModel: (model) =>
    set((state) => {
      const next = { ...state, model }
      persist(next)
      return { model }
    }),
  setSystemPrompt: (systemPrompt) =>
    set((state) => {
      const next = { ...state, systemPrompt }
      persist(next)
      return { systemPrompt }
    }),
  update: (patch) =>
    set((state) => {
      const next = { ...state, ...patch }
      persist(next)
      return patch
    }),
  clear: () => {
    const next = { ...DEFAULT }
    persist(next)
    set(next)
  },
}))

/** 拿当前配置（非 hook 调用方用，比如 reply 流程里的异步任务） */
export function currentLlmConfig(): LlmConfig {
  return useLlmStore.getState()
}
