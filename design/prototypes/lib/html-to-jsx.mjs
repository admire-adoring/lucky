/**
 * HTML 片段 → JSX 表达式（字符串）。
 *
 * 为什么要有这个东西：8 个原型里有 69 个面板、约 60 个弹窗模板，全是静态标记。
 * 手抄一遍是几千行，而且抄错不会报错 —— 只是少了一块内容。
 *
 * 为什么不用 `dangerouslySetInnerHTML`：
 *   本仓库已有明确纪律（见 src/types/workbench.ts 的 TextRun 注释）——
 *   那段 HTML 现在是生成的、将来可能来自用户的笔记内容，当代码执行不合适。
 *   而且内联的 `onclick="…"` 在 React 里根本不会执行，做出来的是一堆**看着有、
 *   点了没反应**的按钮 —— 比不渲染更糟。
 *
 * 这个转换器**不做**的三件事（都是刻意的）：
 *   · 不猜业务语义。`onclick="openEvent('每日站会')"` 只翻译成
 *     `onClick={() => handlers.openEvent('每日站会')}`，函数体留给手写的页面文件。
 *   · 不改类名。CSS 是生成物且大量用组合选择器（`.card.ov-kpi-card`），
 *     改一个类名要连带改一批规则。
 *   · 不静默丢弃。遇到翻译不了的东西就抛错，并把"本事用过哪些 handler"汇报出来，
 *     让人一眼能看出漏了什么。静默跳过是这个流程里最贵的失败方式。
 */

/** 属性名重命名：HTML → React DOM 属性。 */
const ATTR_RENAME = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  maxlength: 'maxLength',
  minlength: 'minLength',
  readonly: 'readOnly',
  contenteditable: 'contentEditable',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  crossorigin: 'crossOrigin',
  datetime: 'dateTime',
  enctype: 'encType',
  formaction: 'formAction',
  accesskey: 'accessKey',
  usemap: 'useMap',
  spellcheck: 'spellCheck',
  srcset: 'srcSet',
  novalidate: 'noValidate',
  accept_charset: 'acceptCharset',
  'accept-charset': 'acceptCharset',
  'http-equiv': 'httpEquiv',
  frameborder: 'frameBorder',
  allowfullscreen: 'allowFullScreen',
}

/** 布尔属性：出现即 true（HTML 里可以写 `disabled` 或 `disabled="disabled"`）。 */
const BOOL_ATTRS = new Set([
  'disabled',
  'required',
  'multiple',
  'hidden',
  'open',
  'reversed',
  'scoped',
  'itemscope',
])

/**
 * 「值受控」属性 → React 的非受控写法。
 *
 * ⚠️ 这一步不能省。原型的表单是**静态**的：`<input value="2026-09-20">`、
 * `<option selected>`。直接搬到 React 会变成受控但**没有 onChange** 的字段 ——
 * 用户一敲键盘就报 "You provided a `value` prop to a form field without an
 * `onChange` handler"，而且输入不进去。改成 `defaultValue` / `defaultChecked`
 * 才是"这本来就该是个非受控输入"的正确表达。
 */
const UNCONTROLLED = {
  value: 'defaultValue',
  checked: 'defaultChecked',
  selected: 'defaultSelected',
}

/** 自闭合空元素。 */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

/** CSS 属性名 → JS 驼峰（`background-color` → `backgroundColor`）。自定义属性保持原样。 */
function camelCss(prop) {
  if (prop.startsWith('--')) return prop
  return prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

const isCustomProp = (prop) => prop.startsWith('--')

/**
 * `style="a: b; --x: y"` → `{{ a: 'b', '--x': 'y' }}`。
 *
 * `transformValue` 由调用方给：内联 style 里的自定义属性也要跟着改名
 * （原型的 `--m-main` 在这里必须变成 `--mw-m-main`，否则运行期取不到值 ——
 * 而**它不报错**，只是颜色没了。这是令牌撞名问题的同一个根，只是出现在属性位置）。
 */
function styleToJsx(raw, transformValue = (v) => v) {
  const decls = []
  let hasCustomProp = false
  for (const chunk of raw.split(';')) {
    const idx = chunk.indexOf(':')
    if (idx < 0) continue
    const prop = chunk.slice(0, idx).trim()
    const value = transformValue(chunk.slice(idx + 1).trim())
    if (!prop || !value) continue
    if (isCustomProp(prop)) hasCustomProp = true
    const key = isCustomProp(prop) ? `'${prop}'` : camelCss(prop)
    decls.push(`${key}: ${JSON.stringify(value)}`)
  }
  if (!decls.length) return null
  const obj = `{ ${decls.join(', ')} }`
  /* 含自定义属性时必须断言到 CSSProperties：那个类型里没有 `--x` 这样的键，
     不写就是一条编译错误（TS2353）。断言不是 any —— 仍然是类型安全的。 */
  return hasCustomProp ? `{${obj} as CSSProperties}` : `{${obj}}`
}

/** 事件属性名映射。**不能靠首字母大写推导** —— `keydown` 推出来是 `onKeydown`， */
/** 而 React 认的是 `onKeyDown`；写错的属性 React 会当未知属性静默透传到 DOM，点了没反应。 */
const EVENT_PROP = {
  click: 'onClick',
  change: 'onChange',
  input: 'onInput',
  keydown: 'onKeyDown',
  keyup: 'onKeyUp',
  keypress: 'onKeyPress',
  submit: 'onSubmit',
  focus: 'onFocus',
  blur: 'onBlur',
  mouseenter: 'onMouseEnter',
  mouseleave: 'onMouseLeave',
  mouseover: 'onMouseOver',
  dblclick: 'onDoubleClick',
  contextmenu: 'onContextMenu',
  scroll: 'onScroll',
}

/**
 * 解析内联事件表达式。
 *
 * 支持 `fn()`、`fn('字面量', 2)`、以及分号串起来的多个调用
 * （原型里真实出现过 `onclick="alert('已创建');closeModal()"`）。
 * 参数里出现 `this` 时，换成 `event.currentTarget` —— React 里没有 `this`。
 *
 * 返回 `{ calls: [{ name, args }], props: [{ key, value }] }`；
 * 无法解析时返回 null，由调用方抛错（**不静默跳过**）。
 */
export function parseHandlerExpression(expr) {
  const statements = expr
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
  const calls = []
  for (const statement of statements) {
    const call = /^([A-Za-z_$][\w$]*)\s*\((.*)\)$/.exec(statement)
    if (!call) return null
    const [, name, argSrc] = call
    // ⚠️ 空参数表要得到 `[]`，不是 `['']`。
    // 踩过：`closeModal()` 被解析成一个"空字符串参数"，于是 props 类型里
    // 多出一个 `closeModal(text: string)` —— 类型不对，但**照样能编译**，
    // 只有调用点写错时才会暴露。零参数的函数在原型里很常见，这条不能含糊。
    const args = []
    if (argSrc.trim() !== '') {
      let depth = 0
      let current = ''
      let inString = null
      for (let i = 0; i < argSrc.length; i++) {
        const ch = argSrc[i]
        if (inString) {
          if (ch === '\\') { current += ch + (argSrc[++i] ?? ''); continue }
          if (ch === inString) inString = null
          current += ch
          continue
        }
        if (ch === "'" || ch === '"' || ch === '`') { inString = ch; current += ch; continue }
        if (ch === '(' || ch === '[' || ch === '{') depth++
        if (ch === ')' || ch === ']' || ch === '}') depth--
        if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; continue }
        current += ch
      }
      args.push(current.trim())
    }
    calls.push({ name, args })
  }
  return calls.length ? calls : null
}

/** 把参数源文本翻译成 JSX 里的实参：`this` → `event.currentTarget`、`document.x` → 当前元素。 */
export function translateArg(argSrc) {
  return argSrc
    .replace(/\bthis\b/g, 'event.currentTarget')
    .replace(/\bdocument\.\w+/g, 'event.currentTarget')
}

/** 从参数源文本推一个 TS 类型（只用到字面量这一档）。 */
function inferArgType(argSrc) {
  if (/\bthis\b/.test(argSrc)) return 'HTMLElement'
  if (/^'.*'$/.test(argSrc) || /^".*"$/.test(argSrc)) return 'string'
  if (/^-?\d+(\.\d+)?$/.test(argSrc)) return 'number'
  if (argSrc === 'true' || argSrc === 'false') return 'boolean'
  return 'string'
}

/**
 * 转换一段 HTML 片段。
 *
 * @param {string} html
 * @param {object} options
 * @param {(name:string, argCount:number) => string|null} options.resolveHandler
 *        把原型里的全局函数名（`openEvent`）映射到页面文件里要调用的名字。
 *        返回 null 表示"这个函数没被处理"，转换器会抛错。
 * @returns {{ code: string, handlers: Map<string, {argTypes: string[], prop?: string}> }}
 */
export function htmlToJsx(html, options = {}) {
  const { resolveHandler = (name) => name } = options
  /** 用到的事件处理器：页面文件要按它生成 props 类型 */
  const handlers = new Map()

  /* 1) 注释先换成占位符，**最后**才还原成 JSX 注释。
     ⚠️ 这里踩过一次：注释如果早早被替换成 JSX 注释留在正文里，
        扫描器会把它当普通文本交给 escapeText，于是左右花括号各自被转义成
        「左花括号 + 引号包住的花括号」那一串，整段变成看不懂的乱码。
        占位符不含花括号，能安全穿过转义那一关。
     ⚠️ 本条注释自己也是活教材：初稿在举例时写出了星号紧跟斜杠的两个字符，
        于是把一个 JS 块注释**提前闭合**了 —— 同一个坑在 CSS 里吃掉过整块令牌，
        在 JS 里直接变成 SyntaxError，而且报错行指向后面很远的地方。
        所以这里提到它时一律用文字描述，不写字面量。 */
  const comments = []
  let src = html.replace(/<!--([\s\S]*?)-->/g, (_, body) => {
    /* 注释体里如果出现星号紧跟斜杠，会提前闭合 JSX 注释 —— 中间插一个空格拆开它 */
    comments.push(body.replace(/\*\//g, '* /'))
    return `\u0000C${comments.length - 1}\u0000`
  })

  // 2) 用「标记栈」扫描：只改标签首尾与属性，正文按 JSX 文本规则转义
  let out = ''
  let i = 0
  while (i < src.length) {
    const lt = src.indexOf('<', i)
    if (lt < 0) {
      out += escapeText(src.slice(i))
      break
    }
    out += escapeText(src.slice(i, lt))
    const gt = src.indexOf('>', lt)
    if (gt < 0) throw new Error(`标签没有闭合：${src.slice(lt, lt + 60)}`)
    const raw = src.slice(lt + 1, gt)
    out += transformTag(raw, handlers, resolveHandler, options)
    i = gt + 1
  }

  // 还原注释占位符。必须在**最后**做：早做的话，JSX 注释里的花括号会被 escapeText 转义掉。
  out = out.replace(/\u0000C(\d+)\u0000/g, (_, n) => `{/*${comments[Number(n)]}*/}`)

  return { code: collapse(out), handlers }
}

/** JSX 文本里的 `{` / `}` / `<` 必须转义，否则会被当成表达式或标签。 */
function escapeText(text) {
  if (!text) return ''
  return text.replace(/\{/g, '{"{"}').replace(/\}/g, '{"}"}')
}

/** 标签名 → 是否空元素；顺带处理 `<!--` 之外的怪情况。 */
function transformTag(raw, handlers, resolveHandler, options = {}) {
  const selfClosing = raw.endsWith('/')
  const body = selfClosing ? raw.slice(0, -1) : raw
  const closing = body.trimStart().startsWith('/')

  if (closing) return `</${body.trim().slice(1).trim()}>`

  // 拆 tagName 与属性串
  const m = /^([A-Za-z][\w:-]*)([\s\S]*)$/.exec(body.trim())
  if (!m) throw new Error(`无法解析标签：<${raw}>`)
  const tag = m[1]
  const attrSrc = m[2]
  /** 大写开头 = 自定义组件（`<ToggleRow>` / `<Switch>`），不是 DOM 元素。 */
  const isComponent = /^[A-Z]/.test(tag)

  const attrs = []
  let rest = attrSrc
  const attrRe = /([:@A-Za-z_][\w:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|[^\s"'>]+))?/g
  let match
  while ((match = attrRe.exec(rest))) {
    const [, rawName, , dq, sq] = match
    const value = dq ?? sq ?? null
    const lower = rawName.toLowerCase()

    // ---- 内联事件 ----
    if (lower.startsWith('on')) {
      const eventName = lower.slice(2)
      const eventProp = EVENT_PROP[eventName]
      if (!eventProp) throw new Error(`没登记的事件名：${rawName}（补进 EVENT_PROP 再生成）`)
      const calls = parseHandlerExpression(value ?? '')
      if (!calls) throw new Error(`无法解析事件：${rawName}="${value}"`)
      const statements = calls.map(({ name, args }) => {
        const target = resolveHandler(name, args.length)
        if (!target) throw new Error(`未处理的事件函数：${name}（来自 ${rawName}="${value}"）`)
        const argTypes = args.map(inferArgType)
        const prev = handlers.get(target)
        if (!prev) handlers.set(target, { argTypes })
        else for (let k = 0; k < argTypes.length; k++) {
          // 同一函数在不同位置传了不同字面量类型时，取更宽的那个
          if (prev.argTypes[k] !== argTypes[k]) prev.argTypes[k] = 'string'
        }
        const translated = args.map(translateArg)
        // 参数里出现 `event`（我们自己注入的形态）时必须把事件对象接进来，
        // 否则生成的是 `() => handlers.foo(event)` —— `event` 在运行期是 undefined，
        // 而**类型检查也不会报**（全局 DOM 里就有个 event，或者干脆被 any 吃掉）。
        const needsEvent = translated.some((a) => /\bevent\b/.test(a))
        return { call: `handlers.${target}(${translated.join(', ')})`, needsEvent }
      })
      const needsEvent = statements.some((s) => s.needsEvent)
      const bodyCode = statements.map((s) => s.call).join('; ')
      /* 两条都不能省：
         · 多条语句必须包花括号 —— 原型里真实存在 `onclick="alert('已创建');closeModal()"`，
           箭头函数的表达式体带分号是**语法错误**；
         · 整个箭头函数还得再包一层花括号，才是 JSX 的属性表达式 ——
           `onClick=() => fn()` 不是合法的 JSX，必须写成 `onClick={() => fn()}`。 */
      const body = statements.length > 1 ? `{ ${bodyCode} }` : bodyCode
      const param = needsEvent ? '(event) => ' : '() => '
      attrs.push(`${eventProp}={${param}${body}}`)
      continue
    }

    // ---- style ----
    if (lower === 'style') {
      const jsx = styleToJsx(value ?? '', options.transformStyleValue)
      if (jsx) attrs.push(`style=${jsx}`)
      continue
    }

    // ---- 布尔属性 ----
    if (BOOL_ATTRS.has(lower)) {
      attrs.push(`${ATTR_RENAME[lower] ?? rawName}=${value === null ? 'true' : truthy(value)}`)
      continue
    }

    // ---- 受控 → 非受控 ----
    if (UNCONTROLLED[lower]) {
      attrs.push(`${UNCONTROLLED[lower]}=${attrValue(value)}`)
      continue
    }

    // ---- 属性名重命名 ----
    const name = ATTR_RENAME[lower] ?? rawName
    if (value === null) {
      /* 组件上的裸属性 = 布尔 true（`<ToggleRow defaultDone />`）。
         DOM 元素上保持字符串 "true" —— 那才是 HTML 的语义，
         而真正的 HTML 布尔属性已经在上面 BOOL_ATTRS 那一支单独处理过。 */
      attrs.push(isComponent ? name : `${name}="true"`)
      continue
    }
    attrs.push(`${name}=${attrValue(value)}`)
  }

  const attrText = attrs.length ? ' ' + attrs.join(' ') : ''
  if (VOID_ELEMENTS.has(tag) || selfClosing) return `<${tag}${attrText} />`
  return `<${tag}${attrText}>`
}
/** `"true"` / `"false"` / `""` / `"disabled"` → JSX 布尔字面量。 */
function truthy(value) {
  if (value === 'false' || value === '') return 'false'
  return 'true'
}

/** 属性值：普通字符串就双引号包起来，内部引号转义。 */
function attrValue(value) {
  if (value === null) return '""'
  if (/["\\]/.test(value)) return `{${JSON.stringify(value)}}`
  return `"${value}"`
}

/**
 * 收尾：把连续空白压成一个空格；行内元素之间的空白是**有语义的**
 * （`<span>a</span> <span>b</span>` 中间那个空格），不能全删。
 * 标签边界处的换行 + 缩进则没有语义，压掉就能得到可读的多行 JSX。
 */
function collapse(code) {
  return code
    .replace(/>\s*\n\s*/g, '>\n')
    .replace(/\n\s*</g, '\n<')
    .trim()
}
