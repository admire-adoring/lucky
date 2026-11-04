/**
 * 任务接口层的映射自测 —— 纯 Node，不引测试框架。
 *
 * 跑法：`node --experimental-strip-types scripts/verify-task-map.mjs`
 *
 * 只测 `src/lib/task-map.ts`（不 import Tauri）：那份文件是"表列 → 页面行"的唯一转换点，
 * 派生字段（今天/逾期/四象限/待排池）全在那儿算。这几种边界一旦错，界面上不会报错，
 * 只会"某一天开始所有任务都显示逾期" —— 所以值得用断言钉住。
 */
import assert from 'node:assert/strict'
import { dayDiff, toTaskRow, ymd } from '../src/lib/task-map.ts'

const today = new Date()
today.setHours(0, 0, 0, 0)

/** 相对今天的 `YYYY-MM-DD` */
const iso = (offset) => {
  const d = new Date(today)
  d.setDate(d.getDate() + offset)
  return ymd(d)
}

const base = (patch = {}) => ({
  id: 't1',
  scope: 'work',
  projectId: null,
  projectName: '',
  ownerCode: null,
  title: '准备评审',
  state: 'todo',
  priority: 'high',
  dueAt: null,
  scheduledStart: null,
  estimateMin: null,
  completedAt: null,
  sourceKind: null,
  inboxAt: null,
  sortOrder: 0,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  items: [],
  ...patch,
})

let passed = 0
const check = (name, fn) => {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

console.log('task-map')

check('今天到期 ⇒ 今天 / inToday / 重要不紧急（P1 high 且未逾期未进行中）', () => {
  const row = toTaskRow(base({ dueAt: iso(0) }))
  assert.equal(row.dueLabel, '今天')
  assert.equal(row.inToday, true)
  assert.equal(row.quad, 2)
  assert.equal(row.overdueDays, 0)
})

check('逾期 2 天 + mid ⇒ 逾期文案 / 天数 / 重要且紧急', () => {
  const row = toTaskRow(base({ dueAt: iso(-2), priority: 'mid' }))
  assert.equal(row.dueLabel, '逾期 2 天')
  assert.equal(row.overdueDays, 2)
  assert.equal(row.quad, 1)
  assert.equal(row.inToday, false)
})

check('3 天后 + low ⇒ 都不占（第四象限）', () => {
  const row = toTaskRow(base({ dueAt: iso(3), priority: 'low' }))
  assert.equal(row.dueLabel, '3 天后')
  assert.equal(row.quad, 4)
})

check('进行中 + low ⇒ 紧急不重要（第三象限）', () => {
  assert.equal(toTaskRow(base({ state: 'doing', priority: 'low', dueAt: iso(5) })).quad, 3)
})

check('无截止 ⇒ 未定 / 不算今天 / 不逾期', () => {
  const row = toTaskRow(base({ dueAt: null }))
  assert.equal(row.dueLabel, '未定')
  assert.equal(row.inToday, false)
  assert.equal(row.overdueDays, 0)
})

check('排了期 ⇒ 退出待排池；没排 ⇒ 在池里', () => {
  assert.equal(toTaskRow(base({ scheduledStart: '14:00', estimateMin: 60 })).pooled, false)
  assert.equal(toTaskRow(base({ dueAt: iso(1) })).pooled, true)
})

check('已完成 ⇒ 不在池里', () => {
  assert.equal(toTaskRow(base({ state: 'done', completedAt: '2026-10-01T10:00:00Z' })).pooled, false)
})

check('dueAt 带时间也按天算（不因 18:00 差一天）', () => {
  assert.equal(dayDiff(`${iso(0)}T18:00`), 0)
  assert.equal(dayDiff(`${iso(1)}T23:59`), 1)
})

console.log(`\n${passed} 项通过`)
