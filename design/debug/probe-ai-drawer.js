/* 交互探针：AI 助手**全局抽屉**（`design/ai-assistant/ai-assistant-sidebar.html` → `/ai-sidebar.css`）。
   ----------------------------------------------------------------------------
   配 `design/debug/shot-app.mjs --probe <本文件> --dump --hash <路由>` 用。

   ⚠️ **同一条命令要在两条不同路由上各跑一遍**（`/life` 与 `/home`）——
   这一层存在的意义就是"每个页面都能弹"，而这个说法只有跨路由才验得到。
   只测一条路由的话，"抽屉其实挂在某一页里"这个错误是看不出来的。

   验七件事：
     1. **默认关着，而且不占地方**。抽屉的 wrapper 带 `.mw-root`（为了拿内核令牌），
        而 `.mw-root` 自带 `background/height:100%/overflow-x` —— 只要那几条生效，
        它就会**盖住整个应用**。所以判据不只是"没 .open"，还有
        "wrapper 的矩形全 0"（`display:contents` 的结构事实）与
        "视口中心那个像素不是抽屉"（真的没挡住点击）。
     2. **点顶栏那颗按钮能弹出来**，且是贴右的浮层：右边缘 ≈ 视口右 - 16、宽 400。
        （≤480 那一档是全宽，另有期望值 —— 与其余探针同一纪律：按宽度分档断言。）
     3. **内容真的渲染**（消息 / 输入框 / 头部三颗按钮 / 副标题带模型名）。
     4. **发送**：回车之后出现用户消息 + 「停止生成」行。
     5. **计时器在非 /ai 路由上真的跑** —— 这是本轮最容易坏的一条：
        计时从页面搬到了 `AiDrawerHost`（路由之外）。搬错的话症状是
        "在 /life 提问，阶段永远停在第一拍"。
     6. **Esc 能关**。
     7. **「展开」跳到 /ai 并收起抽屉**（用户要求的整条动线）。

   ⚠️ dump 通道不做合成帧：`.ai-panel` 的进出场是 `transform/opacity` 过渡，
      所以**不要读 transform 的中间值**，只读类名与"非过渡属性"（`pointer-events`）。
      `read-probe.mjs` 头部那条"观感以出图为准"在这里同样适用。
      ⚠️ 探针源码会被注入 `<script>`，注释里**不许出现**那个 pre 标签的字面量。
      ⚠️ 每一步都包 try/catch：把 `e.message` 写进报告，"探针坏了"与"页面没反应"必须能分开。
*/
;(function () {
  const out = { fail: [], info: {}, steps: [] }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const q = (sel) => document.querySelector(sel)
  const qa = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel))
  const css = (el, prop) => (el ? getComputedStyle(el).getPropertyValue(prop).trim() : '')
  const rect = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
  }

  function click(el) {
    if (!el) throw new Error('要点的元素不存在')
    el.click()
  }

  async function step(name, fn) {
    try {
      const detail = await fn()
      out.steps.push({ ok: true, name, detail: detail === undefined ? '' : detail })
    } catch (e) {
      const msg = String(e && e.message ? e.message : e)
      out.steps.push({ ok: false, name, detail: msg })
      out.fail.push(name + '：' + msg)
    }
  }

  async function run() {
    const panel = q('.ai-drawer .ai-panel')
    const wrapper = q('.ai-drawer')
    if (!panel || !wrapper) {
      out.fail.push('页面上没有抽屉（.ai-drawer / .ai-panel）—— 宿主没挂上？')
      return report()
    }
    out.info.route = location.hash
    /* 把**探针跑的那个环境**写进报告：视口、主题（`<html data-theme>` 与主题令牌）。
       ⚠️ 这条是补上来的教训：本项目跑矩阵用的是
         for A in "1440x900 light" …; do set -- $A; … --size $1 --theme $2
       而 **zsh 的 `set --` 不做分词** ⇒ `$1` 是整串、`$2` 是空 ⇒ 每一条都跑在
       "尺寸参数是一整串、主题参数是空" 的条件下：**所谓"暗色那几档"其实全是亮色**，
       而报告里当时没有任何字段能看出这一点（全绿）。现在环境自报，冒充的档一眼可见。 */
    out.info.env = {
      viewport: innerWidth + 'x' + innerHeight,
      themeAttr: document.documentElement.getAttribute('data-theme') || '(none)',
      themedBgPage: css(q('.ai-drawer'), '--mw-bg-page'),
    }
    /* 自检"这一次真的跑在某个主题上"。空字符串/缺属性 = 调用方把主题参数传成了空 ——
       报告照样全绿，但那一档根本没被测（本项目实测被这一点骗过：整张
       "亮暗两套"的矩阵里，暗色那几档其实是亮色）。 */
    if (out.info.env.themeAttr !== 'light' && out.info.env.themeAttr !== 'dark') {
      out.fail.push(
        '页面的 data-theme 是 ' + out.info.env.themeAttr +
          '（应为 light/dark）→ 主题参数没生效，这一档没被真正测到',
      )
    }

    /* ---------- 1 · 关闭态：不显示、也不占地方 ---------- */
    await step('关闭态：不显示且 wrapper 不生成盒子', async () => {
      if (panel.classList.contains('open')) throw new Error('一进来就是打开的')
      const pe = css(panel, 'pointer-events')
      if (pe !== 'none') throw new Error('关闭态 pointer-events 是 ' + pe + ' → 它会吸走点击')
      const w = rect(wrapper)
      out.info.wrapperRect = w
      if (w.w !== 0 || w.h !== 0) {
        throw new Error(
          'wrapper 的矩形是 ' + w.w + '×' + w.h + '（应为 0×0）→ 它生成了盒子，' +
            '.mw-root 自带的背景/高度会盖住页面（display:contents 没生效）',
        )
      }
      /* 真的没挡住：视口正中那一像素不能落在抽屉里 */
      const hit = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight / 2))
      out.info.centerHit = hit ? hit.className || hit.tagName : 'null'
      if (hit && wrapper.contains(hit)) throw new Error('视口中心命中了抽屉 → 它挡住了底下的页面')
      return 'wrapper 0×0 · pointer-events:none · 中心命中 ' + out.info.centerHit
    })

    /* ---------- 2 · 点顶栏那颗按钮弹出来 ---------- */
    await step('点顶栏 AI 按钮：弹出且贴右', async () => {
      const trigger = q('.sb-topbar .sb-icon-btn.ai')
      if (!trigger) throw new Error('顶栏没有那颗 AI 按钮（.sb-icon-btn.ai）')
      /* ⚠️ 先掐掉过渡再点。进出场是 `transform/opacity` 过渡，而**dump 通道不做合成帧**
         —— 过渡一挂上，读到的永远是**起点值**：这颗面板的关闭态是
         `translateX(calc(100% + 24px)) scale(0.98)`，于是量出来的是
         「左边缘 1452（在视口外）、宽 392（= 400 × 0.98）」——一个**假失败**，
         看起来像"--ai-drawer-w 没接上 + 右边距不对"。
         掐掉之后 class 变化立即生效，读到的是终态；而"谁赢"由特异性决定，
         与有没有过渡无关，所以这不影响判据。（与 `probe-ai.js` 点抽屉开关同一处置。） */
      const kill = document.createElement('style')
      kill.textContent = '*{transition:none !important}'
      document.head.appendChild(kill)
      click(trigger)
      await sleep(80)
      if (!q('.ai-drawer .ai-panel').classList.contains('open')) {
        throw new Error('点了按钮但抽屉没有 .open')
      }
      const r = rect(q('.ai-drawer .ai-panel'))
      out.info.panelRect = r
      out.info.viewport = { w: innerWidth, h: innerHeight }
      const narrow = innerWidth <= 480
      const expectW = narrow ? innerWidth : Math.min(400, innerWidth - 32)
      if (Math.abs(r.w - expectW) > 2) {
        throw new Error('抽屉宽 ' + r.w + '（期望 ' + expectW + '）→ --ai-drawer-w 没接上或窄屏那条没生效')
      }
      /* ⚠️ 上边缘的期望值是 **顶栏高 + 8**，不是原型那个 16 ——
         面板要让开常驻顶栏，因为 Windows 的关窗键就在顶栏右上角，
         压上去就是"窗口关不掉"。判据取外壳自己的刻度 --sb-topbar-h，
         免得把 68 这个数抄成第二份事实源。 */
      /* 上边缘要**两条判据都过**，它们问的是两件事：
         ① 功能：必须低于**顶栏元素的底边** —— 顶栏右上角是窗口控制，
            压上去在 Windows 上就是"窗口关不掉"；
         ② 几何：必须等于外壳声明的**那一行的高度** + 8（`--sb-topbar-h` = 68）。
         ⚠️ 这两个数**不是**同一个数：顶栏元素本身只有 58 高（它是 border-box，
            装在那个 68 的行里），所以只查元素矩形会以为"差 18px 没对齐"，
            只查令牌又不知道有没有真的压住按钮。两条一起要。
         ⚠️ 不要用 computedStyle 的 height 去量顶栏 —— 那给的是**内容盒**。 */
      /* ⚠️ 量参照物（顶栏底边 / 主内容上边）之前先让布局静下来。
         实测见过一次 8px 的抖动（前一次读到 .main 上边 92、下一次 100），
         大概率是"点开抽屉那一下 + 刚掐掉过渡"与外壳的栅格动画撞在一起。
         120ms 足够它落定，而**不稳定的探针比没有探针更消耗信任**。 */
      await sleep(120)
      const barEl = q('.sb-topbar')
      const barBottom = barEl ? Math.round(barEl.getBoundingClientRect().bottom) : 0
      const mainTop = q('.sb-app .main') ? rect(q('.sb-app .main')).t : null
      out.info.topbar = { bottom: barBottom, mainTop: mainTop }
      if (r.t < barBottom) {
        throw new Error(
          '面板上边缘 ' + r.t + ' 压在顶栏里（顶栏底边在 ' + barBottom + '）→ ' +
            'Windows 上关窗键就在那块，窗口会关不掉',
        )
      }
      /* 几何条：面板上边缘要**与主内容齐平**（.main 的上边缘）。
         ⚠️ 这条比"等于某个令牌相加"更好：它直接表达意图（"和内容对齐"），
            而且**跟着外壳自己的栅格走** —— 外壳哪天改了 padding/gap，
            这里会立刻报红，而不是等肉眼发现"抽屉比内容高了一截"。
         （本项目的前身写法是 top = 顶栏高 + 8，纯估计值：实测 76 落进了
           顶栏那一行内部（它底边在 81），屏幕上看着像贴住了顶栏。） */
      if (mainTop !== null && Math.abs(r.t - mainTop) > 2) {
        throw new Error('面板上边缘 ' + r.t + ' 与主内容上边缘 ' + mainTop + ' 不齐平')
      }
      if (narrow) {
        if (Math.abs(r.l) > 1) throw new Error('≤480 应当贴左（读到 left=' + r.l + '）')
      } else if (Math.abs(innerWidth - (r.l + r.w) - 16) > 2) {
        throw new Error('右边距不是 16px（右边缘在 ' + (r.l + r.w) + '，视口 ' + innerWidth + '）')
      }
      /* ⚠️ **面板自己的表面**必须一起查。几何对、底衬没了，是这一类缺陷最会漏的形状：
         面板的 `background` 与 `box-shadow` 读的是外壳令牌 `--sb-bg-float` /
         `--sb-shadow-float`，而那几支的作用域是 `.sb-root`（**不在** html 上）。
         wrapper 少带一个宿主类 ⇒ `var()` 取不到值 ⇒ 整条声明被丢弃 ⇒
         面板变全透明、底下页面直接透上来，而**几何、类名、内容全都没问题**。
         实测就是这样漏过一次（出图才看出来）。判据与完整页那支探针的 surface() 同一条。 */
      const bg = css(q('.ai-drawer .ai-panel'), 'background-color')
      const shadow = css(q('.ai-drawer .ai-panel'), 'box-shadow')
      const radius = css(q('.ai-drawer .ai-panel'), 'border-radius')
      out.info.panelSurface = { bg: bg, radius: radius, shadow: shadow ? 'yes' : 'none' }
      if (!bg || bg === 'rgba(0, 0, 0, 0)') {
        throw new Error('面板底衬是透明的 → --sb-bg-float 取不到值（wrapper 少了 .sb-root？）')
      }
      if (!shadow || shadow === 'none') {
        throw new Error('面板没有投影 → --sb-shadow-float 取不到值（wrapper 少了 .sb-root？）')
      }
      if (!radius || radius === '0px') throw new Error('面板没有圆角 → 生成物那一层没生效')
      return r.w + '×' + r.h + ' @' + r.l + ',' + r.t + ' · 底衬 ' + bg
    })

    /* ---------- 3 · 内容真的渲染出来了 ---------- */
    await step('内容：消息 / 输入框 / 头部三颗', async () => {
      const msgs = qa('.ai-drawer .msg').length
      const bubbles = qa('.ai-drawer .msg-bubble').length
      out.info.messages = msgs
      out.info.bubbles = bubbles
      if (!msgs) throw new Error('一条消息都没有（共享会话是空的？）')
      if (!bubbles) throw new Error('没有 .msg-bubble —— 消息样式或标记对不上')
      /* ⚠️ 两种气泡的判据**不一样**，不能只查第一条：
         `.msg-bubble` 自己没有底衬（原型就是这样），底衬挂在两个变体上：
           · 助手 → `--sb-bg-hover`，是**实色** ⇒ 查 `background-color`
           · 用户 → `--grad-ai`，是**渐变** ⇒ `background-color` 永远是 transparent，
             颜色在 `background-image` 里
         只查 background-color 的话，第一条是用户消息就必然报"透明" ——
         那是探针的错，不是页面的错。**假阳性的探针比没有探针更消耗信任**
         （完整页那支探针在同一处栽过，这里是照它的处置写的）。 */
      const aiBubble = q('.ai-drawer .msg.assistant .msg-bubble')
      if (!aiBubble) throw new Error('没有助手气泡（.msg.assistant .msg-bubble）')
      const aiBg = css(aiBubble, 'background-color')
      out.info.bubbleAssistant = aiBg
      if (!aiBg || aiBg === 'rgba(0, 0, 0, 0)') {
        throw new Error('助手气泡底衬是透明的 → 抽屉那一层没生效')
      }
      const userBubble = q('.ai-drawer .msg.user .msg-bubble')
      if (userBubble) {
        const img = css(userBubble, 'background-image')
        out.info.bubbleUser = img.slice(0, 40)
        if (!img || img === 'none') {
          throw new Error('用户气泡没有背景图 → --grad-ai 那一条没生效')
        }
      }
      const headBtns = qa('.ai-drawer .ai-panel-head-actions .ai-icon-btn').length
      out.info.headButtons = headBtns
      if (headBtns !== 3) throw new Error('头部按钮 ' + headBtns + ' 颗（应为 清空 / 展开 / 收起 三颗）')
      if (!q('.ai-drawer .input-box textarea')) throw new Error('没有输入框（.input-box textarea）')
      const sub = q('.ai-drawer .ai-panel-head-sub')
      out.info.headSub = sub ? sub.textContent.trim() : 'absent'
      if (!/在线 · /.test(out.info.headSub)) {
        throw new Error('副标题是「' + out.info.headSub + '」→ 没有报当前模型名')
      }
      return msgs + ' 条消息 · 头部 ' + headBtns + ' 颗 · 副标题「' + out.info.headSub + '」'
    })

    /* ---------- 4 · 发送 ---------- */
    let sent = ''
    await step('发送：回车之后出现用户消息与停止行', async () => {
      const ta = q('.ai-drawer .input-box textarea')
      const before = qa('.ai-drawer .msg.user').length
      sent = '有哪些逾期任务'
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(ta, sent)
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(60)
      const btn = q('.ai-drawer .input-box .send-btn')
      if (!btn || btn.disabled) throw new Error('写了字之后发送键仍是禁用的')
      click(btn)
      await sleep(120)
      const after = qa('.ai-drawer .msg.user').length
      out.info.userMessages = before + '→' + after
      if (after <= before) throw new Error('点发送之后没有多出用户消息')
      if (!q('.ai-drawer .stop-row')) throw new Error('生成中没有出现「停止生成」那一行（.stop-row）')
      return '用户消息 ' + before + '→' + after + ' · 停止行已出现'
    })

    /* ---------- 5 · 计时器在**这条路由**上真的跑 ---------- */
    await step('计时：阶段确实在推进（计时器挂在路由之外）', async () => {
      const stages = () => {
        const items = qa('.ai-drawer .thinking-live .stage-item')
        return items.findIndex((el) => el.classList.contains('active'))
      }
      const first = stages()
      out.info.stageFirst = first
      if (first < 0) throw new Error('生成中的消息上没有阶段指示器（.thinking-live）')
      /* 四拍的总时长约 300+700+500+400ms；这里等 1.1s 只要求"动过" */
      await sleep(1100)
      const second = stages()
      out.info.stageLater = second
      if (second <= first) {
        throw new Error(
          '等了 1.1s 阶段还停在 ' + second + '（起点 ' + first +
            '）→ 推进器没在跑。它在路由之外（AiDrawerHost），不在这条路由的页面里',
        )
      }
      return '第 ' + first + ' 拍 → 第 ' + second + ' 拍'
    })

    /* ---------- 6 · Esc 收起 ---------- */
    await step('Esc 收起', async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await sleep(80)
      if (q('.ai-drawer .ai-panel').classList.contains('open')) throw new Error('按了 Esc 抽屉还开着')
      return '已收起'
    })

    /* ---------- 7 · 展开跳到完整页面 ---------- */
    await step('展开：跳到 /ai 并收起抽屉', async () => {
      click(q('.sb-topbar .sb-icon-btn.ai'))
      await sleep(80)
      if (!q('.ai-drawer .ai-panel').classList.contains('open')) throw new Error('重新打开失败')
      const expand = qa('.ai-drawer .ai-panel-head-actions .ai-icon-btn').find(
        (el) => (el.getAttribute('title') || '').indexOf('展开') >= 0,
      )
      if (!expand) throw new Error('头部没有「展开到完整页面」那颗按钮')
      click(expand)
      await sleep(220)
      out.info.hashAfterExpand = location.hash
      if (location.hash.indexOf('/ai') < 0) {
        throw new Error('点了展开之后 hash 是 ' + location.hash + '（应为 #/ai）')
      }
      if (location.hash.indexOf('?') < 0 && qa('.sb-topbar .sb-icon-btn.ai').length) {
        /* 到了 /ai 之后那颗按钮就该消失 —— 那一页本身就是完整页面 */
        throw new Error('到了 /ai 之后顶栏还留着 AI 按钮（应当不渲染）')
      }
      return 'hash → ' + location.hash + ' · 顶栏那颗按钮已撤'
    })

    return report()
  }

  function report() {
    /* 两条通道都写：`<pre>` 是常规读法；**`<title>`** 给"dump 被截断"兜底
       （本机 dump 上限约 6 万字节，探针报告追加在 body 末尾正好会被截掉）。 */
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
