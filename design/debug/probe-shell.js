/* 探测：新外壳（`design/sidebar/sidebar_index.html` → `src/components/shell/*`）。
   ----------------------------------------------------------------------------
   配 `design/debug/shot-app.mjs --probe <本文件> --dump` 用。

   验四件事，每一件都是"看代码看不出来、只有量计算值才知道"的：

   1. **壳接上了没有**。`--accent` 是否等于本模块的 `--mw-m-main`（原型那一份没有
      这个接线，会落回 @property 的 initial-value 品牌紫 —— 高亮会是紫的而不是模块色）。
   2. **环会不会溢出侧栏**。环是定宽正方形（2×(rl+12)）；侧栏宽度由栅格给。
      溢出不会报错，只会让外圈标签被裁掉一半。
   3. **环上的标签叠不叠字**。相邻标签中心的弦长 = 2·rl·sin(π/n)，
      而 n 是**模块自己的 Tab 数**（工作 12 项，生活 11 项）——
      原型是按它自己那九个模块调的，换成 Tab 之后必须重量。
      ⚠️ 这一条是本轮最可能真出问题的一条：叠字在缩略图上"看着只是有点密"。
   4. **主区表面生效了没有**。`.main` 在本层是**故意保留原名 + 抬特异性**去压内核那条的
      （padding 26 而不是 24、有卡片底衬）。特异性算错的话它退化成内核那套，
      而"没有底衬"这件事在亮色下几乎看不出来。

   ⚠️ 读法上的老坑（`probe-series.mjs` 记过）：不能拿 `/PROBE([^<]*)/` 直接 match stdout ——
      内联脚本**源码本身**里就写着 PROBE，会被先匹配到。
      必须锚在由脚本创建的那个带 id 的元素上。
*/
;(function () {
  function css(el, prop) {
    return getComputedStyle(el).getPropertyValue(prop).trim()
  }

  /**
   * 颜色归一 —— **不这么做的话这条断言一定是假阳性**。
   *
   * `getPropertyValue('--mw-m-main')` 给的是**令牌原文** `#10b981`，
   * 而 `--accent` 经过 `@property --accent { syntax: '<color>' }` 注册之后，
   * 读出来已经被解析成 `rgb(16, 185, 129)`。两者是同一个颜色、两种写法。
   * 用 canvas 的 fillStyle 把任意写法归一成 `rgb()` 再比。
   */
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
      // ⚠️ 探针自己抛错时必须**把它报出来**。不包这一层的话表现为"没有 PROBE 输出"，
      //    而那与"页面没渲染"是同一句话 —— 两类完全不同的失效就分不开了（实测栽过一次：
      //    getComputedStyle(null) 抛 TypeError，探针静默死掉）。
      out.info = { probeError: String(e && e.message ? e.message : e) }
      out.fail.push("探针自身抛错：" + out.info.probeError)
    }

    /* ---------- 5 · 命令面板：**点开它**再看一眼 ----------
       为什么非点不可：`.cmd-mask` 的规则来自**生成物**（外壳原型那一份），
       而生成物曾经出现过"被剪掉一截"的缺陷 —— 面板自己那条 `.sb-root .cmd-mask`
       被削成 `.cmd-mask`，元素上还有这个类、**照样生效**，所以静态看一点问题都没有。
       而这一类"浮层的基础规则没了"的缺陷，症状统一是：**默认该关着的浮层常驻在文档流里**。
       ⇒ 所以壳层这里也有一条：点开 → 它必须是 `position:fixed` 且铺满视口。

       ⚠️ 先掐掉动画/过渡。dump 通道不做合成帧，而 `.cmd-mask` 挂着 `sb-fade-in`：
          不掐的话读到的是动画第一帧（`opacity:0`），几何也可能被带偏。
          （见 read-probe.mjs 头部那条：观感以出图为准，断言只读 display/几何。） */
    var trigger = null
    var cands = document.querySelectorAll('.sb-root [title^="跳转"]')
    for (var ci = 0; ci < cands.length; ci++) {
      var cr = cands[ci].getBoundingClientRect()
      if (cr.width > 0 && cr.height > 0) {
        trigger = cands[ci]
        break
      }
    }
    out.info.paletteTrigger = trigger ? 'ok' : 'absent'
    if (!trigger) {
      /* 窄屏可能只剩抽屉里的入口 —— 报出来但不判失败（那是布局选择，不是缺陷） */
      report(out)
      return
    }
    var kill = document.createElement('style')
    kill.textContent = '*{animation:none !important;transition:none !important}'
    document.head.appendChild(kill)
    trigger.click()
    setTimeout(function () {
      measurePalette(out)
      report(out)
    }, 90)
  }

  function measurePalette(out) {
    try {
      var mask = document.querySelector('.sb-root .cmd-mask')
      if (!mask) {
        out.fail.push('点了「跳转」之后 .sb-root 里没有 .cmd-mask → 那条基础规则多半脱了作用域')
        return
      }
      var cs = getComputedStyle(mask)
      var r = mask.getBoundingClientRect()
      out.info.palette = {
        open: /(^|\s)open(\s|$)/.test(mask.className),
        position: cs.position,
        display: cs.display,
        w: Math.round(r.width),
        h: Math.round(r.height),
        items: document.querySelectorAll('.sb-root .cmd-item').length,
      }
      if (!out.info.palette.open) out.fail.push('点了「跳转」之后 .cmd-mask 没有 .open（面板打不开）')
      if (cs.display === 'none') out.fail.push('命令面板的遮罩是 display:none → 它没生效')
      if (cs.position !== 'fixed') {
        out.fail.push('命令面板的遮罩不是 position:fixed（读到 ' + cs.position + '）→ 它会落在文档流里')
      }
      if (
        Math.abs(r.left) > 1 ||
        Math.abs(r.top) > 1 ||
        r.width < window.innerWidth - 2 ||
        r.height < window.innerHeight - 2
      ) {
        out.fail.push(
          '命令面板的遮罩没有铺满视口（' +
            Math.round(r.left) +
            ',' +
            Math.round(r.top) +
            ' ' +
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
      if (!out.info.palette.items) out.fail.push('命令面板里没有条目（.cmd-item）')
    } catch (e) {
      out.fail.push('命令面板那一相抛错：' + String(e && e.message ? e.message : e))
    }
  }

  function measure(out) {
    var root = document.querySelector('.sb-root')
    var radial = document.querySelector('.sb-root .radial')
    var wrap = document.querySelector('.sb-root .sidebar-wrap')
    var bar = document.querySelector('.sb-root .sb-topbar')
    var main = document.querySelector('.sb-root .main')
    var app = document.querySelector('.sb-root .sb-app')

    if (!root || !bar || !main) {
      out.fail.push('外壳没渲染出来（.sb-root/.sb-topbar/.main 至少缺一个）→ 组件大概抛错了')
      return report(out)
    }

    /* ---- 1 · 壳接上了没有 ---- */
    out.info.module = root.getAttribute('data-module')
    out.info.mMain = css(root, '--mw-m-main')
    out.info.sidebarW = css(root, '--sb-w')
    out.info.gridAreas = css(app, 'grid-template-areas')
    out.info.mainPadding = css(main, 'padding')
    out.info.mainBg = css(main, 'background-color')
    out.info.topbarBg = css(bar, 'background-color')

    if (!/topbar/.test(out.info.gridAreas) || !/sidebar/.test(out.info.gridAreas)) {
      out.fail.push('栅格区域不对：' + out.info.gridAreas)
    }
    if (out.info.mainPadding !== '26px') {
      out.fail.push('.main 的 padding 是 ' + out.info.mainPadding + '（期望 26px）→ 本层那条没压过内核的 24px')
    }

    /* ⑧ 「项目」域的根（/projects）没有 Tab，环**不应该**被渲染。
       渲染出来就是一个空圆盘 + 一扇写着空串的门，读起来像坏了。 */
    if (!radial) {
      out.info.ring = 'absent'
      var stage = document.querySelector('.sb-root .radial-stage')
      if (stage) out.fail.push('没有分区时仍渲染了 .radial-stage（空环）')
      return report(out)
    }
    out.info.ring = 'present'

    /* ---- 2 · 环会不会溢出侧栏 ---- */
    var radialRect = radial.getBoundingClientRect()
    var wrapRect = wrap ? wrap.getBoundingClientRect() : null
    out.info.accent = css(radial, '--accent')
    out.info.radialW = Math.round(radialRect.width)
    out.info.wrapW = wrapRect ? Math.round(wrapRect.width) : -1
    if (norm(out.info.accent) !== norm(out.info.mMain)) {
      out.fail.push('--accent(' + out.info.accent + ') ≠ --mw-m-main(' + out.info.mMain + ") → 环的高亮不是本模块的颜色")
    }
    if (wrapRect && radialRect.width > wrapRect.width) {
      out.fail.push('环(' + Math.round(radialRect.width) + 'px) 比侧栏(' + Math.round(wrapRect.width) + 'px) 还宽 → 外圈标签会被裁')
    }

    /* ---- 3 · 标签叠不叠字 ---- */
    var labels = [].slice.call(radial.querySelectorAll('.radial__label'))
    var rects = labels.map(function (l) {
      var r = l.getBoundingClientRect()
      return { t: (l.textContent || '').trim(), l: r.left, r: r.right, tp: r.top, b: r.bottom }
    })
    var hits = []
    for (var i = 0; i < rects.length; i++) {
      for (var j = i + 1; j < rects.length; j++) {
        var a = rects[i], b = rects[j]
        var ox = Math.min(a.r, b.r) - Math.max(a.l, b.l)
        var oy = Math.min(a.b, b.b) - Math.max(a.t, b.t)
        if (ox > 1 && oy > 1) hits.push(a.t + '×' + b.t + '(' + Math.round(ox) + '×' + Math.round(oy) + ')')
      }
    }
    out.info.ringItems = radial.querySelectorAll('.radial__item').length
    out.info.labelCount = labels.length
    out.info.labelMaxWidth = labels.length ? css(labels[0], 'max-width') : ''
    out.info.overlaps = hits
    if (labels.length !== out.info.ringItems) {
      out.fail.push('环上项数(' + out.info.ringItems + ') 与标签数(' + labels.length + ') 不等')
    }
    if (hits.length) out.fail.push('标签叠字 ' + hits.length + ' 处：' + hits.join(', '))

    /* ---- 4 · 当前项真的被标出来了吗 ---- */
    var current = radial.querySelectorAll('.radial__item[data-current="true"]')
    out.info.currentCount = current.length
    if (current.length !== 1) {
      out.fail.push('被标记为当前项的瓦片有 ' + current.length + ' 个（应为 1）')
    } else {
      out.info.currentLabel = (current[0].textContent || '').trim()
      out.info.currentBg = css(current[0], 'background-color')
      out.info.currentColor = css(current[0], 'color')
    }

    /* ---- 附加：窄屏豁免与抽屉开关 ---- */
    var toggle = document.querySelector('.workspace-drawer-toggle')
    out.info.drawerToggleDisplay = toggle ? css(toggle, 'display') : 'absent'
    if (toggle && css(toggle, 'display') !== 'none' && window.innerWidth > 768) {
      out.fail.push('宽屏下抽屉开关是 ' + css(toggle, 'display') + ' → 顶栏会多出一个汉堡')
    }

    return
  }

  function report(out) {
    /* 两条通道都写：`<title>` 给"dump 被截断"兜底 —— `/home` 的 dump 在本机
       稳定停在 61841 字节，而 `<pre>` 追加在 body 末尾正好落在那之后。
       `<title>` 在 `<head>` 里、序列化时排最前，截断动不了它（详见 read-probe.mjs）。 */
    document.title = 'PROBE ' + JSON.stringify(out)
    var el = document.createElement('pre')
    el.id = 'PROBE'
    el.textContent = JSON.stringify(out, null, 1)
    document.body.appendChild(el)
  }

  /* 等 React 首次提交 + 环的入场动画走完再量 */
  setTimeout(run, 700)
})()
