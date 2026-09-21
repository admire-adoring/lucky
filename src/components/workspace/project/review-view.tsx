import { cn } from '../../../lib/cn'
import { REVIEW_SECTIONS, REVIEW_VERDICTS, VERDICT_CLASS, type ReviewKey } from '../../../data/workspace/project'
import type { ProjectApi } from './api'

/**
 * 复盘：只读 ⇄ 编辑。
 *
 * ⚠️ 与原型最大的一处结构差异：原型在编辑态里**把 DOM 当值的持有者**
 * （所以需要 `syncDraftFromDom()` 在增删/保存前把输入框的 value 收回来 ——
 * 那是个只在"状态和 DOM 各存一份"时才会有的动作）。
 * React 里草稿本身就是状态，输入即改草稿：`syncDraftFromDom` 这一整类问题不存在。
 * 这不是"写法不同"，是**少了一类失败模式**。
 */
export function ReviewPanel({ api }: { api: ProjectApi }) {
  const readOnly = api.reviewDraft === null
  const review = api.reviewDraft ?? api.review

  const filled = REVIEW_SECTIONS.reduce((n, s) => n + review[s.key].filter((x) => x.trim()).length, 0)

  const patch = (next: Partial<typeof review>) => {
    if (!api.reviewDraft) return
    api.updateDraft({ ...api.reviewDraft, ...next })
  }

  const setItem = (key: ReviewKey, index: number, value: string) => {
    if (!api.reviewDraft) return
    const list = api.reviewDraft[key].slice()
    list[index] = value
    api.updateDraft({ ...api.reviewDraft, [key]: list })
  }

  const removeItem = (key: ReviewKey, index: number) => {
    if (!api.reviewDraft) return
    const list = api.reviewDraft[key]
    /* 最后一条不给删 —— 原型把删除键置灰，理由是"删空了的话那一栏就消失了" */
    if (list.length <= 1) return
    api.updateDraft({ ...api.reviewDraft, [key]: list.filter((_, i) => i !== index) })
  }

  const addItem = (key: ReviewKey) => {
    if (!api.reviewDraft) return
    api.updateDraft({ ...api.reviewDraft, [key]: [...api.reviewDraft[key], ''] })
  }

  return (
    <section className="card">
      <div className="review-section-head">
        <div className="card-title">阶段复盘</div>
        <div className="review-actions-inline">
          {readOnly ? (
            <button className="btn btn-ghost" onClick={api.startReviewEdit}>
              编辑
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <div className="review-summary">
          <div className="review-summary-item">
            <span>达成度</span>
            {readOnly ? (
              <span className={cn('verdict', VERDICT_CLASS[review.verdict])}>{review.verdict}</span>
            ) : (
              <select
                className="review-select"
                value={review.verdict}
                onChange={(event) => patch({ verdict: event.target.value })}
              >
                {REVIEW_VERDICTS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="review-summary-item">
            <span>自评</span>
            <span className={cn('rating', readOnly && 'is-readonly')}>
              {[1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className={cn('rating-star', i <= review.score && 'on')}
                  title={`${i} 分`}
                  onClick={() => {
                    if (!api.reviewDraft) {
                      api.notice('先点「编辑」才能改自评')
                      return
                    }
                    patch({ score: i })
                  }}
                >
                  {i <= review.score ? '★' : '☆'}
                </span>
              ))}
            </span>
          </div>
          <div className="review-summary-item">
            <span>条目</span>
            <span>{filled} 条</span>
          </div>
        </div>
      </div>

      <div>
        {REVIEW_SECTIONS.map((section) =>
          readOnly ? (
            <div key={section.key} className="review-block">
              <div className="review-label">{section.label}</div>
              <ul className="review-list">
                {review[section.key].length ? (
                  review[section.key].map((item, i) => <li key={i}>{item}</li>)
                ) : (
                  <li className="is-empty">尚未填写</li>
                )}
              </ul>
            </div>
          ) : (
            <div key={section.key} className="review-edit-block">
              <div className="review-label">{section.label}</div>
              {review[section.key].map((item, i) => (
                <div key={i} className="review-edit-row">
                  <input
                    className="review-input"
                    value={item}
                    placeholder={section.ph}
                    onChange={(event) => setItem(section.key, i, event.target.value)}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    title="删除这条"
                    disabled={review[section.key].length <= 1}
                    onClick={() => removeItem(section.key, i)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" className="review-add" onClick={() => addItem(section.key)}>
                + 添加一条
              </button>
            </div>
          ),
        )}
      </div>

      {readOnly ? null : (
        <div className="review-bar">
          <div className="review-bar-hint">编辑中 · 未保存的改动不会写入</div>
          <button className="btn btn-ghost" onClick={api.cancelReviewEdit}>
            取消
          </button>
          <button className="btn btn-primary" onClick={api.saveReview}>
            保存复盘
          </button>
        </div>
      )}
    </section>
  )
}
