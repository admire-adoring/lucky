import type { KeyboardEvent } from 'react'
import type { ServerItem } from '../../../data/derive'
import { ENV_LABEL } from '../../../lib/server-view'
import { OpsIcon } from './ops-icon'

/* ==================================================================== *
 * 概览「运维」格里的服务器 —— 与「文档」格同一种书
 *
 * 为什么不是一张服务器卡：概览这一屏里，文档是书、服务器是行卡片，
 *   两格并排看着就是两套东西。运维格改为书脊之后，`3 + 3 + 1 + 2` 的
 *   网格节奏也跟着一致（两台机器与三本书走同一档尺寸）。
 *
 * 与 `DocBook` / `DeployDocBook` 共用 `.doc-book` / `.db-*` 那一套材质，
 *   不引 `DocBook` 是因为它的 `kind` 是 `DocKind` 枚举（方案 / 设计 / …），
 *   服务器没有这个维度，硬塞就得多造一个假种类。
 *
 * 四行版面按"一台机器"重新分配：
 *   · 签 = 环境（生产 / 测试），图形 = 服务器
 *   · 题 = 主机名，副题 = 地址（这台机器最常被复制走的值）
 *   · 页脚 = 运行状态 · 当前版本
 * 发布记录那一列（成功 / 回滚）不进来 —— 一格只有一张书架的宽度，
 *   版本号已经在页脚，回滚记录进「运维」分区看。
 * ==================================================================== */

export function ServerBook({ server, onOpen }: { server: ServerItem; onOpen: () => void }) {
  return (
    <div
      className="doc-book srv-book"
      role="button"
      tabIndex={0}
      aria-label={`打开服务器 ${server.name}`}
      onClick={onOpen}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onOpen()
      }}
    >
      <div className="db-top">
        <span className="db-tag">{ENV_LABEL[server.env] ?? server.env}</span>
        <span className="db-icon" aria-hidden="true">
          <OpsIcon name="server" size={14} />
        </span>
      </div>

      <div className="db-mid">
        <div className="db-title">{server.name}</div>
        <div className="db-rule">
          <span />
        </div>
        <div className="db-sub">{server.ip}</div>
      </div>

      <div className="db-foot">
        <span>{server.on ? '运行中' : '已停止'}</span>
        <span>{server.version}</span>
      </div>
    </div>
  )
}
