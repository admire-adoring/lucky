/* 探测：只做一件事 —— 点开书架上的第一本书，**不关**。
   ----------------------------------------------------------------------------
   给**截图通道**用：截图发生在虚拟时间预算结束时（4s），那时飞行动画已经跑完、
   弹窗正开着，所以这张图能拍到"弹窗 + 背后的书架"的合影。
   （`probe-shelf.js` 会走到关闭，截图到那一步时弹窗已经没了 —— 两个探针各管一头。）

   用法：node design/debug/shot-app.mjs --probe design/debug/probe-shelf-open.js \
           --out /tmp/shelf-open.png --hash /work/projects --size 1440x900
*/
;(function () {
  setTimeout(function () {
    var book = document.querySelector('.book-flat')
    if (!book) {
      document.title = 'PROBE-FAIL 没有 .book-flat'
      return
    }
    book.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.title = 'PROBE-SHELF-OPEN 已点开第一本书'
  }, 700)
})()
