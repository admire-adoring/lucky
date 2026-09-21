#!/usr/bin/env node
/**
 * 生成 **7 个**模块工作区的**面板与弹窗组件**（不含 `projects`，理由见 `MODULES` 的注释）。
 *
 * 产物：`src/pages/workspace/<module>/panels.tsx`
 *   · `TABS`          —— Tab 定义（键 + 标签）
 *   · `<Xxx>Panel`    —— 每个 Tab 的面板标记
 *   · `<Xxx>Modal`    —— 弹窗体（原型的 `openModal(标题, \`模板\`)` 第二参数）
 *   · `MODAL_SPECS`   —— 弹窗的静态标题 + 是否需要触发参数
 *   · `Handlers`      —— 面板要调用的交互回调**类型**（实现写在手写的 Page 文件里）
 *
 * 分工：**标记是生成物，行为是手写的**。
 *   面板/弹窗里的每个 `onclick` 都被翻译成 `handlers.xxx(...)`，函数体一律不在这里实现 ——
 *   转换器猜业务语义必然出错，而"看着有、点了没反应"的按钮比不渲染更难查。
 *
 * 三类"标记里带着状态"的结构会被换成受控组件（这是必须的，不能照搬）：
 *   `.task-item` / `.done-item` + `.task-check` + `.task-text`/`.done-text`
 *     原型靠 `classList.toggle('done')` 命令式改类名，顺带改兄弟元素的类名。
 *     React 里一旦重渲染（例如开一个弹窗），命令式加的类会被抹掉 —— 勾选会自己弹回去。
 *     改由 `<ToggleRow>` 用 Context 驱动，子元素自己读状态。
 *   `.switch`（`onclick="toggleSwitch(this)"`）→ `<Switch defaultOn>`
 *   `.theme-preview`（3 个 `.theme-swatch`）→ `<ThemeSwatches />`
 *
 * 用法：
 *   node design/gen-workspace-pages.mjs           # 写入
 *   node design/gen-workspace-pages.mjs --check   # 只校验产物是否过期
 *   node design/gen-workspace-pages.mjs --report  # 只打印统计
 */
import fs from 'node:fs'
import path from 'node:path'
import { htmlToJsx, parseHandlerExpression, translateArg } from './lib/html-to-jsx.mjs'

const HERE = new URL('.', import.meta.url).pathname
const ROOT = path.resolve(HERE, '..')
const OUT_ROOT = path.join(ROOT, 'src/pages/workspace')

/**
 * 模块 key → 原型文件。顺序即产物的节顺序。
 *
 * ⚠️ **`projects` 不在这张表里**，尽管它的 CSS 仍然由
 * `build-workspace-css.mjs` 生成。理由：
 *   这个转换器只搬**静态标记**，而项目工作区的面板几乎全是脚本按数据渲染出来的
 *   （三个任务视图、两个阅读器、一张图谱、81 处模板插值 + `data-*` 事件委托）。
 *   把它硬塞进来，产物会是一堆空容器 —— 看着有、点了没反应。
 *   所以项目工作区是**手写**的：`src/pages/workspace/ProjectsWorkspace.tsx`
 *   与 `src/components/workspace/project/**`。
 *
 * 判据很干脆：**这个模块的正文里有多少是"标记"、多少是"程序"**。
 * 标记占多数 → 进生成器；程序占多数 → 手写，CSS 仍然生成。
 */
const MODULES = {
  tasks: 'task/task_index.html',
  calendar: 'candle/candle_index.html',
  life: 'life/life_index.html',
  work: 'work/work_index.html',
  learning: 'study/study_index.html',
  knowledge: 'know/knowledge_index.html',
  settings: 'setting/setting_index.html',
}

/** 原型里的全局函数 → 页面文件里要调用的 handler 名。`null` = 有意不迁移。 */
const HANDLER_MAP = {
  alert: 'notice',
  closeModal: 'closeModal',
  toggleSwitch: 'toggleSwitch',
  setTheme: 'setTheme',
}
/**
 * 其余 `openXxx` 一律原样保留（转换器已校验它们都存在）。
 *
 * ⚠️ 还有一类必须放行：**我们自己注入的那两串**（`notice('原型演示：…')` 与
 * `<弹窗key>Open()`）。它们已经是最终 handler 名，不是原型里的函数名 ——
 * 不放行的话，预处理注入一个、转换器再不认识它，会当场抛"未处理的事件函数"。
 * 这个坑的特点是**只在有兜底注入的模块上出现**，别的模块照样生成成功，很容易看漏。
 */
const resolveHandler = (name) => {
  if (name in HANDLER_MAP) return HANDLER_MAP[name]
  if (/^(notice|closeModal|toggleSwitch|setTheme)$/.test(name)) return name
  if (/^\w+Open$/.test(name)) return name
  if (/^open[A-Z]/.test(name)) return name
  return null
}

/* ------------------------------------------------------------------ *
 * 读取原型
 * ------------------------------------------------------------------ */

function readPrototype(rel) {
  const html = fs.readFileSync(path.join(HERE, rel), 'utf8')
  return {
    html,
    body: /<body[^>]*>([\s\S]*?)<\/body>/.exec(html)[1].replace(/<script[\s\S]*?<\/script>/g, ''),
    js: /<script[^>]*>([\s\S]*?)<\/script>/.exec(html)[1],
  }
}

/** Tab：键与标签。标签取自原型 `.tab` 的可见文字。 */
function readTabs(proto) {
  const main = proto.body.slice(proto.body.indexOf('<main class="main">'))
  const nav = /<nav class="tabs"[\s\S]*?<\/nav>/.exec(main)
  if (!nav) return []
  return [...nav[0].matchAll(/<div class="tab[^"]*" data-tab="([^"]+)">([\s\S]*?)<\/div>/g)].map((m) => ({
    key: m[1],
    label: m[2].trim(),
  }))
}

/** 原型 JS 里的 titleMap（面包屑用的副标题）—— 用来交叉校验 Tab 标签，防手滑。 */
function readTitleMap(proto) {
  const m = /const titleMap = \{([\s\S]*?)\};/.exec(proto.js)
  if (!m) return null
  const out = {}
  for (const line of m[1].split('\n')) {
    const kv = /^\s*(\w+)\s*:\s*'([^']*)'\s*,?$/.exec(line)
    if (kv) out[kv[1]] = kv[2]
  }
  return out
}

/**
 * 切面板：`<div class="panel[ active]" data-panel="k">…</div>`
 *
 * ⚠️ 用「配对闭合标签」精确定位，而不是拿「下一个面板开始」当右边界。
 * 踩过：原型的注释落在两个面板之间，于是
 *   · 注释被算进上一个面板的尾部；
 *   · 面板**自己的闭合 div 也被算进内容里** —— 产出的 JSX 每块面板末尾都多一个
 *     `</div>`，报错是 "Expected corresponding JSX closing tag"，
 *     离真正的原因（右边界取错）已经很远了。
 */
function readPanels(proto) {
  const body = proto.body
  const main = body.slice(body.indexOf('<main class="main">'), body.lastIndexOf('</main>'))
  const out = []
  let i = 0
  for (;;) {
    const m = /<div class="panel[^"]*" data-panel="([^"]+)">/.exec(main.slice(i))
    if (!m) break
    const lt = i + m.index
    const gt = lt + m[0].length - 1
    const close = matchClose(main, lt, 'div')
    if (close < 0) break
    out.push({ key: m[1], html: main.slice(gt + 1, close) })
    i = close + '</div>'.length
  }
  return out
}

/**
 * 弹窗：三种形态，都要认。
 *  1. `openModal('静态标题', \`模板\`)` 放在 `getElementById('id').addEventListener('click', …)` 里
 *     → 由页面里那个 `id` 元素触发，标题是静态的
 *  2. `function openXxx(参数) { openModal(标题, \`模板\`) }` → 由内联 onclick 触发，标题常带插值
 *  3. 静态标题里没有插值 → 直接当字面量
 */
function readModals(proto) {
  const js = proto.js
  const modals = []

  // 形态 1：先找 byId 点击监听，再看它的回调里有没有 openModal
  const listenerRe =
    /getElementById\('([\w-]+)'\)\s*\.addEventListener\('click',\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\}\)/g
  for (const m of js.matchAll(listenerRe)) {
    const calls = [...m[2].matchAll(/openModal\(\s*'([^']*)'\s*,\s*`([\s\S]*?)`\s*\)/g)]
    for (const c of calls) {
      modals.push({ key: m[1], title: c[1], html: c[2], triggerId: m[1], arg: null })
    }
  }

  // 形态 2：openXxx(参数) 函数
  const fnRe = /function\s+(open[A-Z]\w*)\s*\(([^)]*)\)\s*\{([\s\S]*?)\n\s*\}/g
  for (const m of js.matchAll(fnRe)) {
    const call = /openModal\(\s*([^,]+?)\s*,\s*`([\s\S]*?)`\s*\)/.exec(m[3])
    if (!call) continue
    const params = m[2].split(',').map((s) => s.trim()).filter(Boolean)
    const titleExpr = call[1].trim()
    const isLiteral = /^['"]/.test(titleExpr)
    modals.push({
      key: m[1],
      // 标题是变量（`title`）时，运行期由触发参数决定
      title: isLiteral ? titleExpr.slice(1, -1) : null,
      html: call[2],
      triggerId: null,
      arg: params[0] ?? null,
    })
  }
  return modals
}

/**
 * 原型 JS 里所有 `getElementById('id').addEventListener('事件', cb)`。
 *
 * 为什么必须收全：**顶栏那排按钮全在 `.topbar-actions` 里**，而顶栏由 React 外壳渲染 ——
 * 不看这份映射的话，`+ 新建任务` / `✨ AI 拆解` / `+ 快速记录` 这些主入口会**凭空消失**
 * （不是变灰、不是报错，是那一排按钮不存在了）。实测 tasks/calendar 各两个、
 * life/work/learning/knowledge 各一个、projects 两个。
 */
function readIdListeners(proto) {
  const out = new Map()
  const re =
    /getElementById\('([\w-]+)'\)\s*\.addEventListener\('(\w+)',\s*(?:\(([^)]*)\)|(\w+))\s*=>\s*\{([\s\S]*?)\n\s*\}\)/g
  for (const m of proto.js.matchAll(re)) {
    const id = m[1]
    if (out.has(id)) continue
    const body = m[5]
    // 回调里直调 openModal 的 → 判定为「开某个弹窗」，交给弹窗那条路径处理
    const opens = /openModal\(/.test(body)
    out.set(id, { id, event: m[2], body, opensModal: opens })
  }
  return out
}

/**
 * 把 JS 回调体里的语句翻成 `fn(参数)` 形式（**不带 `handlers.` 前缀**）。
 *
 * ⚠️ 不带前缀是有意的：这一串会被当成「内联 onclick 表达式」再喂给转换器，
 * 由它统一加上 `handlers.` 前缀。这里若自己先加上，转换器看到 `handlers.notice(...)`
 * 会认不出函数名而当场报错 —— 两处各加一次前缀，等于两层翻译叠在一起。
 * 翻不动就返回 null（由调用方兜底成 notice）。
 */
function translateCallbackBody(body) {
  const statements = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l !== '{' && l !== '}' && !l.startsWith('if ') && !l.startsWith('//'))
    .map((l) => l.replace(/;$/, ''))
  if (!statements.length) return null
  const calls = []
  for (const statement of statements) {
    const parsed = parseHandlerExpression(statement)
    if (!parsed) return null
    for (const { name, args } of parsed) {
      const target = resolveHandler(name)
      if (!target) return null
      calls.push(`${target}(${args.map(translateArg).join(', ')})`)
    }
  }
  return calls.length ? calls.join('; ') : null
}

/** 把 JS 函数体里的语句也做一次翻译（顶栏 `quickAdd` 这类走的是这条路）。 */
function translateInlineStatements(body) {
  const statements = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && l !== '{' && l !== '}' && !l.startsWith('//'))
    .map((l) => l.replace(/;$/, ''))
    .filter(Boolean)
  if (!statements.length || statements.length > 4) return null
  const out = []
  for (const statement of statements) {
    const parsed = parseHandlerExpression(statement)
    if (!parsed) return null
    for (const { name, args } of parsed) {
      const target = resolveHandler(name)
      if (!target) return null
      out.push(`handlers.${target}(${args.map(translateArg).join(', ')})`)
    }
  }
  return out.join('; ')
}

/** 顶栏动作区：`.topbar-actions` 里的按钮，**去掉主题开关**（外壳自己提供一份）。 */
function readTopbarActions(proto) {
  const m = /<div class="topbar-actions">([\s\S]*?)<\/div>\s*<\/header>/.exec(proto.body)
  if (!m) return ''
  return m[1]
    .replace(/<button class="theme-toggle"[^>]*>[\s\S]*?<\/button>/g, '')
    .trim()
}

/* ------------------------------------------------------------------ *
 * 标记改写：三类"带着状态"的结构换成受控组件
 * ------------------------------------------------------------------ */

/**
 * 在转换**之前**对 HTML 做替换。顺序有讲究：先从内到外替换掉最具体的模式，
 * 免得外层的正则把内层已经换好的组件标签又吃回去。
 */
function preprocess(html, ctx) {
  let out = html

  /* 0) 内联 style 里的自定义属性改名。
     ⚠️ 这一条不做的话，令牌层改名只做了一半：CSS 里已经是 `var(--mw-kc)`，
        而内联定义还叫 `--kc` —— 于是**引用存在、值永远取不到**，
        颜色静默丢失（不报错、不缺类型）。原型里真实用的是
        `<div class="card ov-kpi-card" style="--kc: var(--m-main)">`。
        两个地方都要改：属性**名**（定义）与 `var()` 里的**引用**。 */
  out = out.replace(/\bstyle="([^"]*)"/g, (all, value) => `style="${prefixStyleVars(value)}"`)

  // 1) 主题色板：整个 `.theme-preview` 三连换成一个组件
  out = out.replace(
    /<div class="theme-preview">\s*(?:<div class="theme-swatch \w+" onclick="setTheme\([^)]*\)"><\/div>\s*)+<\/div>/g,
    () => {
      ctx.uses.add('ThemeSwatches')
      return '<ThemeSwatches />'
    },
  )

  // 2) 开关：`class="switch[ on]" onclick="toggleSwitch(this)"`
  out = out.replace(
    /<div class="switch( on)?" onclick="toggleSwitch\(this\)"><\/div>/g,
    (_, on) => {
      ctx.uses.add('Switch')
      return on ? '<Switch defaultOn />' : '<Switch />'
    },
  )

  // 3) 任务行 / 已完成行：整块换成 `<ToggleRow defaultDone>`，
  //    内部的 `.task-check` / `.task-text` / `.done-text` 再换成读 Context 的组件。
  //    ⚠️ 必须外层先换（`ToggleRow` 提供 Context），内层才有得读。
  out = replaceToggleRows(out, 'task-item', ctx)
  out = replaceToggleRows(out, 'done-item', ctx)

  // 3b) 下拉的选中项：把 <option selected> 挪成父级 <select defaultValue>。
  //     React 里 selected 写在 option 上属于"受控但无人管"：类型上没有 defaultSelected，
  //     而 selected 会触发 dev 警告（建议改用 select 的 value / defaultValue）。
  //     挪到 select 上才是 React 认可的非受控写法。
  out = out.replace(/<select([^>]*)>([\s\S]*?)<\/select>/g, (all, attrs, inner) => {
    if (!/\bselected\b/.test(inner)) return all
    const picked = /<option[^>]*\bselected\b[^>]*>([\s\S]*?)<\/option>/.exec(inner)
    const label = picked ? picked[1].replace(/<[^>]*>/g, '').trim() : ''
    const cleaned = inner.replace(/(<option[^>]*?)\s+selected(?=[\s>])/g, '$1')
    const withDefault = /\bdefaultValue=/.test(attrs) ? attrs : `${attrs} defaultValue="${label}"`
    return `<select${withDefault}>${cleaned}</select>`
  })

  // 4) 行内的勾选块与文字块：换成读 Context 的组件。
  //    必须在 ToggleRow 之后做（它们要读的是 ToggleRow 提供的 Context）。
  out = replaceInnerToggles(out, ctx)

  // 5) 由 id + addEventListener 触发的元素：把处理补到标记上。
  //    不做这一步的症状是"按钮在那儿、点了没反应" —— 因为原型的监听是脚本挂的，
  //    而脚本不会被搬过来。
  for (const [id, { event, expr }] of Object.entries(ctx.idTriggers ?? {})) {
    out = out.replace(new RegExp(`<([a-z]+)([^>]*\\bid="${id}"[^>]*)>`, 'g'), (all, tag) => {
      const bar = all.replace(/^<([a-z]+)/, '').replace(/>$/, '')
      return `<${tag}${bar} on${event}="${expr}">`
    })
  }

  return out
}

/**
 * `.task-check` → `<TaskCheck />`、`.task-text` → `<TaskText>`、`.done-text` → `<DoneText>`。
 *
 * ⚠️ 原来写在类名里的 `done` 被**丢掉**：勾选状态现在由 `ToggleRow` 的 Context 提供，
 * 标记里再留一个 `done` 会变成第二个真相源 —— 初始态在标记里、之后由状态决定，
 * 两者一旦不一致，症状是"勾了但文字没划线"（或反过来）。
 */
function replaceInnerToggles(html, ctx) {
  let out = html

  // 自闭合的勾选块（`.task-check` 里没有内容，原型靠 textContent 塞 ✓）
  out = out.replace(/<div class="task-check( done)?"[^>]*><\/div>/g, () => {
    ctx.uses.add('TaskCheck')
    return '<TaskCheck />'
  })

  for (const [cls, comp] of [
    ['task-text', 'TaskText'],
    ['done-text', 'DoneText'],
  ]) {
    let from = 0
    for (;;) {
      const open = out.indexOf(`class="${cls}`, from)
      if (open < 0) break
      const lt = out.lastIndexOf('<', open)
      const tagName = /^<([a-z]+)/.exec(out.slice(lt))?.[1]
      if (!tagName) { from = open + 1; continue }
      const gt = out.indexOf('>', open)
      const closeIdx = matchClose(out, lt, tagName)
      if (closeIdx < 0) { from = open + 1; continue }
      const inner = out.slice(gt + 1, closeIdx)
      const replaced = `<${comp}>${inner}</${comp}>`
      out = out.slice(0, lt) + replaced + out.slice(closeIdx + `</${tagName}>`.length)
      from = lt + replaced.length
      ctx.uses.add(comp)
    }
  }
  return out
}

/**
 * 内联 style 里的自定义属性加 `--mw-` 前缀：既改名（定义），也改 `var()` 引用。
 *
 * ⚠️ 不做这一条的话，令牌改名只做了一半：CSS 里已经是 `var(--mw-kc)`，
 * 而内联定义还叫 `--kc` —— **引用在、值永远取不到**，颜色静默丢失
 * （不报错、不缺类型、编辑器也不提示）。原型里真实用的是
 * `<div class="card ov-kpi-card" style="--kc: var(--m-main)">` 这种写法。
 *
 * 已经带前缀的不重复加，否则会得到 `--mw-mw-kc` 这种四不像 —— 同样不报错。
 */
function prefixStyleVars(value) {
  const rename = (name) => (name.startsWith('--mw-') ? name : `--mw-${name.slice(2)}`)
  return value
    .replace(/var\(\s*(--[A-Za-z0-9_-]+)/g, (_, name) => `var(${rename(name)}`)
    .replace(/(^|[;\s])(--[A-Za-z0-9_-]+)\s*:/g, (_, pre, name) => `${pre}${rename(name)}:`)
}

/** 把一个 `class="task-item"`/`"done-item"` 的开标签换成 `<ToggleRow …>`，闭标签换成 `</ToggleRow>`。 */
function replaceToggleRows(html, cls, ctx) {
  // 找开标签，然后配对到它自己的闭标签
  let out = html
  let searchFrom = 0
  for (;;) {
    const open = out.indexOf(`class="${cls}"`, searchFrom)
    if (open < 0) break
    // 往回找到 `<`
    const lt = out.lastIndexOf('<', open)
    const tagName = /^<([a-z]+)/.exec(out.slice(lt))?.[1]
    if (!tagName) { searchFrom = open + 1; continue }
    const gt = out.indexOf('>', open)
    const openTag = out.slice(lt, gt + 1)
    const done = /\bdone\b/.test(openTag)
    // 配对闭合标签
    const closeIdx = matchClose(out, lt, tagName)
    if (closeIdx < 0) { searchFrom = open + 1; continue }
    const inner = out.slice(gt + 1, closeIdx)

    /* ⚠️ 原来的 `class` **必须原样带走**：`.task-item` / `.done-item` 正是那份生成的
       CSS 在消费的接口（`.card .task-item`、`.task-check.done + …` 之类）。
       丢掉它，整行的排版与间距会全部失效 —— 而且页面照常渲染，只是"变丑了"，
       不会报任何错。这里同时把其它属性（内联 style 之类）一并搬过去。 */
    const extraAttrs = openTag
      .replace(/^<[a-z]+/, '')
      .replace(/>$/, '')
      .replace(/\s*class="[^"]*"/, '')
      .trim()
    const attrs = [`className="${cls}"`, done ? 'defaultDone' : '', extraAttrs]
      .filter(Boolean)
      .join(' ')

    const replaced = `<ToggleRow ${attrs}>${inner}</ToggleRow>`
    out = out.slice(0, lt) + replaced + out.slice(closeIdx + `</${tagName}>`.length)
    searchFrom = lt + replaced.length
    ctx.uses.add('ToggleRow')
  }
  return out
}

/** 从 `start` 处的开标签出发，找同名标签的配对闭合位置。 */
function matchClose(html, start, tagName) {
  const openRe = new RegExp(`<${tagName}\\b`, 'g')
  const closeRe = new RegExp(`</${tagName}>`, 'g')
  let depth = 0
  let i = start
  while (i < html.length) {
    openRe.lastIndex = i
    closeRe.lastIndex = i
    const o = openRe.exec(html)
    const c = closeRe.exec(html)
    if (!c) return -1
    if (o && o.index < c.index) {
      // 自闭合不算一层
      const gt = html.indexOf('>', o.index)
      if (html[gt - 1] === '/') { i = gt + 1; continue }
      depth++
      i = gt + 1
    } else {
      depth--
      if (depth === 0) return c.index
      i = c.index + c[0].length
    }
  }
  return -1
}

/**
 * 把 JS 模板串里的 `${expr}` 换成占位符，转换完再换回 `{expr}`。
 * 这样插值在**文本位置**与**属性位置**都能正确处理（两处的 JSX 写法一样）。
 */
function extractInterpolations(template) {
  const exprs = []
  const html = template.replace(/\$\{([\s\S]*?)\}/g, (_, expr) => {
    exprs.push(expr.trim())
    return `@@INTERP${exprs.length - 1}@@`
  })
  return { html, exprs }
}

const restoreInterpolations = (code, exprs) => {
  /* ⚠️ 先处理**带引号**的形态，再处理裸的。
     踩过：原型写的是 value="${title}"，去掉引号前整串是 value="@@INTERP0@"，
     直接做裸替换会得到 defaultValue="{title}" —— 一个**字符串字面量**，
     于是组件里的 title 绑定变成未使用（noUnusedParameters 报错），
     而界面上的输入框里显示的是花括号本身。属性位置必须落到 {expr}，不能留在引号里。 */
  return code
    .replace(/"@@INTERP(\d+)@@"/g, (_, i) => `{${exprs[Number(i)]}}`)
    .replace(/'@@INTERP(\d+)@@'/g, (_, i) => `{${exprs[Number(i)]}}`)
    .replace(/@@INTERP(\d+)@@/g, (_, i) => `{${exprs[Number(i)]}}`)
}

/* ------------------------------------------------------------------ *
 * 产出
 * ------------------------------------------------------------------ */

const IDENT = {
  'task-item': 'TaskItem',
  'done-item': 'DoneItem',
  'theme-preview': 'ThemeSwatches',
}

/** `new-task-btn` / `aiAdd` → PascalCase 组件名 */
function pascal(name) {
  return name
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')
}

const report = []

function buildModule(key, proto) {
  const tabs = readTabs(proto)
  const titleMap = readTitleMap(proto)
  const panels = readPanels(proto)
  const modals = readModals(proto)
  const idListeners = readIdListeners(proto)
  const topbarHtml = readTopbarActions(proto)

  /* --- Tab 与 titleMap 交叉校验：两处标签必须一致，不一致就是原型自己漂了 --- */
  const problems = []
  if (titleMap) {
    for (const tab of tabs) {
      if (titleMap[tab.key] && titleMap[tab.key] !== tab.label) {
        problems.push(`Tab "${tab.key}" 标签不一致：.tab 写「${tab.label}」，titleMap 写「${titleMap[tab.key]}」`)
      }
    }
  }
  if (panels.length !== tabs.length) {
    problems.push(`面板数 ${panels.length} ≠ Tab 数 ${tabs.length}`)
  }
  const panelKeys = new Set(panels.map((p) => p.key))
  for (const tab of tabs) if (!panelKeys.has(tab.key)) problems.push(`Tab "${tab.key}" 没有对应面板`)
  for (const p of panels) if (!tabs.some((t) => t.key === p.key)) problems.push(`面板 "${p.key}" 没有对应 Tab`)
  if (problems.length) {
    console.error(`✗ ${key} 原型自身不一致：`)
    for (const p of problems) console.error('   ' + p)
    process.exitCode = 1
  }

  /* --- 由 id 触发的元素：先建映射，供预处理把处理补到标记上 ---
     三种来源，优先级从高到低：
       1. 某个弹窗的触发器（`getElementById(id).addEventListener('click', () => openModal(…))`）
       2. 其它已登记的监听：把回调体翻成 `handlers.xxx(…)`（`#quickAdd` 那类）
       3. **都没有**：仍然给一个 `notice('原型演示：<按钮文字>')`。
          第 3 条是刻意的 —— 宁可弹一句"原型演示"，也不要一个点下去毫无反应的按钮：
          后者用户分不清是"没做"还是"卡住了"，是最贵的一种缺陷。 */
  const idTriggers = {}
  const modalByKey = new Map()
  for (const mo of modals) {
    if (modalByKey.has(mo.key)) {
      console.error(`✗ ${key} 有两个弹窗都叫 ${mo.key}`)
      process.exitCode = 1
    }
    modalByKey.set(mo.key, mo)
    if (mo.triggerId) idTriggers[mo.triggerId] = { event: 'click', expr: `${mo.key}Open()` }
  }

  // 标记里所有带 id 的元素（顶栏 + 面板），用来兜第 3 条
  const markup = proto.body
  const idsInMarkup = new Map()
  for (const m of markup.matchAll(/<([a-z]+)([^>]*\bid="([\w-]+)"[^>]*)>/g)) {
    const [, tag, rest, id] = m
    const after = markup.slice(m.index + m[0].length)
    const label = tag === 'input' || tag === 'textarea'
      ? (/\bplaceholder="([^"]*)"/.exec(rest)?.[1] ?? id)
      : after.split('<')[0].replace(/<[^>]*>/g, '').trim() || id
    idsInMarkup.set(id, { tag, label })
  }

  for (const [id, meta] of idsInMarkup) {
    if (idTriggers[id]) continue
    const listener = idListeners.get(id)
    if (listener && !listener.opensModal) {
      const expr = translateCallbackBody(listener.body)
      if (expr) {
        idTriggers[id] = { event: listener.event, expr }
        continue
      }
    }
    const label = (meta.label || id).replace(/'/g, "\\'")
    idTriggers[id] = { event: listener?.event ?? 'click', expr: `notice('原型演示：${label}')` }
  }

  const ctx = { uses: new Set(), idTriggers }
  const handlersUsed = new Map()

  /** 把一次转换里出现过的 handler 并进总表。 */
  const accumulate = (handlers) => {
    for (const [name, info] of handlers) {
      const prev = handlersUsed.get(name)
      if (!prev) handlersUsed.set(name, [...info.argTypes])
      else for (let i = 0; i < info.argTypes.length; i++) {
        if (prev[i] !== info.argTypes[i]) prev[i] = 'string'
      }
    }
  }

  const convert = (label, html) => {
    const { code, handlers } = htmlToJsx(preprocess(html, ctx), { resolveHandler })
    accumulate(handlers)
    return code
  }

  /* --- 面板 --- */
  const panelCode = panels.map((p) => ({
    key: p.key,
    name: `${pascal(p.key)}Panel`,
    code: convert(`panel:${p.key}`, p.html),
    bytes: p.html.length,
  }))

  /* --- 弹窗 --- */
  const modalCode = modals.map((mo) => {
    const { html, exprs } = extractInterpolations(mo.html)
    const bodyCtx = { ...ctx, idTriggers: {} }
    const { code, handlers } = htmlToJsx(preprocess(html, bodyCtx), { resolveHandler })
    /* ⚠️ 弹窗体里的 handler **也必须计入** `Handlers` 接口。
       漏掉的话，弹窗里那句 `onClick={() => handlers.closeModal()}` 会引到一个
       接口里不存在的成员 —— 而且是**编译错**（不是静默），只是报错位置在生成物里，
       很容易被当成生成器坏了。第一次生成时就踩到了这一条。 */
    accumulate(handlers)
    return {
      key: mo.key,
      name: `${pascal(mo.key)}Modal`,
      title: mo.title,
      arg: mo.arg,
      code: restoreInterpolations(code, exprs),
      argExpr: exprs.find((e) => e === mo.arg) ?? null,
      bytes: mo.html.length,
    }
  })

  /* --- 顶栏动作区 ---
     必须生成：那排按钮属于页面，不属于外壳。外壳只提供窗口控制、面包屑、主题与账户，
     而 `+ 新建任务` / `✨ AI 拆解` / `+ 快速记录` 是**每个模块各不相同**的。 */
  const topbarCode = topbarHtml ? convert('topbar', topbarHtml) : null

  /* --- 组装文件 --- */
  const tabsForTs = tabs.map((t) => `  { key: '${t.key}', label: '${t.label}' },`).join('\n')
  const L = []
  L.push(`/* @generated by design/gen-workspace-pages.mjs —— 请勿手改 */`)
  L.push(`/**`)
  L.push(` * ${key} 模块的面板与弹窗标记。`)
  L.push(` *`)
  L.push(` * 事实源：design/${MODULES[key]}`)
  L.push(` * 重新生成：node design/gen-workspace-pages.mjs`)
  L.push(` *`)
  L.push(` * 这里**只有标记**，没有行为：每个 onclick 都被翻译成 \`handlers.xxx(...)\`，`)
  L.push(` * 实现写在手写的 <${pascal(key)}Workspace />（同目录）。`)
  L.push(` */`)
  L.push('')

  const imports = []
  /* ⚠️ 生成物里只要出现 `as CSSProperties`，就必须 import 那个类型。
     它来自 react 的类型导出，而 tsconfig 开着 verbatimModuleSyntax ——
     只能写成 `import type`，写成值导入会被判错。 */
  const needsCssProperties = [topbarCode, ...panelCode.map((p) => p.code), ...modalCode.map((m) => m.code)].some(
    (code) => code && code.includes('as CSSProperties'),
  )
  if (needsCssProperties) imports.push(`import type { CSSProperties } from 'react'`)
  if (ctx.uses.has('ToggleRow') || ctx.uses.has('Switch') || ctx.uses.has('ThemeSwatches')) {
    /* ⚠️ 只 import **真正用到**的那几个。tsconfig 开着 noUnusedLocals，
       多 import 一个就是一条编译错误 —— 而且报在生成物里，
       看起来像生成器坏了。这里踩过一次：只要用了 ToggleRow 就把
       TaskCheck / TaskText / DoneText 全带上，而有些模块只用其中两个。 */
    const names = ['ToggleRow', 'Switch', 'ThemeSwatches', 'TaskCheck', 'TaskText', 'DoneText'].filter(
      (n) => ctx.uses.has(n),
    )
    imports.push(`import { ${names.join(', ')} } from '../../../components/workspace/toggles'`)
  }
  if (imports.length) {
    L.push(...imports)
    L.push('')
  }

  L.push(`import type { ModuleTab } from '../../../data/workspace/types'`)
  L.push('')
  L.push(`/** Tab 定义（键 + 标签）。标签与原型顶栏面包屑的 titleMap 交叉校验过。 */`)
  L.push(`export const TABS: ModuleTab[] = [`)
  L.push(tabsForTs)
  L.push(`]`)
  L.push('')

  L.push(`/** 本模块所有交互回调 —— 实现写在 <${pascal(key)}Workspace /> 里。 */`)
  L.push(`export interface Handlers {`)
  for (const [name, argTypes] of [...handlersUsed].sort()) {
    const args = argTypes.map((t, i) => `arg${i}: ${t}`).join(', ')
    L.push(`  ${name}: (${args}) => void`)
  }
  L.push(`}`)
  L.push('')

  L.push(`export const MODAL_SPECS = {`)
  for (const mo of modalCode) {
    const title = mo.title === null ? 'null' : `'${mo.title.replace(/'/g, "\\'")}'`
    L.push(`  ${mo.key}: { title: ${title}${mo.arg ? `, arg: true` : ''} },`)
  }
  L.push(`} as const`)
  L.push('')
  L.push(`export type ModalKey = keyof typeof MODAL_SPECS`)
  L.push('')

  for (const p of panelCode) {
    /* ⚠️ 接口要**恒定**，不能按"用没用上 handlers"来裁剪签名。
       裁剪之后，手写的 Page 文件就必须知道"这一块面板到底用不用 handlers"——
       生成器的内部判断泄漏进了手写代码，而它一变，手写代码就编不过。
       所以签名固定，没用到时把绑定名写成 `_handlers`（tsconfig 的
       noUnusedParameters 豁免下划线开头的名字）。 */
    const panelBinding = p.code.includes('handlers.') ? 'handlers' : 'handlers: _handlers'
    L.push(`export function ${p.name}({ ${panelBinding} }: { handlers: Handlers }) {`)
    L.push(`  return (`)
    /* ⚠️ Fragment 包裹不能省：一个面板里有并列的多块 `<section>` / `<div>`，
       而 JSX 的 `return ( … )` 只允许**一个**根元素。
       少了它，报错是一串指向生成物的 "JSX expressions must have one parent element"，
       很容易被误读成"生成器坏了"。 */
    L.push(`    <>`)
    L.push(indent(p.code, 3))
    L.push(`    </>`)
    L.push(`  )`)
    L.push(`}`)
    L.push('')
  }

  /* 顶栏动作区 —— **即使一个都没有也照样导出**。
     理由是接口恒定：手写的 Page 文件统一写 `<TopbarActions handlers={…} />`，
     不需要知道"这个模块顶栏有没有按钮"。裁剪掉的话，设置页那种
     "顶栏只剩主题开关"的模块就会编不过，而生成器一改，手写代码跟着崩。 */
  L.push(`/**`)
  L.push(` * 顶栏动作区 —— 原型的 \`.topbar-actions\` 里的按钮。`)
  L.push(` *`)
  L.push(` * 为什么要生成：这排按钮**每个模块都不一样**（任务页是「AI 拆解 / 新建任务」，`)
  L.push(` * 生活页是「快速记录」，设置页一个都没有）。只把它们交给外壳会全丢掉 ——`)
  L.push(` * 而且丢得没有声响：外壳照常渲染，只是那排主入口不存在了。`)
  L.push(` * 主题开关已从这里剔掉（外壳自己提供一份，全站只能有一个主题开关）。`)
  L.push(` */`)
  if (topbarCode) {
    const usesHandlers = topbarCode.includes('handlers.')
    L.push(`export function TopbarActions({ ${usesHandlers ? 'handlers' : 'handlers: _handlers'} }: { handlers: Handlers }) {`)
    L.push(`  return (`)
    L.push(`    <>`)
    L.push(indent(topbarCode, 3))
    L.push(`    </>`)
    L.push(`  )`)
    L.push(`}`)
  } else {
    L.push(`export function TopbarActions({ handlers: _handlers }: { handlers: Handlers }) {`)
    L.push(`  return null`)
    L.push(`}`)
  }
  L.push('')

  for (const mo of modalCode) {
    /* 同面板：接口恒定，没用到的那一项把绑定名写成 `_xxx`（noUnusedParameters 豁免）。
       带参数的弹窗一定声明它的参数 —— 即使弹窗体本身没用到（标题在弹窗头上，
       由页面提供），调用点也必须能照常传。 */
    const bindings = ['handlers']
    const types = ['handlers: Handlers']
    if (!mo.code.includes('handlers.')) bindings[0] = 'handlers: _handlers'
    if (mo.arg) {
      bindings.push(mo.arg)
      types.push(`${mo.arg}: string`)
      if (!new RegExp(`\\b${mo.arg}\\b`).test(mo.code)) bindings[bindings.length - 1] = `${mo.arg}: _${mo.arg}`
    }
    L.push(`/** 弹窗体：原型 \`${mo.key}\` ${mo.title ? `标题「${mo.title}」` : `标题由触发参数决定`} */`)
    L.push(`export function ${mo.name}({ ${bindings.join(', ')} }: { ${types.join('; ')} }) {`)
    L.push(`  return (`)
    // 弹窗体顶层就是若干个并列的 `.form-field`，同样需要 Fragment（见面板处的注释）
    L.push(`    <>`)
    L.push(indent(mo.code, 3))
    L.push(`    </>`)
    L.push(`  )`)
    L.push(`}`)
    L.push('')
  }

  return {
    key,
    file: L.join('\n'),
    tabs,
    panels: panelCode,
    modals: modalCode,
    handlers: [...handlersUsed].sort(),
    uses: [...ctx.uses],
  }
}

function indent(code, level) {
  const pad = '  '.repeat(level)
  return code
    .split('\n')
    .map((l) => (l.trim() ? pad + l : l))
    .join('\n')
}

const results = []
for (const [key, rel] of Object.entries(MODULES)) {
  results.push(buildModule(key, readPrototype(rel)))
}

const mode = process.argv[2]

if (mode === '--report') {
  for (const r of results) {
    console.log(
      `${r.key.padEnd(10)} Tab ${String(r.tabs.length).padStart(2)} · 面板 ${String(r.panels.length).padStart(2)} · 弹窗 ${String(r.modals.length).padStart(2)} · 产物 ${String(r.file.length).padStart(6)} 字符`,
    )
    console.log(`           handlers: ${r.handlers.map(([n, a]) => `${n}(${a.join(',')})`).join(', ') || '（无）'}`)
    if (r.uses.length) console.log(`           受控组件: ${r.uses.join(', ')}`)
  }
  process.exit(process.exitCode ?? 0)
}

if (mode === '--check') {
  let bad = 0
  for (const r of results) {
    const file = path.join(OUT_ROOT, r.key, 'panels.tsx')
    const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
    if (prev !== r.file) {
      console.error(`✗ ${path.relative(ROOT, file)} 已过期`)
      bad++
    }
  }
  if (bad) {
    console.error('请运行：node design/gen-workspace-pages.mjs')
    process.exit(1)
  }
  console.log('✓ panels.tsx 与原型一致')
} else {
  for (const r of results) {
    const dir = path.join(OUT_ROOT, r.key)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'panels.tsx'), r.file)
  }
  console.log(`✓ 已写入 ${results.length} 个模块的 panels.tsx`)
  for (const r of results) console.log(`   ${r.key.padEnd(10)} ${r.file.length} 字符`)
}
