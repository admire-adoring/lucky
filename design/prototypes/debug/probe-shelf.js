/* 探测：工作模块的「项目」书架（`design/work/work_index.html` → `ProjectShelf.tsx`）。
   ----------------------------------------------------------------------------
   配 `node design/debug/shot-app.mjs --probe design/debug/probe-shelf.js --dump --hash /work/projects`。

   验七件事，每一件都是"看代码看不出来、只有量计算值或真点一次才知道"的：

   1. **封面那一族声明真的落地了**。书脊宽度、内框边框、书名/短码文字、封面进度条 ——
      少任何一条都是一条 `var()` 取不到而被整条丢弃的声明，页面照常渲染、控制台干净。
   2. **浮层默认是"不存在"**，不是"看不见"。弹窗与飞行克隆体都是条件渲染的，
      所以这一条断言的是**个数为 0**；将来若改成"常在 DOM 里靠 class 切"，
      这条会红 —— 那时要改成读 `display`（见 probe-ai-actions.js 的判据）。
   3. **空分组要给明确空态**，不能是一片空白（口径 scope=work 时"已归档"通常是空的）。
   4. **点头部计数与 DOM 节点数一致**：两条独立来源，不一致说明"筛选口径"与"渲染口径"分叉了。
   5. **点开一本书真的会开弹窗**，而且**底衬/投影/圆角/几何**一起断言。
      只断"弹窗出现了"会漏掉最会漏的一种：wrapper 少带一个宿主类，
      21 条声明被静默丢弃，几何与内容全对、面板却全透明。
   6. **飞行动画真的起来了** —— 在 480ms 窗口里轮询 `.fly-clone`，
      并要求它是 `position: fixed`（它要是落回文档流，就会在列表末尾闪一下）。
      同一件事在关闭方向再验一遍。
   7. **弹窗正文是真实数据的形状**：概况行 ≥4、进度条在、有跳项目工作区的按钮、
      分区 ≥5、标题等于书名。

   ⚠️ 两条时序纪律，都是**本探针自己踩过**的（不是页面的毛病）：
   a) **点关闭必须等飞入结束**。`open()`/`close()` 都有 `flying` 闸门（原型就有的设计：
        动画中重复点击一律忽略）。在 400ms 就点关闭，那一刻飞入还没走完（480ms），
        点击被正确忽略 —— 而探针会读到"弹窗没关掉"，看起来像页面坏了。
        ⇒ 先用 `waitFor` 等克隆体消失，再关。
   b) **"关闭后弹窗消失"要等飞出结束**（同一把闸门，另一个方向）。
   ⚠️ 不读动画驱动的 `opacity`（dump 通道不做合成帧，动画停在第一帧）——
      显不显示一律读 `display` / 几何（这条是 read-probe.mjs 里记的老坑）。
*/
;(function () {
  function css(el, prop) {
    return getComputedStyle(el).getPropertyValue(prop).trim()
  }

  var out = { info: {}, fail: [], steps: [] }
  function step(ok, name, detail) {
    out.steps.push({ ok: !!ok, name: name, detail: String(detail) })
    if (!ok) out.fail.push(name + ' —— ' + detail)
  }

  function report(extra) {
    if (extra) out.info.extra = extra
    document.title = 'PROBE ' + JSON.stringify(out)
    var el = document.createElement('pre')
    el.id = 'PROBE'
    el.textContent = JSON.stringify(out, null, 1)
    document.body.appendChild(el)
  }

  /** 在 windowMs 窗口内轮询 `.fly-clone`，返回采样次数与第一次采到的位置。 */
  function watchClone(windowMs, done) {
    var seen = 0
    var pos = ''
    var t0 = performance.now()
    ;(function poll() {
      var clone = document.querySelector('.fly-clone')
      if (clone) {
        seen++
        if (!pos) pos = css(clone, 'position') + ' | left=' + clone.style.left + ' top=' + clone.style.top
      }
      if (performance.now() - t0 < windowMs) {
        setTimeout(poll, 25)
        return
      }
      done(seen, pos)
    })()
  }

  /** 等某个条件成立（或超时）。返回是否等到。 */
  function waitFor(predicate, timeoutMs, done) {
    var t0 = performance.now()
    ;(function poll() {
      if (predicate() || performance.now() - t0 > timeoutMs) {
        done(predicate())
        return
      }
      setTimeout(poll, 25)
    })()
  }

  function run() {
    var wrap = document.querySelector('.bookshelf-wrap')
    step(!!wrap, '书架容器渲染', wrap ? '有 .bookshelf-wrap' : '没有 .bookshelf-wrap')
    if (!wrap) return report()

    var books = [].slice.call(wrap.querySelectorAll('.book-flat'))
    out.info.books = books.length
    step(books.length > 0, '书架里有书', books.length + ' 本')

    /* ---- 1 · 封面的零件 ---- */
    var first = books[0]
    var cover = first.querySelector('.bf-cover')
    var coverBg = cover ? css(cover, 'background-image') : ''
    out.info.coverBg = coverBg.slice(0, 58)
    step(!!cover && /gradient/.test(coverBg), '封面是渐变（不是透明兜底）', coverBg.slice(0, 46))

    var spine = first.querySelector('.bf-spine')
    step(!!spine && parseFloat(css(spine, 'width')) >= 10, '书脊宽度', spine ? css(spine, 'width') : '缺失')

    var frame = first.querySelector('.bf-frame')
    var frameW = frame ? css(frame, 'border-top-width') : ''
    step(!!frame && parseFloat(frameW) > 0, '封面内框有边框', frameW || '缺失')

    var title = first.querySelector('.bf-title')
    step(!!title && title.textContent.trim().length > 0, '书名', title ? title.textContent.trim() : '缺失')

    var tag = first.querySelector('.bf-tag')
    step(!!tag && tag.textContent.trim().length > 0, '优先级短码', tag ? tag.textContent.trim() : '缺失')

    var fill = first.querySelector('.bf-progress-mini-fill')
    step(!!fill && parseFloat(css(fill, 'height')) > 0, '封面进度条', fill ? css(fill, 'height') : '缺失')

    /* ---- 2 · 浮层默认不存在 ---- */
    step(document.querySelectorAll('.modal-mask').length === 0, '默认没有弹窗', String(document.querySelectorAll('.modal-mask').length))
    step(document.querySelectorAll('.fly-clone').length === 0, '默认没有克隆体', String(document.querySelectorAll('.fly-clone').length))

    /* ---- 3 · 两个分组 + 空分组有明确空态 ---- */
    var groups = [].slice.call(wrap.querySelectorAll('.shelf-group'))
    step(groups.length === 2, '书架有两个分组', String(groups.length))
    var emptyGroups = groups.filter(function (g) {
      return g.querySelectorAll('.book-flat').length === 0
    })
    step(
      emptyGroups.every(function (g) {
        return !!g.querySelector('.empty-state')
      }),
      '空分组有明确空态',
      emptyGroups.length ? emptyGroups.length + ' 个空分组' : '（没有空分组）',
    )

    /* ---- 4 · 头部计数 vs 实际书数 ---- */
    var meta = wrap.querySelector('.bookshelf-head .doc-meta')
    var metaText = meta ? meta.textContent.replace(/\s+/g, ' ').trim() : ''
    out.info.headMeta = metaText
    var m = /(\d+) 个项目/.exec(metaText)
    step(!!m && Number(m[1]) === books.length, '头部项目数与书数一致', metaText || '头部副标题缺失')

    /* ---- 5/6 · 点开第一本 ---- */
    var bookName = title ? title.textContent.trim() : ''
    first.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    watchClone(320, function (seen, pos) {
      out.info.flySamples = seen
      out.info.clonePos = pos
      step(seen > 0, '飞入时克隆体出现过', seen + ' 次采样')
      step(/fixed/.test(pos), '克隆体是 position:fixed', pos || '没采到')

      var mask = document.querySelector('.modal-mask')
      var box = document.querySelector('.modal')
      step(!!mask && css(mask, 'display') === 'flex', '遮罩已显示', mask ? css(mask, 'display') : '缺失')
      step(!!box && /entering/.test(box.className), '弹窗带进场动画类', box ? box.className : '缺失')

      var boxBg = box ? css(box, 'background-color') : ''
      step(!!box && boxBg !== 'rgba(0, 0, 0, 0)' && boxBg !== 'transparent', '弹窗底衬非透明', boxBg)
      step(!!box && css(box, 'box-shadow') !== 'none', '弹窗有投影', box ? css(box, 'box-shadow').slice(0, 28) : '')
      step(!!box && parseFloat(css(box, 'border-top-left-radius')) > 0, '弹窗有圆角', box ? css(box, 'border-top-left-radius') : '')

      var rect = box ? box.getBoundingClientRect() : null
      out.info.boxRect = rect ? [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)] : null
      step(!!rect && rect.width > 200 && rect.left >= 0 && rect.top >= 0, '弹窗几何在视口内', JSON.stringify(out.info.boxRect))

      var dot = document.querySelector('.modal-title-dot')
      step(!!dot && css(dot, 'background-color') !== 'rgba(0, 0, 0, 0)', '标题色点有底色', dot ? css(dot, 'background-color') : '缺失')

      var modalTitle = document.querySelector('.modal-title')
      var modalTitleText = modalTitle ? modalTitle.textContent.trim() : ''
      out.info.modalTitle = modalTitleText
      step(modalTitleText === bookName && bookName !== '', '弹窗标题 = 书名', modalTitleText + ' vs ' + bookName)

      /* ---- 7 · 正文形状（真实数据的四段 + 进度） ---- */
      var rows = document.querySelectorAll('.modal .detail-row').length
      step(rows >= 4, '概况行数 ≥4', String(rows))
      step(!!document.querySelector('.modal .progress-bar'), '弹窗里有进度条', String(document.querySelectorAll('.modal .progress-bar').length))
      step(
        !!document.querySelector('.modal .detail-list li, .modal .empty-state'),
        '关键节点有内容或明确空态',
        String(document.querySelectorAll('.modal .detail-list li').length),
      )

      var labels = [].slice.call(document.querySelectorAll('.modal .detail-section > .detail-label')).map(function (l) {
        return l.textContent.trim()
      })
      out.info.sections = labels
      step(labels.length >= 5, '弹窗分区数 ≥5', labels.join(' / '))

      var cta = [].slice.call(document.querySelectorAll('.modal .form-actions .btn')).map(function (b) {
        return b.textContent.trim()
      })
      out.info.cta = cta
      step(cta.indexOf('打开项目工作区') >= 0, '有跳项目工作区的按钮', cta.join(' / ') || '（无）')

      /* ---- 8 · 关得掉（先等飞入结束，见文件头的时序纪律 a） ---- */
      waitFor(function () {
        return document.querySelectorAll('.fly-clone').length === 0
      }, 1500, function (flewDone) {
        step(flewDone, '飞入在 1.5s 内收尾', flewDone ? '克隆体已撤' : '克隆体还在')
        var closeBtn = document.querySelector('.modal-close')
        step(!!closeBtn, '有关闭按钮', closeBtn ? '有' : '缺失')
        if (!closeBtn) return report()

        closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        watchClone(320, function (seenBack, posBack) {
          out.info.closeFlySamples = seenBack
          out.info.closeClonePos = posBack
          step(seenBack > 0, '关闭时反向飞出', seenBack + ' 次采样')
          /* 飞出 480ms 之后才卸载，所以这一条要等（时序纪律 b） */
          waitFor(function () {
            return document.querySelectorAll('.modal-mask').length === 0
          }, 1500, function (closed) {
            step(closed, '关闭后弹窗从 DOM 消失', String(document.querySelectorAll('.modal-mask').length))
            step(document.querySelectorAll('.fly-clone').length === 0, '关闭后克隆体已撤', String(document.querySelectorAll('.fly-clone').length))
            report()
          })
        })
      })
    })
  }

  /* 等 React 首次提交（壳上量过 700ms 才稳） */
  setTimeout(run, 700)
})()
