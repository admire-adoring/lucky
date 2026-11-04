/* 新建部署文档。

   这一档此前只有一句「还没有写接口」的回执。真正的入口是 `doc_create`：
   部署文档就是 `doc` 表里 `owner_kind='server'` 的那批，宿主必须是一台机器，
   `project_id` 指向本项目 —— 所以这里要问的第一件事是"挂在哪台机器下"。

   库里的文件落点由后端按 `server/<机器名>/` 分，正文写一份 `.md` 骨架：
   建完立刻进编辑面，光标那一段就是要填的步骤，不是先建一个空壳再让人找入口。
*/

import { useEffect, useRef, useState } from 'react'
import type { DocRow } from '../../../api/docs'
import { errorText } from '../../../api/error'
import { useDocMutations } from '../../../hooks/use-docs'
import { cn } from '../../../lib/cn'
import { DEPLOY_DOC_KINDS } from '../../../lib/server-view'
import { PanelModal } from './panel-shell'

/** 正文骨架。三段是部署文档最小可用的形状：做什么 / 怎么做 / 怎么退回去。 */
function skeleton(name: string) {
  return `# ${name}\n\n## 前置条件\n\n## 步骤\n\n1. \n\n## 回滚\n\n`
}

export function NewDeployDocDialog({
  projectId,
  servers,
  onCreated,
  onClose,
}: {
  projectId: string
  /** 可选的宿主机器（本项目名下的那些） */
  servers: { name: string; ip: string }[]
  /** 建好了 —— 带着库里那一行，调用方用它打开编辑面 */
  onCreated: (doc: DocRow) => void
  onClose: () => void
}) {
  const [host, setHost] = useState(servers[0]?.name ?? '')
  const [name, setName] = useState('')
  const [kind, setKind] = useState(DEPLOY_DOC_KINDS[0]?.code ?? 'manual')
  const [version, setVersion] = useState('')
  const [error, setError] = useState('')
  const nameRef = useRef<HTMLInputElement | null>(null)

  /* 打开就把焦点放在标题上：机器已有默认值，第一步要敲的是名字 */
  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  /* 与文档索引那几处同一个 mutation —— 失效范围（`docKeys.all`）只有一份 */
  const create = useDocMutations().create

  const submit = () => {
    const title = name.trim()
    if (!title) {
      setError('先给它起个名字 —— 书架上按这个名字排')
      return
    }
    if (!host) {
      setError('先选一台机器 —— 部署文档挂在机器下面')
      return
    }
    setError('')
    create.mutate(
      {
        ownerKind: 'server',
        ownerId: host,
        projectId,
        name: title,
        kind,
        source: 'local_md',
        version: version.trim(),
        content: skeleton(title),
      },
      {
        onSuccess: (doc) => onCreated(doc),
        onError: (err) => setError(errorText(err)),
      },
    )
  }

  return (
    <PanelModal
      title="新建部署文档"
      cancelLabel="取消"
      onCancel={onClose}
      footer={
        <button type="button" className="btn btn-primary" disabled={create.isPending} onClick={submit}>
          {create.isPending ? '正在建…' : '新建并打开'}
        </button>
      }
    >
      <div className="path-form">
        <div className="fld">
          <div className="fld-head">
            <span className="fld-label">挂在哪台机器下</span>
          </div>
          {servers.length ? (
            <div className="chip-group" role="group" aria-label="选择机器" style={{ flexWrap: 'wrap' }}>
              {servers.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  className={cn('chip', host === item.name && 'active')}
                  aria-pressed={host === item.name}
                  title={item.ip}
                  onClick={() => setHost(item.name)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="fld-note">这个项目还没有服务器 —— 先添加一台，部署文档才有落点</div>
          )}
        </div>

        <div className="fld">
          <div className="fld-head">
            <label className="fld-label" htmlFor="nddName">
              标题
            </label>
          </div>
          <input
            ref={nameRef}
            id="nddName"
            className="fld-inp"
            type="text"
            autoComplete="off"
            placeholder="例如：支付服务发版流程"
            value={name}
            aria-invalid={error && !name.trim() ? 'true' : 'false'}
            onChange={(event) => {
              setName(event.target.value)
              setError('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
          />
        </div>

        <div className="fld">
          <span className="fld-label">类型</span>
          <div className="chip-group" role="group" aria-label="选择类型">
            {DEPLOY_DOC_KINDS.map((item) => (
              <button
                key={item.code}
                type="button"
                className={cn('chip', kind === item.code && 'active')}
                aria-pressed={kind === item.code}
                onClick={() => setKind(item.code)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="fld">
          <div className="fld-head">
            <label className="fld-label" htmlFor="nddVer">
              版本（选填）
            </label>
          </div>
          <input
            id="nddVer"
            className="fld-inp"
            type="text"
            autoComplete="off"
            placeholder="v1.0"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
          />
          <div className="fld-note">正文先落一份骨架（前置条件 / 步骤 / 回滚），建完直接进编辑面</div>
        </div>

        {error ? (
          <div className="fld-err" role="alert">
            {error}
          </div>
        ) : null}
      </div>
    </PanelModal>
  )
}
