/* 文档原文 · 代码块的视图偏好与交互（原型 edCodePrefs / edCode* 一族）。

   偏好（行号 / 换行 / 字号 / 标题栏）是模块级的，两态共用，不进 markdown。
   重渲造的是新 DOM，所以每次画完都要重新调 applyCodePrefs 敷一遍。
   行号与自动换行互斥：行号按逻辑行编，一行折成三行就会错位。
   菜单显隐用 .is-open 类，不用 hidden 属性。 */

export interface CodePrefs {
  /* 行号（与 `wrap` 互斥） */
  num: boolean
  /* 自动换行（与 `num` 互斥） */
  wrap: boolean
  /* 字号三档 */
  fs: 'small' | 'mid' | 'large'
  /* 显示各代码块的标题栏 */
  bar: boolean
}

export const CODE_FS: Record<string, string> = { small: '11.5px', mid: '12.5px', large: '14px' }
export const CODE_STYLES: [string, string][] = [['light', '浅色'], ['dark', '深色'], ['contrast', '高对比']]

/* 模块级（跨"换一篇 / 切两态"保持），但不落 localStorage —— 与原型同一档：
    它是"这一会儿想怎么看"，刷新回到默认（`num: true, wrap: false, fs: 'mid', bar: true`）。 */
export const codePrefs: CodePrefs = { num: true, wrap: false, fs: 'mid', bar: true }

/* 把偏好敷到这一层里所有代码块上。 */
export function applyCodePrefs(root: Element | null): void {
  if (!root) return
  Array.prototype.forEach.call(root.querySelectorAll('.rd-code'), (el: Element) => {
    el.classList.toggle('is-wrap', !!codePrefs.wrap)
    el.classList.toggle('is-nonum', !codePrefs.num)
    el.classList.toggle('is-nobar', !codePrefs.bar)
    ;(el as HTMLElement).style.setProperty('--rc-fs', CODE_FS[codePrefs.fs] || CODE_FS.mid)
  })
}

/* ---------------------------------------------------------------- 元素与状态 */

export function codeBoxOf(node: Node | null): Element | null {
  let cur: Node | null = node
  while (cur && cur.nodeType === 3) cur = cur.parentNode
  return cur && (cur as Element).closest ? (cur as Element).closest('.rd-code') : null
}

/* `data-style` → 三档类名（渲染与切换共用一支，别两处各写一份映射）。 */
export function codePaint(box: Element | null): void {
  if (!box) return
  const st = box.getAttribute('data-style') || 'light'
  box.classList.remove('is-st-light', 'is-st-dark', 'is-st-contrast')
  box.classList.add('is-st-' + (/^(light|dark|contrast)$/.test(st) ? st : 'light'))
}

/* ------------------------------------------------------------------ 折叠 */

export function codeFoldAll(box: Element): void {
  box.classList.toggle('is-folded')
  if (box.classList.contains('is-folded')) box.classList.remove('is-clipped')
  codeUnclip(box, true)
}

/* 折叠"从第 n 行之后"的其余行。
    行高从真实元素上量（`offsetHeight`）：字号档一改行高就变 ——
       写死一个数就会裁错行（多裁半行 / 少裁一行）。 */
export function codeFoldAt(box: Element, n: number, notice: (t: string) => void): void {
  const body = box.querySelector('.rd-code-body')
  const nums = box.querySelectorAll('.rd-code-num')
  if (!body || !nums.length || !(n >= 1)) return
  if (n >= nums.length) { codeUnclip(box); return }
  box.classList.remove('is-folded')
  box.classList.add('is-clipped')
  const lh = (nums[0] as HTMLElement).offsetHeight || 22
  ;(body as HTMLElement).style.maxHeight = Math.round(lh * n + 24) + 'px'   /* 24 = 上下各 12 的内距 */
  let cap = box.querySelector('.rd-code-more-n') as HTMLButtonElement | null
  if (!cap) {
    cap = document.createElement('button')
    cap.type = 'button'
    cap.className = 'rd-code-more-n'
    box.appendChild(cap)
  }
  cap.textContent = '还有 ' + (nums.length - n) + ' 行 · 展开'
  notice('已折叠第 ' + n + ' 行之后的内容')
}

export function codeUnclip(box: Element, keepCap = false): void {
  box.classList.remove('is-clipped')
  const body = box.querySelector('.rd-code-body') as HTMLElement | null
  if (body) body.style.maxHeight = ''
  if (keepCap) return
  const cap = box.querySelector('.rd-code-more-n')
  if (cap) cap.remove()
}

/* ------------------------------------------------------------------ 复制 */

/* 复制。本仓虽然多半有 `navigator.clipboard`，但 Tauri 的 `file://` 场景下它常直接不可用
    ⇒ 那条"临时 textarea + `execCommand`"的降级路是常态，不能只写上边那一支。 */
export function codeCopy(box: Element | null): Promise<boolean> {
  const code = box ? box.querySelector('.rd-code-pre code') : null
  const text = code ? code.textContent || '' : ''
  const fallback = () => {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch { /* 环境不给就算了 */ }
    document.body.removeChild(ta)
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true, () => { fallback(); return true })
  }
  fallback()
  return Promise.resolve(true)
}

/* ------------------------------------------------------------------ 更多菜单 */

export function codeMenuToggle(box: Element): void {
  const menu = box.querySelector('.rd-code-menu')
  if (!menu) return
  const on = !menu.classList.contains('is-open')
  codeMenuClose()
  menu.classList.toggle('is-open', on)
  if (on) codeSyncMenu(box)
}

export function codeMenuClose(): void {
  Array.prototype.forEach.call(document.querySelectorAll('.rd-code-menu'), (m: Element) => {
    m.classList.remove('is-open')
  })
}

/* 把当前偏好反映到菜单上（开关的 `is-on`、字号三档的选中）。 */
export function codeSyncMenu(box: Element | null): void {
  const menu = box && box.querySelector('.rd-code-menu')
  if (!menu) return
  const on = (k: string, v: boolean) => {
    const s = menu.querySelector('[data-code-mi="' + k + '"] .rd-code-sw')
    if (s) s.classList.toggle('is-on', !!v)
  }
  on('wrap', codePrefs.wrap)
  on('num', codePrefs.num)
  Array.prototype.forEach.call(menu.querySelectorAll('[data-code-fs]'), (b: Element) => {
    b.classList.toggle('is-on', b.getAttribute('data-code-fs') === codePrefs.fs)
  })
}

/* 宿主拿到的动作标记：`sync-*` 要改数据（只有宿主知道数据在哪），其余在这边就地完成。 */
export type CodeAction = 'sync-style' | 'sync-both' | null

/* 代码块里的点击分派。返回 sync-* 表示要同步到全文，由宿主执行。

   操作栏的空白也要吃掉点击，否则光标会被甩到代码末尾。
   同一行的折叠三角再点一次是收起。 */
export function codeClick(
  event: MouseEvent,
  box: Element,
  ctx: { canSync: boolean; notice: (t: string) => void },
): CodeAction {
  const t = event.target as HTMLElement
  const { notice } = ctx
  if (t.closest('.rd-code-foldall')) { codeFoldAll(box); return null }
  const fold = t.closest('.rd-code-fold')
  if (fold) {
    const n = Number((fold as HTMLElement).dataset.rdFold || 0)
    if (box.classList.contains('is-clipped') && box.getAttribute('data-clip-at') === String(n)) codeUnclip(box)
    else { box.setAttribute('data-clip-at', String(n)); codeFoldAt(box, n, notice) }
    return null
  }
  if (t.closest('.rd-code-more-n')) { codeUnclip(box); return null }
  if (t.closest('.rd-code-copy')) {
    codeCopy(box).then(() => notice('代码已复制'), () => notice('复制失败：这个环境不允许读剪贴板'))
    return null
  }
  if (t.closest('.rd-code-more')) { codeMenuToggle(box); return null }
  const mi = t.closest('[data-code-mi]') as HTMLButtonElement | null
  if (mi) {
    if (!mi.disabled) {
      const key = mi.getAttribute('data-code-mi') as string
      if (key === 'wrap') {
        codePrefs.wrap = !codePrefs.wrap
        if (codePrefs.wrap && codePrefs.num) { codePrefs.num = false; notice('自动换行后行号会与视觉行错位 ⇒ 行号已关') }
        applyCodePrefs(box.closest('.rd-body'))
        codeSyncMenu(box)
        return null
      }
      if (key === 'num') {
        codePrefs.num = !codePrefs.num
        if (codePrefs.num && codePrefs.wrap) { codePrefs.wrap = false; notice('行号与自动换行不能同时开 ⇒ 换行已关') }
        applyCodePrefs(box.closest('.rd-body'))
        codeSyncMenu(box)
        return null
      }
      if (key === 'nobar') {
        codePrefs.bar = !codePrefs.bar
        applyCodePrefs(box.closest('.rd-body'))
        notice(codePrefs.bar ? '已显示全文的代码块标题栏' : '已隐藏全文代码块的标题栏')
        codeMenuClose()
        return null
      }
      if (key === 'sync-style' || key === 'sync-both') {
        /* 阅读态是只读副本（那一态的下拉也是 disabled）⇒ 这两项在阅读态渲染时就 disabled 了，
           走到这里一定在编辑态。 */
        codeMenuClose()
        return key === 'sync-both' ? 'sync-both' : 'sync-style'
      }
    }
    return null
  }
  const fsz = t.closest('[data-code-fs]') as HTMLElement | null
  if (fsz) {
    codePrefs.fs = fsz.getAttribute('data-code-fs') as CodePrefs['fs']
    applyCodePrefs(box.closest('.rd-body'))
    codeSyncMenu(box)
    return null
  }
  if (t.closest('.rd-code-menu')) return null
  const bar = t.closest('.rd-code-bar')
  if (bar && !t.closest('input, select, button')) { event.preventDefault(); return null }
  return null
}
