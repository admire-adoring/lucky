import { useCallback } from 'react'
import { toast } from '../../stores/toast-store'
import type { AiSession } from '../../data/ai/types'

/**
 * 会话 → Markdown。
 *
 * 纯函数：只做文本拼装，不碰剪贴板、不弹提示 —— 那两件事是**动作**，
 * 由下面的 hook 负责。分开的理由是它俩的失败方式不同：
 * 拼装不会失败，剪贴板权限会。
 */
export function sessionToMarkdown(session: AiSession): string {
  const body = session.messages
    .map((message) => {
      const who = message.role === 'user' ? '我' : '助手'
      const text = message.text.map((run) => run.text).join('')
      const quote = message.quote?.lines.map((line) => line.map((run) => run.text).join('')).join('\n')
      const files = message.attachments?.map((file) => `（附件：${file.name} · ${file.size}）`).join('')
      const thought = message.thought?.length
        ? `\n\n<details><summary>思考了 ${message.thought.length} 步</summary>\n\n${message.thought
            .map((step, i) => `${i + 1}. ${step.desc.map((run) => run.text).join('')}`)
            .join('\n')}\n\n</details>`
        : ''
      return `## ${who} · ${message.time}\n\n${text}${quote ? `\n\n${quote}` : ''}${files ? `\n\n${files}` : ''}${thought}`
    })
    .join('\n\n')
  return `# ${session.title}\n\n${body}\n`
}

/**
 * 「导出」这个动作。
 *
 * ⚠️ 原型的导出是 `toast('已导出为 Markdown')` —— **一句没有发生过的事**。
 *    应用里没有文件写入通道（`src-tauri` 的命令层只接了 `projects_list` 一个示例），
 *    所以这里改成"复制到剪贴板"：那件事真的会发生，用户拿到的也是同一份 Markdown。
 *
 * 判据（与消息上的"复制"共用）：**这个动作会不会让界面显示一个系统里不存在的状态。**
 * 说"已导出"而磁盘上什么都没有 —— 会。
 */
export function useExportSession() {
  return useCallback(async (session: AiSession) => {
    try {
      await navigator.clipboard.writeText(sessionToMarkdown(session))
      toast(`已复制「${session.title}」为 Markdown`)
    } catch {
      toast('复制失败：当前环境不允许访问剪贴板')
    }
  }, [])
}
