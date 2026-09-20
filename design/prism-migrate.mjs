#!/usr/bin/env node
/* ============================================================================
   标记迁移：把原型的表面类名从「旧玻璃五档」换成 Prism 的 `.g` + `.g1~.g4`
   ----------------------------------------------------------------------------
   为什么要有这个脚本，而不是手工改一遍：
     同一批类名在**两个地方**各存在一份 —— workbench.html 的静态标记，和
     gen-modules.mjs 的模板字符串（九面板 / 45 磁贴 / 九段对话 / HERO_CSS / SCRIPT）。
     手改一处、漏另一处，下一次跑生成器就会把自己改的覆盖回去，
     而"被覆盖"这件事本身**不报错**（生成器只认自己的模板）。

   规则分两层：
     · 机械层（本脚本的 RULES）—— 只做"同一个词换另一个词"，可反复跑
     · 角色层（ROLE_FIXES）—— 少数几处的档位不是由类名唯一决定的，
       必须按它在页面上的角色来定（搜索框是"输入框"不是"卡片"、外壳要 `shell` 等）

   用法：
     node design/prism-migrate.mjs           # 迁移两个文件
     node design/prism-migrate.mjs --check   # 只报告剩余旧类名，不写盘
   ========================================================================= */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const FILES = [path.join(DIR, 'workbench.html'), path.join(DIR, 'gen-modules.mjs')]
const DRY = process.argv.includes('--check')

/* ---------- 机械层 ---------- */
/** 旧材质 → Prism 档位。`g--refr` 只给大面积面板（卡片 / 瓦片）；
 *  控件档（g1）刻意不给折射 —— 1px 控件上的折射会变成"双线"。 */
const RULES = [
  [/\bglass-panel\b/g, 'g g3 g--refr'],
  [/\bglass-bar\b/g, 'shell g g4'],
  [/\bglass-soft\b/g, 'g g1'],
  [/\bglass-lift\b/g, 'g-lift'],
]

/** 一个 class 串里是否已经有材质档位 */
const HAS_MAT = /(^|\s)(g|g1|g2|g3|g4|shell)(\s|$)/
/** 材质自己拥有投影（--g-sh-*），所以旧的 shadow-* 工具类一律撤掉；
 *  同属性覆盖的胜负看产出顺序，留着就是"哪天不生效了也查不出来"。
 *  ⚠️ `hover:` 变体必须排在裸词**之前**：`\bbg-surface\b` 会在
 *  `hover:bg-surface-raised` 内部命中，把 `bg-surface-raised` 吃掉、只留下一个
 *  悬空的 `hover:` —— 而悬空的 `hover:` 不是合法类名，它会静默地什么都不做
 *  （实测就是这样：类串里留着一串 `hover:`，页面上没有任何报错）。 */
const DROP_WHEN_MAT = [
  /\bhover:bg-surface(?:-raised|-sunken)?\b/g,
  /\bfocus:bg-surface(?:-raised|-sunken)?\b/g,
  /\bhover:shadow-(?:xs|sm|md|lg|xl)\b/g,
  /\bhover:border-line-strong\b/g,
  /\bbg-surface(?:-raised|-sunken)?\b/g,
  /\bborder-line-strong\b/g,
  /\bshadow-(?:xs|sm|md|lg|xl)\b/g,
]
/** 悬空的伪类前缀：后面直接跟空白或引号 = 它修饰的东西已经被删掉了 */
const DANGLING = /(?:^|\s)(hover|focus|active):(?=\s|"|$)/g

function migrateClass(c) {
  for (const [re, to] of RULES) c = c.replace(re, to)
  let out = c
  if (HAS_MAT.test(out)) {
    for (const re of DROP_WHEN_MAT) out = out.replace(re, '')
  } else {
    /* 没有玻璃类、只有表面色 —— 按"它是什么"给档位：
       凹陷的小盒子（空态 / 芯片容器）→ g1；其余（正文承载）→ g3 */
    out = out
      .replace(/\bbg-surface-sunken\b/g, 'g g1')
      .replace(/\bbg-surface-raised\b/g, 'g g1')
      .replace(/\bbg-surface\b/g, 'g g3 g--refr')
  }
  out = out.replace(DANGLING, ' ').replace(/[ \t]{2,}/g, ' ')
  return out.trim()
}

/* ---------- 角色层 ---------- */
/** 这几处的档位不由类名唯一决定，按它在页面上的角色定。
 *  ⚠️ 用**特征锚点**（一个别处不会出现的类名片段）整段替换，而不是写死整个类串：
 *  写死整串的话，上游少一个类名（比如刚被 DROP 掉的那个）就匹配不上，
 *  而匹配不上**不报错**，只会静静地什么都不做（第一次跑就栽在这里）。 */
const ROLE_FIXES = [
  /* 环上九枚入口：**每个菜单域一种颜色**的落点。
     撤掉 text-ink-500 / border-line / hover:text-ink-900 —— 三个都在跟
     `.g.mod-tile` 抢属性（材质未分层，它们抢不过；留着就是"写了但不生效"）。 */
  [
    /(class=")radial__item[^"]*(")/g,
    '$1radial__item g g1 mod-tile flex items-center justify-center transition-colors duration-150$2',
  ],
  /* 搜索框：它是**输入框**，不是卡片的缩小版。Prism 用"遮挡 α 最实的一档 + 可辨边界"，
     所以撤掉 border-transparent / bg-ink-50 / focus:border-brand-500 / focus:bg-surface ——
     前两个在跟 .input 抢背景与边界；后两个是旧方案"用品牌色画焦点"的办法，
     Prism 的焦点环由 --ring 给（.input:focus-visible）。
     锚点用 pl-[35px]（左内边距给放大镜让位），这个值只在搜索框上出现。 */
  [
    /(class=")[^"]*pl-\[35px\][^"]*(")/g,
    '$1input h-9 w-full rounded-full pl-[35px] pr-[52px] text-13 outline-none transition-colors duration-150 ease-out max-[1240px]:pr-3$2',
  ],
  /* ⌘K 徽标：外环用的是 --g-oc-ring（.85）—— 判据是"与背后底色断开"、不是"面板够不够实"，
     所以它不该走 .g1（面板 α .10），而是专用 .badge。锚点是 font-mono + text-10-5。 */
  [
    /(class=")[^"]*font-mono text-10-5[^"]*(")/g,
    '$1badge absolute right-[9px] rounded-[5px] px-1.5 py-0.5 font-mono text-10-5 leading-[1.5] text-ink-400 max-[1240px]:hidden$2',
  ],
]

/* ---------- 报告用：迁移后不该再出现的旧词 ---------- */
const LEGACY = [
  'glass-panel',
  'glass-bar',
  'glass-soft',
  'glass-lift',
  'bg-surface',
  'bg-surface-raised',
  'bg-surface-sunken',
  'bg-canvas',
  'shadow-xs',
  'shadow-sm',
  'border-line-strong',
]

function scoped(text) {
  /* 只迁移 body 里的标记，以及生成器里的模板字符串 ——
     style 块与注释里的说明文字不动（它们记录的是历史，改了反而失真）。 */
  return text
}

let changed = 0
const report = []
for (const file of FILES) {
  const src = fs.readFileSync(file, 'utf8')
  const isHtml = file.endsWith('.html')
  const a = isHtml ? src.indexOf('<body>') : 0
  const b = isHtml ? src.indexOf('</body>') : src.length
  const head = src.slice(0, a)
  const body = src.slice(a, b)
  const tail = src.slice(b)

  // 注释里的类名举例不迁移：它们是"这里曾经怎么写"的记录
  const parts = body.split(/(<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/)/)
  let touched = 0
  const next = parts
    .map((p, i) => {
      // 奇数下标是注释（split 捕获组），跳过
      if (i % 2 === 1) return p
      let s = p.replace(/class="([^"]*)"/g, (m, c) => {
        const migrated = migrateClass(c)
        if (migrated !== c) touched++
        return `class="${migrated}"`
      })
      /* 生成器里还有几个**不带 class= 的类串常量**（TILE_CLS / LIST_CLS / HEAD_CHIP…）——
         磁贴与列表的类名都从它们派生。只扫 class="…" 会漏掉它们，
         而漏掉的后果是"下一次跑生成器，45 块磁贴又退回旧材质"
         （生成器只认自己的模板，人改过的输出它照覆盖）。 */
      if (!isHtml) {
        s = s.replace(/'([^'\n]*)'/g, (m, c) => {
          if (!/glass-|bg-surface|shadow-(xs|sm)|border-line-strong/.test(c)) return m
          const migrated = migrateClass(c)
          if (migrated !== c) touched++
          return `'${migrated}'`
        })
      }
      return s
    })
    .join('')
  let out = parts.join('') === next ? body : next

  let roled = 0
  for (const [re, to] of ROLE_FIXES) {
    const n = (out.match(re) || []).length
    if (n > 0) {
      out = out.replace(re, to)
      roled += n
    }
  }

  const leftovers = LEGACY.map((k) => [k, out.split(k).length - 1]).filter(([, n]) => n > 0)
  report.push({ file: path.basename(file), touched, roled, leftovers })
  if (out !== body) changed++
  if (!DRY) fs.writeFileSync(file, head + out + tail)
  void scoped
}

console.log(DRY ? '\n（--check：未写盘）' : '')
for (const r of report) {
  console.log(`${r.file}: 机械替换 ${r.touched} 个 class 串 · 角色修正 ${r.roled} 处`)
  if (r.leftovers.length) console.log('   剩余旧词：' + r.leftovers.map(([k, n]) => `${k}×${n}`).join(' · '))
  else console.log('   剩余旧词：无')
}
console.log(`\n${DRY ? '待改' : '已改'} ${changed} 个文件`)
