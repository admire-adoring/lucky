/* ============================================================================
   跑 gen-modules.mjs，并在它挂掉时给出可操作的提示。
   ----------------------------------------------------------------------------
   为什么要这一层：
     1) 那个文件里所有 CSS / JS / 文档常量都是**模板字符串**，而模板字符串内部的
        注释一旦用反引号包住标识符（例如包住 border 或 --r），就会**提前闭合它**。
        报错长这样：SyntaxError: Unexpected identifier 'xxx'
        位置指向的往往是"受害者"那一行，而真正的原因在上一两行的注释里。
        （这个坑本会话踩了八次，每次都要白跑一轮定位。）
     2) 所以本脚本先做一次 **preflight 扫描**，一次列出所有可疑行；
        若仍挂了，再从报错行反查一遍并打印附近原文。

   用法：node design/run-gen.mjs [--dry]
   ========================================================================= */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const GEN = fileURLToPath(new URL('./gen-modules.mjs', import.meta.url))
const SRC = fs.readFileSync(GEN, 'utf8')

/* ---- preflight：扫描"模板字符串内部出现的反引号" ----
   难点是**合法的嵌套模板**（形如 ${cond ? \`<b>\` : ''}）不能被误报 ——
   一次实测里 64 个命中有 58 个是合法的。所以再加一条过滤：
   真问题一定出现在**中文注释**里，行尾会停在标点/文字上；
   而合法嵌套模板的行尾总是 JS 字符（} , ) ; 或反引号本身）。 */
function scanTemplateBackticks(src) {
  const out = []
  let i = 0
  let line = 1
  let inTpl = false
  const n = src.length
  const eol = (from) => {
    const j = src.indexOf('\n', from)
    return j === -1 ? n : j
  }
  while (i < n) {
    const c = src[i]
    if (c === '\n') {
      line++
      i++
      continue
    }
    if (!inTpl) {
      if (c === '/' && src[i + 1] === '/') {
        while (i < n && src[i] !== '\n') i++
        continue
      }
      if (c === '/' && src[i + 1] === '*') {
        i += 2
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
          if (src[i] === '\n') line++
          i++
        }
        i += 2
        continue
      }
      if (c === "'" || c === '"') {
        const q = c
        i++
        while (i < n && src[i] !== q) {
          if (src[i] === '\\') i++
          if (src[i] === '\n') line++
          i++
        }
        i++
        continue
      }
      if (c === '`') {
        inTpl = true
        i++
        continue
      }
      i++
      continue
    }
    if (c === '\\') {
      i += 2
      continue
    }
    if (c === '$' && src[i + 1] === '{') {
      let depth = 1
      i += 2
      while (i < n && depth > 0) {
        if (src[i] === '{') depth++
        else if (src[i] === '}') depth--
        else if (src[i] === '\n') line++
        i++
      }
      continue
    }
    if (c === '`') {
      const end = eol(i)
      const rest = src.slice(i + 1, end)
      // ⚠️ 允许集里必须包含 `{`：合法的嵌套模板作为**实参**时，行尾常是 `) {`
      //    （if / for 的条件里用模板）。少了这一条，那两行会被反复误报，
      //    而"每次跑都报两句假的"正是让人开始忽略这个警告的起点。
      const looksLikeEnd = /^[\s;,)\]}]*$/.test(rest) || /^[\s;,)\]}]*\{/.test(rest) || /^\s*\+/.test(rest)
      if (!looksLikeEnd) {
        const text = src.slice(src.lastIndexOf('\n', i) + 1, end)
        const tail = text.trim().slice(-1)
        // 行尾停在 JS 字符上 → 几乎一定是合法的嵌套模板
        if (!/[;,)\]}`]/.test(tail)) out.push({ line, text: text.trim() })
      }
      inTpl = false
      i++
      continue
    }
    i++
  }
  return out
}

const suspects = scanTemplateBackticks(SRC)
if (suspects.length) {
  console.error('\n' + '─'.repeat(74))
  console.error(`⚠️ 预检：疑似「模板字符串内部的注释里用了反引号」共 ${suspects.length} 处。`)
  console.error('   那些 CSS / JS / 文档常量都是模板字符串 —— 注释里提到标识符请一律用「」。')
  suspects.forEach((s) => console.error('   第 ' + s.line + ' 行 | ' + s.text.slice(0, 104)))
  console.error('─'.repeat(74) + '\n')
}

const r = spawnSync(process.execPath, [GEN, ...process.argv.slice(2)], { encoding: 'utf8' })
process.stdout.write(r.stdout || '')

let err = r.stderr || ''
const m = err.match(/gen-modules\.mjs:(\d+)/)
if (r.status !== 0 && /SyntaxError/.test(err) && m) {
  const lineNo = Number(m[1])
  const lines = SRC.split('\n')
  err += '\n' + '─'.repeat(74) + '\n'
  err += '⚠️ 报错行附近（多半是上面某行注释里的反引号提前闭合了模板字符串）：\n'
  for (let i = Math.max(0, lineNo - 4); i < Math.min(lines.length, lineNo + 2); i++) {
    err += '   ' + String(i + 1).padStart(5) + ' | ' + lines[i].slice(0, 112) + '\n'
  }
  err += '─'.repeat(74) + '\n'
}
process.stderr.write(err)
process.exit(r.status ?? 1)
