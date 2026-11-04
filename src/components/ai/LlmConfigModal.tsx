import { useState } from 'react'
import { WorkspaceModal } from '../workspace/WorkspaceModal'
import { cn } from '../../lib/cn'
import { useLlmStore } from '../../stores/llm-store'
import { toast } from '../../stores/toast-store'
import { callLlm } from '../../api/llm'

/**
 * 外部 LLM 配置弹窗。
 *
 * 让用户填 OpenAI 兼容接口的 endpoint / apiKey / model —— 启用后，
 * AI 助手在规则引擎命中不了时会把提问转发给这个 LLM。
 *
 * 与规则引擎的关系：
 *   · 规则引擎命中的问题（全域概览 / 域况 / 逾期 / 任务 / 周报 / 风险）仍走本地
 *   · 命中不了的（包括闲聊、通用问答）才转发
 *
 * endpoint 接受三种形态：
 *   · `https://api.openai.com/v1`（base，自动补 /chat/completions）
 *   · `https://api.openai.com/v1/chat/completions`（完整 URL，原样用）
 *   · `https://your-gateway.com`（无版本前缀，自动补 /v1/chat/completions）
 *
 * apiKey 存 localStorage —— 与 ai-store 不持久化是两件事：
 * 会话是临时态，配置是配置项。
 */
export function LlmConfigModal({ onClose }: { onClose: () => void }) {
  const config = useLlmStore()
  const [enabled, setEnabled] = useState(config.enabled)
  const [endpoint, setEndpoint] = useState(config.endpoint)
  const [apiKey, setApiKey] = useState(config.apiKey)
  const [model, setModel] = useState(config.model)
  const [systemPrompt, setSystemPrompt] = useState(config.systemPrompt)

  const save = () => {
    config.update({ enabled, endpoint: endpoint.trim(), apiKey: apiKey.trim(), model: model.trim(), systemPrompt: systemPrompt.trim() })
    toast(enabled ? '已启用外部 LLM —— 规则引擎答不了的问题会转发' : '已保存（未启用）')
    onClose()
  }

  const test = () => {
    if (!endpoint.trim()) {
      toast('先填 endpoint')
      return
    }
    toast('正在测试连接…')
    /* 测试 = 发一句 "ping" 看 HTTP 是否通。失败原因（401/404/网络）会说出来。 */
    const probeConfig = { enabled, endpoint: endpoint.trim(), apiKey: apiKey.trim(), model: model.trim() || 'gpt-4o-mini', systemPrompt: '' }
    callLlm([{ role: 'user', content: 'ping' }], probeConfig)
      .then(() => toast('连接成功 —— LLM 网关可用'))
      .catch((error: Error) => toast(`测试失败：${error.message}`))
  }

  return (
    <WorkspaceModal
      title="外部 LLM 配置"
      label="外部 LLM 配置"
      onClose={onClose}
      actions={
        <div className="modal-actions-row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={test} title="发一句 ping 测试连通性">
            测试连接
          </button>
          <span className="spacer" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={save}>
            保存
          </button>
        </div>
      }
    >
      <div className="llm-config-form">
        <div className="fld">
          <label className="fld-label" htmlFor="llmEnabled">
            <input
              id="llmEnabled"
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            <span>启用外部 LLM 转发</span>
          </label>
          <span className="fld-hint">
            启用后，规则引擎答不了的问题会转发给外部 LLM；规则引擎能答的（全域概览 / 域况 / 逾期 / 任务 / 周报 / 风险）仍走本地。
          </span>
        </div>

        <div className="fld">
          <label className="fld-label" htmlFor="llmEndpoint">
            Endpoint
          </label>
          <input
            id="llmEndpoint"
            className="fld-inp mono"
            type="text"
            autoComplete="off"
            placeholder="https://api.openai.com/v1"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
          />
          <span className="fld-hint">OpenAI 兼容接口。DeepSeek / Moonshot / 自建网关都按这一份协议。</span>
        </div>

        <div className="fld">
          <label className="fld-label" htmlFor="llmApiKey">
            API Key
          </label>
          <input
            id="llmApiKey"
            className="fld-inp mono"
            type="password"
            autoComplete="off"
            placeholder="sk-..."
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
          <span className="fld-hint">存 localStorage，只在本机使用。留空也行（自建网关可能不要 key）。</span>
        </div>

        <div className="fld">
          <label className="fld-label" htmlFor="llmModel">
            模型名
          </label>
          <input
            id="llmModel"
            className="fld-inp mono"
            type="text"
            autoComplete="off"
            placeholder="gpt-4o-mini"
            value={model}
            onChange={(event) => setModel(event.target.value)}
          />
          <span className="fld-hint">如 gpt-4o-mini / deepseek-chat / moonshot-v1-8k</span>
        </div>

        <div className="fld">
          <label className="fld-label" htmlFor="llmSystem">
            系统提示词（选填）
          </label>
          <textarea
            id="llmSystem"
            className="fld-inp"
            rows={3}
            placeholder="你是 Lucky-Y 项目管理工具的助手…"
            value={systemPrompt}
            onChange={(event) => setSystemPrompt(event.target.value)}
          />
          <span className="fld-hint">不填用内置默认（强调用中文、不编造数据）</span>
        </div>

        <div className={cn('fld-hint-block', !enabled && 'muted')}>
          当前状态：{enabled ? '已启用 —— 规则引擎命中不了时转发' : '未启用 —— 全部走规则引擎'}
        </div>
      </div>
    </WorkspaceModal>
  )
}
