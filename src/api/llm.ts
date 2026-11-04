import type { LlmConfig } from '../stores/llm-store'

/**
 * 外部 LLM HTTP 客户端 —— OpenAI 兼容接口（/v1/chat/completions）。
 *
 * 这一通道与规则引擎并行：
 *   · 规则引擎命中（全域概览 / 域况 / 逾期 / 任务 / 周报 / 风险）→ 本地同步生成，不调这一份
 *   · 规则引擎命中不了 → 启用了 LLM 则转发，没启用则落到"答不了"
 *
 * 协议按 OpenAI /v1/chat/completions：post { model, messages } 拿 choices[0].message.content。
 * DeepSeek / Moonshot / 自建 OpenAI 兼容网关都按这一份协议，差别只在 endpoint 与 model 名。
 */

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * 把 endpoint 拼成完整 URL。
 *
 * 用户填的可能是 `https://api.openai.com/v1`、`https://api.openai.com/v1/`、
 * 或带路径的 `https://api.openai.com/v1/chat/completions` —— 三种都要吃得下。
 */
function completionsUrl(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (/\/chat\/completions$/.test(trimmed)) return trimmed
  if (/\/v1$/.test(trimmed)) return `${trimmed}/chat/completions`
  /* 没有版本前缀时按 OpenAI 习惯补上 —— 用户的自建网关如果有不同路径，
     直接填完整 URL 就跳过这一步 */
  return `${trimmed}/v1/chat/completions`
}

export async function callLlm(
  messages: LlmMessage[],
  config: LlmConfig,
): Promise<string> {
  const url = completionsUrl(config.endpoint)
  if (!url) throw new Error('未配置 LLM endpoint')

  const fullMessages: LlmMessage[] = config.systemPrompt.trim()
    ? [{ role: 'system', content: config.systemPrompt.trim() }, ...messages]
    : messages

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages: fullMessages,
      stream: false,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const head = body.slice(0, 200)
    throw new Error(`LLM HTTP ${res.status}${head ? `: ${head}` : ''}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('LLM 返回格式不识别（没有 choices[0].message.content）')
  }
  return content.trim()
}

/**
 * 把一段 LLM 文本回复转成 TextRun[]。
 *
 * 简单地按行拆 —— LLM 通常一次返回多段，按 \n 切行后每行作为一个 run。
 * 不解析 markdown：本页富文本只有 `<strong>`，markdown 语法会原样显示。
 * 真要做 markdown 渲染得另起一个解析器，那是独立工作。
 */
export function llmTextToRuns(text: string): { text: string; em?: boolean }[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() || line === '')
  return lines.map((line, i) => ({
    text: i < lines.length - 1 ? `${line}\n` : line,
  }))
}
