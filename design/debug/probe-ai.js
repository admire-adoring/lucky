/* 探测：AI 助手页（`design/ai-assistant/ai-assistant_index.html` → `/ai`）。
   ----------------------------------------------------------------------------
   配 `design/debug/shot-app.mjs --probe <本文件> --dump` 用。

   验六件事，每一件都是"看代码看不出来、只有量计算值才知道"的：

   1. **色指针接上了没有**。本页不是九域之一，没有 `data-module`，所以内核 §4 那段
      强调色指针一条都匹配不到 —— 缺它的后果是 `--mw-m-main` **没有值**，
      柔底/辉光/渐变全部落回 `@property` 的 initial-value（品牌紫），页面上
      「只是颜色不太对」，零报错。这里逐支比"指向了 dashboard 那一组"。
   2. **栅格是四栏而不是两栏**。换壳最核心的一行就是 `grid-template-areas`：
      顶栏通栏 + 侧栏/主区/右栏。它错了不会报错，只会让右栏掉进下一行。
   3. **顶栏那一行的高度是 68 而不是 56**。原型是 56px 的细顶栏，应用的外壳顶栏
      是 68px 胶囊。照搬 56 会让胶囊溢出 12px 并被 grid 的隐式行拉出滚动条 ——
      而且**只在窄屏发作**（那条覆盖写在 ≤768 里），最难归因。
   4. **三块面板的表面真的生效了**。生成物把原型那一整套（底衬/模糊/圆角/投影）
      搬进来了，但作用域与导入顺序算错的话会**静默**退化成透明 ——
      亮色下几乎看不出来（本项目在 `.main` 上吃过一次）。
   5. **不溢出**。定宽元件（侧栏 260 / 右栏 280）与窗口宽度相加不能超；
      装饰层的固有外扩（`::before{inset:-1px}`）只允许 2px，但**文档级横向溢出必须为 0**。
   6. **会话真的渲染出来了**（消息条数、思考卡、附件 chip）。
      这一条是"类名对不上"那类缺陷的兜底：DOM 里有类名不等于 CSS 给了样式，
      所以下面同时比 `background-color` 与 `border-radius` 的**非空**。

   ⚠️ 与 probe-shell 同一批老坑，都沿用它的处置：
      · 读法锚在 **pre#PROBE 那个元素**上（注入脚本源码里就有 PROBE 字样）；
        ⚠️ 本文件里**不要出现那个标签的字面量** —— 那段源码会被 dump 进 DOM，
          读侧一旦按字面量找，会先命中注释、再把它当 JSON 解析失败（实测栽过一次）。
      · 颜色一律用 canvas 的 `fillStyle` 归一（令牌原文 `#6366F1` vs 注册后的 `rgb(...)`）；
      · 探针自身抛错要写进报告（否则"探针坏了"与"页面没渲染"分不开）；
      · **不要读动画驱动的 `opacity`** —— dump 通道不做合成帧。
*/
;(function () {
  function css(el, prop) {
    return getComputedStyle(el).getPropertyValue(prop).trim()
  }

  function norm(color) {
    var c = document.createElement('canvas').getContext('2d')
    c.fillStyle = '#000'
    c.fillStyle = color
    return c.fillStyle
  }

  function run() {
    var out = { fail: [], info: {} }
    try {
      measure(out)
    } catch (e) {
      out.info = { probeError: String(e && e.message ? e.message : e) }
      out.fail.push('探针自身抛错：' + out.info.probeError)
    }

    /* 窄屏再加一拍：**点一下抽屉开关**，看侧栏是不是真的滑进来了。
       为什么不只是"看 CSS 里有没有那条规则"：`.is-open` 那条写在
       `ai-assistant.css` 里，而外壳那一套抽屉挂在 `.sb-app > .sidebar-wrap` 上 ——
       本页的容器叫 `.ai-app`、侧栏叫 `.ai-sidebar`，**一条都不会匹配**。
       那种错"很有规则、也很有作用域"，只有真的点一下才分得出来。
       ⚠️ 走页面的状态入口（点那颗开关）而不是改 store/属性 —— 与其余九页同一纪律。

       ⚠️ 先掐掉过渡再点。**dump 通道不做合成帧**，而 `transform` 是过渡属性：
       过渡一挂上，读到的永远是**起点值**（`translateX(-100%)`），
       哪怕真实浏览器里它早滑进来了。这与"命令面板读到 opacity: 0"是同一条坑 ——
       症状是探针报一个**假的**「抽屉打不开」。掐掉过渡之后 class 变化立即生效，
       读到的就是终态；而"谁赢"由特异性决定，与有没有过渡无关，所以这不影响判据。 */
    if (out.info.innerW <= 768) {
      var toggle = document.querySelector('.workspace-drawer-toggle')
      if (toggle) {
        var style = document.createElement('style')
        style.textContent = '*{transition:none !important}'
        document.head.appendChild(style)
        toggle.click()
        setTimeout(function () {
          measureDrawer(out)
          report(out)
        }, 60)
        return
      }
    }
    report(out)
  }

  function measureDrawer(out) {
    try {
      var sidebar = document.querySelector('.ai-root .ai-sidebar')
      if (!sidebar) {
        out.fail.push('抽屉那一相找不到 .ai-sidebar')
        return
      }
      var transform = css(sidebar, 'transform')
      out.info.drawer = {
        display: css(sidebar, 'display'),
        transform: transform,
        hasOpenClass: /(^|\s)is-open(\s|$)/.test(sidebar.className),
      }
      /* 打开后应当是 translateX(0) → matrix(1, 0, 0, 1, 0, 0)。
         `none` 也算通过（没有 transition 参与时浏览器可能直接给 none）。 */
      if (transform !== 'none' && transform !== 'matrix(1, 0, 0, 1, 0, 0)') {
        out.fail.push('点了抽屉开关之后侧栏仍在屏幕外：transform=' + transform + ' → 那条 .is-open 没匹配到')
      }
    } catch (e) {
      out.fail.push('抽屉那一相抛错：' + String(e && e.message ? e.message : e))
    }
  }

  function measure(out) {
    var root = document.querySelector('.ai-root')
    var app = document.querySelector('.ai-root .ai-app')
    var bar = document.querySelector('.ai-root .sb-topbar')
    var sidebar = document.querySelector('.ai-root .ai-sidebar')
    var main = document.querySelector('.ai-root .ai-main')
    var aside = document.querySelector('.ai-root .ai-aside')
    var bubble = document.querySelector('.ai-root .msg-bubble')
    var assistantBubble = document.querySelector('.ai-root .msg.assistant .msg-bubble')
    var userBubble = document.querySelector('.ai-root .msg.user .msg-bubble')

    if (!root || !app || !bar || !main) {
      out.fail.push('.ai-root/.ai-app/.sb-topbar/.ai-main 至少缺一个 → 页面大概没渲染出来')
      return
    }

    /* ---- 1 · 色指针 ---- */
    out.info.mMain = css(root, '--mw-m-main')
    out.info.sDashboard = css(root, '--mw-s-dashboard')
    out.info.m1 = norm(css(root, '--mw-m1'))
    out.info.aDashboard1 = norm(css(root, '--mw-a-dashboard-1'))
    out.info.gradAi = css(root, '--grad-ai').slice(0, 34)
    if (!out.info.mMain) {
      out.fail.push('--mw-m-main 没有值 → 本页缺色指针（会落回品牌紫，零报错）')
    } else if (norm(out.info.mMain) !== norm(out.info.sDashboard)) {
      out.fail.push('--mw-m-main(' + out.info.mMain + ') ≠ --mw-s-dashboard(' + out.info.sDashboard + ')')
    }
    if (out.info.m1 !== out.info.aDashboard1) {
      out.fail.push('--mw-m1(' + out.info.m1 + ') ≠ --mw-a-dashboard-1(' + out.info.aDashboard1 + ') → 极光色团不是 dashboard 那一组')
    }

    /* ---- 2 · 栅格 ----
       ⚠️ 这一条**必须按宽度分开断言**：同一个断言在不同视口下可能真假相反
          （本项目在侧栏探针上栽过：900px 下"侧栏不是 fixed"是对的，
           700px 下同一句就是"整页没有导航入口"）。
          三档的期望形状各不相同：
            >1200 → 顶栏通栏 + 侧栏 260 + 主区 + 右栏 280
            ≤1200 → 右栏被原型自己收掉（两列）
            ≤768  → 单列，侧栏变成脱离栅格的抽屉 */
    var w = window.innerWidth
    out.info.gridAreas = css(app, 'grid-template-areas')
    out.info.gridCols = css(app, 'grid-template-columns')
    if (w > 1200) {
      if (!/topbar topbar topbar/.test(out.info.gridAreas) || !/sidebar main aside/.test(out.info.gridAreas)) {
        out.fail.push('宽屏栅格不是四栏：' + out.info.gridAreas)
      }
    } else if (w > 768) {
      if (!/sidebar main/.test(out.info.gridAreas) || /aside/.test(out.info.gridAreas)) {
        out.fail.push('≤1200 的栅格应该是两列（右栏收掉）：' + out.info.gridAreas)
      }
      if (aside && css(aside, 'display') !== 'none') {
        out.fail.push('≤1200 时右栏还是 ' + css(aside, 'display') + ' → 会与主区抢宽度')
      }
    } else {
      if (!/^"topbar" "main"$/.test(out.info.gridAreas)) {
        out.fail.push('≤768 应单列：' + out.info.gridAreas)
      }
      /* 侧栏必须变成**可打开的抽屉** —— "藏起来"等于整页没有会话入口 */
      if (sidebar) {
        out.info.narrowSidebar = { display: css(sidebar, 'display'), position: css(sidebar, 'position') }
        if (out.info.narrowSidebar.position !== 'fixed') {
          out.fail.push('≤768 侧栏不是抽屉（position=' + out.info.narrowSidebar.position + '）→ 会话列表够不着')
        }
      }
      var toggle = document.querySelector('.workspace-drawer-toggle')
      out.info.drawerToggle = toggle ? css(toggle, 'display') : 'absent'
      if (!toggle || css(toggle, 'display') === 'none') {
        out.fail.push('≤768 没有抽屉开关 → 整页没有打开会话列表的入口')
      }
    }
    if (w > 768) {
      var wideToggle = document.querySelector('.workspace-drawer-toggle')
      if (wideToggle && css(wideToggle, 'display') !== 'none') {
        out.fail.push('宽屏下抽屉开关是 ' + css(wideToggle, 'display') + ' → 顶栏多出一个汉堡')
      }
    }

    /* ---- 3 · 顶栏那一行的高度 ---- */
    var barRect = bar.getBoundingClientRect()
    out.info.topbarH = Math.round(barRect.height)
    out.info.topbarRow = css(app, 'grid-template-rows').split(' ')[0]
    out.info.sbTopbarH = css(root, '--sb-topbar-h')
    if (out.info.topbarRow !== out.info.sbTopbarH) {
      out.fail.push(
        '顶栏那一行是 ' + out.info.topbarRow + '，而外壳顶栏高 ' + out.info.sbTopbarH +
          ' → ' + (window.innerWidth <= 768 ? '窄屏那条覆盖赢了（抬特异性没生效）' : '宽屏这条没生效'),
      )
    }
    if (Math.round(barRect.height) > parseFloat(out.info.topbarRow)) {
      out.fail.push('顶栏实测高 ' + out.info.topbarH + ' > 那一行的高度 → 胶囊会溢出')
    }

    /* ---- 4 · 三块面板的表面（窄屏右栏不在栅格里，跳过它） ---- */
    function surface(el, label) {
      if (!el) return label + ':absent'
      var bg = css(el, 'background-color')
      var radius = css(el, 'border-radius')
      var shadow = css(el, 'box-shadow')
      out.info[label] = { w: Math.round(el.getBoundingClientRect().width), bg: bg, radius: radius, shadow: shadow ? 'yes' : 'none' }
      if (!bg || bg === 'rgba(0, 0, 0, 0)') out.fail.push(label + ' 的底衬是透明的 → 生成物那一层没生效')
      if (!radius || radius === '0px') out.fail.push(label + ' 没有圆角 → 生成物那一层没生效')
      if (!shadow || shadow === 'none') out.fail.push(label + ' 没有投影 → 生成物那一层没生效')
    }
    surface(sidebar, 'sidebar')
    surface(main, 'main')
    if (window.innerWidth > 1200) surface(aside, 'aside')

    /* ---- 5 · 尺寸与溢出 ---- */
    out.info.innerW = window.innerWidth
    if (window.innerWidth > 1200) {
      if (Math.abs(out.info.sidebar.w - 260) > 2) {
        out.fail.push('会话侧栏宽 ' + out.info.sidebar.w + '（期望 260）→ --ai-sidebar-w 没接上')
      }
      if (!aside) {
        out.fail.push('宽屏下没有右栏')
      } else if (Math.abs(out.info.aside.w - 280) > 2) {
        out.fail.push('右栏宽 ' + out.info.aside.w + '（期望 280）→ --ai-aside-w 没接上')
      }
    }
    var docOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth
    out.info.docOverflow = docOverflow
    out.info.appOverflow = app.scrollWidth - app.clientWidth
    if (docOverflow > 0) out.fail.push('文档级横向溢出 ' + docOverflow + 'px（必须为 0）')
    if (out.info.appOverflow > 2) out.fail.push('.ai-app 横向溢出 ' + out.info.appOverflow + 'px')

    /* ---- 6 · 内容渲染出来了 ---- */
    out.info.messages = document.querySelectorAll('.ai-root .msg').length
    out.info.thoughtCards = document.querySelectorAll('.ai-root .thought-card').length
    out.info.thoughtSteps = document.querySelectorAll('.ai-root .tc-step').length
    out.info.sessionItems = document.querySelectorAll('.ai-root .session-item').length
    out.info.quotes = document.querySelectorAll('.ai-root .msg-quote').length
    if (!out.info.messages) out.fail.push('一条消息都没渲染出来')
    if (!out.info.thoughtCards) out.fail.push('思考卡没渲染出来（markup 与生成物对不上？）')
    if (!out.info.sessionItems) out.fail.push('会话列表是空的')

    /* ⚠️ 气泡要**分开看两种**，不能只查第一条：
       `.msg-bubble` 本身**没有底衬**（原型就是这样），底衬挂在两个变体上：
         · 助手是 `--sb-bg-hover`（一个实色 → background-color 非透明）
         · 用户是 `--grad-ai`（一条**渐变** → background-color 永远是 transparent，
           颜色在 background-image 里）
       只查 background-color 的话，第一条（用户）必然报"透明" ——
       那是探针的错，不是页面的错。**假阳性的探针比没有探针更消耗信任**，
       所以这里按变体各查各的判据。 */
    if (assistantBubble) {
      out.info.bubbleAssistant = {
        bg: css(assistantBubble, 'background-color'),
        radius: css(assistantBubble, 'border-radius'),
        fs: css(assistantBubble, 'font-size'),
      }
      if (!out.info.bubbleAssistant.bg || out.info.bubbleAssistant.bg === 'rgba(0, 0, 0, 0)') {
        out.fail.push('.msg.assistant .msg-bubble 底衬透明 → 对话流的样式没接上')
      }
    } else {
      out.fail.push('没有助手气泡')
    }
    if (userBubble) {
      var userImg = css(userBubble, 'background-image')
      out.info.bubbleUser = {
        color: css(userBubble, 'color'),
        image: userImg.slice(0, 40),
        radius: css(userBubble, 'border-radius'),
      }
      if (!userImg || userImg === 'none') {
        out.fail.push('.msg.user .msg-bubble 没有背景图 → --grad-ai 那一条没生效')
      }
    } else {
      out.fail.push('没有用户气泡')
    }

    /* ---- 7 · 顶栏那九项还在（这一页不能是导航死胡同）---- */
    out.info.navItems = document.querySelectorAll('.ai-root .nav-p-item').length
    if (out.info.navItems !== 9) out.fail.push('顶栏九域导航只有 ' + out.info.navItems + ' 项')

    return
  }

  function report(out) {
    var el = document.createElement('pre')
    el.id = 'PROBE'
    el.textContent = JSON.stringify(out, null, 1)
    document.body.appendChild(el)
  }

  /* 等 React 首次提交完成再量 */
  setTimeout(run, 700)
})()
