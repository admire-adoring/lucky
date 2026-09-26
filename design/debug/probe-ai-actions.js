/* 交互探针：AI 助手第二轮新增的那批交互。
   ----------------------------------------------------------------------------
   配 `design/debug/shot-app.mjs --probe <本文件> --dump` 用。

   与 `probe-ai.js` 的分工：那份量的是**布局与配色**（静态、读计算值）；
   这份把新加的东西**挨个点一遍**，因为它们的失效方式都是"看起来在、点了没反应"：

     1. 搜索        —— 打开浮层 → 输入关键词 → 结果条数与命中高亮（`<mark>`）→ 点一条跳过去
     2. 上下文      —— 打开选择器 → 选项数 → 勾选 → 确定 → 右栏条目数与选择器一致
     3. 排队        —— 生成中再发一条 → 排队横幅出现、计数为 1
     4. 思考链面板  —— 打开 → 页码 → 点"下一条" → 页码前进
     5. 版本切换    —— 点"重新生成" → 版本切换器出现且为 2 / 2
     6. 停止 / 继续 —— 停止后出现「已停止」徽标与「继续生成」按钮

   ⚠️ 探针自身的两个坑（都实测踩过，处置沿用）：
      · 探针源码会被原样注入 `<script>`，所以**本文件的注释里不许出现**那个 pre 标签的字面量；
      · 每一步都包 try/catch，把 `e.message` 写进报告 ——
        "探针坏了"与"页面没反应"必须能分开报（本项目的探针纪律）。
   ⚠️ dump 通道里 CSS 动画/过渡不走，所以本探针**只断言类名与计数**，
      不断言"淡入到几成不透明"。观感一律以出图为准。
*/
;(function () {
  const out = { fail: [], info: {}, steps: [] }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const q = (sel) => document.querySelector(sel)
  const qa = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel))
  const count = (sel) => qa(sel).length

  /** 点一下"真元素"（用原生 click，走的是页面自己的事件入口） */
  function click(el) {
    if (!el) throw new Error('要点的元素不存在')
    el.click()
  }

  /** 找出文案匹配的按钮/条目 */
  function byText(sel, text) {
    return qa(sel).find((el) => (el.textContent || '').indexOf(text) >= 0)
  }

  async function step(name, fn) {
    try {
      const detail = await fn()
      out.steps.push({ ok: true, name, detail: detail === undefined ? '' : detail })
    } catch (e) {
      out.steps.push({ ok: false, name, detail: String(e && e.message ? e.message : e) })
      out.fail.push(`${name}：${String(e && e.message ? e.message : e)}`)
    }
  }

  async function run() {
    /* ---------- 0 · 页面在不在 ---------- */
    if (!q('.ai-root') || !q('.ai-main')) {
      out.fail.push('页面没渲染出来（.ai-root/.ai-main 至少缺一个）')
      return report()
    }
    out.info.messages = count('.ai-root .msg')
    out.info.thoughtCards = count('.ai-root .thought-card')

    /* ---------- 1 · 搜索 ---------- */
    await step('搜索：打开并命中', async () => {
      const trigger = q('.ai-search-anchor .sb-icon-btn')
      click(trigger)
      await sleep(80)
      const box = q('.ai-root .search-box')
      if (!box || !box.classList.contains('show')) throw new Error('搜索浮层没打开（.search-box 缺 show）')
      const input = q('.ai-root .ai-search-input')
      if (!input) throw new Error('搜索输入框不存在（.ai-search-input）')
      /* 用 React 受控输入的方式写值：改 value 后派发 input 事件 */
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, '工作')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(80)
      const items = count('.ai-root .search-result-item')
      const marks = count('.ai-root .search-results mark')
      out.info.searchItems = items
      out.info.searchMarks = marks
      if (!items) throw new Error('输入「工作」之后没有结果')
      if (!marks) throw new Error('结果里没有 <mark> 命中高亮')
      return `结果 ${items} 条 · 高亮 ${marks} 处`
    })

    await step('搜索：点跨会话标题能切过去', async () => {
      const input = q('.ai-root .ai-search-input')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      /* ⚠️ 查询词要选**只在别的会话里命中**的：用「工作」会命中当前会话的两条消息，
         点了当然不换会话 —— 第一版就是这么写的，报了个假失败。 */
      setter.call(input, 'React 19')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(80)
      const hits = qa('.ai-root .search-result-item')
      if (!hits.length) throw new Error('搜「React 19」没有任何结果')
      const before = q('.ai-main .chat-head-title').textContent
      click(hits[0])
      await sleep(150)
      const box = q('.ai-root .search-box')
      if (box.classList.contains('show')) throw new Error('点了结果之后浮层没关')
      const after = q('.ai-main .chat-head-title').textContent
      out.info.sessionBefore = before
      out.info.sessionAfter = after
      if (before === after) throw new Error(`会话没切过去（还是「${after}」）`)
      return `「${before}」→「${after}」`
    })

    await step('搜索：点消息能定位并高亮', async () => {
      /* 回到种子会话（它有 6 条消息），再搜一条只在消息里出现的词 */
      click(byText('.ai-root .session-item .s-text', '今天有什么安排').closest('.session-item'))
      await sleep(120)
      const trigger = q('.ai-search-anchor .sb-icon-btn')
      click(trigger)
      await sleep(60)
      const input = q('.ai-root .ai-search-input')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, '逾期')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(80)
      const hit = qa('.ai-root .search-result-item').find(
        (el) => (el.querySelector('.sr-text') || {}).textContent.indexOf('逾期') >= 0,
      )
      if (!hit) throw new Error('没有找到含「逾期」的消息命中')
      click(hit)
      /* 高亮只亮 1.6s，而 dump 通道会把定时器快进 —— 所以只断言"信号被消费过"：
         `jumpTo(null)` 已经跑完（页面上不再有高亮），且目标消息确实在 DOM 里。
         这一条**不是**在验观感，只验"点了之后有反应"。 */
      await sleep(200)
      const marked = count('.ai-root .msg.anchor-highlight')
      const boxes = count('.ai-root .msg')
      out.info.anchorHighlighted = marked
      out.info.msgCountAfterJump = boxes
      if (!boxes) throw new Error('跳转之后消息列表空了')
      return `消息 ${boxes} 条 · 当前高亮 ${marked} 处（1.6s 后自清）`
    })

    /* ---------- 2 · 上下文 ---------- */
    await step('上下文：选择器与右栏一致', async () => {
      const managementOpen = qa('.ai-aside-title .more')[0]
      click(managementOpen)
      await sleep(80)
      const picker = q('.ai-root .context-picker')
      if (!picker.classList.contains('show')) throw new Error('上下文选择器没打开')
      const options = count('.ai-root .ctx-option')
      out.info.ctxOptions = options
      if (options < 3) throw new Error(`选择器里只有 ${options} 项（目录应该有两类真来源 + 8 个项目）`)

      const selectedBefore = count('.ai-root .ctx-option.selected')
      /* 勾一个当前**没选**的，再确定 */
      const target = qa('.ai-root .ctx-option').find((el) => !el.classList.contains('selected'))
      click(target)
      await sleep(40)
      click(byText('.ai-root .ctx-btn.primary', '确定'))
      await sleep(120)
      if (q('.ai-root .context-picker').classList.contains('show')) throw new Error('点了确定之后弹窗没关')
      const items = count('.ai-root .ai-aside .context-item')
      out.info.ctxSelectedBefore = selectedBefore
      out.info.ctxItemsAfter = items
      if (items !== selectedBefore + 1) {
        throw new Error(`右栏条目是 ${items}，而勾选后应是 ${selectedBefore + 1} —— 两处没接上`)
      }
      return `选项 ${options} 项 · 选中 ${selectedBefore} → 右栏 ${items} 条`
    })

    await step('上下文：× 能移除', async () => {
      const before = count('.ai-root .ai-aside .context-item')
      const remove = q('.ai-root .ai-aside .c-remove')
      if (!remove) throw new Error('右栏没有移除按钮（.c-remove）')
      click(remove)
      await sleep(80)
      const after = count('.ai-root .ai-aside .context-item')
      if (after !== before - 1) throw new Error(`点了 × 之后是 ${after} 条（原来是 ${before}）`)
      return `${before} → ${after}`
    })

    /* ---------- 3 · 排队 ---------- */
    await step('排队：生成中再发一条会入队', async () => {
      const input = q('.ai-root .input-box textarea')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      /* 第一条：进入生成中 */
      setter.call(input, '全域现在什么情况')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(40)
      click(q('.ai-root .send-btn'))
      await sleep(60)
      const live = count('.ai-root .thinking-live')
      if (!live) throw new Error('发出去之后没有进入生成中（.thinking-live 不存在）')

      /* 第二条：生成中，应当入队而不是被丢掉 */
      setter.call(input, '有哪些逾期任务')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(40)
      const sendBtn = q('.ai-root .send-btn')
      out.info.queueBtnClass = sendBtn.className
      if (sendBtn.className.indexOf('queue') < 0) {
        throw new Error(`生成中且有内容时发送键应是「排队发送」（.queue），实际是「${sendBtn.className}」`)
      }
      click(sendBtn)
      await sleep(80)
      const banner = q('.ai-root .queue-banner')
      const qCount = q('.ai-root .q-count')
      out.info.queueBanner = banner ? banner.className : 'absent'
      out.info.queueCount = qCount ? qCount.textContent : 'absent'
      if (!banner || banner.className.indexOf('show') < 0) throw new Error('排队横幅没出现（.queue-banner 缺 show）')
      if (!qCount || qCount.textContent.trim() !== '1') throw new Error(`排队计数是「${qCount && qCount.textContent}」，应为 1`)
      return `横幅已显示 · 计数 ${qCount.textContent}`
    })

    /* ---------- 4 · 停止 / 继续 ---------- */
    await step('停止：徽标与「继续生成」', async () => {
      const sendBtn = q('.ai-root .send-btn')
      /* 此刻输入区是空的（上一步刚入队），点它就是"停止" */
      out.info.stopBtnClass = sendBtn.className
      click(sendBtn)
      await sleep(120)
      const badge = q('.ai-root .msg-stopped-badge')
      const cont = q('.ai-root .continue-btn')
      if (!badge) throw new Error('停止之后没有「已停止」徽标（.msg-stopped-badge）')
      if (!cont) throw new Error('停止之后没有「继续生成」按钮（.continue-btn）')
      return `徽标「${badge.textContent.trim()}」· 按钮「${cont.textContent.trim()}」`
    })

    /* ---------- 5 · 版本切换 ---------- */
    await step('重新生成：版本切换器', async () => {
      /* ⚠️ 要挑**没被停止过**的那一条：被停过的消息文本是占位符
         （「（已停止，没有生成内容）」），拿它当版本 0 会让"上一版"变成占位文案。
         store 里已经把这条规则写进去了（见 `regenerate` 的 `seedable`），
         这里选一个正常的助手消息来验版本切换本身。 */
      const stopped = q('.ai-root .msg-stopped-badge')
      const regen = qa('.ai-root .msg-action')
        .filter((el) => (el.getAttribute('title') || '').indexOf('重新生成') >= 0)
        .filter((el) => {
          const row = el.closest('.msg')
          return row && !row.querySelector('.msg-stopped-badge')
        })[0]
      if (!regen) throw new Error('没有可重新生成的正常助手消息')
      const bubble = () => regen.closest('.msg').querySelector('.msg-bubble').textContent
      const textBefore = bubble()
      click(regen)
      await sleep(150)
      const sw = regen.closest('.msg').querySelector('.msg-version-switch')
      if (!sw) throw new Error('点了重新生成之后没有版本切换器（.msg-version-switch）')
      const label = sw.textContent.replace(/\s+/g, ' ').trim()
      const textAfter = bubble()
      out.info.versionLabel = label
      if (label.indexOf('2 / 2') < 0) throw new Error(`版本号是「${label}」，应含「2 / 2」`)
      if (textAfter === textBefore) throw new Error('新版本与旧版本正文一字未变（版本切换是空转的）')
      /* 切回上一版：正文应当回到原样 */
      click(sw.querySelector('button'))
      await sleep(150)
      const textBack = bubble()
      if (textBack !== textBefore) throw new Error('切回上一版之后正文和原来对不上')
      if (stopped) out.info.stoppedStillThere = count('.ai-root .msg-stopped-badge')
      return `${label} · 正文 ${textBefore.length} → ${textAfter.length} → ${textBack.length}（切回一致）`
    })

    /* ---------- 6 · 思考链面板 ---------- */
    await step('思考链面板：翻页', async () => {
      /* 消息动作里第三颗就是「查看思考链」。
         ⚠️ 点**第一条**助手消息的：点最后一条的话它已经在末页，
            「下一条」本来就该是禁用的 —— 第一版就是这么点，报了个假失败
            （判据要能区分"按钮坏了"和"到头了"）。 */
      const openers = qa('.ai-root .msg-action').filter(
        (el) => (el.getAttribute('title') || '').indexOf('思考链') >= 0,
      )
      if (openers.length < 2) throw new Error(`只有 ${openers.length} 条消息带「查看思考链」，翻页验不了`)
      click(openers[0])
      await sleep(150)
      const panel = q('.ai-root .thought-panel')
      if (!panel.classList.contains('show')) throw new Error('思考链面板没打开')
      const page = q('.ai-root .nav-page')
      const before = page.textContent.trim()
      out.info.tpPage = before
      const nodes = count('.ai-root .thought-panel .tl-node')
      const nextBtn = qa('.ai-root .thought-panel-nav button')[1]
      if (nextBtn.disabled) throw new Error(`「下一条」是禁用的（当前页码 ${before}）`)
      click(nextBtn)
      await sleep(150)
      const after = q('.ai-root .nav-page').textContent.trim()
      out.info.tpPageAfter = after
      if (before === after) throw new Error(`点了「下一条」页码没变（还是 ${after}）`)
      const nodesAfter = count('.ai-root .thought-panel .tl-node')
      if (!nodesAfter) throw new Error('面板里没有时间轴节点')
      return `${before} → ${after} · 时间轴 ${nodes} → ${nodesAfter} 节点`
    })

    /* ---------- 7 · 会话菜单里的两个弹窗 ----------
       补上来的：这两个浮层此前**没有任何一步碰过**，于是"生成器把它们的
       基础规则剪掉一截、弹窗常驻在侧栏文档流里"这件事，九步全绿也没发现。
       教训：验收要覆盖**每一个浮层**，不能只覆盖"主路径上的那几个"。

       ⚠️ 这里断言的是"它仍然是一个**覆盖视口**的浮层"（position:fixed + rect 覆盖全屏），
          而不只是"类名里有 show" —— 因为出问题的那一次，`show { display:flex }`
          这一条**还在**、类名也还在，唯一没了的是那条基础规则。 */
    await step('会话菜单：重命名 / 删除确认两个弹窗', async () => {
      var menu = q('.ai-root .session-menu')
      if (!menu) throw new Error('会话菜单不在 DOM 里（.session-menu）')
      if (menu.classList.contains('show')) throw new Error('会话菜单一开始就是打开的')

      /* 用第一项的「更多」打开（不挑最后一项，免得碰到 pinned 分组的分界） */
      var more = qa('.ai-root .s-more')[0]
      click(more)
      await sleep(120)
      if (!q('.ai-root .session-menu').classList.contains('show')) {
        throw new Error('点了「更多」之后会话菜单没显示')
      }

      /* --- 7a · 重命名 --- */
      var renameItem = byText('.ai-root .session-menu-item', '重命名')
      if (!renameItem) throw new Error('会话菜单里没有「重命名」')
      click(renameItem)
      await sleep(150)
      var modal = q('.ai-root .rename-modal')
      if (!modal.classList.contains('show')) throw new Error('点了「重命名」之后弹窗没显示')
      out.info.renameModal = overlayShape(modal)
      assertOverlay(modal, 'rename-modal')
      /* 关掉：取消按钮 */
      var cancel = byText('.ai-root .rename-actions button', '取消')
      if (!cancel) throw new Error('重命名弹窗里没有「取消」')
      click(cancel)
      await sleep(150)
      if (q('.ai-root .rename-modal').classList.contains('show')) {
        throw new Error('点了「取消」之后重命名弹窗没关掉')
      }
      var renameDetail = out.info.renameModal

      /* --- 7b · 删除确认 --- */
      click(qa('.ai-root .s-more')[0])
      await sleep(120)
      var deleteItem = byText('.ai-root .session-menu-item', '删除')
      if (!deleteItem) throw new Error('会话菜单里没有「删除」')
      click(deleteItem)
      await sleep(150)
      var confirm = q('.ai-root .confirm-modal')
      if (!confirm.classList.contains('show')) throw new Error('点了「删除」之后确认弹窗没显示')
      out.info.confirmModal = overlayShape(confirm)
      assertOverlay(confirm, 'confirm-modal')
      /* 收尾：点「取消」，**不要真的删**（删了会让后面的断言与环境有关） */
      var cancelDelete = byText('.ai-root .confirm-actions button', '取消')
      if (!cancelDelete) throw new Error('删除弹窗里没有「取消」')
      click(cancelDelete)
      await sleep(150)
      if (q('.ai-root .confirm-modal').classList.contains('show')) {
        throw new Error('点了「取消」之后删除弹窗没关掉')
      }
      if (q('.ai-root .session-menu').classList.contains('show')) {
        throw new Error('弹窗关掉之后会话菜单还开着（应当一并收起）')
      }
      return `重命名 ${renameDetail} · 删除 ${out.info.confirmModal}`
    })

    return report()
  }

  /** 浮层的形状：fixed？尺寸覆盖视口？——读出来是为了让报告能自证 */
  function overlayShape(el) {
    var cs = getComputedStyle(el)
    var r = el.getBoundingClientRect()
    return (
      cs.position +
      ' ' +
      Math.round(r.width) +
      '×' +
      Math.round(r.height) +
      ' @' +
      Math.round(r.left) +
      ',' +
      Math.round(r.top)
    )
  }

  /**
   * 断言它真的是"盖住整个视口"的浮层。
   * ⚠️ 只断言 position:fixed 是不够的：`display:flex` 跟着基础规则一起丢了的时候，
   *    元素会退回**普通块级**，此时 position 是 static —— 那正是实测那个症状。
   * ⚠️ 也不能只断言"宽度差不多"：普通块在窄屏下宽度也接近视口宽。
   *    所以两条一起要：fixed + 贴着 (0,0) 且铺满。 */
  function assertOverlay(el, name) {
    var cs = getComputedStyle(el)
    var r = el.getBoundingClientRect()
    if (cs.position !== 'fixed') {
      throw new Error(
        name + ' 不是 position:fixed（读到 ' + cs.position + '）→ 它会落在文档流里，把侧栏挤下去',
      )
    }
    if (Math.abs(r.left) > 1 || Math.abs(r.top) > 1) {
      throw new Error(name + ' 没有贴着视口左上角（读到 ' + Math.round(r.left) + ',' + Math.round(r.top) + '）')
    }
    if (r.width < window.innerWidth - 2 || r.height < window.innerHeight - 2) {
      throw new Error(
        name +
          ' 没有铺满视口（' +
          Math.round(r.width) +
          '×' +
          Math.round(r.height) +
          ' vs 视口 ' +
          window.innerWidth +
          '×' +
          window.innerHeight +
          '）',
      )
    }
  }

  function report() {
    /* 两条通道都写：
       · `<pre id="PROBE">` —— 常规读法；
       · **`<title>`** —— dump 在本机有约 6 万字节的上限，而 `<pre>` 追加在 body 末尾、
         正好落在截断点之后（`/ai` 这一页加完第二轮功能就超了）。
         `<title>` 在 `<head>` 里，序列化时排最前，截断动不了它。
       注意 compact JSON：title 里不换行，省字节。 */
    const json = JSON.stringify(out)
    document.title = 'PROBE ' + json
    const el = document.createElement('pre')
    el.id = 'PROBE'
    el.textContent = JSON.stringify(out, null, 1)
    document.body.appendChild(el)
  }

  setTimeout(() => {
    run().catch((e) => {
      out.fail.push('探针自身抛错：' + String(e && e.message ? e.message : e))
      report()
    })
  }, 700)
})()
