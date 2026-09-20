#!/usr/bin/env node
/* 把 gen-modules.mjs 的**内容层**导出成 JSON —— 作为移植到 src/** 的"标准答案"。
   ----------------------------------------------------------------------------
   为什么要有这一步（而不是直接手抄那 620 行 MODULES）：
     那 620 行是 9 个模块 × 5 块磁贴的内容，手抄一遍几乎必然有出入，
     而出入是"数字对不上 / 文案差一个字"这种**看起来没问题**的类型。
     导出一份 JSON 当靶子，React 侧的移植就能**逐字段比对**，而不是靠眼睛。

   做法：不重写、不解析 HTML，而是把 gen-modules.mjs 里那几个"产出 HTML 字符串"的
   构造器换成"产出描述符对象"的收集器，然后求值。于是 MODULES 自然变成一棵纯数据树。
      · 命中范围：文件里从数据区到 MODULES 结束（切在 "5. 输出片段" 之前），
        后面那些模板常量（HERO_CSS / SCRIPT / DOC）与写盘/守卫段一律不执行。
      · 被替换的构造器：chart / kpiTile / listTile / projectRow / flatRow / eventRow /
        aRows / liRows / icon。原定义**改名保留**（`__html` 后缀），不删除 ——
        这样"切点选错、某个构造器其实被数据区依赖"会当场报错，而不是悄悄少字段。

   用法：node design/export-workbench-content.mjs [outJson]
   ⚠️ 本脚本**只读** gen-modules.mjs 与 workbench.html，不写任何设计源文件。
*/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(DIR, 'gen-modules.mjs')
const OUT = process.argv[2] || '/tmp/workbench-content.json'

/* 换成收集器的构造器。名字 → 它收集成什么形状。 */
const COLLECTORS = {
  chart: "const chart = (groups, o = {}) => ({ groups, width: o.width ?? 238, height: o.height ?? 35, baseline: o.baseline ?? 34 })",
  /* ⚠️ `labels` / `legend` / `tail` 在生成器里用 `null` 表示"这块磁贴没有这一段"，
     而类型上是可选字段 —— 把 null 归一成 undefined，`JSON.stringify` 才会把键整条去掉。
     留着 `labels: null` 会得到一个**存在但为 null** 的字段，渲染层每次都得写 `?? []`。 */
  kpiTile:
    "const kpiTile = (d) => ({ kind: 'kpi', ...d, labels: d.labels ?? undefined, legend: d.legend ?? undefined, tail: d.tail ?? undefined })",
  listTile: "const listTile = (d) => ({ kind: 'list', ...d })",
  /* 项目行**只留 id**：项目本身的字段在 src/data/projects.ts 里，
     把整条 project 铺进生成物会让同一份数据在包里出现两遍（还多一份会过期的副本）。
     渲染时按 id 去 PROJECTS 取，于是"项目改了、行没改"在结构上不可能发生。 */
  projectRow: "const projectRow = (p) => ({ kind: 'project', id: p.id })",
  flatRow: "const flatRow = (d) => ({ kind: 'flat', ...d })",
  eventRow: "const eventRow = (d) => ({ kind: 'event', ...d })",
  aRows: "const aRows = (rows) => rows",
  liRows: "const liRows = (rows) => rows",
  icon: "const icon = (name, cls) => ({ icon: name, cls })",
  /* 气泡：`aiBubble(html, time)` 本来返回**整段 <div>**，这里只取内文与时间，
     角色由调用的是哪个函数决定。walk() 再把内文里的 <b> 转成片段数组。 */
  aiBubble: "const aiBubble = (content, time) => ({ role: 'ai', content, time })",
  userBubble: "const userBubble = (content, time) => ({ role: 'user', content, time })",
}

const raw = fs.readFileSync(SRC, 'utf8')

/* 切点：模板段开始之前。这一段之后只产出标记，与内容无关。 */
const CUT_MARK = '   5. 输出片段'
const cutAt = raw.indexOf(CUT_MARK)
if (cutAt === -1) throw new Error(`找不到切点「${CUT_MARK}」—— gen-modules.mjs 的结构变了，先确认再导出`)
let code = raw.slice(0, raw.lastIndexOf('/* ===', cutAt))

/* 把原构造器的**声明**改名。只改 `const 名字 = `，不动调用处 ——
   调用处要落到注入的收集器上。找不到声明说明结构变了，直接报错。 */
for (const name of Object.keys(COLLECTORS)) {
  const decl = `const ${name} = `
  if (!code.includes(decl)) throw new Error(`找不到构造器声明：${decl}`)
  code = code.replace(decl, `const ${name}__html = `)
}

/* 注入收集器：必须在 MODULES 之前求值，所以插在 `const MODULES = [` 那一行之前。 */
const MODULES_AT = 'const MODULES = ['
const modAt = code.indexOf(MODULES_AT)
if (modAt === -1) throw new Error('找不到 `const MODULES = [`')
code =
  code.slice(0, modAt) +
  '/* ---- 收集器（导出用，与 HTML 无关）---- */\n' +
  Object.values(COLLECTORS).join('\n') +
  '\n\n' +
  code.slice(modAt)

/* ⚠️ MODULES 之后有一行把对话里的 `__MODULE_COUNT__` 占位符回填成"除工作台外的模块数"。
   它按「chat 项是字符串」写，而这里 chat 项已经是 `{role, html, time}` 描述符 ——
   不改这一行会当场 `s.split is not a function`。这正是"换了一层没换另一层"的典型，
   所以顺手断言替换确实命中了，避免哪天生成器改了写法而这里静默失效。 */
const COUNT_LINE = "m.chat = m.chat.map((s) => s.split('__MODULE_COUNT__').join(MODULE_COUNT_NOTE))"
if (!code.includes(COUNT_LINE)) throw new Error('找不到对话占位符回填那一行 —— 生成器写法变了，先确认再导出')
code = code.replace(
  COUNT_LINE,
  "m.chat = m.chat.map((s) => (typeof s === 'string' ? s : { ...s, content: s.content.split('__MODULE_COUNT__').join(MODULE_COUNT_NOTE) }))",
)

/* ⚠️ 不用再补 MODULES 之后的加工段：`MODULE_COUNT_NOTE`（对话里的模块数占位符回填）
   与 `ENTER`（每个模块的"进入主页面"CTA 口径）都在切点**之前**，已经被上面的切片包含。
   第一版多补了一次，直接撞 `Identifier 'MODULE_COUNT_NOTE' has already been declared` ——
   这类"补重了"比"漏了"更容易发现，但还是别补。 */

const tmp = path.join(DIR, '.export-workbench-content.tmp.mjs')
fs.writeFileSync(tmp, code + '\nexport { MODULES, P, SCOPES, SCOPE, STATUS, TASKS, DOM, GLOBAL_AVG, MONTHS, BUDGET, BUDGET_TOTAL, VIS, BY_DAYS, INK300, BRAND, DANGER, PRIO, ENTER }\n')

/* 富文本：气泡与行里用 `<b class="...">…</b>` 做强调。
   导出时转成「片段数组」，React 侧就不必用 dangerouslySetInnerHTML。
   ⚠️ 只认 <b>：这是我们自己生成的标记，词汇表就这么大。出现别的标签要报错，
      否则会静默丢内容（"少了一段加粗"这种问题没人会去查）。 */
const OPEN_B = /^<b(?:\s[^>]*)?>/
function toRichText(s) {
  /* ⚠️ 必须**恒定返回数组**：有的气泡整句都没有强调。若那种就返回裸字符串，
     类型上会变成 `TextRun[] | string`，渲染层每次都得判一次，
     而漏判的那一处会在运行时静默渲染成一坨对象/空节点。 */
  if (!s.includes('<b')) {
    assertNoMarkup(s)
    return [{ text: s }]
  }
  const runs = []
  let buf = ''
  let em = null // 正在累积的强调片段；null = 不在 <b> 里
  let i = 0
  while (i < s.length) {
    const rest = s.slice(i)
    const open = OPEN_B.exec(rest)
    if (open) {
      if (em !== null) throw new Error('富文本里出现嵌套的 <b>')
      if (buf) { runs.push({ text: buf }); buf = '' }
      em = ''
      i += open[0].length
      continue
    }
    if (rest.startsWith('</b>')) {
      i += 4
      if (em === null) throw new Error('富文本里出现多余的 </b>')
      runs.push({ text: em, em: true })
      em = null
      continue
    }
    if (s[i] === '<') throw new Error(`富文本里出现了未识别的标签：${rest.slice(0, 60)}`)
    if (em !== null) em += s[i]
    else buf += s[i]
    i++
  }
  if (em !== null) throw new Error('富文本里的 <b> 没有闭合')
  if (buf) runs.push({ text: buf })
  return runs
}

/** 不该出现标记的字段里出现了标签 → 说明有内容没被导出，必须报错而不是放过 */
function assertNoMarkup(s) {
  if (/<\/?[a-z][^>]*>/i.test(s)) {
    throw new Error(`不该出现标记的字段里出现了标签：${s.slice(0, 80)}`)
  }
}

/** 递归把描述符树里的富文本字段转成片段数组。
    ⚠️ 判"是不是富文本"不能只看键名：`text` 这个键在两处含义不同 ——
       事件行的 `text` 是带 <b> 的正文（富文本），
       而 `enter.text` 是「进入任务清单」这种**纯文案**。
       第一版按键名一刀切，结果 9 个模块的 CTA 文案全被包成了片段数组。
       所以这里要连父节点的 kind 一起看。 */
function walk(node, keyPath = '', key = '') {
  if (Array.isArray(node)) return node.map((v, i) => walk(v, `${keyPath}[${i}]`, key))
  if (node && typeof node === 'object') {
    const out = {}
    const isEventRow = node.kind === 'event'
    for (const [k, v] of Object.entries(node)) {
      const rich = k === 'content' || (k === 'text' && isEventRow)
      out[k] = rich ? toRichText(v) : walk(v, keyPath ? `${keyPath}.${k}` : k, k)
    }
    return out
  }
  if (typeof node !== 'string') return node
  /* `tail` 是唯一一处"整段标记"的字段（知识库"数据接入"磁贴里的规划中清单）。
     它是**生成器里手写的一小段 HTML**，所以只能在这里拆成描述符 ——
     ⚠️ 拆不动就抛错，绝不静默放过：放过它的症状是"少了一块内容"，
     而少内容在页面上不会报错，只会显得那块磁贴空着。 */
  if (key === 'tail') return parseTail(node)
  assertNoMarkup(node)
  return node
}

/** 解析 `tail` 那段 HTML → { items, note, icon }。 */
function parseTail(s) {
  const items = [...s.matchAll(/\[object Object\]([^<]+)/g)].map((m) => m[1].trim())
  const note = /<span class="ml-auto[^"]*">([^<]+)<\/span>/.exec(s)?.[1] ?? null
  if (items.length === 0 || !note) {
    throw new Error(`tail 拆解失败（items ${items.length} 个 / note ${note}）—— 生成器里的写法变了，去看 gen-modules.mjs 的知识库模块`)
  }
  return { kind: 'planned', items, note }
}

const mod = await import(pathToFileURL(tmp).href)
fs.unlinkSync(tmp)

/* ---------- 项目口径指纹 ----------
   gen-modules.mjs 里的 `P` 是 src/data/projects.ts 的**投影**（逐字段一致，见那边的注释）。
   投影就意味着两处，两处就会漂 —— 而漂了之后页面照常渲染，只是数字对不上。
   所以把"投影后的关键字段"压成一个指纹带进生成物，运行时拿 PROJECTS 现算一遍比对：
   不一致就当场报错，而不是等谁发现"工作台说 164 条任务、项目页说 166 条"。
   用非加密哈希（djb2 变体）而不是 sha256：浏览器端要同步执行，SubtleCrypto 是异步的。 */
const fpFields = (p) => [
  p.id, p.scope, p.name, p.status, p.priority, p.progress,
  p.done, p.total, p.due, p.days, p.milestone, p.visibility,
  p.docs, p.risk ?? '', p.budget ?? '',
].join('|')
function fingerprint(rows) {
  let h = 5381
  const s = rows.map(fpFields).join('\n')
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

/* ---------- 只导出组件真正要的两样 ----------
   `projects` / `meta`（SCOPE/STATUS 类串）都**不导出**：
     前者在 src/data/projects.ts，后者在 src/data/meta.ts —— 生成物里再放一份就是第三个副本。 */
const payload = {
  modules: walk(mod.MODULES),
  aggregates: {
    TASKS: mod.TASKS,
    GLOBAL_AVG: mod.GLOBAL_AVG,
    MONTHS: mod.MONTHS,
    BUDGET_TOTAL: mod.BUDGET_TOTAL,
    BY_DAYS: mod.BY_DAYS.map((p) => p.id),
    VIS: mod.VIS.filter(([, n]) => n > 0),
    DOM: Object.fromEntries(
      Object.entries(mod.DOM).map(([k, v]) => [k, { total: v.total, done: v.done, todo: v.todo, avg: v.avg, rate: v.rate }]),
    ),
  },
  projectsFingerprint: fingerprint(mod.P),
}

const TS_OUT = path.join(DIR, '..', 'src/data/workbench-content.ts')
const ts = `/* ============================================================================
   工作台内容层 —— 由 design/export-workbench-content.mjs 生成，**请勿手改**。
   ----------------------------------------------------------------------------
   事实源是 design/gen-modules.mjs 的 MODULES（它同时驱动设计原型 workbench.html）。
   内容不手抄的理由与 CSS 同源那条一致：抄一遍就会漂，而"数字/文案差一点"这种漂
   在页面上不会报错，只会安静地不一致。

   重跑：node design/export-workbench-content.mjs --write
   校验：node design/export-workbench-content.mjs --check
   ========================================================================= */
import type { WorkbenchAggregates, WorkbenchModule } from '../types/workbench'

/** gen-modules.mjs 里项目投影的指纹。src/data/workbench.ts 会拿 PROJECTS 现算一遍比对 */
export const CONTENT_PROJECTS_FINGERPRINT = '${payload.projectsFingerprint}'

export const WORKBENCH_AGGREGATES: WorkbenchAggregates = ${JSON.stringify(payload.aggregates, null, 2)}

export const WORKBENCH_MODULES: WorkbenchModule[] = ${JSON.stringify(payload.modules, null, 2)}
`
const rendered = ts

if (process.argv.includes('--check')) {
  const current = fs.existsSync(TS_OUT) ? fs.readFileSync(TS_OUT, 'utf8') : ''
  if (current !== rendered) {
    console.error('✗ src/data/workbench-content.ts 已过期 —— 重跑：node design/export-workbench-content.mjs --write')
    process.exit(1)
  }
  console.log('✓ src/data/workbench-content.ts 已是最新')
} else if (process.argv.includes('--write')) {
  fs.writeFileSync(TS_OUT, rendered)
  const tiles = payload.modules.reduce((n, m) => n + m.tiles.length, 0)
  const chats = payload.modules.reduce((n, m) => n + m.chat.length, 0)
  console.log(`✓ 已写入 src/data/workbench-content.ts`)
  console.log(`  ${payload.modules.length} 个模块 · ${tiles} 块磁贴 · ${chats} 条对话 · 指纹 ${payload.projectsFingerprint}`)
  console.log(`  模块顺序：${payload.modules.map((m) => m.key).join(' ')}`)
} else {
  const tiles = payload.modules.reduce((n, m) => n + m.tiles.length, 0)
  const chats = payload.modules.reduce((n, m) => n + m.chat.length, 0)
  console.log(`导出结果（未写盘，加 --write 落盘）：${payload.modules.length} 个模块 · ${tiles} 块磁贴 · ${chats} 条对话`)
  console.log(`  模块顺序：${payload.modules.map((m) => m.key).join(' ')}`)
  console.log(`  项目指纹：${payload.projectsFingerprint}`)
}
void OUT
