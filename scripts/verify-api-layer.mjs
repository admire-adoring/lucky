/**
 * api 层 + 筛选层映射自测 —— 纯 Node，不引测试框架。
 *
 * 跑法：`node --experimental-strip-types scripts/verify-api-layer.mjs`
 *
 * 覆盖：
 *   · api/error.ts —— toApiError / errorText / call（错误封装统一出口）
 *   · lib/filter-projects.ts —— parseQuery / projectHit / filterProjects / watchProjects / averageProgress / tagPool
 */
import assert from 'node:assert/strict'
import { toApiError, errorText, call, ApiError } from '../src/api/error.ts'
import {
  parseQuery,
  projectHit,
  filterProjects,
  watchProjects,
  averageProgress,
  tagPool,
} from '../src/lib/filter-projects.ts'

let passed = 0
const check = (name, fn) => {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

/* ------------------------------------------------------------------ api/error */

console.log('api/error')

check('壳层 { code, message } → ApiError，code 保留', () => {
  const err = toApiError({ code: 'conflict', message: '机器名已存在' })
  assert.equal(err instanceof ApiError, true)
  assert.equal(err.code, 'conflict')
  assert.equal(err.message, '机器名已存在')
})

check('未知 code → unknown', () => {
  const err = toApiError({ code: 'weird', message: '???', extra: 1 })
  assert.equal(err.code, 'unknown')
  assert.equal(err.message, '???')
})

check('裸字符串 → unknown + 原文', () => {
  const err = toApiError('炸了')
  assert.equal(err.code, 'unknown')
  assert.equal(err.message, '炸了')
})

check('null/undefined 兜底', () => {
  assert.equal(toApiError(null).code, 'unknown')
  assert.equal(toApiError(undefined).code, 'unknown')
})

check('ApiError 实例原样透传（不重新包装）', () => {
  const original = new ApiError('notFound', '项目不存在')
  const passed = toApiError(original)
  assert.equal(passed, original)
})

check('errorText 从壳层对象取 message（不走 [object Object]）', () => {
  assert.equal(errorText({ code: 'db', message: '库锁了' }), '库锁了')
  assert.equal(errorText('纯字符串'), '纯字符串')
  assert.equal(errorText(new ApiError('invalid', '参数错')), '参数错')
})

check('call 成功路径直通', async () => {
  const result = await call(() => Promise.resolve(42))
  assert.equal(result, 42)
})

check('call 失败路径换成 ApiError', async () => {
  await assert.rejects(
    () => call(() => Promise.reject({ code: 'notFound', message: '没了' })),
    (err) => err instanceof ApiError && err.code === 'notFound',
  )
})

/* ----------------------------------------------------------- filter-projects */

console.log('\nfilter-projects')

const sample = (patch = {}) => ({
  id: 'p1',
  ownerId: 'me',
  scope: 'work',
  name: '支付重构',
  description: '拆分旧网关',
  status: 'active',
  priority: 'high',
  progress: 40,
  tags: ['客户A', '支付'],
  startDate: '2026年9月1日',
  dueDate: '2026-11-01',
  dueShort: '11月01日',
  dueLong: '2026年11月01日',
  daysLeft: 10,
  tasksDone: 4,
  tasksTotal: 10,
  owners: ['LY'],
  milestone: '一期',
  budget: '¥50,000',
  visibility: '工作内部',
  repoUrl: '—',
  docsUrl: '',
  risk: null,
  ...patch,
})

const projects = [
  sample({ id: 'p1', scope: 'work', status: 'active', priority: 'high', progress: 40, daysLeft: 10, tags: ['客户A', '支付'] }),
  sample({ id: 'p2', scope: 'work', status: 'risk', priority: 'high', progress: 20, daysLeft: -3, tags: ['支付'], name: '风控' }),
  sample({ id: 'p3', scope: 'learn', status: 'planning', priority: 'low', progress: 0, daysLeft: 30, tags: ['读书'], name: '读 Rust Book' }),
  sample({ id: 'p4', scope: 'life', status: 'done', priority: 'mid', progress: 100, daysLeft: 0, tags: ['体检'], name: '年度体检' }),
  sample({ id: 'p5', scope: 'work', status: 'archived', priority: 'low', progress: 100, daysLeft: -60, tags: [], name: '旧网关' }),
]

const baseFilter = { scope: 'all', query: '', sort: 'default' }

check('全部（空 status）不含已归档', () => {
  const hit = projects.filter((p) => projectHit(p, { ...baseFilter, status: '' }))
  assert.equal(hit.length, 4)
  assert.equal(hit.find((p) => p.id === 'p5'), undefined)
})

check('active 把 planning 也算进来', () => {
  const hit = projects.filter((p) => projectHit(p, { ...baseFilter, status: 'active' }))
  assert.deepEqual(hit.map((p) => p.id).sort(), ['p1', 'p3'])
})

check('scope 筛选 work 只留 work', () => {
  const hit = projects.filter((p) => projectHit(p, { ...baseFilter, scope: 'work', status: '' }))
  assert.deepEqual(hit.map((p) => p.id).sort(), ['p1', 'p2'])
})

check('#标签 语法 + 关键词组合', () => {
  const hit = projects.filter((p) =>
    projectHit(p, { ...baseFilter, status: '', query: '#支付 风控' }),
  )
  assert.deepEqual(hit.map((p) => p.id), ['p2'])
})

check('#前缀匹配（#客 命中客户A）', () => {
  const hit = projects.filter((p) =>
    projectHit(p, { ...baseFilter, status: '', query: '#客' }),
  )
  assert.equal(hit.length, 1)
  assert.equal(hit[0].id, 'p1')
})

check('parseQuery 拆分标签与关键词', () => {
  const q = parseQuery('#支付 #客  重构  ')
  assert.deepEqual(q.tags, ['支付', '客'])
  assert.equal(q.keyword, '重构')
})

check('sort:due 按剩余天数升序', () => {
  const sorted = filterProjects(projects, { ...baseFilter, status: '', sort: 'due' })
  const ids = sorted.map((p) => p.id)
  // daysLeft: p2(-3) < p4(0) < p1(10) < p3(30)，p5 归档不含
  assert.deepEqual(ids, ['p2', 'p4', 'p1', 'p3'])
})

check('sort:progress 按进度降序', () => {
  const sorted = filterProjects(projects, { ...baseFilter, status: '', sort: 'progress' })
  assert.equal(sorted[0].id, 'p4') // 100
  assert.equal(sorted[1].id, 'p1') // 40
})

check('watchProjects 风险优先 + 逾期次之 + 取前3', () => {
  const watch = watchProjects(projects, { ...baseFilter, status: '' })
  assert.equal(watch[0].id, 'p2') // risk 最优先
  assert.ok(watch.length <= 3)
})

check('watchProjects 不含已完成/已归档', () => {
  const watch = watchProjects(projects, { ...baseFilter, status: '' }, 10)
  assert.equal(watch.find((p) => p.id === 'p4' || p.id === 'p5'), undefined)
})

check('averageProgress 空集合 → 0', () => {
  assert.equal(averageProgress([]), 0)
})

check('averageProgress 四舍五入', () => {
  assert.equal(averageProgress([sample({ progress: 40 }), sample({ progress: 45 })]), 43)
})

check('tagPool 按频次降序 + 同频按名', () => {
  const pool = tagPool(projects)
  assert.equal(pool[0], '支付') // 出现 2 次
  assert.ok(pool.includes('客户A'))
  assert.ok(pool.includes('体检'))
})

console.log(`\n${passed} 项通过`)
