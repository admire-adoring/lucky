#!/usr/bin/env node
/**
 * gen-modules.mjs —— 工作台原型（版式 B）的内容生成器
 * ----------------------------------------------------------------------------
 * **一次性内容生成工具，不是构建流水线的一环。**可以反复跑（区间定位容忍改版前后两套
 * 标记，已经撤掉的顶栏胶囊 / 已经加上的面包屑会自动跳过），但它的**权威性只在内容**：
 * 手改完 workbench.html 里由它生成的片段后再跑一次，手改会被覆盖。
 *
 * 流水线只有一条：改类名 → node design/build-css.mjs（编译并内联令牌产物）。
 * 本脚本负责**内容**：九张模块卡 + 九个面板（45 块磁贴）+ 九段助手对话 + 轮播脚本，
 * 以及那些必须跟着改的注释。
 *
 * 为什么要有它：45 块磁贴里 30 多条 SVG 柱状图路径、九个面板的重复骨架，
 * 手写必错、且改一处数据要改十处。这里把「数据 → 数字 → 图」的关系写死成函数，
 * 重跑一次全量重建，人只读数据、不手算柱高。
 *
 * 用法：node design/gen-modules.mjs
 *   --dry   只报告将要做的改动与校验结果，不写文件
 *
 * 数据源：src/data/projects.ts 的 8 个项目（字段逐一对齐，见下面的 P）。
 * 所有对外显示的数字都由 P 派生 —— 脚本末尾会打印核算表，可以逐条对账。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const PAGE = path.join(DIR, 'workbench.html')
const DRY = process.argv.includes('--dry')

/* ============================================================================
   0. 工具
   ========================================================================= */
const r1 = (v) => Math.round(v * 10) / 10
const sum = (a) => a.reduce((x, y) => x + y, 0)

/** 柱状图。viewBox 0 0 238 35，基线 y=34。
 *  柱用竖线（M x 34 V top）+ stroke-width 表达宽度 —— 比 <rect> 紧凑得多，
 *  stroke-width 相同的柱合成一条 path，30 根柱也只有几十字节。 */
const chart = (groups, { width = 238, height = 35, baseline = 34 } = {}) => {
  const paths = groups
    .map(
      ({ color, w, bars }) =>
        `<path d="${bars.map(([x, h]) => `M${x} ${baseline} V${r1(baseline - h)}`).join(' ')}" stroke="${color}" stroke-width="${w}" fill="none" />`,
    )
    .join('\n                              ')
  return `<svg viewBox="0 0 ${width} ${height}" class="block w-full aspect-[${width}/${height}]" aria-hidden="true">
                              <line x1="0" y1="${baseline}" x2="${width}" y2="${baseline}" stroke="rgba(17,20,28,.10)" stroke-width="1" />
                              ${paths}
                            </svg>`
}
/** 柱高：数值 → 像素。**下限 2px**，否则 0% 的项目那根柱完全不可见，会让人以为漏画了。 */
const hOf = (v, max, maxH = 30, minH = 2) => Math.max(minH, r1((v / max) * maxH))

/* ============================================================================
   1. 数据：与 src/data/projects.ts 逐字段一致
   ========================================================================= */
const P = [
  { id: 'p1', scope: 'life', name: '马尔代夫家庭旅行', short: '马尔代夫', status: 'active', priority: 'mid', progress: 68, done: 13, total: 19, due: '10月01日', days: 13, milestone: '行程终版确认', budget: 32000, visibility: '家庭可见', docs: '旅行资料库', risk: null },
  { id: 'p2', scope: 'life', name: '老房翻新改造', short: '老房翻新', status: 'risk', priority: 'high', progress: 42, done: 9, total: 24, due: '9月30日', days: 12, milestone: '瓦工进场', budget: 186000, visibility: '家庭可见', docs: '装修报价与图纸', risk: '工期已延期 5 天' },
  { id: 'p3', scope: 'work', name: 'Q4 客户交付系统重构', short: 'Q4 重构', status: 'active', priority: 'high', progress: 72, done: 26, total: 36, due: '11月15日', days: 58, milestone: '灰度发布', budget: null, visibility: '工作内部', docs: '技术方案 v3', risk: '鉴权迁移存在兼容风险' },
  { id: 'p4', scope: 'work', name: '团队 OKR 落地推进', short: '团队 OKR', status: 'planning', priority: 'mid', progress: 12, done: 3, total: 18, due: '12月31日', days: 104, milestone: 'KR 拆解评审', budget: null, visibility: '工作内部', docs: 'OKR 对齐文档', risk: null },
  { id: 'p5', scope: 'learn', name: 'Rust 异步编程精读', short: 'Rust 精读', status: 'active', priority: 'mid', progress: 80, done: 16, total: 20, due: '9月28日', days: 10, milestone: 'mini-runtime 跑通', budget: null, visibility: '私有', docs: '读书笔记合集', risk: null },
  { id: 'p6', scope: 'learn', name: '数据可视化课程实践', short: '可视化课程', status: 'planning', priority: 'low', progress: 0, done: 0, total: 14, due: '11月20日', days: 63, milestone: '作业 1-4 完成', budget: null, visibility: '私有', docs: '课程大纲', risk: null },
  { id: 'p7', scope: 'learn', name: '个人博客 v2 重写', short: '博客 v2', status: 'done', priority: 'low', progress: 100, done: 22, total: 22, due: '8月30日', days: -19, milestone: '正式上线', budget: null, visibility: '公开', docs: '设计系统说明', risk: null },
  { id: 'p8', scope: 'life', name: '年度体检与健身计划', short: '年度体检', status: 'done', priority: 'mid', progress: 100, done: 11, total: 11, due: '8月15日', days: -34, milestone: '12 周计划达成', budget: 6800, visibility: '私有', docs: '体检报告索引', risk: null },
]

/* ============================================================================
   2. 派生
   ========================================================================= */
const SCOPES = ['life', 'work', 'learn']
const SCOPE = {
  life: { label: '生活', bar: 'bg-life', chip: 'bg-life-bg text-life-strong', grad: 'bg-[linear-gradient(90deg,#34d3a6,#0f9d76)]', hex: '#0f9d76' },
  work: { label: '工作', bar: 'bg-work', chip: 'bg-work-bg text-work-strong', grad: 'bg-[linear-gradient(90deg,#6f9dff,#2f6fed)]', hex: '#2f6fed' },
  learn: { label: '学习', bar: 'bg-learn', chip: 'bg-learn-bg text-learn-strong', grad: 'bg-[linear-gradient(90deg,#a78bfa,#7c3aed)]', hex: '#7c3aed' },
}
// 状态 chip / 点色取 src/data/meta.ts 的 STATUS_META，色值取 index.css 的令牌
const STATUS = {
  planning: { label: '待启动', chip: 'bg-ink-100 text-ink-600', dot: 'bg-ink-400', hex: '#74808f' },
  active: { label: '进行中', chip: 'bg-success-bg text-success-strong', dot: 'bg-success', hex: '#0f9d76' },
  risk: { label: '风险阻塞', chip: 'bg-danger-bg text-danger-strong', dot: 'bg-danger', hex: '#d82323' },
  done: { label: '已完成', chip: 'bg-brand-50 text-brand-600', dot: 'bg-brand-500', hex: '#4f46e5' },
}
const INK300 = '#9ba4b2'
const BRAND = '#4f46e5'
const DANGER = '#d82323'
const PRIO = { high: '#e5484d', mid: '#e0a020', low: INK300 }

const byScope = (s) => P.filter((p) => p.scope === s)
const avg = (a) => Math.round(sum(a) / a.length)
const unfinished = P.filter((p) => p.status !== 'done')
const active = P.filter((p) => p.status === 'active')
const risky = P.filter((p) => p.status === 'risk')
const planned = P.filter((p) => p.status === 'planning')
const completed = P.filter((p) => p.status === 'done')

const TASKS = { total: sum(P.map((p) => p.total)), done: sum(P.map((p) => p.done)) }
TASKS.todo = TASKS.total - TASKS.done
TASKS.rate = r1((TASKS.done / TASKS.total) * 100)

const DOM = Object.fromEntries(
  SCOPES.map((s) => {
    const g = byScope(s)
    const total = sum(g.map((p) => p.total))
    const done = sum(g.map((p) => p.done))
    return [s, { group: g, total, done, todo: total - done, avg: avg(g.map((p) => p.progress)), rate: r1((done / total) * 100) }]
  }),
)
const GLOBAL_AVG = avg(P.map((p) => p.progress))
/** 月份 → 未完成项目的到期数（日程/工作台共用） */
const MONTHS = ['9', '10', '11', '12']
const monthCount = Object.fromEntries(MONTHS.map((m) => [m, unfinished.filter((p) => p.due.startsWith(m + '月')).length]))
const BUDGET = P.filter((p) => p.budget)
const BUDGET_TOTAL = sum(BUDGET.map((p) => p.budget))
const VIS = ['私有', '工作内部', '家庭可见', '公开'].map((v) => [v, P.filter((p) => p.visibility === v).length])
/** 剩余天数（未完成项目，按剩余升序） */
const BY_DAYS = [...unfinished].sort((a, b) => a.days - b.days)

/* ============================================================================
   3. 片段生成器（骨架逐字对齐 workbench.html 里既有的磁贴与卡片）
   ========================================================================= */
const MORE_BTN = `<button type="button" aria-label="更多操作" class="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-sm border border-transparent text-ink-300 transition-colors duration-150 hover:bg-ink-50 hover:text-ink-700"><svg class="icon h-[15px] w-[15px]"><use href="#i-more" /></svg></button>`
const ARROW = `<svg class="icon h-[13px] w-[13px] shrink-0 text-ink-300 transition-transform duration-150 group-hover:translate-x-0.5"><use href="#i-arrow-right" /></svg>`
const TILE_CLS = 'g g3 g--refr relative flex flex-col overflow-hidden rounded-xl border border-line p-5 transition-all duration-[220ms] ease-out hover:-translate-y-0.5'
const LIST_CLS = 'g g3 g--refr relative flex flex-col overflow-hidden rounded-xl border border-line transition-all duration-[220ms] ease-out hover:-translate-y-0.5'
const HEAD_CHIP = 'g g1 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-line text-ink-500'

const icon = (name, cls) => `<svg class="icon ${cls}"><use href="#${name}" /></svg>`

/** KPI 磁贴：标题 + 副标 + 大数字 + 图表区。chart 传 null 时用 tail 顶替图表区。 */
const kpiTile = ({ icon: ico, title, sub, value, unit, dot, chart: chartSvg, labels, legend, tail }) => `<article class="${TILE_CLS}">
                          <div class="relative flex items-center gap-2">
                            <span class="${HEAD_CHIP}">${icon(ico, 'h-[15px] w-[15px]')}</span>
                            <b class="text-13 font-semibold text-ink-700">${title}</b>
                            <span class="flex-1"></span>
                            ${MORE_BTN}
                          </div>
                          <div class="relative mt-2.5 text-11-5 font-medium text-ink-400">${sub}</div>
                          <div class="relative mt-3 flex items-center gap-2">
                            <b class="text-29 leading-none font-bold tracking-[-0.02em] tabular-nums">${value}</b>
                            ${unit ? `<small class="text-13 font-semibold text-ink-400">${unit}</small>` : ''}
                            ${dot ? `<i class="h-[7px] w-[7px] shrink-0 rounded-full ${dot}"></i>` : ''}
                          </div>
                          <div class="relative mt-auto pt-4">
                            ${chartSvg || ''}
                            ${
                              labels
                                ? `<div class="mt-1.5 grid text-center text-11 font-medium text-ink-400" style="grid-template-columns: repeat(${labels.length}, minmax(0, 1fr))">${labels.map((l) => `<span class="truncate">${l}</span>`).join('')}</div>`
                                : ''
                            }
                            ${
                              legend
                                ? `<div class="mt-1.5 flex items-center justify-center gap-5 text-11 font-medium text-ink-400">${legend.map(([c, l]) => `<span class="inline-flex items-center gap-1.5"><i class="h-[6px] w-[6px] rounded-full ${c}"></i>${l}</span>`).join('')}</div>`
                                : ''
                            }
                            ${tail || ''}
                          </div>
                        </article>`

/** 列表卡：抬头上边框 + 行体（<a> 行或 <li> 行） */
const listTile = ({ icon: ico, title, right, body }) => `<article class="${LIST_CLS}">
                          <div class="flex items-center gap-2 border-b border-line px-5 py-4">
                            <span class="${HEAD_CHIP}">${icon(ico, 'h-[15px] w-[15px]')}</span>
                            <b class="text-13 font-semibold text-ink-700">${title}</b>
                            <span class="flex-1"></span>
                            <span class="text-12 font-medium text-ink-400">${right}</span>
                          </div>
                          ${body}
                        </article>`

/** ≤14 天到期 → 日期转红加粗（判据同 src 的 Delta 语义：紧近的截止日是"信息"不是"装饰"） */
const dueCls = (p) => (p.status !== 'done' && p.days <= 14 ? ' font-semibold text-danger-strong' : '')

/** 项目行：色条 + 名称 + 状态 chip + 到期/任务 + 进度条 */
const projectRow = (p) => `<a href="#" class="group flex items-center gap-3 border-b border-line px-5 py-3.5 transition-colors duration-150 last:border-b-0 hover:bg-ink-50">
                            <span class="h-[34px] w-[3px] shrink-0 rounded-full ${SCOPE[p.scope].bar}"></span>
                            <div class="min-w-0 flex-1">
                              <div class="flex items-center gap-2">
                                <b class="truncate text-13-5 font-semibold text-ink-800">${p.name}</b>
                                <span class="inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full border border-transparent ${STATUS[p.status].chip} px-[9px] text-11-5 font-semibold whitespace-nowrap"><i class="h-[5.5px] w-[5.5px] shrink-0 rounded-full ${STATUS[p.status].dot}"></i>${STATUS[p.status].label}</span>
                              </div>
                              <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-11-5 font-medium text-ink-400">
                                <span class="inline-flex items-center gap-[5px]${dueCls(p)}">${icon('i-calendar', 'h-[12.5px] w-[12.5px] text-ink-400')}${p.due}</span>
                                <span class="inline-flex items-center gap-[5px]">${icon('i-check', 'h-[12.5px] w-[12.5px] text-ink-400')}${p.done}/${p.total} 任务</span>
                              </div>
                            </div>
                            <div class="hidden w-[132px] shrink-0 max-[600px]:hidden lg:block">
                              <div class="flex items-center gap-2.5">
                                <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100"><span class="block h-full ${SCOPE[p.scope].grad}" style="width: ${p.progress}%"></span></div>
                                <span class="min-w-[34px] text-right text-12 font-bold tabular-nums text-ink-600">${p.progress}%</span>
                              </div>
                            </div>
                            ${ARROW}
                          </a>`

/** 扁平行：域点 + 名称 + 右侧元信息 + 进度条（用于"按域汇总"这类行） */
const flatRow = ({ dot, grad, name, meta, pct, pctCls = 'text-ink-600' }) => `<a href="#" class="group flex items-center gap-3 border-b border-line px-5 py-3.5 transition-colors duration-150 last:border-b-0 hover:bg-ink-50">
                            <span class="h-[34px] w-[3px] shrink-0 rounded-full ${dot}"></span>
                            <div class="min-w-0 flex-1">
                              <b class="block truncate text-13-5 font-semibold text-ink-800">${name}</b>
                              <div class="mt-1 text-11-5 font-medium text-ink-400">${meta}</div>
                            </div>
                            <div class="hidden w-[132px] shrink-0 max-[600px]:hidden lg:block">
                              <div class="flex items-center gap-2.5">
                                <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100"><span class="block h-full ${grad}" style="width: ${pct}%"></span></div>
                                <span class="min-w-[34px] text-right text-12 font-bold tabular-nums ${pctCls}">${pct}%</span>
                              </div>
                            </div>
                            ${ARROW}
                          </a>`

/** 事件行：点 + 正文 + 副标 · 右侧 */
const eventRow = ({ dot, text, sub, right, tone }) => `<li class="flex gap-3 border-b border-line px-5 py-3 last:border-b-0">
                            <span class="flex w-[15px] shrink-0 justify-center"><i class="mt-[6px] h-[7px] w-[7px] rounded-full ${dot}"></i></span>
                            <div class="min-w-0 flex-1">
                              <p class="text-12-5 leading-[1.6] text-ink-700">${text}</p>
                              <div class="mt-0.5 flex flex-wrap items-center gap-2 text-11 font-medium text-ink-400">
                                <span class="truncate">${sub}</span>
                                <span class="h-[3px] w-[3px] shrink-0 rounded-full bg-ink-300"></span>
                                <span class="shrink-0 tabular-nums${tone === 'danger' ? ' font-semibold text-danger-strong' : ''}">${right}</span>
                              </div>
                            </div>
                          </li>`

const aRows = (rows) => `<div class="flex flex-1 flex-col">${rows.join('')}</div>`
const liRows = (rows) => `<ul class="flex flex-1 flex-col">${rows.join('')}</ul>`

const panel = (m, { hidden }) => `                      <div data-module-panel="${m.key}"${hidden ? ' hidden' : ''}>
                        <div class="grid grid-cols-2 gap-4 max-[860px]:grid-cols-1">
                          <div class="col-span-2 grid grid-cols-3 gap-4 max-[860px]:col-span-full max-[1240px]:grid-cols-2 max-[600px]:grid-cols-1">
                        ${m.tiles.slice(0, 3).join('\n                        ')}
                          </div>
                        ${m.tiles.slice(3).join('\n                        ')}
                        </div>
                      </div>`

/* ---- 径向菜单的几何：九个模块全部在环上，中心是一枚指向选中项的指针 ----
   两个半径是算出来的常量，也是 CSS 与 JS 共用的**唯一来源**（JS 那侧由本脚本内插，不手抄）：
     --r  92px   图标瓦片所在的半径
     --rl 130px  名称标签所在的半径 —— 必须比瓦片更外一圈：同一半径放标签，
                 在 40° 间隔下会撞上邻座的瓦片（瓦片那圈的弧间距只有 2·92·sin20° ≈ 63px，
                 而标签宽约 46px）；推到 130px 后弧间距 ≈ 89px，实测不再相交。
                 两者的**差**（38px）是关键常量：圆形瓦片半宽 22 + 标签沿径向的半支撑 23
                 − 容差 ≈ 38。收窄断点时这两个数必须成对地收，差不能变。

   ⚠️ **瓦片是圆的（border-radius 999），这不是审美选择，是几何需要。**
   方形瓦片的「支撑半径」随方向变：边长 44 的方盒在 40° 斜方向上要占到
   22·(|cos|+|sin|) ≈ 31px，而正方向只要 22px —— 于是斜方向那几张瓦片会比正方向的
   多"吃"掉 9px，把外圈的标签压住。实测（方形 44px + r 92 + rl 122）：
   同项目的标签与瓦片盒重叠最多 33×16px，也就是**第一个字有 1~2 个字宽压在了瓦片上**。
   改成圆之后支撑半径恒为 item/2，重叠降到 3.4px 以内（只是字的角挨着圆的边缘）。
   方形斜方向多吃 9px 这个量，靠"把标签往外推"是补不干净的 —— 那要把 rl 抬到 145，
   Hero 会凭空长高 46px，而用户前一轮刚要求把内容整体上移。

   四个数彼此牵制，改任何一个都要重新量：
     step 40°   9 个正好铺满 360°
     dial 82px  中心球直径（比瓦片大一号，它要撑住"中心"这个位置）
     nameY 45px 中心名字的纵向偏移：上界是球半径 41px，下界是最靠下的瓦片**圆的**上缘。
                最靠下的是 ±70° 两枚（r·sin70° − item/2 = 86.4 − 22 = 64.4px），
                13px 紧行高从 45 起、到 58 止 —— 上余 4px、下余 6.4px。
                （取 44 会变成上余 3 / 下余 7.4；这一对永远只有几像素，改 r / item / nameY
                 里任何一个都必须重新配平。）

   装饰件的尺寸全部派生自上面这几个数：
     光晕    直径 2·rl      —— 正好罩住整个环（含标签圈）
     花瓣与罗盘星  画在 SVG 层（viewBox 100 映到 var(--dial)，随令牌缩放），
                   半径关系见下方 PETAL 与 spike 的注释。
     ⚠️ 曾经的"刻度圈"（dial 内沿的 10° 细刻度 + 40° 主刻度）已删 —— 原因见 HERO_CSS。 */
const RING = { r: 92, rl: 130, step: 40, start: -90, item: 44, dial: 82, nameY: 45, mark: 1.12 }
/** 第 i 个模块的固定角度（从 12 点起顺时针，40° 一格）——**不随当前项变化**，
 *  所以位置永远是稳定的（这是"指针方案"能成立的前提：地图不动，只有指针转）。 */
const ringAngle = (i) => RING.start + RING.step * i
/** 标签相对瓦片中心的偏移（沿同一方向再外推 rl − r） */
const ringLabelOffset = (a) => {
  const rad = (a * Math.PI) / 180
  return { lx: r1((RING.rl - RING.r) * Math.cos(rad)), ly: r1((RING.rl - RING.r) * Math.sin(rad)) }
}

/** 环上的一项：44px 瓦片 + 图标，名字靠 --lx/--ly 推到外圈。
 *  九项全部在环上（含当前项），当前项只是**被标记**（品牌色实底），不再"飞进中心"。 */
const ringItem = (m, i, a, { lx, ly }) => `                      <button
                        type="button"
                        class="radial__item g g1 mod-tile flex items-center justify-center transition-colors duration-150"
                        style="--a: ${a}deg; --lx: ${lx}px; --ly: ${ly}px; --i: ${i}"
                        data-module="${m.key}" data-label="${m.label}" data-summary="${m.summary}"
                        data-enter="${m.enter.text}" data-enter-path="${m.enter.path}" data-enter-self="${m.enter.self ? 'true' : 'false'}"
                        data-current="${i === 0}" aria-current="${i === 0}"
                        aria-label="切换到${m.label}"
                      >
                        <span class="radial__label text-11 font-medium text-ink-400">${m.label}</span>
                        <svg class="icon h-[22px] w-[22px]"><use href="#${m.icon}" /></svg>
                      </button>`

/** 助手对话：头像用 #i-spark（⚠️ src/components/icons/IconSprite.tsx 里没这个 symbol，
 *  原型自己的内联雪碧图补了一个，见文末说明）。 */
const aiBubble = (html, time) => `<div class="flex gap-2.5">
                              <span class="rail-avatar rail-avatar--sm" aria-hidden="true">${icon('i-spark', 'h-[11px] w-[11px]')}</span>
                              <div class="min-w-0 flex-1">
                                <p class="text-12-5 leading-[1.65] text-ink-700">${html}</p>
                                <div class="mt-1 text-11 font-medium tabular-nums text-ink-400">${time}</div>
                              </div>
                            </div>`
const userBubble = (html, time) => `<div class="flex justify-end">
                              <div class="max-w-[88%]">
                                <p class="rounded-[13px] rounded-tr-[5px] bg-brand-50 px-3 py-2 text-12-5 leading-[1.65] text-ink-800">${html}</p>
                                <div class="mt-1 text-right text-11 font-medium tabular-nums text-ink-400">${time}</div>
                              </div>
                            </div>`
/* 对话起点分隔线。一条线同时收三件事：
   ① 消息区是**底部对齐**的（整页常驻栏，对话贴着输入框长），于是栏顶那块留白
      原本"浮着半截内容" —— 有了起点线，留白读作"对话从这儿往上长"；
   ② 时间戳只写到 16:04，日期在整屏都没有出处 —— 这里补上；
   ③ 它是聊天界面的惯例（Slack / 微信的「今天」）。
   ⚠️ 它必须是面板的**第一个**子元素。
   外层的 flex-col-reverse **只把"整块"推到容器底部**，块内顺序仍是正常的 column
   （实测：容器里 9 个面板有 8 个 hidden，可见的其实只有 1 个 flex item，
   于是 reverse 只决定"这一块贴哪边"，决定不了块内谁上谁下）。
   放最后不会报错，只会让"起点"掉到对话末尾 —— 只有截图能发现。 */
const RAIL_DAY = `                            <div class="flex items-center gap-2 pt-1 text-11 font-medium text-ink-400"><span class="h-px flex-1 bg-line"></span>今天<span class="h-px flex-1 bg-line"></span></div>`
const chatPanel = (m, { hidden }) => `                          <div data-module-panel="${m.key}" class="flex flex-col gap-4"${hidden ? ' hidden' : ''}>
${RAIL_DAY}
                            ${m.chat.join('\n                            ')}
                          </div>`

/* ============================================================================
   4. 九个模块
   ========================================================================= */
/* ---------- 右侧「今日焦点」的派生 ----------
   口径与磁贴完全一致：**先风险（status === 'risk'）、再剩余天数升序**，取前 N 条。
   每条只引用 projects.ts 里已有的字段（name / milestone / done-total / days / due / progress / docs），
   **不允许出现磁贴里没有的数字** —— 右侧补的是"具体是哪几件"，不是新造一批数。 */
const domUnfinished = (sc) => P.filter((p) => p.scope === sc && p.status !== 'done')

/** 通用：风险优先 → 剩余天数升序 → 取前 n */
const focusOf = (list, n = 4) =>
  [...list]
    .sort((a, b) => (b.risk ? 1 : 0) - (a.risk ? 1 : 0) || a.days - b.days)
    .slice(0, n)
    .map((p) => ({
      name: p.name,
      meta: `${p.milestone} · 任务 ${p.done}/${p.total}`,
      tag: p.days <= 14 ? `剩 ${p.days} 天` : p.due,
      tone: p.risk ? 'danger' : p.days <= 14 ? 'warn' : 'ink',
    }))

/** 任务清单：按「完成率最低」排 —— 落后最多的先看（与磁贴的"任务进度"同一组数） */
const focusByLag = (list, n = 4) =>
  [...list]
    .sort((a, b) => a.done / a.total - b.done / b.total)
    .slice(0, n)
    .map((p) => ({
      name: p.name,
      meta: `${p.milestone} · 进度 ${p.progress}%`,
      tag: `任务 ${p.done}/${p.total}`,
      tone: p.risk ? 'danger' : p.done / p.total < 0.5 ? 'warn' : 'ink',
    }))

/** 日程：按到期日排（越近越前），tag 给日期而不是天数 —— 这是它与"今日焦点"的区别 */
const focusByDate = (list, n = 4) =>
  [...list]
    .sort((a, b) => a.days - b.days)
    .slice(0, n)
    .map((p) => ({
      name: p.name,
      meta: `${p.milestone} · 剩余 ${p.days} 天`,
      tag: p.due,
      tone: p.days <= 14 ? 'warn' : 'ink',
    }))

/** 知识库：8 个项目的文档索引（docsUrl → 知识库索引，与磁贴同源） */
const focusDocs = (n = 4) =>
  P.slice(0, n).map((p) => ({
    name: p.docs,
    meta: `${p.name} · ${p.visibility}`,
    tag: '索引',
    tone: 'ink',
  }))

/** 项目：全部 8 个按风险 + 进度排（含已完成 —— 项目模块要看全貌） */
const focusProjects = (n = 4) =>
  [...P]
    .sort((a, b) => (b.risk ? 1 : 0) - (a.risk ? 1 : 0) || a.progress - b.progress)
    .slice(0, n)
    .map((p) => ({
      name: p.name,
      meta: `${p.milestone} · 任务 ${p.done}/${p.total}`,
      tag: `${p.progress}%`,
      tone: p.risk ? 'danger' : p.progress < 50 ? 'warn' : 'ink',
    }))

/* 三档色调。⚠️ warning 没有 -strong 变体（令牌里只有 warning / -bg / -line），
   而主色阶 #c2740a 压在 13% 同色底上不足 4.5:1 —— 所以 warn 档的**文字走 ink-700**，
   颜色信息由圆点（装饰级，不受文字对比度约束）承担。这是 §2.3 ③ 的同一判据。 */
const FOCUS_TONE = {
  danger: { dot: 'bg-danger', tag: 'bg-danger-bg text-danger-strong' },
  warn: { dot: 'bg-warning', tag: 'bg-warning-bg text-ink-700' },
  ink: { dot: 'bg-ink-300', tag: 'text-ink-500' },
}
/** 一条焦点：圆点 + 名称 + 右侧标记 + 一行说明 */
const focusItem = (f) => {
  const t = FOCUS_TONE[f.tone]
  return [
    `                      <li class="flex items-start gap-2.5 rounded-xl border border-line g g3 g--refr px-3 py-2.5">`,
    `                        <i class="mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full ${t.dot}"></i>`,
    `                        <div class="min-w-0 flex-1">`,
    `                          <div class="flex items-baseline gap-2">`,
    `                            <b class="min-w-0 truncate text-12-5 font-semibold text-ink-900">${f.name}</b>`,
    `                            <span class="ml-auto shrink-0 rounded-full px-1.5 py-px text-11 font-bold tabular-nums ${t.tag}">${f.tag}</span>`,
    `                          </div>`,
    `                          <div class="mt-0.5 truncate text-11-5 font-medium text-ink-500">${f.meta}</div>`,
    `                        </div>`,
    `                      </li>`,
  ].join('\n')
}

/** 一个焦点面板。设置是唯一没有数据源的模块 → 走空态（不编数字）。 */
const FOCUS_EMPTY = '                      <li class="rounded-xl border border-dashed border-line px-3 py-6 text-center text-11-5 font-medium text-ink-400">设置模块未接入数据源 —— 文档里的 10 个设置页见下方面板</li>'
const focusPanelOf = (m) => {
  const body = m.focus.length ? m.focus.map(focusItem).join('\n') : FOCUS_EMPTY
  return [
    `                    <ul class="grid gap-2" data-focus-panel="${m.key}"${m.key === 'home' ? '' : ' hidden'}>`,
    body,
    '                    </ul>',
  ].join('\n')
}

const MODULES = [
  /* ---------- 工作台：全应用总览（本页本身） ---------- */
  {
    key: 'home',
    label: '工作台',
    summary: `全域平均进度 ${GLOBAL_AVG}% · ${P.length} 个项目 · ${TASKS.total} 条任务`,
    icon: 'i-grid',
    focus: focusOf(unfinished),
    tiles: [
      kpiTile({
        icon: 'i-trend',
        title: '域完成度',
        sub: '3 个业务域 · 柱高 = 域平均进度',
        value: `${GLOBAL_AVG}%`,
        dot: 'bg-brand-500',
        chart: chart([{ color: BRAND, w: 26, bars: SCOPES.map((s, i) => [73 + i * 46, hOf(DOM[s].avg, 100)]) }]),
        labels: SCOPES.map((s) => SCOPE[s].label),
      }),
      kpiTile({
        icon: 'i-check-circle',
        title: '任务总量',
        sub: `已完成 ${TASKS.done} / ${TASKS.total} 条`,
        value: `${TASKS.rate}%`,
        dot: 'bg-brand-500',
        chart: chart([
          { color: BRAND, w: 22, bars: SCOPES.map((s, i) => [11 + i * 94, hOf(DOM[s].done, 56)]) },
          { color: INK300, w: 22, bars: SCOPES.map((s, i) => [39 + i * 94, hOf(DOM[s].todo, 56)]) },
        ]),
        labels: SCOPES.map((s) => SCOPE[s].label),
        legend: [['bg-brand-500', '已完成'], ['bg-ink-300', '待办']],
      }),
      kpiTile({
        icon: 'i-alert',
        title: '风险与到期',
        sub: `${risky.length} 项风险 · ${unfinished.length} 项待到期`,
        value: `${risky.length}`,
        unit: '项',
        dot: 'bg-danger',
        chart: chart([
          { color: DANGER, w: 26, bars: [[40, hOf(monthCount['9'], 2)]] },
          { color: BRAND, w: 26, bars: MONTHS.slice(1).map((m, i) => [92 + i * 52, hOf(monthCount[m], 2)]) },
        ]),
        labels: MONTHS.map((m) => `${m}月`),
      }),
      listTile({ icon: 'i-project', title: '项目明细', right: `全部 · ${P.length} 个项目`, body: aRows([...P].sort((a, b) => b.progress - a.progress).map(projectRow)) }),
      listTile({
        icon: 'i-clock',
        title: '关键节点',
        right: '风险与里程碑',
        body: liRows([
          eventRow({ dot: 'bg-danger', text: `<b class="font-semibold text-danger-strong">${P[1].risk}</b>`, sub: P[1].name, right: `剩余 ${P[1].days} 天`, tone: 'danger' }),
          eventRow({ dot: 'bg-danger', text: P[2].risk, sub: P[2].name, right: `剩余 ${P[2].days} 天` }),
          ...[P[0], P[4], P[3]].map((p) =>
            eventRow({ dot: SCOPE[p.scope].bar, text: `里程碑 · ${p.milestone}`, sub: p.name, right: p.due }),
          ),
        ]),
      }),
    ],
    chat: [
      aiBubble(`早上好。今天有 <b>${risky.length} 项风险</b>、<b>${unfinished.length} 项待到期</b>：<b>${P[1].name}</b> 剩余 ${P[1].days} 天（${P[1].progress}%）、<b>${P[4].name}</b> 剩余 ${P[4].days} 天（${P[4].progress}%）。要我先排今天的顺序吗？`, '16:04'),
      userBubble('先看全域。', '16:05'),
      aiBubble(`全域平均进度 <b>${GLOBAL_AVG}%</b>，${TASKS.total} 条任务完成 ${TASKS.done} 条（${TASKS.rate}%）。生活 ${DOM.life.avg}% 领先，工作 ${DOM.work.avg}% 落后 ${GLOBAL_AVG - DOM.work.avg} 个百分点 —— 差距主要来自 <b>${P[3].name}</b>（${P[3].progress}%，还没有实质排期）。`, '16:05'),
    ],
  },

  /* ---------- 任务清单：按项目汇总 ---------- */
  {
    key: 'tasks',
    label: '任务清单',
    summary: `待办 ${TASKS.todo} · 已完成 ${TASKS.done} / ${TASKS.total}（${TASKS.rate}%）`,
    icon: 'i-kanban',
    focus: focusByLag(unfinished),
    tiles: [
      kpiTile({
        icon: 'i-kanban',
        title: '待办分布',
        sub: '按业务域 · 柱高 = 待办条数',
        value: `${TASKS.todo}`,
        unit: '条',
        dot: 'bg-brand-500',
        chart: chart([
          { color: SCOPE.life.hex, w: 26, bars: [[73, hOf(DOM.life.todo, 25)]] },
          { color: SCOPE.work.hex, w: 26, bars: [[119, hOf(DOM.work.todo, 25)]] },
          { color: SCOPE.learn.hex, w: 26, bars: [[165, hOf(DOM.learn.todo, 25)]] },
        ]),
        labels: SCOPES.map((s) => SCOPE[s].label),
      }),
      kpiTile({
        icon: 'i-flag',
        title: '优先级分布',
        sub: '按项目优先级 · 柱高 = 项目数',
        value: `${P.length}`,
        unit: '个',
        dot: 'bg-brand-500',
        chart: chart([
          { color: PRIO.high, w: 26, bars: [[73, hOf(P.filter((p) => p.priority === 'high').length, 4)]] },
          { color: PRIO.mid, w: 26, bars: [[119, hOf(P.filter((p) => p.priority === 'mid').length, 4)]] },
          { color: PRIO.low, w: 26, bars: [[165, hOf(P.filter((p) => p.priority === 'low').length, 4)]] },
        ]),
        labels: ['高', '中', '低'],
      }),
      kpiTile({
        icon: 'i-clock',
        title: '紧急待办',
        sub: '≤14 天到期的项目 · 柱高 = 剩余天数',
        value: `${BY_DAYS.filter((p) => p.days <= 14).length}`,
        unit: '项',
        dot: 'bg-danger',
        chart: chart([{ color: DANGER, w: 26, bars: BY_DAYS.filter((p) => p.days <= 14).map((p, i) => [73 + i * 46, hOf(p.days, 14)]) }]),
        labels: BY_DAYS.filter((p) => p.days <= 14).map((p) => `${p.days}天`),
      }),
      listTile({
        icon: 'i-list',
        title: '待办明细',
        right: `未完成的 ${unfinished.length} 个项目`,
        body: aRows(
          BY_DAYS.map((p) =>
            flatRow({
              dot: SCOPE[p.scope].bar,
              grad: SCOPE[p.scope].grad,
              name: p.name,
              meta: `待办 ${p.total - p.done} 条 · ${p.due}`,
              pct: p.progress,
            }),
          ),
        ),
      }),
      listTile({
        icon: 'i-layers',
        title: '任务分布',
        right: '按业务域',
        body: aRows(
          SCOPES.map((s) =>
            flatRow({
              dot: SCOPE[s].bar,
              grad: SCOPE[s].grad,
              name: SCOPE[s].label,
              meta: `${DOM[s].done} / ${DOM[s].total} 条 · 待办 ${DOM[s].todo}`,
              pct: DOM[s].rate,
            }),
          ),
        ),
      }),
    ],
    chat: [
      aiBubble(`当前 <b>${TASKS.todo} 条待办</b>，集中在三处：<b>${P[1].name}</b> ${P[1].total - P[1].done} 条、<b>${P[3].name}</b> ${P[3].total - P[3].done} 条、<b>${P[2].name}</b> ${P[2].total - P[2].done} 条。`, '16:06'),
      userBubble('先把 ≤14 天的拉出来。', '16:07'),
      aiBubble(`${BY_DAYS.filter((p) => p.days <= 14).length} 个项目在 14 天内到期：${BY_DAYS.filter((p) => p.days <= 14).map((p) => `<b>${p.name}</b>（${p.days} 天，剩 ${p.total - p.done} 条）`).join('、')}。按剩余天数排序就是上面的顺序。`, '16:07'),
    ],
  },

  /* ---------- 日程：项目截止日与里程碑 ---------- */
  {
    key: 'schedule',
    label: '日程',
    summary: `${unfinished.length} 项待到期 · 最近 ${BY_DAYS[0].due} · ${completed.length} 项已归档`,
    icon: 'i-calendar',
    focus: focusByDate(unfinished),
    tiles: [
      kpiTile({
        icon: 'i-calendar',
        title: '到期分布',
        sub: '未完成项目 · 柱高 = 该项目数',
        value: `${unfinished.length}`,
        unit: '项',
        dot: 'bg-brand-500',
        chart: chart([
          { color: DANGER, w: 26, bars: [[40, hOf(monthCount['9'], 2)]] },
          { color: BRAND, w: 26, bars: MONTHS.slice(1).map((m, i) => [92 + i * 52, hOf(monthCount[m], 2)]) },
        ]),
        labels: MONTHS.map((m) => `${m}月`),
      }),
      kpiTile({
        icon: 'i-flag',
        title: '里程碑节点',
        sub: '每个项目 1 个里程碑 · 按域着色',
        value: `${P.length}`,
        unit: '条',
        dot: 'bg-brand-500',
        chart: chart(SCOPES.map((s, i) => ({ color: SCOPE[s].hex, w: 26, bars: [[73 + i * 46, hOf(DOM[s].group.length, 3)]] }))),
        labels: SCOPES.map((s) => SCOPE[s].label),
      }),
      kpiTile({
        icon: 'i-alert',
        title: '风险与延期',
        sub: `${P[1].name} · 主卫瓷砖到货延迟`,
        value: `5`,
        unit: '天',
        dot: 'bg-danger',
        chart: chart([
          { color: DANGER, w: 26, bars: [[96, hOf(5, 12)]] },
          { color: INK300, w: 26, bars: [[142, hOf(P[1].days, 12)]] },
        ]),
        labels: [`延期 5 天`, `剩余 ${P[1].days} 天`],
      }),
      listTile({
        icon: 'i-calendar',
        title: '未来 6 周',
        right: '按截止日排序',
        body: aRows(
          BY_DAYS.map((p) =>
            flatRow({
              dot: SCOPE[p.scope].bar,
              grad: SCOPE[p.scope].grad,
              name: p.name,
              meta: `${p.due} · 剩余 ${p.days} 天`,
              pct: p.progress,
            }),
          ),
        ),
      }),
      listTile({
        icon: 'i-flag',
        title: '关键里程碑',
        right: `${P.length} 个项目`,
        body: liRows(
          [...P].sort((a, b) => a.days - b.days).map((p) =>
            eventRow({ dot: SCOPE[p.scope].bar, text: p.milestone, sub: p.name, right: p.due }),
          ),
        ),
      }),
    ],
    chat: [
      aiBubble(`${P.length} 个节点里 ${unfinished.length} 个待到期，最近的三个都在 9 月底：${BY_DAYS.slice(0, 3).map((p) => `${p.due} <b>${p.name}</b>`).join('、')}。`, '16:08'),
      userBubble('11 月还有几个？', '16:08'),
      aiBubble(`${monthCount['11']} 个：${unfinished.filter((p) => p.due.startsWith('11月')).map((p) => `${p.due} <b>${p.name}</b>（里程碑：${p.milestone}）`).join('、')}。12月31日 是 <b>${P[3].name}</b>。`, '16:09'),
    ],
  },

  /* ---------- 生活 / 工作 / 学习：三个业务域（内容与既有面板逐字一致，仅换生成方式） ---------- */
  {
    key: 'life',
    label: '生活',
    summary: `生活 ${DOM.life.avg}% · ${DOM.life.group.length} 个项目 · ${DOM.life.total} 条任务`,
    icon: 'i-life',
    focus: focusOf(domUnfinished('life')),
    tiles: [
      kpiTile({
        icon: 'i-trend',
        title: '域完成度',
        sub: `${DOM.life.group.length} 个项目 · 柱高 = 项目进度`,
        value: `${DOM.life.avg}%`,
        dot: 'bg-life',
        chart: chart([{ color: SCOPE.life.hex, w: 26, bars: [P[0], P[1], P[7]].map((p, i) => [73 + i * 46, hOf(p.progress, 100)]) }]),
        labels: [P[0].short, P[1].short, P[7].short],
      }),
      kpiTile({
        icon: 'i-check-circle',
        title: '任务进度',
        sub: `已完成 ${DOM.life.done} / ${DOM.life.total} 条`,
        value: `${DOM.life.rate}%`,
        dot: 'bg-life',
        chart: chart([
          { color: SCOPE.life.hex, w: 22, bars: [[11, hOf(13, 24)], [105, hOf(9, 24)], [199, hOf(11, 24)]] },
          { color: INK300, w: 22, bars: [[39, hOf(6, 24)], [133, hOf(15, 24)], [227, hOf(0, 24)]] },
        ]),
        labels: [P[0].short, P[1].short, P[7].short],
        legend: [['bg-life', '已完成'], ['bg-ink-300', '待办']],
      }),
      kpiTile({
        icon: 'i-clock',
        title: '到期压力',
        sub: '2 个未完成项目 · 柱高 = 剩余天数',
        value: '2',
        unit: '项',
        dot: 'bg-danger',
        chart: chart([{ color: DANGER, w: 26, bars: [[96, hOf(P[0].days, 13)], [142, hOf(P[1].days, 13)]] }]),
        labels: [`${P[0].days} 天`, `${P[1].days} 天`],
      }),
      listTile({ icon: 'i-project', title: '项目明细', right: `生活 · ${DOM.life.group.length} 个项目`, body: aRows([P[0], P[1], P[7]].map(projectRow)) }),
      listTile({
        icon: 'i-clock',
        title: '最近活动',
        right: '生活 · 近 7 天',
        body: liRows([
          eventRow({ dot: 'bg-life', text: '<b class="font-semibold text-ink-800">LY</b> 更新了行程排期', sub: P[0].name, right: '12 分钟前' }),
          eventRow({ dot: 'bg-life', text: '<b class="font-semibold text-ink-800">LY</b> 完成了「预订接送机」', sub: P[0].name, right: '2 小时前' }),
          eventRow({ dot: 'bg-life', text: '<b class="font-semibold text-ink-800">LY</b> 调整了预算上限', sub: P[1].name, right: '昨天 18:40' }),
          eventRow({ dot: 'bg-danger', text: '<b class="font-semibold text-danger-strong">检测到工期延期 5 天</b>', sub: P[1].name, right: '3 天前' }),
        ]),
      }),
    ],
    chat: [
      aiBubble(`今天有 1 项风险阻塞：<b>${P[1].name}</b> 的工期已延期 5 天，我已把它排进今天的第一件事。`, '16:07'),
      userBubble('按现在的进度，9 月 30 日还交得了吗？', '16:09'),
      aiBubble(`按剩余 ${P[1].days} 天、当前 ${P[1].progress}% 的进度推算，按期概率约 <b>35%</b>。两条路：启用备用供应商，或顺延 7 天。`, '16:09'),
    ],
  },
  {
    key: 'work',
    label: '工作',
    summary: `工作 ${DOM.work.avg}% · ${DOM.work.group.length} 个项目 · ${DOM.work.total} 条任务`,
    icon: 'i-work',
    focus: focusOf(domUnfinished('work')),
    tiles: [
      kpiTile({
        icon: 'i-trend',
        title: '域完成度',
        sub: `${DOM.work.group.length} 个项目 · 柱高 = 项目进度`,
        value: `${DOM.work.avg}%`,
        dot: 'bg-work',
        chart: chart([{ color: SCOPE.work.hex, w: 26, bars: [[96, hOf(P[2].progress, 100)], [142, hOf(P[3].progress, 100)]] }]),
        labels: [P[2].short, P[3].short],
      }),
      kpiTile({
        icon: 'i-check-circle',
        title: '任务进度',
        sub: `已完成 ${DOM.work.done} / ${DOM.work.total} 条`,
        value: `${DOM.work.rate}%`,
        dot: 'bg-work',
        chart: chart([
          { color: SCOPE.work.hex, w: 26, bars: [[11, hOf(26, 36)], [105, hOf(3, 36)]] },
          { color: INK300, w: 26, bars: [[63, hOf(10, 36)], [157, hOf(15, 36)]] },
        ]),
        labels: [P[2].short, P[3].short],
        legend: [['bg-work', '已完成'], ['bg-ink-300', '待办']],
      }),
      kpiTile({
        icon: 'i-alert',
        title: '风险集中度',
        sub: '1 项风险 · 距交付 58 天',
        value: '1',
        unit: '项',
        dot: 'bg-danger',
        chart: chart([
          { color: DANGER, w: 26, bars: [[40, hOf(26, 36)]] },
          { color: INK300, w: 26, bars: [[92, hOf(10, 36)]] },
          { color: BRAND, w: 26, bars: [[144, hOf(P[3].progress, 100)], [196, hOf(P[2].progress, 100)]] },
        ]),
        labels: ['已完成', '待办', '进行中', '推进中'],
      }),
      listTile({ icon: 'i-project', title: '项目明细', right: `工作 · ${DOM.work.group.length} 个项目`, body: aRows([P[2], P[3]].map(projectRow)) }),
      listTile({
        icon: 'i-clock',
        title: '最近活动',
        right: '工作 · 近 7 天',
        body: liRows([
          eventRow({ dot: 'bg-work', text: '<b class="font-semibold text-ink-800">ZQ</b> 提交了灰度发布检查单', sub: P[2].name, right: '40 分钟前' }),
          eventRow({ dot: 'bg-work', text: '<b class="font-semibold text-ink-800">LY</b> 更新了技术方案 v3', sub: P[2].name, right: '昨天 15:20' }),
          eventRow({ dot: 'bg-danger', text: '<b class="font-semibold text-danger-strong">鉴权迁移存在兼容风险</b>', sub: P[2].name, right: '2 天前' }),
          eventRow({ dot: 'bg-work', text: '<b class="font-semibold text-ink-800">HM</b> 拆解了 3 项 KR', sub: P[3].name, right: '4 天前' }),
        ]),
      }),
    ],
    chat: [
      aiBubble(`工作域平均进度 <b>${DOM.work.avg}%</b>，低于全域 ${GLOBAL_AVG - DOM.work.avg} 个百分点。主要拖累是 <b>${P[3].name}</b>（${P[3].progress}%）。`, '16:11'),
      userBubble('鉴权那个风险影响交付吗？', '16:12'),
      aiBubble(`<b>${P[2].name}</b> 还剩 ${P[2].days} 天、进度 ${P[2].progress}%。风险点是旧版 Token 与新版 JWT 并存，需要灰度阶段验证双写一致性 —— 建议把它挂到里程碑「${P[2].milestone}」之前。`, '16:12'),
    ],
  },
  {
    key: 'learn',
    label: '学习',
    summary: `学习 ${DOM.learn.avg}% · ${DOM.learn.group.length} 个项目 · ${DOM.learn.total} 条任务`,
    icon: 'i-learn',
    focus: focusOf(domUnfinished('learn')),
    tiles: [
      kpiTile({
        icon: 'i-trend',
        title: '域完成度',
        sub: `${DOM.learn.group.length} 个项目 · 柱高 = 项目进度`,
        value: `${DOM.learn.avg}%`,
        dot: 'bg-learn',
        chart: chart([{ color: SCOPE.learn.hex, w: 26, bars: [P[4], P[5], P[6]].map((p, i) => [73 + i * 46, hOf(p.progress, 100)]) }]),
        labels: [P[4].short, P[5].short, P[6].short],
      }),
      kpiTile({
        icon: 'i-check-circle',
        title: '任务进度',
        sub: `已完成 ${DOM.learn.done} / ${DOM.learn.total} 条`,
        value: `${DOM.learn.rate}%`,
        dot: 'bg-learn',
        chart: chart([
          { color: SCOPE.learn.hex, w: 22, bars: [[11, hOf(16, 22)], [105, hOf(0, 22)], [199, hOf(22, 22)]] },
          { color: INK300, w: 22, bars: [[39, hOf(4, 22)], [133, hOf(14, 22)], [227, hOf(0, 22)]] },
        ]),
        labels: [P[4].short, P[5].short, P[6].short],
        legend: [['bg-learn', '已完成'], ['bg-ink-300', '待办']],
      }),
      kpiTile({
        icon: 'i-clock',
        title: '到期压力',
        sub: '2 个未完成项目 · 柱高 = 剩余天数',
        value: '2',
        unit: '项',
        dot: 'bg-danger',
        chart: chart([
          { color: DANGER, w: 26, bars: [[96, hOf(P[4].days, 63)]] },
          { color: INK300, w: 26, bars: [[142, hOf(P[5].days, 63)]] },
        ]),
        labels: [`${P[4].days} 天`, `${P[5].days} 天`],
      }),
      listTile({ icon: 'i-project', title: '项目明细', right: `学习 · ${DOM.learn.group.length} 个项目`, body: aRows([P[4], P[5], P[6]].map(projectRow)) }),
      listTile({
        icon: 'i-clock',
        title: '最近活动',
        right: '学习 · 近 7 天',
        body: liRows([
          eventRow({ dot: 'bg-learn', text: '<b class="font-semibold text-ink-800">LY</b> 完成了「第 5 章精读」', sub: P[4].name, right: '1 小时前' }),
          eventRow({ dot: 'bg-learn', text: '<b class="font-semibold text-ink-800">LY</b> 提交了里程碑「正式上线」', sub: P[6].name, right: '19 天前' }),
          eventRow({ dot: 'bg-learn', text: '<b class="font-semibold text-ink-800">LY</b> 整理了 6 篇读书笔记', sub: P[4].name, right: '3 天前' }),
          eventRow({ dot: 'bg-ink-400', text: '课程实践尚未开始（进度 0%）', sub: P[5].name, right: '待启动' }),
        ]),
      }),
    ],
    chat: [
      aiBubble(`学习域进度最好：平均 <b>${DOM.learn.avg}%</b>，${DOM.learn.total} 条任务完成 ${DOM.learn.done} 条。但 <b>${P[4].name}</b> 只剩 ${P[4].days} 天、还差 ${P[4].total - P[4].done} 条。`, '16:13'),
      userBubble('另外那个课要开始吗？', '16:13'),
      aiBubble(`<b>${P[5].name}</b> 还没开始（${P[5].progress}%），距离截止 ${P[5].days} 天、${P[5].total} 条作业。与 <b>${P[4].name}</b> 的收尾期重叠 —— 建议先让精读收口，再开课。`, '16:14'),
    ],
  },

  /* ---------- 知识库：8 条文档索引（来自每个项目的 docsUrl） ---------- */
  {
    key: 'knowledge',
    label: '知识库',
    summary: `${P.length} 条文档索引 · 来源 ${P.length} 个项目 · 正文不入库`,
    icon: 'i-knowledge',
    focus: focusDocs(),
    tiles: [
      kpiTile({
        icon: 'i-knowledge',
        title: '索引总量',
        sub: '按归属域 · 柱高 = 索引条数',
        value: `${P.length}`,
        unit: '条',
        dot: 'bg-brand-500',
        chart: chart(SCOPES.map((s, i) => ({ color: SCOPE[s].hex, w: 26, bars: [[73 + i * 46, hOf(DOM[s].group.length, 3)]] }))),
        labels: SCOPES.map((s) => SCOPE[s].label),
      }),
      kpiTile({
        icon: 'i-lock',
        title: '可见性分布',
        sub: '按可见性 · 柱高 = 条目数',
        value: `${VIS.length}`,
        unit: '档',
        dot: 'bg-brand-500',
        chart: chart(
          VIS.map(([label, n], i) => ({
            color: label === '公开' ? INK300 : BRAND,
            w: 26,
            bars: [[40 + i * 52, hOf(n, 3)]],
          })),
        ),
        labels: VIS.map(([label]) => label),
      }),
      kpiTile({
        icon: 'i-empty',
        title: '数据接入',
        sub: '尚未接入后端 · 索引为静态占位',
        value: '—',
        unit: '未接入',
        dot: 'bg-ink-300',
        chart: null,
        tail: `<div class="flex flex-col gap-2 rounded-lg border border-line g g1 px-3 py-2.5 text-11-5 font-medium text-ink-500">
                              ${['永久笔记', '双链图谱', '附件管理']
                                .map((t) => `<span class="flex items-center gap-2">${icon('i-empty', 'h-[13px] w-[13px] text-ink-400')}${t}<span class="ml-auto text-ink-400">规划中</span></span>`)
                                .join('\n                              ')}
                            </div>`,
      }),
      listTile({
        icon: 'i-knowledge',
        title: '索引明细',
        right: `${P.length} 条 · 按项目`,
        body: liRows(
          P.map((p) =>
            eventRow({ dot: SCOPE[p.scope].bar, text: `<b class="font-semibold text-ink-800">${p.docs}</b>`, sub: p.name, right: p.visibility }),
          ),
        ),
      }),
      listTile({
        icon: 'i-layers',
        title: '沉淀规则',
        right: '模块设计 §5',
        body: liRows([
          eventRow({ dot: 'bg-learn', text: '学习笔记成熟 → 升级为永久笔记', sub: '学习 → 知识库', right: '规划中' }),
          eventRow({ dot: 'bg-work', text: '工作通用知识 → 脱敏后入库', sub: '工作 → 知识库', right: '规划中' }),
          eventRow({ dot: 'bg-brand-500', text: '项目产出 → 沉淀为知识条目', sub: '项目 → 知识库', right: '规划中' }),
          eventRow({ dot: 'bg-danger', text: '<b class="font-semibold text-danger-strong">工作机密、公司代码、客户数据不入库</b>', sub: '红线', right: '强制', tone: 'danger' }),
        ]),
      }),
    ],
    chat: [
      aiBubble(`当前 <b>${P.length} 条文档索引</b>全部来自项目的 docsUrl 字段，还没有独立的笔记库 —— 按设计文档，知识库在 MVP 阶段先并入学习模块。`, '16:15'),
      userBubble('那这些索引现在能做什么？', '16:15'),
      aiBubble(`现在只能做"找得到"：每条索引指向一个项目、一个可见性等级（${VIS.map(([v, n]) => `${v} ${n}`).join(' / ')}）。永久笔记、双链、附件都要等后端。<b>工作文档正文不入个人库</b>这条红线已经落在可见性上了。`, '16:16'),
    ],
  },

  /* ---------- 项目：统一执行层 ---------- */
  {
    key: 'project',
    label: '项目',
    summary: `${P.length} 个项目 · 进行中 ${active.length} · 风险 ${risky.length}`,
    icon: 'i-project',
    focus: focusProjects(),
    tiles: [
      kpiTile({
        icon: 'i-kanban',
        title: '状态分布',
        sub: '按项目状态 · 柱高 = 项目数',
        value: `${P.length}`,
        unit: '个',
        dot: 'bg-brand-500',
        chart: chart([
          { color: STATUS.planning.hex, w: 26, bars: [[40, hOf(planned.length, 3)]] },
          { color: STATUS.active.hex, w: 26, bars: [[92, hOf(active.length, 3)]] },
          { color: STATUS.risk.hex, w: 26, bars: [[144, hOf(risky.length, 3)]] },
          { color: STATUS.done.hex, w: 26, bars: [[196, hOf(completed.length, 3)]] },
        ]),
        labels: ['待启动', '进行中', '风险', '已完成'],
      }),
      kpiTile({
        icon: 'i-layers',
        title: '域分布',
        sub: '按业务域 · 柱高 = 项目数',
        value: `${P.length}`,
        unit: '个',
        dot: 'bg-brand-500',
        chart: chart(SCOPES.map((s, i) => ({ color: SCOPE[s].hex, w: 26, bars: [[73 + i * 46, hOf(DOM[s].group.length, 3)]] }))),
        labels: SCOPES.map((s) => SCOPE[s].label),
      }),
      kpiTile({
        icon: 'i-file',
        title: '预算规模',
        sub: `${BUDGET.length} 个项目登记预算 · 柱高 = 预算（万元）`,
        value: `¥${(BUDGET_TOTAL / 10000).toFixed(1)}万`,
        unit: '',
        dot: 'bg-brand-500',
        chart: chart([{ color: BRAND, w: 26, bars: BUDGET.map((p, i) => [73 + i * 46, hOf(p.budget / 10000, 18.6)]) }]),
        labels: BUDGET.map((p) => `¥${(p.budget / 10000).toFixed(1)}万`),
      }),
      listTile({ icon: 'i-project', title: '项目明细', right: '按进度降序', body: aRows([...P].sort((a, b) => b.progress - a.progress).map(projectRow)) }),
      listTile({
        icon: 'i-flag',
        title: '里程碑',
        right: '每个项目 1 个',
        body: liRows([...P].sort((a, b) => a.days - b.days).map((p) => eventRow({ dot: SCOPE[p.scope].bar, text: p.milestone, sub: p.name, right: p.due }))),
      }),
    ],
    chat: [
      aiBubble(`${P.length} 个项目：进行中 ${active.length}、待启动 ${planned.length}、风险 ${risky.length}、已完成 ${completed.length}。平均进度 <b>${GLOBAL_AVG}%</b>，最高的 ${completed.map((p) => `<b>${p.name}</b>`).join(' 与 ')} 都到 100%。`, '16:17'),
      userBubble('预算一共多少？', '16:17'),
      aiBubble(`只有 ${BUDGET.length} 个项目带预算：${BUDGET.map((p) => `${p.short} ¥${p.budget.toLocaleString('en-US')}`).join('、')}，合计 <b>¥${BUDGET_TOTAL.toLocaleString('en-US')}</b>。其余 ${P.length - BUDGET.length} 个是内部或学习类项目，未登记预算。`, '16:18'),
    ],
  },

  /* ---------- 设置：全局支撑（无数据源 → 空态 + 文档里的页面清单） ---------- */
  {
    key: 'settings',
    label: '设置',
    summary: `10 个设置页 · 可开关 6 个模块 · 4 类集成`,
    icon: 'i-settings',
    focus: [],
    tiles: [
      kpiTile({
        icon: 'i-grid',
        title: '模块开关',
        sub: '设置 → 模块管理 · 开启/关闭',
        value: '6',
        unit: '个',
        dot: 'bg-brand-500',
        chart: chart([{ color: BRAND, w: 26, bars: [[73, hOf(3, 3)], [119, hOf(2, 3)], [165, hOf(1, 3)]] }]),
        labels: ['业务域', '统一层', '系统'],
      }),
      kpiTile({
        icon: 'i-settings',
        title: '设置页',
        sub: '每根柱 = 1 个设置页（模块设计 §6）',
        value: '10',
        unit: '页',
        dot: 'bg-brand-500',
        chart: chart([{ color: BRAND, w: 16, bars: Array.from({ length: 10 }, (_, i) => [12 + i * 23.4, 24]) }]),
        labels: null,
      }),
      kpiTile({
        icon: 'i-link',
        title: '集成位',
        sub: '设置 → 集成与 API',
        value: '4',
        unit: '类',
        dot: 'bg-brand-500',
        chart: chart([{ color: BRAND, w: 26, bars: [40, 92, 144, 196].map((x) => [x, 24]) }]),
        labels: ['GitHub', '日历', 'Notion', 'Webhook'],
      }),
      listTile({
        icon: 'i-settings',
        title: '设置页清单',
        right: '10 页 · 均在规划中',
        body: liRows(
          [
            ['账户与安全', '/settings/account'],
            ['模块管理', '/settings/modules'],
            ['主题与外观', '/settings/appearance'],
            ['通知提醒', '/settings/notifications'],
            ['数据与备份', '/settings/data'],
            ['导入导出', '/settings/import-export'],
            ['集成与 API', '/settings/integrations'],
            ['权限与隐私', '/settings/privacy'],
            ['快捷键', '/settings/shortcuts'],
            ['关于', '/settings/about'],
          ].map(([name, path]) => eventRow({ dot: 'bg-ink-300', text: `<b class="font-semibold text-ink-800">${name}</b>`, sub: path, right: '规划中' })),
        ),
      }),
      listTile({
        icon: 'i-lock',
        title: '边界与红线',
        right: '模块设计 §6',
        body: liRows([
          eventRow({ dot: 'bg-brand-500', text: '模块开关控制 6 个模块的显示与隐藏', sub: '模块管理', right: '全局' }),
          eventRow({ dot: 'bg-life', text: '隐私过滤：工作机密 / 生活隐私 / 学习公开范围', sub: '权限与隐私', right: '分级' }),
          eventRow({ dot: 'bg-ink-300', text: '数据导出：Markdown / CSV / JSON', sub: '导入导出', right: '规划中' }),
          eventRow({ dot: 'bg-danger', text: '<b class="font-semibold text-danger-strong">审计日志：登录、导出、集成调用</b>', sub: '权限与隐私', right: '强制', tone: 'danger' }),
        ]),
      }),
    ],
    chat: [
      aiBubble(`设置模块有 10 个页面、可开关 6 个模块、4 类集成位 —— 都在设计文档里定好了，但<b>本轮原型没有设置界面</b>。`, '16:19'),
      userBubble('那先不做？', '16:19'),
      aiBubble(`按 MVP 顺序，设置排在最后一步（账户、模块管理、主题、数据导出）。现在最该确认的是<b>模块开关</b>：它决定了除工作台之外的 __MODULE_COUNT__ 个模块能不能被隐藏。`, '16:20'),
    ],
  },
]

/* 上面最后一段对话需要"除工作台外的模块数"，而模块表还在构建中，所以先埋占位符再回填 */
const MODULE_COUNT_NOTE = String(MODULES.length - 1)
for (const m of MODULES) m.chat = m.chat.map((s) => s.split('__MODULE_COUNT__').join(MODULE_COUNT_NOTE))

/* ---- 每个模块的「进入主页面」CTA ----
   分工：环上的指针回答"**我在哪**"，这枚按钮回答"**从这儿怎么进去**"。
   两者不重复 —— 前者是位置，后者是动作。

   目标路由全部取自 docs/模块设计.md，没有自造：
     · 六个顶层模块的**根路径**：/life · /work · /learning · /projects · /knowledge · /settings
       ⚠️ 学习模块文档写的路由是 `/learning`，而 scope 枚举是 `learn` —— 这是**已知冲突**
         （见 docs/模块设计.md 与 backend/lucky_y_server 的 model.rs），本原型按**文档的路由**写。
     · 任务清单 / 日程 在文档里是**工作模块内的页面**、不是顶层模块，所以目标是
       /work/tasks 与 /work/calendar（模块 §2 的页面表）。
     · 工作台是**本页** → 走 self 态：按钮保留但置灰。
       ⚠️ **不能把它藏起来**：藏了之后每次切回工作台，Hero 会凭空矮 52px、磁贴整块往上跳。
     · ⚠️ 工作台的根路径 `/` 在文档里没有写，是**推断**（它就是本应用的首页）。

   文案：顶层模块统一「进入{名}主菜单」（用户给的例子是「进入工作主菜单」）；
   工作台 / 任务清单 / 日程 / 知识库 / 设置 这几个读作"菜单"别扭，用「进入{名}」。 */
const ENTER = {
  home: { text: '已在工作台', path: '/', self: true },
  tasks: { text: '进入任务清单', path: '/work/tasks' },
  schedule: { text: '进入日程', path: '/work/calendar' },
  life: { text: '进入生活主菜单', path: '/life' },
  work: { text: '进入工作主菜单', path: '/work' },
  learn: { text: '进入学习主菜单', path: '/learning' },
  knowledge: { text: '进入知识库', path: '/knowledge' },
  project: { text: '进入项目主菜单', path: '/projects' },
  settings: { text: '进入设置', path: '/settings' },
}
for (const m of MODULES) m.enter = ENTER[m.key]
/* 键名打错（或加了模块忘了配 CTA）会在这里当场停 —— 否则按钮会渲染成 "进入undefined" */
if (MODULES.some((m) => !m.enter || !m.enter.text || !m.enter.path)) {
  throw new Error('有模块没配`进入主页面`的 CTA 口径（ENTER 的键要对得上 MODULES 的 key）')
}
const ENTER0 = MODULES[0].enter

/* ============================================================================
   5. 输出片段
   ========================================================================= */
/* ---- 八芒星罗盘 + 花瓣花环（点阵描边） ----
   视觉来源是一张「星空罗盘」：一圈点阵外环 + 罗马数字刻度 + 八芒星指针。
   落到 82px 的盘上做了三处替换：外环 → 12 片花瓣；罗马数字 → 仍略掉（空间不够，见下）；
   八芒星 → 保留（主尖加长加亮，承担"指向"）。
   全部由细点拼出来、没有一个实心块 —— 正好延续"中心不做实心"的那条判据。

   在直径只有 82px 的中心里必须做取舍：
     · **罗马数字略掉**（12 个数字平分周长 ≈257px → 每个只有 21px 弧长、字号得压到 ~7px，必糊）。
       它在大尺寸下才成立；要做就得把中心放大到 ~150px，那会连带把整个环推大。
     · 点阵外环 / 八芒星 **保留** —— 它们才是"罗盘感"的主要来源。
     · 星形随 --na 旋转（与那根细针共用同一个角度变量，不会错位），
       长轴指出方向；细针叠在长轴上，把"指向哪一格"说清楚（星形是对称的，单看有歧义）。

   形状是罗盘玫瑰的标准做法，而且**四根长尖不等长**：
     · 正上方那根（`is-main`，len 30）最长最亮 —— 它就是"指针"，随 --na 转到选中项；
     · 另外三根（len 23）短一档 —— 罗盘玫瑰本来就有主次，等长会读成"风向标"；
     · 对角四根（len 12）最短，补出八芒星的形状。
   去掉原来那根 2.5px 的细针：它比星形还长，直接把"罗盘"压成了"仪表针"，
   而指向的确定性并不靠它 —— 选中项还有 亮块 / 进度弧 / 中心名 三处在说。 */
const spike = (len, half, rot, main) =>
  `<path${main ? ' class="is-main"' : ''} d="M50 50 L${50 - half} 50 L50 ${50 - len} L${50 + half} 50 Z" transform="rotate(${rot} 50 50)" />`

/* ---- 花瓣花环（用户要的"花纹"就是花瓣，不是波浪）----
   单瓣是一个「叶形」：根部在半径 r0、尖在 r1，两侧各用一段二次贝塞尔从根鼓到尖，
   控制点放在 ±half 角、半径 rm 处 —— 所以"花瓣多胖 / 多长"全由这几个数决定，
   量得出来，不是凭手感拖曲线。

   尺度核算（dial 半径 41px，1 viewBox 单位 ≈ 0.82px）：
     r0 33 → 27.1px（根）、r1 45 → 36.9px（尖）→ 花瓣长 9.8px
     张角 half 7.5° → 花瓣宽约 8.4px，而每瓣占 30°、在半径 32px 处合 16.8px 弧长
     → 瓣间留 8px 空隙 ✅ "一眼数得清 12 瓣"靠的就是这个空隙
   ⚠️ 花瓣的"胖瘦"由 half 决定，不是由曲线手感决定：第一版用了 half 12（宽 14.4px > 长 9.5px），
   出来是一圈**胖圆的水滴**，不像花瓣；收到 7.5 才成细长叶形。
   根半径 27.1px，与外侧进度弧（38.1px 起）之间只留 1.2px —— 这是盘上最挤的一处。
   内侧原本要给主刻度让出 21.0~25.5px（该层已删），所以现在花瓣与指针之间是空的。 */
const PETAL = { n: 12, r0: 33, r1: 45, half: 7.5, rm: 39 }

/* ---- 环绕盘绕线：**已撤掉**（用户 2026-09-19：「会不会显得太花哨了」→ 选"撤掉盘绕线带"）----
   它曾填在「盘边 41 → 瓦片内沿 70」那条 29px 的空带里。**位置本身是对的**（盘内确实已满），
   撤掉的原因不是位置，而是**它在真实尺寸下读不出想表达的东西**：
   6 倍放大图里是"两条缠绕的线"，1:1 下退化成"一圈模糊的虚影" —— 可见，但不可读。
   成本花了、信息没传出去，剩下的就只是噪音；再加上盘内已有 12 片花瓣（同为沿圆周的径向起伏、
   形态撞车），中心区就从"精致"变成"过载"。
   判据：**装饰的价值 = 读者能否在真实尺寸下读出它；只在放大图里成立的，就该收。
   （"可见"与"可读"是两件事 —— 我上一轮就是拿放大图判断"它把盘和瓦片连成了一体"。）**

   要恢复的话，两套做法都记在这里：
     a) 环绕盘绕线：两条闭合正弦环 r(θ) = R + A·sin(waves·θ + phase)，半径带 47~63、
        波数取互质的两值（8 与 13 —— 同波数 + 相位差 180° 是**永不相交**的，
        只会读成"两条平行花边"）、幅度 8/7、透明 62% / 44%、点距 1.8/1.4 与 1.4/1.8、
        90s 转一圈；居中用 margin（有 transform 动画时，居中绝不能写进 transform）。
     b) 贴着瓦片半径 92 的一圈点状虚线（更早的形态）—— 但它被九个瓦片挡住大半。 */
const PV = (deg, R) => {
  const t = ((deg - 90) * Math.PI) / 180
  return [r1(50 + R * Math.cos(t)), r1(50 + R * Math.sin(t))]
}
const petalPath = (() => {
  const [x0, y0] = PV(0, PETAL.r0)
  const [x1, y1] = PV(0, PETAL.r1)
  const [lx, ly] = PV(-PETAL.half, PETAL.rm)
  const [rx, ry] = PV(PETAL.half, PETAL.rm)
  return `M${x0} ${y0} Q${lx} ${ly} ${x1} ${y1} Q${rx} ${ry} ${x0} ${y0} Z`
})()
const petalRing = Array.from(
  { length: PETAL.n },
  (_, k) => `<path d="${petalPath}" transform="rotate(${r1((360 / PETAL.n) * k)} 50 50)" />`,
).join('\n                            ')

const COMPASS = `                      <svg class="hub-compass" viewBox="0 0 100 100" aria-hidden="true">
                        <g class="hub-compass__petals">
                            ${petalRing}
                        </g>
                        <g class="hub-compass__star">
                          ${spike(24, 3.6, 0, true)}
                          ${[90, 180, 270].map((rot) => spike(21, 3.2, rot)).join('\n                          ')}
                          ${[45, 135, 225, 315].map((rot) => spike(12, 2.4, rot)).join('\n                          ')}
                        </g>
                      </svg>`

/** 九个焦点面板：与磁贴面板、对话面板同一套切换机制（HTML hidden 属性） */
const focusPanels = MODULES.map(focusPanelOf).join('\n')

const hero = `              <!-- 中部：模块径向菜单 -->
              <div class="relative">

                <!-- 左导航 + 右内容。圆盘靠左之后，"其余部分"才有地方放东西（在此之前它是居中的，
                     两侧各空约 570px）。为什么右栏放"明细"而不是又一组数字：下方磁贴区给的全是
                     **统计**（完成率 / 分布 / 到期压力都是聚合值），缺"具体是哪几件" ——
                     判据：**Hero 补的是磁贴没说的那部分，不是把它的数字换个位置再放一遍。** -->
                <div class="flex items-start gap-8 max-[1240px]:flex-col max-[1240px]:gap-5">
                  <div class="w-[360px] shrink-0 max-[1240px]:w-full">
                  <!-- ===== 模块径向菜单 =====
                       九个模块**全部**在环上（40° 一格铺满 360°），中心是一枚指向选中项的指针。

                       三个方案里选它的理由：
                         · 卡片轮播：卡片上的数字（主指标 / 任务 x/y / 待办 / 到期）与下方五块磁贴
                           **逐项重复**（项目数→项目明细、主指标→域完成度、任务 x/y→任务进度、
                           到期日→到期压力）—— 去的是重复，不是信息。
                         · 「八个在环 + 选中进中心」：没有重复，但每次切换环上八个整体挪一格，
                           位置不稳定（空间记忆失效）。
                         · 本方案：九个都在 = 完整地图；角度固定 = 位置可记；
                           中心只给**方向**、不复制图标 = 没有重复。三个约束同时满足。

                       代价是中心失去了"当前模块的身份感"（那里只有一枚针）。
                       补回来的三处：环上被选中的那一格（我是谁）+ 指针（我在哪）
                       + 表盘下方的名字（叫什么）—— 三者分工，互不重复。

                       ---- 这一版的"能量层" ----
                       环不只是九个按钮摆一圈，而是**一圈会呼吸的仪表**：
                         aura   中心大片极淡光晕，随当前模块换色（生活绿 / 工作蓝 / 学习紫 /
                                其余品牌紫）—— 切换时整个 Hero 的色调跟着走，这是最省笔墨的
                                "系统感"来源：一处变量、三处消费（光晕 / 指针 /
                                选中瓦片），没有任何一个数字或名字被重复表达。

                       装饰的尺寸全部由 RING 常量派生（见本文件开头的几何注释），
                       并且**全部落在环内**：光晕直径 2·rl 就是环的宽高 ——
                       既不会撑出滚动区，也不会挤到瓦片或中心名。

                       初始 --a / --lx / --ly 写死在 HTML 里，与脚本 render() 的首次输出一致，
                       否则加载瞬间会看到环从错误角度转一下。
                       ⚠️ 环上**不挂** data-accent：强调色定义在 Hero 的 section 上（见 HERO_CSS），
                       环只是继承 —— 环上再挂一份，[data-accent] 的默认规则就会在环上生效，
                       把继承来的域色覆盖回品牌紫，联动就断了。 -->
                  <div class="radial" id="module-ring" role="group" aria-roledescription="环形菜单" aria-label="模块切换">
                    <!-- 装饰层：光晕 / 涟漪。两者都 aria-hidden，
                         且都在瓦片之前 —— 后画的在上，所以涟漪会从瓦片**底下**扩散出去。 -->
                    <span class="hub-aura" aria-hidden="true"></span>
                    <i class="hub-ripple" aria-hidden="true"></i>

                    <!-- 中心是一枚**指针**，指向环上被选中的那一项。
                         它刻意**不显示**当前模块的图标 —— 环上已经有那枚图标了（被标记成实底），
                         中心再放一份就是"同一信息在一屏出现两次"（顶栏模块胶囊就是这么被撤掉的）。
                         指针给的是**方向**：地图（环上九个）不动，只有指针转 ——
                         所以位置可以被记住，切换时动的也只有一枚针，安静得多。 -->
                    <!-- ===== 门：表盘 + 中心名 = 进入当前模块主页面的入口 =====
                         这里**不再是**表盘下方那枚实底胶囊。用户的原话是「按钮太直白」——
                         一枚写着"进入工作主菜单"的胶囊把动作**喊**了出来，而这一屏要的是
                         "仪表本身就是门"：中心本来就在说"我在哪"，现在它同时说"从这儿进去"。

                         判据：**同一个元素可以承担两个语义，前提是它们是同一条链上相邻的两步**
                         （选模块 → 进模块，中间没有别的事）。按钮则是把第二步单独拎出来、
                         还替用户配了一句说明书 —— 多出来的不是信息，是噪音。

                         可发现性靠中心名右侧那枚**常驻的小箭头**（不是 hover 才出现，
                         否则静态截图里整屏就没有任何"可以进去"的线索了）；它用左右各一份
                         等宽留白把名字顶回正中间，所以加箭头**不动**原来的对位。
                         hover / 键盘聚焦时：表盘边缘亮起一圈**指向针方向**的光边
                         （见 .hub-dial::before），箭头变域色并右移 2px，光标变手型。

                         self 态（工作台 = 本页）：disabled + 常态没有箭头。
                         不藏、不降透明度 —— 藏了 Hero 会时而高矮变化，
                         降透明度会让深底白字那一类对比度塌掉（这一版干脆没有实底了）。 -->
                    <button
                      type="button"${ENTER0.self ? ' disabled' : ''}
                      class="hub-door"
                      data-enter-door
                      data-enter-path="${ENTER0.path}"
                      title="目标：${ENTER0.path}"
                      aria-label="${ENTER0.text}（${ENTER0.path}）"
                    >
                      <span class="hub-dial" aria-hidden="true">
                        <i class="hub-arc" data-hub-arc></i>
${COMPASS}
                        <i class="hub-pin"></i>
                      </span>
                      <span class="hub-name text-13 font-bold leading-none tracking-[-0.01em] text-ink-900" aria-hidden="true">
                        <i class="hub-name__pad"></i>
                        <span data-hub-name>${MODULES[0].label}</span>
                        <svg class="icon hub-name__go h-3 w-3"><use href="#i-arrow-right" /></svg>
                      </span>
                      <span class="hub-door__clip" aria-hidden="true" data-enter-clip></span>
                    </button>
${MODULES.map((m, i) => ringItem(m, i, ringAngle(i), ringLabelOffset(ringAngle(i)))).join('\n')}
                  </div>

                  <!-- 当前模块摘要。位置指示已经有两处（中心的 hub-name + 顶栏面包屑），
                       所以这一行只讲数据；aria-live 让读屏在切换时听到变化。 -->
                  <div class="mt-2 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2">
                    <span class="text-11-5 font-medium text-ink-400" aria-live="polite" data-module-summary>${MODULES[0].summary}</span>
                  </div>
                  </div>

                  <!-- 右：今日焦点。数据全部由 projects.ts 派生（见文件头的 focusOf 系列）。 -->
                  <section class="g g3 g--refr min-w-0 flex-1 self-stretch rounded-2xl border border-line p-4 max-[1240px]:w-full">
                    <div class="flex items-baseline gap-2">
                      <h2 class="text-13-5 font-bold text-ink-900">今日焦点</h2>
                      <span class="text-11-5 font-medium text-ink-400">先风险、再临近</span>
                    </div>
                    <div class="mt-3">
${focusPanels}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </section>

          `

const panelsBlock = MODULES.map((m, i) => panel(m, { hidden: i !== 0 })).join('\n')
const chatsBlock = MODULES.map((m, i) => chatPanel(m, { hidden: i !== 0 })).join('\n')

const HERO_CSS = `    <style id="lucky-y-tw-hero">
      /* 把强调色注册成 <color>：只有注册过的自定义属性才**可插值**，
         于是切换模块时整个环的色调是渐变过去的，而不是"啪"地换一套色。
         initial-value 只是给语法解析一个兜底 —— 实际值永远由 .radial 上的
         var(--color-*) 决定，**这里不承担责任**（写死色值就会变成第二份事实源）。
         浏览器不支持 @property 时退化成突变，其余效果照常。 */
      @property --accent {
        syntax: '<color>';
        inherits: true;
        initial-value: #6366f1;
      }
      @property --accent-deep {
        syntax: '<color>';
        inherits: true;
        initial-value: #4f46e5;
      }
      /* 进度弧的角度。也要注册成 <angle> 才能插值 ——
         否则切模块时那条弧是"啪"地跳变，而不是扫过去。
         它是**长度**在变（不是旋转），所以脚本直接赋目标值即可，不需要像指针那样累加。 */
      @property --arc {
        syntax: '<angle>';
        inherits: false;
        initial-value: 0deg;
      }
      /* 指针的角度，同样必须注册成 <angle>。
         原来它只是个普通自定义属性，靠 .hub-compass__star 上的
         "transition: transform" 来平滑 —— 那只够一个消费者用。
         现在它还要驱动 CTA 那圈**锥形渐变光边的 from 角**，而渐变里的自定义属性
         **不可插值**（没注册就是"啪"地跳）：针是滑的、光是跳的，一眼就露馅。
         所以把过渡移到 --na 自己身上（见下面 [data-accent] 的 transition），
         一处过渡、两处消费（针的 transform 与光边的 from）。 */
      @property --na {
        syntax: '<angle>';
        inherits: true;
        initial-value: 0deg;
      }

      /* Hero 的径向菜单 —— 原型专属的空间编排。
         半径、角度、表盘尺寸都是算出来的一次性空间关系，没有可抽象的令牌，
         所以刻意不放进 src/styles/index.css（那里是事实源）；落地时随组件搬进 src。

         几何：九个模块全部在环上（${RING.step}° 一格铺满 360°），中心是表盘 + 指针。
         四个数彼此牵制，改任何一个都要重新量（见 gen-modules.mjs 的 RING 常量）：
           --r     瓦片半径
           --rl    标签半径（必须比瓦片更外一圈，否则 40° 间隔下标签撞邻座瓦片）
           --dial  表盘直径
           --nameY 中心名字的纵向偏移（上界＝表盘半径，下界＝最靠下那两枚瓦片的上沿） */
      /* 强调色：默认品牌紫，三个业务域换成各自的域色 ——
         色是**氛围**而不是信息，所以它可以在整圈上复用而不构成"重复表达"。

         ⚠️ 变量定义在 **[data-accent] 这一层（也就是 Hero 的 section）**，不是 .radial 上。
         两个原因：① 同色还要给 Hero 的底色带用（.hero-band），它不在环里面；
         ② 变量定义点越靠上，能消费它的元素越多，而"同一条色链"只有一份。
         所以 data-accent 属性由脚本写在 **section** 上，环只是继承它 ——
         环上**不能再**挂 data-accent：那会让 [data-accent] 的默认规则在环上生效，
         把继承来的域色覆盖回品牌紫（联动就断了）。

         三个选择器都按属性匹配（不是 .radial[data-accent]），也是同一个理由。 */
      /* ⚠️ 这里现在**没有 per-模块 的规则**（原来有 life / work / learn 三条）——
         九个模块各有一组色，逐个写就是九条规则、且加一个模块要记得加一条。
         改成读 Prism 的模块槽位：「--s」（强调）与 「--brand-a」（填充，承白字）由
         src/styles/prism.css §3 的 [data-series] / [data-module] 提供，**一张色表**。
         于是这条链上仍然只有一份事实源，而且第 10 个模块出现时这里一个字都不用改。

         ⚠️ 「--accent-deep」 接的是 「--brand-a」 而**不是** 「--s」：这一支是给"实底 + 白字"
         用的（环上被选中的那枚瓦片），必须落在白字可行的那个窄窗口里（Y=0.180）。
         强调色 「--s」 是设计原值，压白字只有 2~3:1，只能当装饰与会标。 */
      [data-accent] {
        /* ⚠️ 必须写成 rgb(var(--s)) 而不是 var(--s)：Prism 的模块色槽是 **RGB 三元组**
           （78 135 235），因为色团公式要的是「rgb(var(--m-lt-1) / var(--m-a1))」这种
           "三元组 + 斜杠 α"的写法。三元组本身**不是**一个 <color>。
           而这里 --accent 注册成了 <color>（@property 的 syntax），赋一个非法值不会报错、
           也不会继承 —— 它会静默落回 @property 的 initial-value，
           于是**九个模块的 Hero 全变成同一个靛蓝**，而页面看起来"很正常"。
           实测就是这么发现的：18 张不同模块的截图，PNG 体积只差 0.02%。 */
        --accent: rgb(var(--s));
        --accent-deep: var(--brand-a);
        /* 色调过渡（需 @property 注册才生效）—— 声明在这一层，
           于是环、光晕、Hero 底色带**一起**渐变过去。
           --na 也在这里：它从"指针自己"上升到 Hero 这一层，一次性解决两处消费
           （针的 transform + CTA 光边的 from 角），而且**只有一个过渡源**。 */
        transition:
          --accent 0.55s ease,
          --accent-deep 0.55s ease,
          --na 0.52s cubic-bezier(0, 0, 0.2, 1);
      }

      /* Hero 顶部那道光环带：颜色也跟着强调色走 ——
         切换模块时"整块 Hero 换色"是这套系统里最容易被感知的一处变化，
         而它只花了一个 var()。 */
      .hero-band {
        background:
          linear-gradient(
            180deg,
            color-mix(in srgb, var(--accent) 20%, transparent) 0%,
            color-mix(in srgb, var(--accent) 8%, transparent) 46%,
            transparent 100%
          ),
          radial-gradient(
            70% 130% at 92% -6%,
            color-mix(in srgb, var(--accent) 26%, transparent) 0%,
            transparent 66%
          );
      }

      /* ===== 门：表盘 + 中心名 = 进入当前模块主页面的入口 =====
         位置就是中心。这里原来放的是表盘下方一枚实底胶囊（写着"进入工作主菜单"）——
         用户的原话是「按钮太直白了」：那枚胶囊把动作**喊**了出来，还替用户配了句说明书。
         改成"仪表本身就是门"之后，同一个元素承担两个语义 ——
         中心一直在说"我在哪"，现在它同时说"从这儿进去"。

         判据：**同一个元素可以承担两个语义，前提是它们是同一条链上相邻的两步**
         （选模块 → 进模块，中间没有别的事）。把第二步拆成独立控件，多出来的不是信息，是噪音。

         ⚠️ 几何一处都不能动：按钮的盒子**就是**原来表盘那 82px（--dial），
         .hub-dial 改成 inset:0 填满它、.hub-name 仍以"盒子中心"为原点偏移 ——
         两者的中心与环心重合，所以搬进按钮之后绝对位置完全不变（实测 Δ=0）。 */
      .hub-door {
        position: absolute;
        left: 50%;
        top: 50%;
        width: var(--dial);
        height: var(--dial);
        transform: translate(-50%, -50%);
        border-radius: 999px;
        /* 按钮的默认样式全部抹掉：padding / border / line-height 任何一项留着都会把表盘顶偏 */
        appearance: none;
        border: 0;
        padding: 0;
        margin: 0;
        background: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      .hub-door:disabled {
        cursor: default;
      }
      /* 门上的涟漪要裁在圆里，所以另开一层**只负责裁**的容器：
         不能直接给按钮加 overflow:hidden —— 那会把它外面那圈冲击波一起裁掉。 */
      .hub-door__clip {
        position: absolute;
        inset: 0;
        border-radius: 999px;
        overflow: hidden;
        pointer-events: none;
      }
      /* 涟漪用白：表盘本身是一块浅色玻璃（radial 的 accent 只染到 30%），
         域色的涟漪压在上面读不出来，白反而像"门里透出一道光"。 */
      .hub-door__ripple {
        position: absolute;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.55);
        pointer-events: none;
      }
      /* 冲击波：点击时创建、播完自己 remove。挂在按钮上（不在裁切层里），
         于是它从表盘边缘往外走 —— 而且**压在环的瓦片底下**（瓦片在 DOM 里更靠后），
         只在瓦片的缝隙里露出来，像一圈从门里推出去的声呐。 */
      .hub-door__wave {
        position: absolute;
        inset: 0;
        border-radius: 999px;
        border: 1.5px solid color-mix(in srgb, var(--accent) 70%, transparent);
        pointer-events: none;
      }
      /* 指针方向的光边：**只在 hover / 键盘聚焦时亮**，且最亮那一点的角度 = 指针角度（--na）。
         平时不画 —— 表盘的边界一直是"只有光、没有线"（外边界交给花瓣花环），
         这圈线只在"门被点亮"的那一刻出现，于是它天然是"可以进去"的信号，而不是装饰。
         ⚠️ **颜色必须取域色，不能取白**：表盘本身是一块浅色玻璃（accent 只染到 30%），
         白线压在上面**等于没画**（实测：把背景换成红色才看见那圈线，白的时候完全看不出）。
         最亮那一点取 --accent-deep（不透明、够深，压得住浅底），其余按角度淡出。
         ⚠️ 能用 --na 驱动的前提是它注册成了 <angle>（见文件头的 @property --na）：
         没注册的自定义属性**不可插值**，锥形渐变的 from 会直接跳过去（针滑、光跳）。 */
      .hub-dial::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 999px;
        padding: 1.5px;
        background: conic-gradient(
          from var(--na, 0deg),
          var(--accent-deep) 0deg,
          color-mix(in srgb, var(--accent) 34%, transparent) 70deg,
          color-mix(in srgb, var(--accent) 12%, transparent) 180deg,
          color-mix(in srgb, var(--accent) 64%, transparent) 292deg,
          var(--accent-deep) 360deg
        );
        -webkit-mask:
          linear-gradient(#000 0 0) content-box,
          linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask:
          linear-gradient(#000 0 0) content-box,
          linear-gradient(#000 0 0);
        mask-composite: exclude;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.22s ease;
      }
      .hub-door:hover:not(:disabled) .hub-dial::before,
      .hub-door:focus-visible .hub-dial::before {
        opacity: 1;
      }
      /* hover 的另一处呼应：表盘的光晕整体加强一档。
         结构必须与 .hub-dial 的常态 box-shadow **同形**（同样的四项、同样的顺序），
         否则过渡会在"两套不相干的阴影"之间插值，看起来像抖了一下。 */
      .hub-door:hover:not(:disabled) .hub-dial {
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.72),
          inset 0 0 30px color-mix(in srgb, var(--accent) 44%, transparent),
          0 0 0 5px color-mix(in srgb, var(--accent) 16%, transparent),
          0 0 46px color-mix(in srgb, var(--accent) 62%, transparent);
      }
      /* 中心名右侧那枚**常驻**的小箭头 —— 它是"这里可以进去"唯一的常驻线索，
         所以不做成 hover 才出现（否则静态截图里整屏没有任何"能进去"的提示）。
         左右各一份等宽留白（pad 与箭头同宽 12px）把名字顶回正中间，
         于是"加箭头"不会移动原来的对位。 */
      .hub-name {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .hub-name__pad {
        width: 12px;
        height: 1px;
        flex: none;
      }
      .hub-name__go {
        color: var(--color-ink-400);
        flex: none;
        transition: color 0.2s ease, translate 0.2s ease;
      }
      .hub-door:hover:not(:disabled) .hub-name__go,
      .hub-door:focus-visible .hub-name__go {
        color: var(--accent-deep);
        translate: 2px 0;
      }
      /* self 态（工作台 = 本页）：箭头与它的留白一起去掉 ——
         **"没有箭头"本身就是"这里没有出口"的信号**，不需要再写一句"已在工作台"。
         按钮保留占位（Hero 高度不变），只是不可点、也没有任何 hover 呼应。 */
      .hub-door:disabled .hub-name__pad,
      .hub-door:disabled .hub-name__go {
        display: none;
      }

      /* ⚠️ 类名**不能叫 ring** —— Tailwind v4 有内置的 ring 工具类（给元素描一圈
         currentcolor 的 box-shadow 环）。扫描器一看到 HTML 里有 class="ring" 就会生成
         .ring { --tw-ring-shadow: ...; box-shadow: ... } —— 于是整个环容器被描上
         一圈 1px 的深色边，看起来就像"Hero 被加了个黑框"。
         它走 box-shadow 而不是 border，**查 border/outline 的探针根本发现不了**。
         判据：**自定义类名不要与任何 Tailwind 工具类同名**（ring / shadow / blur / flex…）——
         同名的后果是"谁生效取决于产出顺序"，正是设计系统 §1.3 那类问题。 */
      .radial {
        --r: ${RING.r}px;
        --rl: ${RING.rl}px;
        --dial: ${RING.dial}px;
        --nameY: ${RING.nameY}px;
        position: relative;
        width: 100%;
        /* 预留环的高度：外圈标签半径 + 半个行高 */
        height: calc(2 * (var(--rl) + 14px));
      }

      /* ---- 装饰层（四件，都在瓦片之前，所以光从瓦片底下穿过）---- */

      /* 1) 光晕：直径正好 2·rl，罩住整个环。
            中心那一大团**偏白**（让玻璃球像是浮在一枚亮盘上），外圈才是强调色的淡光。
            它是"整个 Hero 随模块变色"的主要承载 —— 切换时最先被注意到的那处变化。 */
      .hub-aura {
        position: absolute;
        left: 50%;
        top: 50%;
        width: calc(2 * var(--rl));
        height: calc(2 * var(--rl));
        transform: translate(-50%, -50%);
        border-radius: 999px;
        pointer-events: none;
        background: radial-gradient(
          circle at 50% 50%,
          rgba(255, 255, 255, 0.66) 0%,
          color-mix(in srgb, var(--accent) 17%, transparent) 32%,
          color-mix(in srgb, var(--accent) 7%, transparent) 60%,
          transparent 82%
        );
        animation: aura-in 0.9s ease-out backwards;
      }
      @keyframes aura-in {
        from {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.7);
        }
      }

      /* 2) 环绕盘绕线：**已撤掉**（用户：「会不会显得太花哨了」）——
         详细原因与恢复参数见 gen-modules.mjs 里那段同名注释。
         一句话：位置是对的，但它在 1:1 下读不出"交错"，只剩噪音。 */

            /* 3) 扫描光束：**已撤掉**（用户 2026-09-19：「撤掉指针射线，已经有对应高亮和进度条了」）
         它曾是一根从中心射向选中项的扇形光，与八芒星共用 --na、一起转。
         撤它的理由不是不好看，而是**它表达的信息已经有两处更强的载体**：
         "选中项是谁" = 瓦片的强调色实底 + 脉冲环（高亮）；"第几格" = 外沿进度弧。
         同一件事被三处表达时，最弱的那个就是噪音 —— 而它恰好还是最占地的一个
         （一条从中心贯穿到标签圈的 40px 宽色带）。

         ⚠️ **撤掉元件，判据不撤**，两条留给以后的装饰：
         ① **装饰的"可见区"要先算再配色**。当年它根部被中心盘盖、中段被选中的瓦片盖，
            真正看得见的只有 41~71（约 29px）与 114~130（约 16px）两小截 ——
            渐变必须把最亮的一段配在可见区，否则会写成"通体同亮、可见的两截都灰扑扑"。
         ② **边缘柔化用 mask，不要 filter: blur**：渲染顺序是 filter → clip-path，
            blur 出来的柔边会被 clip 重新切成硬边；mask 排在最后，柔边才留得住。
            （不加柔化时，一条等宽的矩形读起来是"一块方形色毯"而不是一束光。） */

      /* 4) 涟漪：切换时从中心扩散一圈（动画由脚本用 WAAPI 播放，不是 CSS 常驻）。 */
      .hub-ripple {
        position: absolute;
        left: 50%;
        top: 50%;
        width: var(--dial);
        height: var(--dial);
        margin-left: calc(var(--dial) / -2);
        margin-top: calc(var(--dial) / -2);
        border-radius: 999px;
        border: 1.5px solid var(--accent);
        opacity: 0;
        pointer-events: none;
      }
      .radial__item {
        --tile-scale: 1;
        position: absolute;
        left: 50%;
        top: 50%;
        width: ${RING.item}px;
        height: ${RING.item}px;
        /* 圆形：几何需要（支撑半径恒定），不是审美偏好 —— 见 gen-modules.mjs 的 RING 注释 */
        border-radius: 999px;
        /* 同一条 transform 函数链、只改值 —— 状态之间才能插值。
           rotate(a) translateX(r) rotate(-a) 是"沿 a 方向推到半径 r、同时把自身转正"的标准写法：
           先转 -a 消掉朝向，平移完再转回来，于是瓦片始终正立。 */
        transform: translate(-50%, -50%) rotate(var(--a)) translateX(var(--r)) rotate(calc(-1 * var(--a))) scale(var(--tile-scale));
        transition:
          transform 0.4s cubic-bezier(0, 0, 0.2, 1),
          opacity 0.3s,
          background-color 0.2s,
          color 0.2s,
          box-shadow 0.2s;
        /* 入场：从中心"展开"。按 --i 错峰，每个瓦片晚 40ms。
           prefers-reduced-motion 时全局那条 @media 会把 animation-duration 压到 0.01ms，
           自动降级为直接到位 —— 不需要额外的媒体查询。 */
        animation: ring-in 0.5s cubic-bezier(0, 0, 0.2, 1) backwards;
        animation-delay: calc(var(--i) * 40ms);
      }
      @keyframes ring-in {
        from {
          opacity: 0;
          transform: translate(-50%, -50%) rotate(var(--a)) translateX(0px) rotate(calc(-1 * var(--a))) scale(0.6);
        }
      }
      /* hover：**只留放大**。边界色与文字色交给 prism.css 的 「.g.mod-tile:hover」 ——
         那条是"两个类 + 伪类"（特异性 0,3,0），比这里的 0,2,0 高，
         写在这里等于写了一条永远不生效的规则（"写了但不生效"最难查，所以宁可删掉）。 */
      .radial__item:hover {
        --tile-scale: ${RING.mark};
      }
      .radial__item:hover .radial__label {
        color: var(--color-ink-600);
      }
      /* 被选中的那一项**留在环上**，用**本模块的填充色**实底标记。
         它承担"我是谁"，中心的指针承担"我在哪" —— 两者分工，不重复。

         ⚠️ 实底与文字色都**不在这里**，而在 prism.css 的 「.g.mod-tile[data-current='true']」
         （特异性 0,3,0）。原因是 hover 抬升也在那一层、也是 0,3,0 ——
         两边都是 0,3,0 时才靠源码顺序裁决，而这里（lucky-y-tw-hero）排在 prism 之后、
         看起来"应该赢"，但下一个往 prism 里加规则的人不会知道这条隐式前提。
         所以留一个明确的特异性台阶，而不是留一个顺序约定。

         这里只负责**发光**与光标：发光用 --accent（要亮），而实底用 --brand-a（要够深，
         才压得住白字）—— 两者方向相反，所以不可能共用一支色。 */
      .radial__item[data-current='true'] {
        --tile-scale: ${RING.mark};
        cursor: default;
        box-shadow:
          0 0 0 1.5px color-mix(in srgb, var(--accent) 55%, transparent),
          0 10px 26px color-mix(in srgb, var(--accent) 42%, transparent),
          0 0 42px color-mix(in srgb, var(--accent) 34%, transparent);
      }
      /* 脉冲环：从瓦片边缘扩散出去的一圈光，2.6s 一次。
         它是"当前在哪"的持续信号 —— 前面几版都只有静态标记，切换之后要再找一遍。 */
      .radial__item[data-current='true']::after {
        content: '';
        position: absolute;
        inset: -1px;
        border-radius: inherit;
        border: 1.5px solid var(--accent);
        animation: sel-pulse 2.6s cubic-bezier(0, 0, 0.2, 1) infinite;
      }
      @keyframes sel-pulse {
        0% {
          transform: scale(1);
          opacity: 0.75;
        }
        70%,
        100% {
          transform: scale(1.55);
          opacity: 0;
        }
      }
      /* 图标发光：选中时白图标自发光，悬停时按当前强调色发光。
         只加在叶子 svg 上（不是瓦片），所以不会给瓦片建新的合成层。 */
      .radial__item[data-current='true'] svg {
        filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.9));
      }
      .radial__item:hover svg {
        filter: drop-shadow(0 0 7px color-mix(in srgb, var(--accent) 75%, transparent));
      }
      .radial__label {
        position: absolute;
        left: 50%;
        top: 50%;
        white-space: nowrap;
        transform: translate(-50%, -50%) translate(var(--lx, 0), var(--ly, 0));
        transition:
          opacity 0.3s,
          color 0.2s;
      }
      /* 选中项的标签**刻意不加重**：环上九个标签统一当"图例"，中心的 hub-name 单独当"状态"。
         加粗会让同一个词在一屏出现两次并且互相争视线（实测截图里就是这样）。
         "我是谁"由三处给：品牌色实底 + 指针 + 中心名，够多了。 */
      /* ---- 中心：光环 + 花瓣 + 罗盘星 ----
         指针只给**方向**，不复制环上那枚图标 —— 复制就是把"同一信息出现两次"请回来。

         **不做实心。** 试过两版：浅色玻璃球（读不出重心）、深色实心核（用户：太丑）——
         一块实心饼压在环中间，无论什么颜色都太重：它把"中心"变成了一个**物体**，
         而这里需要的其实是**一束光**。所以现在只留三样：
           ① 一圈 accent 描边环（给形状，border + 内外发光）
           ② 一层极淡的 accent 汇聚光（径向渐变的芯，18% → 0）
           ③ SVG 层里的花瓣花环与八芒星（给花纹与方向）
         形状由"环"给、存在感由"光"给 —— 不需要填充。 */
      .hub-dial {
        /* ⚠️ 位置属性全部搬到了外面的 .hub-door（门 = 表盘大小的按钮盒）：
           这里只负责"填满它"。两者中心重合，所以绝对位置与搬动前完全一致。 */
        position: absolute;
        inset: 0;
        border-radius: 999px;
        background: radial-gradient(
          circle at 50% 50%,
          color-mix(in srgb, var(--accent) 30%, transparent) 0%,
          color-mix(in srgb, var(--accent) 10%, transparent) 44%,
          transparent 76%
        );
        /* 外边界**不画实线**，交给 SVG 层那圈花瓣花环（罗盘的外环本来就是一圈纹样）。
           发光仍然要够足 —— 去掉实心之后，"存在感"全靠光：
           第一版只给了 55% / 26px，在浅紫底上几乎看不见环，视觉重心整个跑到了
           上面那块选中瓦片（实心圆）上，比"太沉"还糟。 */
        backdrop-filter: blur(8px) saturate(1.3);
        -webkit-backdrop-filter: blur(8px) saturate(1.3);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.55),
          inset 0 0 26px color-mix(in srgb, var(--accent) 30%, transparent),
          0 0 0 4px color-mix(in srgb, var(--accent) 10%, transparent),
          0 0 34px color-mix(in srgb, var(--accent) 42%, transparent);
        /* 门的 hover 会把这一串换成"加强一档"的同形阴影（见 .hub-door:hover .hub-dial）——
           过渡挂在这里，否则 hover 时是"啪"地跳一档。 */
        transition: box-shadow 0.24s ease;
      }
      /* ---- 刻度层：**已删**（用户 2026-09-19：「去掉花瓣和指针中间的竖线」）----
         曾经有两层：次刻度（10° 一格）与主刻度（40° 一格、与环上 9 个模块一一对齐）。
         次刻度先删 —— 罗盘的外缘本身就是"一圈花瓣花纹"，再叠一层细密刻度就是两层细线糊在一起；
         主刻度随后也删 —— 它夹在星形主尖（19.7px）与花瓣根部（27.5px）之间那 7.8px 的空隙里
         （自己只占 4.5px），且在 12 点方向与指针**共线**，视觉上读成"指针拖出一条尾巴伸到花瓣上"。

         ⚠️ 删它有信息代价：「指针压在哪条主刻度上 = 第几个模块」这条读数没有了。
         现在"第 i / 共 9"完全由**进度弧**（外沿，每格 40°）与中心名承担。
         将来若要恢复：对齐关系仍然成立（conic-gradient 的 0deg 在 12 点方向、顺时针为正，
         与模块角 -90 + 40·i 同坐标系），原规则是 inset 6px 层、mask 60%~73%（即 21.0~25.5px）、
         repeating-conic-gradient 40° 一格、3° 宽 —— 抄回去即可，但**先确认它跟花瓣会不会打架**。 */
      /* ---- 八芒星罗盘 + 花瓣花环 ----
         全部用"细点"描边（stroke-dasharray + round cap）做出星尘质感，
         没有一个实心块 —— 与参考图的语言一致，也延续"中心不做实心"。
         viewBox 100 映到 var(--dial) 82px，即 1 单位 ≈ 0.82px，半径分配（dial 半径 41px）：
           进度弧      38.1~39.4   （最外，承载"第几格"）
           花瓣花环    27.5~37.0   （12 瓣，根 27.5、尖 37.0 —— 盘上最醒目的一层）
           星形主尖    19.7        （len 24）
         ⚠️ 21.0~25.5 那片现在是**空的**：原主刻度层已按用户要求删除，
         所以「指针 → 花瓣」之间不再有任何线条（见上面「刻度层：已删」）。
         盘**外** 41~70 那条 29px 的空带现在**完全留空**：曾放过一圈环绕盘绕线，已按用户要求
         撤掉（见 HERO_CSS —— 位置量得对，输在真实尺寸下读不出"交错"）。
         每两层之间留 ≥1px（线条本身只有 ~0.85px 宽）。
         **花瓣这一层要最亮**（78%）—— 它是用户明确要的"花纹"，其余层是陪衬；
         第一版把花纹做成两层淡波浪（36%/26%），用户反馈"没有花纹啊，看不出来"。 */
      .hub-compass {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
      /* 花瓣花环：12 片叶形花瓣绕一圈，尖朝外。描边点阵、填充极淡 ——
         花瓣是主体，所以透明度给足（78%），不然又回到"看不出来"。
         ⚠️ 选择器写成「.hub-compass__petals path」（组 + 后代），不是给每片花瓣挂类：
         挂类的写法一旦漏了，SVG 的 path 会走**默认黑色填充** ——
         实测就是这样：12 片花瓣全黑，而"忘了写 class"本身不会报任何错。 */
      .hub-compass__petals path {
        fill: color-mix(in srgb, var(--accent) 14%, transparent);
        stroke: color-mix(in srgb, var(--accent) 78%, transparent);
        stroke-width: 0.9;
        stroke-dasharray: 1.5 1.2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      /* 星形与那根细针**共用 --na**，所以两者永远同向、不会错位。
         ⚠️ SVG 里做 CSS 旋转必须给 transform-box —— 默认的 origin 落在用户坐标系的 (0,0)，
         不给就会绕左上角甩出去（实测过：星形整个飞出圆盘）。 */
      .hub-compass__star {
        transform-box: view-box;
        transform-origin: 50% 50%;
        /* ⚠️ 这里**不再写 transition** —— 平滑已经由 --na 自己的过渡提供
           （见 @property --na 的注释）。两处都写会串成 ~0.7s 的迟钝，
           而且针会比 CTA 的光边慢半拍，"同一个数驱动两处"的同步感就没了。 */
        transform: rotate(var(--na, 0deg));
      }
      .hub-compass__star path {
        fill: color-mix(in srgb, var(--accent) 20%, transparent);
        stroke: color-mix(in srgb, var(--accent) 82%, transparent);
        stroke-width: 0.9;
        stroke-dasharray: 1.4 1.2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      /* 主尖：最长、最亮 —— 它承担"指向选中项"，所以要和其余三根明显分得开 */
      .hub-compass__star path.is-main {
        fill: color-mix(in srgb, var(--accent) 34%, transparent);
        stroke: var(--accent);
        stroke-width: 1.1;
      }
      /* 进度弧：外沿一圈，长度 = 当前是第几个（9 个模块 → 每格 40°）。
         它把"第 i / 共 N"变成**视觉信息** —— 比在别处补一行"3 / 9"的文字便宜得多，
         ⚠️ 主刻度层已删，所以它现在是"第几格"的**唯一**读数（见上面「刻度层：已删」）。
         --arc 由脚本写（每格 40°），注册成 <angle> 才能扫过去。 */
      .hub-arc {
        position: absolute;
        inset: 0;
        border-radius: 999px;
        background: conic-gradient(
          from 0deg,
          color-mix(in srgb, var(--accent) 85%, transparent) 0deg var(--arc, 0deg),
          transparent var(--arc, 0deg) 360deg
        );
        -webkit-mask: radial-gradient(closest-side, transparent 93%, #000 95%);
        mask: radial-gradient(closest-side, transparent 93%, #000 95%);
        transition: --arc 0.5s cubic-bezier(0, 0, 0.2, 1);
      }
      .hub-pin {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 6px;
        height: 6px;
        margin: -3px 0 0 -3px;
        border-radius: 999px;
        background: var(--accent);
        box-shadow:
          0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent),
          0 0 12px color-mix(in srgb, var(--accent) 65%, transparent);
      }
      /* --na（指针角度）现在由**八芒星的主尖**消费，壳体上不再有独立的针元素。
         它仍然写在 .radial 那一层：这条链只留一份事实源
         （早先扫描光束也读它；光束已撤，但写在环上仍是对的 —— 将来要加"跟随方向的元素"，直接读 --na 即可）。
         角度由脚本**单调累加**保证走最短弧（见 SCRIPT 的 pointTo）。 */
      .hub-name {
        position: absolute;
        left: 50%;
        top: 50%;
        white-space: nowrap;
        transform: translate(-50%, var(--nameY));
      }
      /* 窄档：四个数**必须成对地收**。
         ⚠️ rl − r 的差（径向间隙）任何时候都得保持在 ~38px：
         圆形瓦片半宽 22 + 标签沿径向的半支撑 23 − 容差 ≈ 38。
         只收 rl 不收 r（或反过来）会立刻把标签压回瓦片上 ——
         而"r 单独收"还会让瓦片顶上来撞中心名（nameY 是跟球半径、r 一起定的）。
         收完的宽向跨度 = 2 × (114 + 23) = 274px，与上一版一致（不引入回归）。 */
      @media (max-width: 600px) {
        .radial {
          --r: 76px;
          --rl: 114px;
          --dial: 64px;
          --nameY: 34px;
        }
      }
      /* ============================================================================
         助手栏 · 参考图（正念陪伴）真正可迁移的是**几何**，不是配色
         ----------------------------------------------------------------------------
           ① 头像是一颗「被光从左上方照亮的球」—— 径向高光 + 细白环 + 外发光，
              而不是一块圆角方块铺一条 45° 线性渐变（那是"标签"，不是"球"）
           ② 状态与声波同一行、元信息另起一行，三行的字号落差拉得很大
           ③ 输入栏是一条**胶囊**，两端各住一枚圆钮
         ⚠️ 色彩分配不照抄：参考图的重色在左端（麦克风 = 主行动），
            而文字场景的主行动是「发送」→ 左端中性、右端实底紫。
         ============================================================================ */
      .rail-avatar {
        display: inline-flex;
        /* 尺寸取 --rail-ball（定义在 .rail 上）：收起态的轨道宽度就是由它推出来的
           （球 40 + 两侧各 8 = 56）—— 两处共用一个源，改球的大小轨道会自动跟上。 */
        height: var(--rail-ball, 40px);
        width: var(--rail-ball, 40px);
        flex: none;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        color: #fff;
        /* 两层：上层是球体高光（光摆在左上 32%/26%），下层是色相。
           色相取 src/data/derive.ts 的 avatarGradient(265)，与顶栏用户头像同源。 */
        background:
          radial-gradient(circle at 32% 26%, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0) 60%),
          linear-gradient(135deg, hsl(265, 72%, 64%), hsl(235, 68%, 52%));
        /* 细白环 + 域色辉光 = 参考图里那颗球"浮"在卡片上的感觉。
           ⚠️ 白环的 α 不能太小：实测 .42 时球的边界会糊进玻璃底衬，"球"就读成了
           "一团印子"—— 它全靠这一圈把外缘切出来（放大 8 倍才看得出来）。 */
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.58),
          0 6px 16px -6px rgba(79, 70, 229, 0.6);
      }
      .rail-avatar--sm {
        height: 22px;
        width: 22px;
      }
      /* 声波：五根不等高的条。
         ⚠️ 这里**刻意不写 animation** —— 它只在切换模块时由脚本跳一拍（railWavePulse）。
         常驻栏里一直动的东西会一直抢注意力，而它并没有新消息要报告。
         结构守卫会检查这条规则里没有 animation，防止有人"顺手"加上。 */
      .rail-wave {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        height: 12px;
        color: var(--color-brand-500);
      }
      .rail-wave i {
        display: block;
        width: 2px;
        border-radius: 999px;
        background: currentColor;
      }
      .rail-wave i:nth-child(1) { height: 4px; }
      .rail-wave i:nth-child(2) { height: 8px; }
      .rail-wave i:nth-child(3) { height: 12px; }
      .rail-wave i:nth-child(4) { height: 7px; }
      .rail-wave i:nth-child(5) { height: 5px; }
      /* 圆钮：抬头右端的按钮簇与输入栏两端共用。
         参考图里那几枚都是"白圆 + 细描边 + 柔和阴影"，所以亮的那一枚默认就带一层薄环。 */
      .rail-round {
        display: inline-flex;
        height: 32px;
        width: 32px;
        flex: none;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        color: var(--color-ink-400);
        transition:
          background-color 0.15s ease,
          color 0.15s ease,
          box-shadow 0.15s ease;
      }
      .rail-round:hover {
        background-color: var(--color-ink-50);
        color: var(--color-ink-900);
      }
      /* 抬头那枚「新建对话」= 参考图右上的 sparkle 圆钮（白圆 + 品牌紫图标）。
         ⚠️ :hover 必须显式写回来：.rail-round:hover 的特异性与 --tile 相同，
         不写的话悬停会把白底和紫图标一起冲掉。 */
      .rail-round--tile {
        background: var(--color-surface-raised);
        color: var(--color-brand-600);
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.7),
          0 4px 10px -4px rgba(79, 70, 229, 0.38);
      }
      .rail-round--tile:hover {
        background: var(--color-surface-raised);
        color: var(--color-brand-600);
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.9),
          0 6px 14px -5px rgba(79, 70, 229, 0.52);
      }
      /* 输入栏左端的附件：中性，不与右端抢 */
      .rail-round--soft:hover {
        background-color: var(--color-ink-50);
      }
      /* 输入栏右端的发送：整条栏里唯一的实底 —— 主行动只该有一个。
         ⚠️ 渐变两端取 Prism 的 --brand-a / --brand-b（0.180 / 0.170）——
         这两个数存在的**全部理由**就是"渐变两端都落进白字可行的那个窄窗口"。
         直接拿强调色做渐变，中段一定会出现一段压白字只有 2~3:1 的区段。 */
      .rail-round--send {
        color: #fff;
        background: linear-gradient(135deg, var(--brand-a) 0%, var(--brand-b) 100%);
        box-shadow: 0 6px 14px -2px color-mix(in srgb, var(--brand-a) 52%, transparent);
      }
      .rail-round--send:hover {
        background: linear-gradient(135deg, var(--brand-a) 0%, var(--brand-b) 100%);
        filter: brightness(1.06);
        color: #fff;
      }
      .rail-round--send:active {
        transform: scale(0.94);
      }
      /* --- 可缩回 / 展开 --------------------------------------------------------
         隐喻是"整条栏往右收进窗口边"，所以**只动宽度** —— 右侧锚点（贴窗口右）不动，
         左边框跟着左移（它就是那道"帘边"）。
         ⚠️ 时序是**两段拼的**，而且两个方向的排法相反：
           收起：内容先淡出（120ms）→ 宽度再收窄；
           展开：宽度先展宽 → 内容后淡入（160ms 延迟）。
         反过来做的后果很具体：宽度过渡期间内容还可见，会看到文字在**每一帧**疯狂重排
         （340 → 56 中间有十几帧，每帧的换行位置都不同）。
         CSS 的规矩：transition 写在**目标状态**上，决定"进入该状态"的时序 ——
         所以 .rail 上那条管"进展开态"、.rail[data-collapsed] 上那条管"进收起态"。 */
      .rail {
        /* 球 40 + 两侧各 8。56 这个数**是从球算出来的**，不是凑的：
           收起态要让球在轨道里居中，56 - 40 = 16，两边各 8。 */
        --rail-ball: 40px;
        --rail-w-collapsed: calc(var(--rail-ball) + 16px);
        transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .rail[data-collapsed] {
        width: var(--rail-w-collapsed);
        transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.12s;
      }
      /* 收起态只剩那颗球。球的左边缘要挪到 (56 - 40) / 2 = 8px 才居中 ——
         用 padding 而不是 margin：head 是 flex 容器，球本来就是它的第一个子项。 */
      .rail-head {
        transition: padding 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.12s;
      }
      .rail[data-collapsed] .rail-head {
        padding-left: 8px;
        padding-right: 0;
        gap: 0;
      }
      /* 收起时要消失的几块（抬头文字 / 抬头按钮簇 / 消息区 / 输入区）。
         ⚠️ 用 visibility 而不是只压 opacity：只压透明度的话，看不见的东西**还能 Tab 进去**
         （键盘焦点会跑进一条看不见的栏里）。visibility 会把它们从 Tab 序里摘掉，
         但要**延迟到淡出结束**再切，否则淡出动画会被立刻打断、变成"啪"地消失。 */
      .rail__fade {
        transition:
          opacity 0.2s ease 0.16s,
          visibility 0s 0s;
      }
      .rail[data-collapsed] .rail__fade {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition:
          opacity 0.12s ease,
          visibility 0s 0.12s;
      }
      /* 那颗球在两态下都是按钮 —— 它是整条栏唯一的开关，也是收起之后唯一的出口，
         所以 hover 要给足"可点"的反馈（放大 + 光环加强，不换形状）。 */
      button.rail-avatar {
        cursor: pointer;
        transition:
          transform 0.22s cubic-bezier(0.34, 1.3, 0.64, 1),
          box-shadow 0.22s ease;
      }
      button.rail-avatar:hover {
        transform: scale(1.06);
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.72),
          0 8px 20px -6px rgba(79, 70, 229, 0.7);
      }
      button.rail-avatar:active {
        transform: scale(0.96);
      }
      button.rail-avatar:focus-visible {
        outline: 2px solid var(--color-brand-500);
        outline-offset: 2px;
      }
      /* 堆叠档（≤1180px）：栏是整宽的块，"往右收窄"没有意义 ——
         改成**塌成一条 56px 高的窄条**（只剩那颗球），点它再张开。 */
      @media (max-width: 1180px) {
        .rail[data-collapsed] {
          width: 100%;
          height: 56px;
        }
        /* 堆叠档下不走"给球腾出居中空间"那套（栏是整宽的，谈不上居中）——
           球回到展开态的位置，于是收起时它**原地不动**，动的只有整条栏的高度。 */
        .rail[data-collapsed] .rail-head {
          padding-left: 16px;
        }
      }
      /* 降级：全局那条 @media 只把 duration 压到 0.01ms ——
         对 infinite 动画来说那等于**以 100kHz 空转**，比不动更糟（持续重绘）。
         所以这里显式停掉持续动画。入场与切换的过渡仍由全局那条压成瞬移。
         （刻度层与盘绕线都已撤掉，所以名单里只剩这两处。） */
      @media (prefers-reduced-motion: reduce) {
        .hub-aura,
        .radial__item[data-current='true']::after {
          animation: none !important;
        }
      }
    </style>`

const SCRIPT = `    <!-- ============================================================================
         模块切换 · 交互
         ----------------------------------------------------------------------------
         只做一件事：把"当前模块"写到 data-current / hidden / 摘要 / 面包屑 / hub 名上，
         再让中心的指针转到那一项，其余交给 CSS transition。

         角度是**固定的**（「ringAngle(i) = -90 + 40·i」，只写一次、不随当前项变化）：
         环是地图，位置永远不动 —— 这是"指针方案"能成立的前提。
         于是切换时动的只有一枚针，而不是整圈图标重排。

         几何常量 R / RL / STEP / START 由 gen-modules.mjs 内插进来：**同一组数只有一份**，
         CSS 与 JS 不各写一遍（写两遍就是两份事实源，改了半径只改一处必然错位）。

         没有指示点（已撤），没有左右两张卡（已换成环）：切换入口是"点环上任意一个图标"
         + 键盘 ←→（←→ 挂在环上，从被聚焦的按钮冒泡上来 —— 环上每一项自己就是 button，
         所以不再需要给容器补 tabindex 那种补丁）。

         没有自动播放：切换是一次视图重置（下方磁贴会整套换掉），
         自动播会让人读到一半被清空；悬停暂停治不了这个 —— 用户没悬停的时候照样会被换掉。
         ============================================================================ -->
    <script>
      (function () {
        var ring = document.getElementById('module-ring')
        if (!ring) return

        var items = Array.prototype.slice.call(ring.querySelectorAll('.radial__item'))
        var ripple = ring.querySelector('.hub-ripple')
        var arcEl = ring.querySelector('[data-hub-arc]')
        // 强调色写在这一层：环、光晕、Hero 底色带都从它继承（见 HERO_CSS 的注释）
        var heroSection = ring.closest('section')
        var panels = Array.prototype.slice.call(document.querySelectorAll('[data-module-panel]'))
        var focusPanels = Array.prototype.slice.call(document.querySelectorAll('[data-focus-panel]'))
        var summary = document.querySelector('[data-module-summary]')
        var hubName = document.querySelector('[data-hub-name]')
        var crumb = document.querySelector('[data-breadcrumb-current]')
        var crumbSep = document.querySelector('[data-breadcrumb-sep]')
        // 「进入主页面」这枚 CTA：文案 / 目标路由 / self 态**全部取自环上的按钮**
        // （与 KEYS / LABELS / SUMMARIES 同一个来源）—— 这里不再抄一份模块表。
        // 「门」的两个落点：按钮自己 + 裁切层（涟漪要在表盘的圆里扩散）。
        // 见 enterBeat()。原来还挂着 label / icon 两个挂点，改成"仪表本身就是门"之后
        // 文案就是中心名、方向就是指针，两个挂点都没有存在的理由了。
        var enterDoor = document.querySelector('[data-enter-door]')
        var enterClip = document.querySelector('[data-enter-clip]')
        var heroBand = document.querySelector('.hero-band')

        // 模块的权威列表取自环上的按钮：DOM 顺序 = 模块顺序 = 面板顺序，
        // key / 名称 / 摘要都写在按钮上，脚本里不再抄一份内容。
        var KEYS = items.map(function (b) { return b.dataset.module })
        var LABELS = items.map(function (b) { return b.dataset.label })
        var SUMMARIES = items.map(function (b) { return b.dataset.summary })

        var N = items.length
        var R = ${RING.r}, RL = ${RING.rl}, STEP = ${RING.step}, START = ${RING.start}
        var current = 0

        // 角度与标签偏移**只写一次**：环是固定地图，切换时不重排。
        items.forEach(function (item, i) {
          var a = START + STEP * i
          var rad = (a * Math.PI) / 180
          item.style.setProperty('--a', a + 'deg')
          item.style.setProperty('--lx', ((RL - R) * Math.cos(rad)).toFixed(1) + 'px')
          item.style.setProperty('--ly', ((RL - R) * Math.sin(rad)).toFixed(1) + 'px')
        })

        /* 指针角度必须**单调累加**，不能直接赋目标角：
           从 -40° 到 +40° 直接赋值会走近路（对的），但从 170° 到 -170° 会**倒着转 340°**。
           这里每次只加"最短的那段差值"，于是跨越 0°/360° 时也顺着转。
           --na 的 0° 是"指针朝上"，而槽位角 0° 是"从 12 点起顺时针" → na = a + 90。
           ⚠️ --na 写在 **Hero 的 section** 上（不是环上）：这条链只留一份事实源，
           而它现在有**两个消费者** —— 表盘里的八芒星（transform）与 CTA 那圈光边
           （conic-gradient 的 from 角）。挂在环上，环外的 CTA 就继承不到。 */
        var needleAngle = START + 90
        function pointTo(a) {
          var target = a + 90
          var delta = ((target - needleAngle + 540) % 360) - 180
          needleAngle += delta
          if (heroSection) heroSection.style.setProperty('--na', needleAngle + 'deg')
        }

        /* 切换时从中心扩散一圈涟漪。用 WAAPI 而不是常驻 CSS 动画：它需要"每次切换重放"，
           CSS 那套得靠 remove class → 强制 reflow → add class 的 hack。
           ⚠️ WAAPI **不受**全局那条 prefers-reduced-motion 的 @media 约束，必须自己判断。 */
        var reduce =
          window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        var firstPaint = true
        function rippleOnce() {
          if (!ripple || reduce || firstPaint) return
          ripple.animate(
            [
              { transform: 'scale(0.35)', opacity: 0.55 },
              { transform: 'scale(2.1)', opacity: 0 },
            ],
            { duration: 620, easing: 'cubic-bezier(0, 0, 0.2, 1)' }
          )
        }

        /* 切换模块时，助手栏抬头那排声波跳一拍。
           ----------------------------------------------------------------------------
           它是**唯一**动这排声波的时机 —— 说的正是"助手正在重读上下文"，
           而不是"这一栏活着"。常驻栏里一直动的东西会一直抢注意力，
           而它并没有新消息要报告（CSS 那边也刻意没写 animation，有守卫盯着）。
           ⚠️ 和涟漪同一套规矩：WAAPI 不受全局 prefers-reduced-motion 的 @media 约束，
           自己判断；首帧也不播（页面刚加载不该有"同步"这个动作）。
           用 scaleY 而不是改 height：不触发重排，五根条的高度差也不会被抹平。 */
        var railWave = document.querySelector('[data-rail-wave]')
        function railWavePulse() {
          if (!railWave || reduce || firstPaint) return
          var bars = railWave.children
          for (var i = 0; i < bars.length; i++) {
            bars[i].animate(
              [
                { transform: 'scaleY(1)' },
                { transform: 'scaleY(2.6)', offset: 0.42 },
                { transform: 'scaleY(1)' },
              ],
              { duration: 300, delay: i * 55, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
            )
          }
        }

        /* ============================================================================
           助手栏：收起 / 展开
           ----------------------------------------------------------------------------
           开关就是**那颗球** —— 它只有一个语义（切换这一栏的显隐），两个状态只是同一语义的
           两个方向，所以不需要第二枚按钮。收起之后它是整条轨上唯一的可点物，也就是唯一的出口。
           收起**只动宽度**（右侧贴着窗口不动，左边框就是那道"帘边"）；
           内容的淡出/淡入由一个类统管（.rail__fade），时序在 CSS 里分两段拼（先淡出再收窄）。
           ⚠️ 状态**不持久化**：原型每次打开都该是完整的，否则评审时会被"上次是收起的"绊住。
           落地时要存 localStorage，并处理两个边界 —— 窗口很窄时强制收起、
           以及堆叠档（≤1180px）下"收窄"要换成"塌成窄条"（CSS 里已有对应规则）。 */
        var rail = document.querySelector('[data-rail]')
        var railToggle = document.querySelector('[data-rail-toggle]')
        function setRail(collapsed) {
          if (!rail || !railToggle) return
          if (collapsed) rail.setAttribute('data-collapsed', '')
          else rail.removeAttribute('data-collapsed')
          railToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
          var label = collapsed ? '展开助手栏' : '收起助手栏'
          railToggle.setAttribute('aria-label', label)
          railToggle.title = label
        }
        if (railToggle) {
          railToggle.addEventListener('click', function () {
            setRail(!rail.hasAttribute('data-collapsed'))
          })
        }

        /* ============================================================================
           主题切换（亮 / 暗）
           ----------------------------------------------------------------------------
           只改 <html> 上的一个属性。两套数值全在 CSS 里（prism.css §1）——
           刻度、面板色、面板 α、三级文字、可辨边界、投影蓝调，各一组。
           所以这里**没有**"同步第二处状态"这件事，也就不可能出现"切了一半"。

           ⚠️ 暗色是**缺省**（「:root」），亮色是覆盖（「html[data-theme='light']」）——
           照 DESIGN_TOKENS.md §2.1 的方向。于是这个按钮的两个状态在 CSS 里是不对称的：
           「data-theme="light"」 存在时走亮色，属性被摘掉时走暗色。
           这里用显式的两个值（light / dark），比"加属性 / 摘属性"更好读，
           代价是 dark 有两条路径可达（显式 dark 与无属性），而它们等价 —— 由 CSS 保证。

           ⚠️ 字形由 CSS 按主题显示（.theme-toggle 的 .i-moon / .i-sun），**不在这里切**：
           脚本在解析后才跑，切 innerHTML 会让首帧出现空窗，看起来像"按钮坏了"。
           这里只维护 aria-label —— 它读屏要用，且是"动作"而不是"状态"，必须跟着变。 */
        var themeToggle = document.querySelector('[data-theme-toggle]')
        function applyTheme(theme) {
          document.documentElement.setAttribute('data-theme', theme)
          if (themeToggle) {
            themeToggle.setAttribute(
              'aria-label',
              theme === 'light' ? '切换到暗色主题' : '切换到亮色主题'
            )
          }
        }
        if (themeToggle) {
          themeToggle.addEventListener('click', function () {
            applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light')
          })
        }

        function render() {
          var key = KEYS[current]

          // 强调色跟着当前模块走：Prism 里九个模块各有一组色（没有"默认回落"那一档），
          // 槽位由 src/styles/prism.css §3 的 [data-series] 提供，这里只写 key、不做映射表。
          // ⚠️ 写在 section 上而不是环上：同一条色链还要给 Hero 的底色带（.hero-band）用，
          // 而它不在环里面。环只是继承这个变量。
          if (heroSection) heroSection.setAttribute('data-accent', key)

          /* ⚠️ 还要**同时**写到 <html> 的 data-series 上，这不是重复劳动：
             [data-accent] 只管 Hero 这一块（底色带 / 光晕 / 指针），
             而"整页底衬也随模块变"要由 .ambient 读色团 —— 它在 #root **之外**，
             继承不到 section 上的任何变量（.ambient 是 body 的另一个子元素）。
             写在 <html> 上，两个属性空间共用同一张色表（见 prism.css §3 的选择器）。 */
          document.documentElement.setAttribute('data-series', key)

          items.forEach(function (item, i) {
            var isCurrent = i === current
            item.setAttribute('data-current', String(isCurrent))
            item.setAttribute('aria-current', String(isCurrent))
          })

          // 指针指向当前项的那一格（固定角度，所以"哪一格"也是固定的）
          pointTo(START + STEP * current)

          // 进度弧：长度 = (当前序号 + 1) × 每格角度 —— "第几 / 共几"变成一个视觉量。
          // 它只改**长度**（不是旋转），所以直接赋目标值即可，不需要像指针那样累加：
          // 没有绕圈问题，回退时弧就是缩短回去。
          if (arcEl) arcEl.style.setProperty('--arc', STEP * (current + 1) + 'deg')

          panels.forEach(function (panel) {
            if (panel.getAttribute('data-module-panel') === key) panel.removeAttribute('hidden')
            else panel.setAttribute('hidden', '')
          })

          // 右侧「今日焦点」也是整页重置的一环：与磁贴、对话、摘要行、面包屑一起换。
          focusPanels.forEach(function (panel) {
            if (panel.getAttribute('data-focus-panel') === key) panel.removeAttribute('hidden')
            else panel.setAttribute('hidden', '')
          })

          if (summary) summary.textContent = SUMMARIES[current]
          if (hubName) hubName.textContent = LABELS[current]

          // 面包屑：当前就在工作台（本页）时不再重复一遍自己
          var isHome = key === 'home'
          if (crumb) {
            crumb.textContent = LABELS[current]
            crumb.hidden = isHome
          }
          if (crumbSep) crumbSep.hidden = isHome

        /* 「门」—— 整页重置的**第七处**联动点。
           门自己不再有独立的文案：它的名字就是中心名（data-hub-name，上面已经同步过）。
           跟着当前模块走的只有两件：目标路由（title / aria-label）与 self 态。
           ⚠️ **不切换显隐**：藏了它 Hero 会凭空矮一截，切回工作台时磁贴整块往上跳。
           self 态靠两处一起表达：disabled（不可点、不进 Tab 序）+ 中心名右侧
           **没有箭头**（见 HERO_CSS 的 .hub-door:disabled）——
           "没有箭头"本身就是"这里没有出口"，不需要再写一句"已在工作台"。 */
        if (enterDoor) {
          var self = items[current].dataset.enterSelf === 'true'
          enterDoor.disabled = self
          enterDoor.dataset.enterPath = items[current].dataset.enterPath
          enterDoor.title = '目标：' + items[current].dataset.enterPath
          enterDoor.setAttribute(
            'aria-label',
            (self ? '已在' + LABELS[current] : items[current].dataset.enter) +
              '（' +
              items[current].dataset.enterPath +
              '）'
          )
        }

          // 涟漪放最后：读屏/首帧之外的所有切换都附带一次"中心扩散"
          rippleOnce()
          // 助手栏那排声波也跟着跳一拍 —— 它说的也是"这一下被系统听见了"
          railWavePulse()
          firstPaint = false
        }

        function go(next) {
          current = (next + N) % N
          render()
        }

        items.forEach(function (item, i) {
          item.addEventListener('click', function () {
            if (i === current) return
            go(i)
          })
        })

        // 挂在环上：焦点在任何一项上时，事件都会冒泡到这里
        ring.addEventListener('keydown', function (event) {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          go(current + (event.key === 'ArrowRight' ? 1 : -1))
        })

        /* ============================================================================
           「进门」这一下的反馈
           ----------------------------------------------------------------------------
           原型不跳页（没有 router），所以用**四次同节拍的动作**把"按下去了"这件事
           在四个尺度上同时说出来：
             ① 门内：从**指针落点**扩开的涟漪（白 55%）—— 最近的尺度，像门里透出一道光
             ② 门边缘：一圈**声呐**往外推到环上（放大到 2.4×）—— 它不是"按钮的边框动画"，
                而是从表盘推出去的一圈波；因为瓦片在 DOM 里更靠后，它会**从瓦片底下穿过**，
                只在缝隙里露出来。
             ③ 门本身：先压 .97 再弹过 1.03 回到 1 —— 触感
             ④ 整个 Hero：底色带 brightness + saturate 脉一下 —— "系统听到了"，代替跳转
           全部由 WAAPI 播、播完自己收（不常驻、不进 CSS、不占状态）。
           ⚠️ WAAPI **不吃**全局那条 prefers-reduced-motion 的 @media，必须自己判断（reduce）。

           落地时这里应该是"播完 ①~③ 再 router.push"（④ 由目标页的入场动画接手），
           而不是留在原地 —— 现在这样只是为了让人看清"进门"这个动作长什么样。 */
        function enterBeat(event) {
          if (reduce) return
          var r = enterDoor.getBoundingClientRect()

          /* 临时元素（涟漪 / 冲击波）用完必须自己收干净，否则每点一次就漏一个节点。
             ⚠️ 只挂 finished.then 不够：**动画被打断时 finished 会 reject**，
             而某些环境下时间轴不推进、finished 干脆不 settle（实测 headless 虚拟时钟就是）。
             所以统一走 setTimeout 兜底 —— 它走任务队列，一定会到。 */
          function cleanup(el, ms) {
            setTimeout(function () {
              if (el.parentNode) el.remove()
            }, ms + 160)
          }

          // ① 落点涟漪。半径要够到最远的那个角，否则会看到一条边没铺满。
          if (enterClip) {
            var x = event.clientX ? event.clientX - r.left : r.width / 2
            var y = event.clientY ? event.clientY - r.top : r.height / 2
            var reach = Math.max(
              Math.hypot(x, y),
              Math.hypot(r.width - x, y),
              Math.hypot(x, r.height - y),
              Math.hypot(r.width - x, r.height - y)
            )
            var dot = document.createElement('span')
            dot.className = 'hub-door__ripple'
            dot.style.left = x - reach + 'px'
            dot.style.top = y - reach + 'px'
            dot.style.width = dot.style.height = reach * 2 + 'px'
            enterClip.appendChild(dot)
            dot.animate(
              [
                { transform: 'scale(0.12)', opacity: 0.9 },
                { transform: 'scale(1)', opacity: 0 },
              ],
              { duration: 520, easing: 'cubic-bezier(0, 0, 0.2, 1)' }
            )
            cleanup(dot, 520)
          }

          /* ② 声呐：从表盘推出去的一圈波（放大到 2.4×）。
             ⚠️ 幅度必须够大才看得见：表盘 82px，而环的瓦片在 92±22 = 70~114 那一圈 ——
             只放大 1.14×（=93px）的话整圈波**全被瓦片盖住**，等于没做。推到 2.4×（197px）
             才会从瓦片的缝隙里透出来，并且还在 .radial 的 288px 盒子里（不会撑出滚动区）。
             它挂在门上而不是裁切层里，才能长到 82px 之外去。 */
          var wave = document.createElement('span')
          wave.className = 'hub-door__wave'
          enterDoor.appendChild(wave)
          wave.animate(
            [
              { transform: 'scale(1)', opacity: 0.85 },
              { transform: 'scale(2.4)', opacity: 0 },
            ],
            { duration: 700, easing: 'cubic-bezier(0.16, 0.8, 0.3, 1)' }
          )
          cleanup(wave, 700)

          // ③ 触感：压下去再弹回来（过冲到 1.03 才有"回弹"而不是"复位"）
          enterDoor.animate(
            [{ scale: '0.97' }, { scale: '1.03', offset: 0.55 }, { scale: '1' }],
            { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
          )

          /* ④ 全屏脉冲：底色带是整个 Hero 的氛围层，让它脉一下 = "这一下被系统听见了"。
             ⚠️ 峰值用 brightness + saturate 的组合，不用单靠 brightness：
             底色带是低透明度渐变，只提亮度几乎看不出来（实测 brightness(1.5) 的峰值帧
             与常态几乎一样）；补上 saturate(1.7) 后那层紫才真的"涨"起来。
             它也不承载任何文字，所以怎么亮都不会碰到对比度。 */
          if (heroBand) {
            heroBand.animate(
              [
                { filter: 'brightness(1) saturate(1)' },
                { filter: 'brightness(1.45) saturate(1.7)' },
                { filter: 'brightness(1) saturate(1)' },
              ],
              { duration: 700, easing: 'ease-out' }
            )
          }
        }
        if (enterDoor) enterDoor.addEventListener('click', enterBeat)

        render()
      })()
    </script>`

/** 替换掉旧的「派生口径 + 与 src 的已知差异」文档块，以及它后面那两段
 *  过时的交互说明（一段是「业务域 3D 旋转木马」，一段是「业务域切换」——
 *  前者是上一版留下的孤儿注释，后者已被下面的 SCRIPT 自带注释取代）。 */
const DOC = `    <!-- ============================================================================
         派生口径 · 数据来源与对账
         ----------------------------------------------------------------------------
         九张模块卡、九个面板（45 块磁贴）、九段助手对话全部由 design/gen-modules.mjs
         从 src/data/projects.ts 的 8 个项目派生 —— **页面里没有编造的数字**，
         每一条都能追到项目字段：

         规模    项目 8 · 生活 3 / 工作 2 / 学习 3
         状态    待启动 2（p4、p6）· 进行中 3（p1、p3、p5）· 风险阻塞 1（p2）· 已完成 2（p7、p8）
         任务    总量 164 · 已完成 100 · 待办 64 · 完成率 61.0%
                 生活 33/54 · 工作 29/54 · 学习 38/56
         进度    全域均值 59%（(68+42+72+12+80+0+100+100)/8）
                 生活 70% · 工作 42% · 学习 60%；卡片上的「较全域 ±n%」= 域均值 − 全域均值
         到期    未完成的 6 个项目：10 / 12 / 13 / 58 / 63 / 104 天
                 按月 9月 2 · 10月 1 · 11月 2 · 12月 1（取 dueShort 的月份）
         预算    3 个项目登记预算：¥32,000 + ¥186,000 + ¥6,800 = ¥224,800
         可见性  私有 3 · 工作内部 2 · 家庭可见 2 · 公开 1
         知识库  8 条索引 = 8 个项目的 docsUrl 字段（没有独立笔记库，故做空态）
         设置    10 个设置页 / 6 个可开关模块 / 4 类集成位 —— 取自 docs/模块设计.md §6
                 （唯一一个没有数据源的模块，因此卡片走"未接入"态而不是编数字）

         每根柱子都是上表数值的线性映射，柱高下限 2px（否则 0% 的项目那根柱不可见，
         会被读成"漏画了"）。范围与排序口径：
           工作台 · 项目明细    按进度降序，全部 8 个项目
           工作台 · 关键节点    风险 2 条 + 里程碑 3 条（p1/p4/p5）
           任务清单 · 待办明细  按剩余天数升序（= 紧急度）
           日程 · 未来 6 周     同上
           项目 · 里程碑        按剩余天数升序

         与 src 的已知差异（本原型按 DESIGN_SYSTEM.md 判据走，源码侧待定）：
           1. IconSprite.tsx 缺 i-mac-full 与 i-spark 两个 symbol，而 WindowControls.tsx
              与助手头像都引用了它们 → macOS 绿点 hover 第三个字形不出现、助手头像渲染成
              空方块。本文件的内联雪碧图里补了这两个（见下方 symbol 区），落地时需补进 src。
           2. 无侧栏版式下 .shell-frame-top-left 不适用：它的圆角写在
              @media (max-width:860px) 内，前提是「≥861px 时左上角归侧栏」。
              本文件改用 rounded-t-[var(--window-radius)] 直接取令牌；
              若要落地本版式，建议给设计系统补一个「上边全圆角」的外壳类。
           3. ProjectStatsPanel.tsx 的 Delta 用 text-success / text-danger 承载 11.5px
              文字，违反 §2.3 ③（success 主色阶压在 13% 同色底上仅 2.8:1）。
              本文件的对应徽标一律走 -strong 色阶。
           4. Hero 中部是**径向菜单 · 指针版 + 能量层**，不是卡片轮播：九个模块**全部**在环上
              （40° 一格铺满 360°、角度固定），中心是**发光描边环 + 12 片花瓣罗盘 + 八芒星指针**。
              原来的九张模块卡已撤 —— 卡上的数字（主指标 / 任务 x/y / 待办 / 到期）
              与下方五块磁贴**逐项重复**，去掉的是重复而非信息。
              这顺带修掉了上一版遗留的缺口：≤860px 且触摸设备原本**没有任何切换路径**
              （侧卡被停靠隐藏、移动端没有键盘），现在环上每个图标都是可见可点的。
              能量层（光晕 / 脉冲环）与"整块 Hero 随模块变色"
              共用同一条变量链，定义在 Hero 的 section 上（色只能定义在能覆盖全部消费者的那一层）。
           5. 顶栏胶囊与页头的筛选胶囊都已撤掉（用户两次要求）。当前模块由 **指针 + 环上
              强调色实底的瓦片 + 中心名** 表达（三处分工，互不重复）；切换入口是环上的图标
              与键盘 ←→（←→ 从被聚焦的图标冒泡到环上，每一项自己就是 button，
              所以不再需要给容器补 tabindex 那种补丁）。
           6. 「助手」是 A 版与模块设计文档里都没有的新概念，落地前需要先定数据与后端口径。
           7. 助手栏是**整页常驻的右栏**（2026-09-19 用户要求），不是磁贴区右侧的一格：
              它是**跨模块**的（切换只换它的历史对话，它本身不随模块出现或消失），
              放进某个模块的栅格里语义上就等于"它属于那一页"。
              结构上 ≥1181px 是「主列（自带滚动容器）+ 340px 右栏」，≤1180px 回落成上下堆叠。
              落地时 src 侧要有一个同级的 AppShell 槽位，而不是把它塞进工作台页面的栅格。
           8. 「进门」（表盘 + 中心名 = 进入当前模块主页面）的目标路由**全部取自
              docs/模块设计.md**：六个顶层模块的根路径 /life · /work · /learning ·
              /projects · /knowledge · /settings（⚠️ 学习模块文档写的是 /learning，而
              scope 枚举是 learn —— 已知冲突，见待办）；任务清单与日程在设计文档里是
              **工作模块内的页面**，所以目标是 /work/tasks 与 /work/calendar。
              两处属于"产物决策"的推断，落地前需确认：
                · 工作台的根路径文档里没有定义，本原型按 "/"（本应用的首页）处理；
                · 工作台就是本页 → 走 self 态：不可点，且中心名右侧**没有箭头**
                  （"没有箭头"本身就是"这里没有出口"，不另外写一句"已在工作台"）。
              原型里门是 button 而不是 a：file:// 下 a href="/work" 会 404；
              落地时换成 router 的 Link，并把目标路由保留在 title / aria-label 上。
              ⚠️ 它是本文件里**唯一一处把两个语义放在同一个元素上**的地方
              （环心 = "我在哪" + "从这儿进去"）。依据是这两个语义在操作链上**相邻**：
              选模块 → 进模块，中间没有别的事。早先那版是表盘下方一枚写着自己名字的
              实底胶囊（"进入工作主菜单"），用户判定「按钮太直白」——
              把第二步拆成独立控件，换来的不是清晰，是把同一件事又说了一遍。
           9. 助手栏的 UI（2026-09-19 用户给参考图后重做）只借那张图的**几何**，不借配色：
              ① 头像是一颗「被光从左上方照亮的球」（径向高光 + 细白环 + 域色辉光），
                 色相仍取 src/data/derive.ts 的 avatarGradient(265) —— 与顶栏用户头像
                 **同一个生成器**，换的是光，不是色；
              ② 抬头是三行（标题 / 状态 + 声波 / 元信息），字号落差拉大；
              ③ 输入栏是一条胶囊，两端各住一枚圆钮。
              参考图的重色在左端（语音语境的主行动是麦克风），而文字场景的主行动是
              「发送」→ 本项目左端中性、右端实底紫。
              **几何可以跨场景搬，色彩分配不行 —— 后者是场景的函数。**
              另有两处是参考图里没有、但这个栏需要的：
                · 「今天」起点线：消息区底部对齐，栏顶那块留白原本"浮着半截内容"；
                  它顺带补上了整屏都没有出处的日期（时间戳只写到 16:04）。
                · 声波**平时静止**，只在切换模块时跳一拍（脚本 railWavePulse）——
                  那一刻助手确实在重读上下文。常驻栏里一直动的东西会一直抢注意力，
                  而它并没有新消息要报告；声波那份 CSS 刻意不写 animation，有守卫盯着。
          10. 助手栏可**缩回 / 展开**（2026-09-19 深夜，用户要求）。四个决定：
              · 缩回的形态是**一条窄轨（56px）**，不是"整条消失" —— 完全隐藏之后画面上
                就没有"它还在"的线索了，用户得记住怎么把它叫回来。
                窄轨里留的是**那颗球**：它同时就是开关，而这只给了它**一个**语义
                （切换这一栏的显隐），两个状态只是同一语义的两个方向 —— 所以不需要第二枚按钮。
                56 也不是凑的：56 = 球 40 + 两侧各 8，于是它在轨道里正好居中。
              · **只动宽度**：右侧贴着窗口不动，左边框跟着左移（它就是那道"帘边"）。
              · 时序分两段，两个方向相反：收起时**内容先淡出（120ms）再收窄**，
                展开时**先展宽再淡入**。反过来的后果很具体 —— 宽度过渡期间内容还看得见，
                会看到文字在**每一帧**疯狂重排（340 → 56 中间有十几帧，每帧换行位置都不同）。
                （CSS 的规矩：transition 写在**目标状态**上，决定"进入该状态"的时序。）
              · 收起态的内容用「visibility: hidden」而不只是「opacity: 0」——
                只压透明度的话，看不见的东西**还能 Tab 进去**（焦点会跑进一条看不见的栏里）。
                visibility 要延迟到淡出结束再切，否则淡出动画会被立刻打断。
              ⚠️ 状态**不持久化**：原型每次打开都该是完整的，否则评审会被"上次是收起的"绊住。
              落地时要存 localStorage，并处理两个边界：窗口很窄时强制收起，
              以及堆叠档（≤1180px）下"往右收窄"要换成"塌成一条窄条"。
         ============================================================================ -->`

/* ============================================================================
   6. 拼进 workbench.html
   ----------------------------------------------------------------------------
   区间定位用「候选集」：同一处内容在改版前后标记不同（如 `<!-- 中部：业务域 3D 旋转木马 -->`
   → 「<!-- 中部：模块 3D 旋转木马 -->」），这里接受"在文档里唯一命中"的那一个，
   于是**脚本可以反复跑**（幂等）。已经撤掉的顶栏胶囊、已经加上的面包屑同理：有就跳过。
   ========================================================================= */
let html = fs.readFileSync(PAGE, 'utf8')
const log = []
const uses = (s) => html.split(s).length - 1
const at = (s) => {
  const n = uses(s)
  if (n !== 1) throw new Error(`锚点不唯一（出现 ${n} 次）：${JSON.stringify(s.slice(0, 60))}`)
  return html.indexOf(s)
}
/** 找到 [起点, 终点) 区间；起点取候选集里唯一命中的那个。
 *  起点会**回退到行首**（当它前面只有空白时）—— 否则每跑一次就会把锚点前面的缩进
 *  多留一层，文件越来越大、缩进越来越深（真的踩过：连续两跑后缩进累积到 66 个空格）。
 *  因此每个输出片段的**首行必须自带缩进**。 */
const region = (froms, to) => {
  const from = froms.find((s) => uses(s) === 1)
  if (!from) throw new Error('区间起点找不到（候选全部命中 ≠1 次）：' + froms.join(' ｜ '))
  let a = html.indexOf(from)
  const lineStart = html.lastIndexOf('\n', a) + 1
  if (/^[ \t]*$/.test(html.slice(lineStart, a))) a = lineStart
  const b = html.indexOf(to, a + from.length)
  if (b < 0) throw new Error('区间终点找不到：' + JSON.stringify(to.slice(0, 40)))
  return [a, b]
}
const replaceRegion = (froms, to, next, label) => {
  const [a, b] = region(froms, to)
  // 只拦"区间溢到了隔壁区块"。注意 Hero 区间**本来就包含自己的 </section>**
  // （它的收尾标签在区间内），所以 </section> 不算越界，真正该拦的是助手栏与顶栏。
  // ⚠️ 因此 **Hero 区间内部不要用 <header> 标签** —— 它是"区间往前吃到了顶栏"的信号，
  // 在区间内合法地用它会让守卫误判（实测：焦点卡标题用了 <header>，第二次跑就报越界）。
  // 卡片里的标题行用 <div> 即可，语义上也无损失。
  const bad = ['</aside>', '</header>'].filter((t) => html.slice(a, b).includes(t))
  if (bad.length) throw new Error(`${label} 区间跨越结构标签：${bad.join(' / ')}`)
  log.push(`${label}：${b - a} 字符 → ${next.length} 字符`)
  html = html.slice(0, a) + next + html.slice(b)
}

/* --- 6.1 顶栏：撤掉居中模块胶囊（已撤过就跳过） --- */
if (uses('<!-- 中：模块胶囊（绝对居中') === 1) {
  const navStart = at('          <!-- 中：模块胶囊（绝对居中')
  const navEnd = html.indexOf('</nav>', navStart) + '</nav>'.length
  const blockEnd = html.indexOf('</div>', navEnd) + '</div>'.length
  const lineStart = html.lastIndexOf('\n', navStart) + 1
  log.push(`顶栏：撤掉居中模块胶囊（${blockEnd - lineStart} 字符）`)
  html = html.slice(0, lineStart) + html.slice(blockEnd + 1)
}

/* --- 6.2 顶栏：撤掉汉堡兜底（它的目标是那个已被撤掉的导航，留着就是死按钮） --- */
if (uses('<!-- ≤860px 的导航兜底') === 1) {
  const h = at('            <!-- ≤860px 的导航兜底')
  const end = html.indexOf('</button>', h) + '</button>'.length
  if (!html.slice(h, end).includes('aria-label="打开导航"')) throw new Error('汉堡兜底块定位失败')
  const lineStart = html.lastIndexOf('\n', h) + 1
  log.push('顶栏：撤掉汉堡兜底')
  html = html.slice(0, lineStart) + html.slice(end + 1)
}

/* --- 6.3 顶栏：加面包屑 --- */
if (uses('data-breadcrumb-current') === 0) {
  const anchor = '              <small class="block text-10 font-semibold uppercase leading-none tracking-[.13em] text-ink-400">Personal OS</small>\n            </div>'
  const add = `\n\n            <!-- 面包屑：顶栏胶囊撤掉之后，它承接"我在哪一层"。
                 与旋转木马的分工：轮播说明"有哪些模块"（横向），面包屑说明"当前在哪"（纵向）。
                 ≤860px 时品牌文字会隐藏，面包屑留着 —— 那时更需要一个位置指示。 -->
            <span class="mx-0.5 h-[22px] w-px shrink-0 bg-line"></span>
            <nav class="flex min-w-0 items-center gap-1.5" aria-label="当前位置">
              <span class="shrink-0 text-12-5 font-semibold text-ink-700">工作台</span>
              <span class="shrink-0 text-12-5 text-ink-300" data-breadcrumb-sep hidden>/</span>
              <span class="truncate text-12-5 font-medium text-ink-500" data-breadcrumb-current hidden></span>
            </nav>`
  const i = html.indexOf(anchor)
  if (i < 0) throw new Error('品牌区块锚点找不到，无法插入面包屑')
  log.push('顶栏：新增面包屑（工作台 / 当前模块）')
  html = html.slice(0, i) + anchor + add + html.slice(i + anchor.length)
}

/* --- 6.4 Hero 中部：径向菜单 --- */
replaceRegion(
  ['<!-- 中部：业务域 3D 旋转木马 -->', '<!-- 中部：模块 3D 旋转木马 -->', '<!-- 中部：模块径向菜单 -->'],
  '<!-- ---------- 磁贴区',
  hero,
  'Hero 中部（径向菜单）',
)

/* --- 6.5 磁贴区：九个面板 ---
   ⚠️ 区间的**终点**是"磁贴容器收尾 + 磁贴区 section 收尾"这两行。
   2026-09-19 助手栏升为整页右栏之后，磁贴区只剩九个面板（原来它右侧还有 col-span-3 的
   助手栏，区间终点因此还含一个 grid 容器的 「</div>」）。移动助手栏 = 改这条锚点，
   忘了改的话 replaceRegion 会**抛错**（找不到终点），不会静默写坏。 */
replaceRegion(
  ['<div data-module-panel="home">', '<div data-domain-panel="life">'],
  '\n              </div>\n          </section>',
  panelsBlock,
  '磁贴区（九面板 · 45 块磁贴）',
)

/* --- 6.6 助手对话：九段 ---
   ⚠️ 区间的**终点**带着输入区那一行的开头（「class="rail__fade shrink-0 border-t ...」）。
   2026-09-19 深夜助手栏改成可缩回之后，输入区多了一个 「rail__fade」（收起时要淡出），
   这条锚点跟着改 —— 忘了改会抛错（找不到终点），不会静默写坏。 */
replaceRegion(
  ['<div data-module-panel="home" class="flex flex-col gap-4">', '<div data-domain-panel="life" class="flex flex-col gap-4">'],
  '\n                </div>\n\n                <div class="rail__fade shrink-0 border-t border-line',
  chatsBlock,
  '助手对话（九段）',
)

/* --- 6.7 空间编排样式块（id 随职责改名：3d → hero，候选集兼容旧名） --- */
{
  const [a, b] = region(['    <style id="lucky-y-tw-hero">', '    <style id="lucky-y-tw-3d">'], '</style>')
  const end = b + '</style>'.length
  log.push(`空间编排：${end - a} 字符 → ${HERO_CSS.length} 字符（径向菜单：双半径 + 中心放大 + 入场展开）`)
  html = html.slice(0, a) + HERO_CSS + html.slice(end)
}

/* --- 6.8 文档块 + 脚本（连同它前面那些过时的业务域注释一起换掉） --- */
{
  const [a, b] = region(
    [
      '    <!-- ============================================================================\n         派生口径 · 数据来源与对账',
      '    <!--\n      ============================================================================\n      派生口径',
    ],
    '</script>',
  )
  const end = b + '</script>'.length
  log.push(`文档块 + 脚本：${end - a} 字符 → ${DOC.length + SCRIPT.length} 字符`)
  html = html.slice(0, a) + DOC + '\n' + SCRIPT + html.slice(end)
}

/* --- 6.9 属性改名：域 → 模块（面板切换器现在装的是模块，不只是业务域） --- */
if (uses('data-domain-panel') > 0) {
  const n = uses('data-domain-panel')
  html = html.split('data-domain-panel').join('data-module-panel')
  log.push(`属性改名：data-domain-panel → data-module-panel（${n} 处）`)
}

/* --- 6.10 文件头注释与「派生口径」同步（已同步过就跳过） --- */
{
  const patches = [
    /* 放在链首：这条的 from 是**当前文件里的实际文本**，先命中，后面那些历次迭代的旧对
       就都不会再命中（它们保留着"如何一步步变成现在这样"的历史，别删）。 */
    /* 2026-09-19 深夜：助手栏可缩回之后，版式摘要补一句形态；顺带删掉下一行那半句
       重复的"＋ 右侧常驻助手栏"（上一行已经说过同一件事，是历史遗留）。 */
    [
      `        B：**无侧栏**。横向顶栏 + 左主列（Hero 色带 + 磁贴，自带滚动）+ 右侧**整页常驻**助手栏
           + 右侧常驻助手栏 —— 首屏是一屏看完的仪表盘，导航退到顶栏。`,
      `        B：**无侧栏**。横向顶栏 + 左主列（Hero 色带 + 磁贴，自带滚动）+ 右侧**整页常驻**助手栏
           （可缩回成一条 56px 的窄轨）—— 首屏是一屏看完的仪表盘，导航退到顶栏。`,
    ],
    /* 2026-09-19：新增「进入主页面」CTA（第七处联动点）+ 助手栏升为整页常驻右栏。
       助手栏**不算**联动点（容器跨模块常驻），但它让"五块磁贴"这个说法更过时了 ——
       顺手把枚举重写成"七处一起动"，并点明 CTA 是唯一一处只换内容不换显隐的。 */
    [
      `      **切换模块是整页重置**：指针方向、环上选中项、下方五块磁贴、助手的历史对话、
      中心名、顶栏面包屑，全部跟着当前模块走。`,
      `      **切换模块是整页重置，七处一起动**：指针方向、环上选中项、中心名、下方磁贴、
      助手的历史对话、右侧今日焦点、以及表盘下方那枚「进入主页面」的 CTA
      （文案 + 目标路由 + self 态）。少一处就会出现自相矛盾的状态 —— 所以每一处都配了
      机械断言。CTA 是**唯一一处"只换内容、不换显隐"**的联动点：藏了它 Hero 会时而矮
      52px —— "整页重置"不等于"重新排版"。
      （助手栏的**容器**不是联动点：它跨模块常驻，跟着换的只是它里面的对话。）`,
    ],
    [
      `      Hero 中部是**模块径向菜单**：当前模块放大成中心图标，其余 8 个等分在环上
           （45° 一格），点环上任意一个它就会飞到中心并切换下方内容。
      两版共用同一套令牌与材质，可以直接对比取舍。

      **切换模块是整页重置**：环上的当前项、下方五块磁贴、助手的历史对话、中心 hub 名、
      顶栏面包屑，全部跟着当前模块走。
      切换**只能手动**（点环上的图标 / ←→ 键）—— 没有指示点、没有自动播放：
      切换会把下方整套内容换掉，读到一半被自动换走是"被清空"而不是"被切换"，
      而悬停暂停治不了这个（用户没悬停的时候照样会被换掉）。
      顶栏的居中模块胶囊已撤：环本身就是模块入口，同一组名字在屏幕上出现两次、
      点哪个结论一样，就是冗余 —— 一份导航只留一处。`,
      `      Hero 中部是**模块径向菜单 · 指针版 + 能量层**：九个模块**全部**在环上
       （40° 一格铺满 360°、**角度固定不随当前项变化**），中心是**发光描边环 + 12 片花瓣罗盘**
       + 八芒星指针 + 当前模块名。三处分工、互不重复：
       环上强调色实底的瓦片＝我是谁、指针＝我在哪、中心名＝叫什么。
       **能量层**：光晕 / 选中项的脉冲环。
       **整块 Hero 的底色随当前模块变色**（生活绿 / 工作蓝 / 学习紫 / 其余品牌紫）——
       这条链只有一份变量（定义在 Hero 的 section 上，见 HERO_CSS）。
      两版共用同一套令牌与材质，可以直接对比取舍。

      **切换模块是整页重置**：指针方向、环上选中项、下方五块磁贴、助手的历史对话、
      中心名、顶栏面包屑，全部跟着当前模块走。
      切换**只能手动**（点环上任意一个图标 / ←→ 键）—— 没有指示点、没有自动播放：
      切换会把下方整套内容换掉，读到一半被自动换走是"被清空"而不是"被切换"，
      而悬停暂停治不了这个（用户没悬停的时候照样会被换掉）。
      顶栏的居中模块胶囊已撤：环本身就是模块入口，同一组名字在屏幕上出现两次、
      点哪个结论一样，就是冗余 —— 一份导航只留一处。`,
    ],
    [
      '           Hero 中部是**业务域 3D 旋转木马**：三张域卡沿弧线排布、轮换到正面。',
      `           Hero 中部是**模块 3D 旋转木马**：九张模块卡沿弧线排布，只有 正面/右/左
           三个槽位可见，第 4 张起停在与正面卡重叠的 parked 槽位（透明度 0）。`,
    ],
    [
      `      **切域是整页重置，不只是换一张卡**：旋转木马、下方五个磁贴、助手的历史对话，
      全部跟着当前域走。
      切换**只能手动**（点指示点 / 点两侧卡 / ←→ 键）—— 没有自动播放：
      切域会把下方整套内容换掉，读到一半被自动换走是"被清空"而不是"被切换"，
      而悬停暂停治不了这个（用户没悬停的时候照样会被换掉）。`,
      `      **切换模块是整页重置，不只是换一张卡**：旋转木马、下方五块磁贴、助手的历史对话、
      顶栏面包屑，全部跟着当前模块走。
      切换**只能手动**（点指示点 / 点两侧卡 / ←→ 键）—— 没有自动播放：
      切换会把下方整套内容换掉，读到一半被自动换走是"被清空"而不是"被切换"，
      而悬停暂停治不了这个（用户没悬停的时候照样会被换掉）。
      顶栏原来的居中模块胶囊已撤掉：九张模块卡本身就是模块入口，
      同一组名字在屏幕上出现两次、点哪个结论一样，就是冗余 —— 一份导航只留一处。`,
    ],
    [
      `      数据：数字全部由 src/data/projects.ts 的 8 个项目算出（见文末「派生口径」）。
      唯一一处演示数据是磁贴 1 里的 30 天序列，卡内已标注。`,
      `      内容：九张模块卡、九个面板（45 块磁贴）、九段助手对话全部由
      design/gen-modules.mjs 从 src/data/projects.ts 的 8 个项目派生后写入
      —— 手写 45 块磁贴的柱高必错。改完数据或卡片结构后重跑：node design/gen-modules.mjs
      （改类名则另外重跑 build-css.mjs）。`,
    ],
    [
      `      切换**只能手动**（点指示点 / 点两侧卡 / ←→ 键）—— 没有自动播放：
      切换会把下方整套内容换掉，读到一半被自动换走是"被清空"而不是"被切换"，`,
      `      切换**只能手动**（点左右两张卡 / ←→ 键）—— **指示点已按用户要求撤掉**：
      切换入口就是左右两张卡与键盘，位置由正面卡 + 面包屑表达（摘要行带 aria-live）。
      没有自动播放：切换会把下方整套内容换掉，读到一半被自动换走是"被清空"而不是"被切换"，`,
    ],
    [
      `                   顶栏的「工作台」已经说明了这是哪一页；当前业务域由旋转木马 + 指示点表达。`,
      `                   顶栏的面包屑已经说明了这是哪一页；当前模块由正面卡 + 面包屑表达。`,
    ],
    [
      `        B：**无侧栏**。横向顶栏（含居中模块胶囊）+ 全幅 Hero 色带 + 12 栅格磁贴`,
      `        B：**无侧栏**。横向顶栏（含面包屑）+ 全幅 Hero 色带 + 12 栅格磁贴`,
    ],
    /* 2026-09-19：助手栏升为**整页常驻右栏**，磁贴区因此不再是一个 12 栅格中的 9 列。
       上面那条把"12 栅格磁贴"写进了版式摘要，这里跟着改。 */
    [
      `        B：**无侧栏**。横向顶栏（含面包屑）+ 全幅 Hero 色带 + 12 栅格磁贴`,
      `        B：**无侧栏**。横向顶栏 + 左主列（Hero 色带 + 磁贴，自带滚动）+ 右侧**整页常驻**助手栏`,
    ],
    [
      `           Hero 中部是**模块 3D 旋转木马**：九张模块卡沿弧线排布，只有 正面/右/左
           三个槽位可见，第 4 张起停在与正面卡重叠的 parked 槽位（透明度 0）。`,
      `           Hero 中部是**模块径向菜单**：当前模块放大成中心图标，其余 8 个等分在环上
           （45° 一格），点环上任意一个它就会飞到中心并切换下方内容。`,
    ],
    [
      `      **切换模块是整页重置，不只是换一张卡**：旋转木马、下方五块磁贴、助手的历史对话、
      顶栏面包屑，全部跟着当前模块走。
      切换**只能手动**（点左右两张卡 / ←→ 键）—— **指示点已按用户要求撤掉**：
      切换入口就是左右两张卡与键盘，位置由正面卡 + 面包屑表达（摘要行带 aria-live）。
      没有自动播放：切换会把下方整套内容换掉，读到一半被自动换走是"被清空"而不是"被切换"，
      而悬停暂停治不了这个（用户没悬停的时候照样会被换掉）。
      顶栏原来的居中模块胶囊已撤掉：九张模块卡本身就是模块入口，
      同一组名字在屏幕上出现两次、点哪个结论一样，就是冗余 —— 一份导航只留一处。`,
      `      **切换模块是整页重置**：环上的当前项、下方五块磁贴、助手的历史对话、中心 hub 名、
      顶栏面包屑，全部跟着当前模块走。
      切换**只能手动**（点环上的图标 / ←→ 键）—— 没有指示点、没有自动播放：
      切换会把下方整套内容换掉，读到一半被自动换走是"被清空"而不是"被切换"，
      而悬停暂停治不了这个（用户没悬停的时候照样会被换掉）。
      顶栏的居中模块胶囊已撤：环本身就是模块入口，同一组名字在屏幕上出现两次、
      点哪个结论一样，就是冗余 —— 一份导航只留一处。`,
    ],
    [
      `        \`lucky-y-tw-3d\`   旋转木马的空间编排（原型专属，落地时随组件搬进 src）`,
      `        \`lucky-y-tw-hero\` 径向菜单的空间编排（原型专属，落地时随组件搬进 src）`,
    ],
    [
      `            <div class="relative mx-auto max-w-[1680px] px-7 pb-8 pt-10 max-[1024px]:px-5 max-[1024px]:pt-8">`,
      `            <div class="relative mx-auto max-w-[1680px] px-7 pb-8 pt-6 max-[1024px]:px-5 max-[1024px]:pt-5">`,
    ],
    /* ⚠️ 这类"只改一次"的补丁，**改值时必须同步更新 from**。
       曾经踩过：from 还写着 h-[356px]，而文件里早已是 h-[372px] —— 不命中就静默跳过，
       于是 class 没换成 hero-band，Hero 的底色带一直用着写死的品牌紫渐变，
       "整块 Hero 随模块变色"这条链在最后一环断掉（而所有探针都显示前面的环节正常）。

       高度用 inset-0 而不是写死的 h-[Npx]：底色带是绝对定位的兄弟节点，不参与布局，
       所以 inset-0 就等于"Hero 内容的高度"—— 而那个高度会随断点变
       （1440 档 372 / 900 档 368 / 600 档 336）。写死一个值就必须为每个断点再写一个，
       而且每次改环的几何都要重算一遍（这个数已经被迫同步过三次了）。 */
    [
      `              class="hero-band pointer-events-none absolute inset-x-0 top-0 h-[372px]"`,
      `              class="hero-band pointer-events-none absolute inset-0"`,
    ],
    [
      `          <section class="relative">`,
      `          <section class="relative" data-accent="home">`,
    ],
    [
      `               ⚠️ 高度是按 Hero 的**实际高度**定的（没有页头之后约 300px）：
               它必须刚好在 Hero 底部淡完，否则要么半路截断、要么渗到磁贴区。 -->`,
      `               ⚠️ 高度用 inset-0 跟随 Hero 的**实际高度**（随断点变：1440 档 372 / 900 档 368
               / 600 档 336）。它必须刚好在 Hero 底部淡完，否则要么半路截断、要么渗到磁贴区。
               写死高度就得为每个断点各写一个值，而且每次改环的几何都要重算 —— 已踩过三次。 -->`,
    ],
  ]
  for (const [from, to] of patches) {
    if (html.split(from).length - 1 !== 1) {
      // 已经改过（或文件头被手改）就静默跳过 —— 这一段是文档，不是结构
      continue
    }
    html = html.split(from).join(to)
    log.push('文件头注释：同步 1 处')
  }
}

/* --- 6.10b 助手栏抬头那行状态：数字同样从 P 派生 ---
   抬头是**静态标记**（不在生成器的任何区间里），所以这里用"每次覆盖内容"的方式写：
   幂等来自"每次都写同一个派生结果"，而不是来自"命中才替换"——
   于是它不可能出现"数据改了、页面上还是旧数字"那种静默漂移。 */
{
  const text = `已接入 ${P.length} 个项目 · ${TASKS.total} 条任务`
  const RE = /(data-rail-status>)[^<]*(<\/span>)/
  if (!RE.test(html)) throw new Error('找不到助手栏状态的挂点：data-rail-status')
  const before = html
  html = html.replace(RE, (m, a, b) => a + text + b)
  if (html !== before) log.push(`助手栏抬头状态 → ${text}`)
}

/* --- 6.11 结构自检 --- */
{
  const d = html.match(/<div/g) || []
  const dc = html.match(/<\/div>/g) || []
  if (d.length !== dc.length) throw new Error(`div 不平衡：<div> ${d.length} / </div> ${dc.length}`)
  for (const k of ['data-module-panel="home"', 'data-module-panel="settings"', 'aria-roledescription="环形菜单"', 'data-module-summary', 'data-breadcrumb-current', 'data-hub-name', 'data-hub-arc', 'hub-compass__petals', 'hub-compass__star', 'is-main', 'data-rail-wave', 'rail-avatar--sm', 'rail-round--send']) {
    if (!html.includes(k)) throw new Error(`合成结果缺内容：${k}`)
  }
  /* 助手栏那排声波**必须静止** —— 它只在切换模块时由脚本跳一拍（railWavePulse）。
     常驻栏里一直动的东西会一直抢注意力，而它并没有新消息要报告。
     这条只能靠断言守：给 .rail-wave i 补一条 animation 是"顺手就写了"的事，
     而后果（一条永远在跳的装饰）在截图里看不出是错的。 */
  if (/\.rail-wave[^{]*\{[^}]*animation/.test(html)) {
    throw new Error('助手栏声波必须静止：只在切换模块时由脚本跳一拍，不能写常驻 animation')
  }
  /* 头像要是「球」不是「标签」：球形来自那层**径向高光**。
     少了它就会退回"圆角方块 + 45° 线性渐变"——观感差别很大，但少写一层看不出来。 */
  if (!/\.rail-avatar\s*\{[^}]*radial-gradient/.test(html)) {
    throw new Error('助手栏头像必须带径向高光（参考图那颗"被光从左上照亮的球"）')
  }
  /* 输入栏是**胶囊**（两端各住一枚圆钮）—— 参考图的第三条几何规律。
     回退成圆角矩形不会报错，只会"看起来不那么像"。
     ⚠️ 断言里钉的是 「g2」（浮层面板档）而不是"有个玻璃类"：这条胶囊的档位是选出来的
     （Prism 把"复合控件容器 / 分段控件"归在 pa-3），退到 g1 不会报错，
     只会让它从"一条栏"变成"一个几乎看不见的件"。 */
  if (!/class="[^"]*rounded-full[^"]*border-line[^"]*g g2[^"]*"/.test(html)) {
    throw new Error('助手栏输入栏应是一条胶囊（rounded-full + g g2）')
  }
  /* 「今天」必须是对话面板的**第一个**子元素 —— 外层那条 flex-col-reverse 只推整块，
     推不动块内顺序（见 RAIL_DAY 的注释）。放到末尾不会报错，只会让起点线掉到对话下面，
     而"对话上面有一条起点线"和"下面有一条"在第一眼看上去都不算错。 */
  if (!html.includes('class="flex flex-col gap-4">\n' + RAIL_DAY)) {
    throw new Error('「今天」分隔线必须排在助手对话面板的第一个子元素位（否则会掉到对话末尾）')
  }
  /* 助手栏的收起 / 展开。这几条的共同点是"写错了不报错，只会看起来差一点"：
     ① 收起**只动宽度**（右锚点贴窗口不动）—— 动右锚点会让整条栏跳到窗口中间；
     ② 收起时**先淡出内容、再收窄** —— 顺序反了会看到文字逐帧重排
        （340 → 56 中间有十几帧，每帧换行位置都不同）；
     ③ 堆叠档下换成"塌成窄条"（整宽的块再往右收窄没有意义）；
     ④ 收起时要用 visibility 把内容**移出 Tab 序**，不能只压 opacity。 */
  if (!html.includes('data-rail-toggle')) {
    throw new Error('助手栏缺收起/展开的挂点：data-rail-toggle')
  }
  if (!/\.rail\[data-collapsed\]\s*\{[^}]*width:\s*var\(--rail-w-collapsed\)/.test(html)) {
    throw new Error('收起态只该动宽度（--rail-w-collapsed），右锚点不能动')
  }
  if (!/\.rail\[data-collapsed\]\s*\{[^}]*transition:[^;]*0\.12s/.test(html)) {
    throw new Error('收起态必须在内容淡出之后再收窄（宽度过渡要带 0.12s 延迟）')
  }
  if (!/\.rail\[data-collapsed\] \.rail__fade\s*\{[^}]*visibility:\s*hidden/.test(html)) {
    throw new Error('收起时要用 visibility 把内容移出 Tab 序，不能只压 opacity')
  }
  if (!/max-width: 1180px\)[\s\S]{0,500}?\.rail\[data-collapsed\][^}]*height:\s*56px/.test(html)) {
    throw new Error('堆叠档（≤1180px）下收起态应塌成一条窄条（height: 56px）')
  }
  // 细针已经撤掉（改由八芒星的主尖承担指向）—— 防止它被无意中加回来造成"两个指针"
  if (html.includes('data-hub-needle')) throw new Error('细针已撤掉，不该再有 data-hub-needle')
  // 主刻度层已按用户要求删除（见 HERO_CSS 的「刻度层：已删」）。它很不起眼，
  // 回来了只有截图能发现 —— 所以用机械守卫钉住。
  // ⚠️ 判据必须落在**刻度层自己的特征**上（「repeating-conic-gradient」），
  // 不能写成"hub-dial 上不许有伪元素"：现在 「.hub-dial::before」 合法地承担着
  // "hover 时那圈指向针方向的光边"（用的是一次性的 conic-gradient）——
  // 一刀切会把合法用法也拦掉，而且拦得毫无道理。**守卫要钉住缺陷，不是钉住位置。**
  if (/\.hub-dial::(after|before)[^{]*\{[^}]*repeating-conic-gradient/.test(html)) {
    throw new Error('主刻度层已删，不该再出现 hub-dial 上的 repeating-conic-gradient')
  }
  for (const stale of ['data-carousel-dot', 'class="face', 'class="stage"', 'data-slot=', 'id="lucky-y-tw-3d"']) {
    if (html.includes(stale)) throw new Error(`旧结构残留：${stale}`)
  }
  // 注释必须配对：多一个 「-->」 不会被解析成注释，而是**当成正文渲染出来**
  // （实测：多出的那个让 Hero 凭空高了 26px，页面上还印着一个"-->"）。
  const cOpen = (html.match(/<!--/g) || []).length
  const cClose = (html.match(/-->/g) || []).length
  if (cOpen !== cClose) throw new Error(`HTML 注释不配对：<!-- ${cOpen} 个 / --> ${cClose} 个`)
  if (html.includes('data-domain-panel')) throw new Error('还有 data-domain-panel 残留')
  // ⚠️ 自定义类名不能与 Tailwind 工具类同名：曾经类名叫 ring，扫描器就生成了 Tailwind 的
  // .ring 工具类（一圈 currentcolor 的 box-shadow），整个环容器被描出"黑框"，
  // 而且它走 box-shadow，查 border/outline 的探针发现不了。
  // 检查前先剥掉注释 —— 上面那条警告注释本身就写着 class="ring" 这个反例，
  // 不剥掉的话断言会自己触发自己（实测踩过一次）。
  const stripped = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  if (/class="ring["\s]/.test(stripped)) {
    throw new Error('类名 ring 与 Tailwind 的 ring 工具类撞名，会描出一圈 currentcolor 的阴影')
  }

  // 能量层的装饰件必须都在：少一个不会报错、也不会破版，
  // 只会"看起来不够酷" —— 这种退化最不容易被发现，所以用机械守卫钉住。
  for (const k of ['hub-aura', 'hub-ripple']) {
    if (!html.includes(k)) throw new Error(`能量层缺件：${k}`)
  }
  // 环绕盘绕线已按用户要求撤掉（嫌中心区花哨）；原轨道点也在那次改造里没了。
  // 三个都不许回来（越攒越多，它们就是"花哨"的历史记录）：
  //   hub-coil  环绕盘绕线 —— 1:1 下读不出"交错"（判据：可见 ≠ 可读）
  //   hub-orbit 点状轨道 —— 被九个瓦片挡住大半
  //   hub-sweep 扫描光束 —— 与"高亮 + 进度弧"语义重复
  for (const gone of ['hub-coil', 'hub-orbit', 'hub-sweep']) {
    if (html.includes(gone)) throw new Error(`已撤掉的装饰不该回来：${gone}`)
  }
  // 右侧「今日焦点」面板必须齐九个 —— 它是整页重置的第五处联动点，
  // 少一个不会报错，只会"切到某个模块时右栏空着"。
  const focusCount = (html.match(/data-focus-panel=/g) || []).length
  if (focusCount !== 9) throw new Error(`今日焦点面板应有 9 个，实际 ${focusCount}`)
  /* 「门」（表盘 + 中心名 = 进入当前模块主页面）的四条断言。
     它们守的都是"少一处不报错、只表现成功能消失或位置歪掉"那类退化。 */
  for (const k of ['data-enter-door', 'data-enter-clip', 'hub-name__go', 'hub-name__pad']) {
    if (!html.includes(k)) throw new Error(`门缺件：${k}`)
  }
  // 环上九项各带一份口径（「data-enter-self」 只有环上的项有）；
  // 「data-enter-path」 还会在**门自己**身上出现一次 —— 那是初始态，必须与脚本首帧渲染一致
  // （否则加载瞬间门会指向上一页的目标）。所以是 9 + 1 = 10 处。
  const ringEnter = (html.match(/data-enter-self="/g) || []).length
  const enterPathAll = (html.match(/data-enter-path="/g) || []).length
  if (ringEnter !== 9) throw new Error(`环上应各带一份进门口径，实际 ${ringEnter} 项`)
  if (enterPathAll !== ringEnter + 1) {
    throw new Error(`门的目标路由应为 ${ringEnter + 1} 处（环上九项 + 门自身初始态），实际 ${enterPathAll} 处`)
  }
  // 几何：「门的盒子 = 表盘那 82px」+ 「.hub-dial」 用 inset:0 填满它 —— 这两条一起保证了
  // "按钮中心 = 环心"，也就是搬进按钮时最容易改坏、而且**肉眼要量过才知道坏了**的那一处。
  // （中心名仍以盒子中心为原点偏移，所以它的绝对位置也一并跟着成立。）
  if (!/\.hub-door\s*\{[^}]*width:\s*var\(--dial\)/.test(html)) {
    throw new Error('门的盒子必须就是表盘那 82px（width: var(--dial)）')
  }
  if (!/\.hub-dial\s*\{[^}]*inset:\s*0;/.test(html)) {
    throw new Error('.hub-dial 必须改成 inset:0 填满门，否则中心对不上环心')
  }
  // 按钮的默认样式必须被抹掉：padding / border / line-height 任何一项留着都会把表盘顶偏。
  if (!/\.hub-door\s*\{[^}]*appearance:\s*none/.test(html)) {
    throw new Error('.hub-door 必须抹掉按钮默认样式（appearance/border/padding）')
  }
  // 中心名右侧那枚箭头必须**常驻**（不做成 hover 才出现）—— 否则静态画面里没有任何
  // "这里可以进去"的线索；而 self 态要把它连同等宽留白一起去掉（"没有箭头"= 没有出口）。
  // 这两条都是"看起来只是风格差异"的退化，只有断言能守。
  if (!/\.hub-door:disabled \.hub-name__pad/.test(html)) {
    throw new Error('self 态必须去掉箭头与它的等宽留白（否则名字会被顶偏）')
  }
  // 指针方向的光边必须由 --na 驱动，而它注册成了 <angle> —— 没注册就是"针滑、光跳"。
  if (!/\.hub-dial::before\s*\{[^}]*conic-gradient\(\s*from var\(--na/.test(html)) {
    throw new Error('表盘的 hover 光边必须由 --na 驱动（针与光要同一个过渡源）')
  }
  if (!html.includes('@property --na')) throw new Error('缺少 @property --na 注册')
  // --na 必须只写一次：八芒星的主尖消费它，写两处就会出现两处不同步。
  const naWrites = (html.match(/setProperty\('--na'/g) || []).length
  if (naWrites !== 1) throw new Error(`--na 的写入点应恰好 1 处，实际 ${naWrites} 处`)
  // 进度弧同理：只有一个写入点。
  const arcWrites = (html.match(/setProperty\('--arc'/g) || []).length
  if (arcWrites !== 1) throw new Error(`--arc 的写入点应恰好 1 处，实际 ${arcWrites} 处`)
  // 强调色必须注册成 <color>，否则切换模块时色调是"跳变"而不是渐变。
  if (!html.includes('@property --accent')) throw new Error('缺少 @property --accent 注册')
  // 强调色的**定义点**在 section 上（环、光晕、Hero 底色带都从它继承）。
  // 环上若再挂一份 data-accent，[data-accent] 的默认规则会在环上生效、把域色覆盖回品牌紫。
  if (!html.includes('data-accent="home"')) throw new Error('section 上缺 data-accent 初值')
  if (/id="module-ring"[^>]*data-accent/.test(html)) throw new Error('环上不该再挂 data-accent（会覆盖继承来的域色）')
  // ⚠️ 必须查「class="hero-band」这个完整前缀，不能只查类名本身：
 // CSS 里那条 .hero-band 规则也会让宽松的 includes 通过，于是"HTML 没换成 hero-band 类"
  // 这个失效会被自检放过去（实测踩过：底色带一直用着写死的品牌紫）。
  if (!html.includes('class="hero-band')) throw new Error('Hero 底色带缺 hero-band 类（强调色链就断在它这里）')

  /* ============================================================================
     Prism 迁移的守卫（2026-09-20）
     ----------------------------------------------------------------------------
     这一组的共同点还是"写错了不报错，只表现成不对劲"：
     · 旧材质类名残留 → 旧令牌整片失效，而且失效得很干净（背景变纯色，不报错）；
     · 档位类没有 「.g」 → 得到一个没有材质的空盒子（规范 §1 纪律 1 的原话）；
     · 九个入口没有各自的色 → "每个菜单域一种颜色"这件事**只靠截图能发现**；
     · 主题图标写死 [data-theme='dark'] → 暗色是缺省时图标反了，页面上没有任何线索。
     ========================================================================= */
  {
    /* ⚠️ 这一组只扫**标记**，不扫整份文件。
       理由很具体：`src/styles/index.css` 里有一块 `@supports not (backdrop-filter)`
       是纯 CSS（无条件产出），它的选择器列表里就有 「.glass-bar, .glass-panel, .glass-soft」；
       `@theme` 里还有 `--shadow-xs / --shadow-sm` 两个变量名。
       拿整份文件去查，守卫会**自己触发自己**（第一次跑就是这样报的 "glass-panel 残留"，
       而标记里其实一个都没有）。守卫扫错范围比没有守卫更糟 —— 它会逼人把守卫删掉。 */
    const markup = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')
    const stripComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    const mark = stripComments(markup)

    /* ① 旧材质类名一律不许再出现（新标记的词汇表就是 Prism 那一套） */
    for (const legacy of ['glass-panel', 'glass-bar', 'glass-soft', 'glass-life', 'bg-surface', 'bg-canvas', 'shadow-xs', 'shadow-sm', 'border-line-strong']) {
      if (mark.includes(legacy)) {
        throw new Error(`标记里还有旧材质类名：${legacy} —— 它引用的令牌已不在 Prism 这套里，会静默失效`)
      }
    }
    /* ② 「.g」 与档位必须同时出现：只写 g1~g4 会得到一个"有变量、没材质"的空盒子 */
    for (const m of mark.matchAll(/class="([^"]*)"/g)) {
      const cls = m[1].split(/\s+/)
      const tier = cls.find((c) => /^g[1-4]$/.test(c))
      if (tier && !cls.includes('g')) {
        throw new Error(`档位类 ${tier} 缺材质本体 .g（规范 §3 纪律 1：只写档位 = 没有材质的空盒子）`)
      }
    }
    /* ③ 九个入口各显其色：每枚瓦片都要带本模块的色槽（mod-tile），且 key 互不相同。
       这一条只有截图能发现 —— 少了一个域色，页面看起来仍然"正常"。 */
    const tiles = [...mark.matchAll(/class="radial__item[^"]*"/g)].map((m) => m[0])
    if (tiles.length !== 9) throw new Error(`环上应有 9 枚入口，实际 ${tiles.length}`)
    if (tiles.some((t) => !t.includes('mod-tile'))) {
      throw new Error('环上有入口没带 mod-tile —— 它就不会显示自己模块的颜色（"每个菜单域一种颜色"缺一个）')
    }
    const modKeys = [...mark.matchAll(/data-module="([a-z]+)"/g)].map((m) => m[1])
    const uniq = new Set(modKeys)
    if (modKeys.length !== 9 || uniq.size !== 9) {
      throw new Error(`data-module 应 9 个且互不相同，实际 ${modKeys.length} 个 / ${uniq.size} 种`)
    }
    /* ④ 色表必须为**两个属性空间**都给出选择器：data-series 管整页氛围、data-module 管每个入口。
       少一个空间 = 有一处不跟着变，而"哪一处没变"在截图里要靠对比两屏才发现。 */
    for (const key of uniq) {
      if (!html.includes(`[data-series="${key}"]`)) {
        throw new Error(`prism 色表缺 [data-series="${key}"] —— 切到该模块时整页氛围不会换色`)
      }
      if (!html.includes(`[data-module="${key}"]`)) {
        throw new Error(`prism 色表缺 [data-module="${key}"] —— 该入口不会有自己的颜色`)
      }
    }
    /* ⑤ 强调色链：--s / --brand-a 必须由 prism 提供，不能回落成写死的品牌色。
       （回落不会报错，只会让九个模块又变回同一个颜色 —— 正是本次要修的那件事。） */
    if (!/\[data-accent\]\s*\{[^}]*--accent:\s*rgb\(var\(--s\)\)/.test(html)) {
      throw new Error('Hero 的 --accent 必须写成 rgb(var(--s))：模块色槽是 RGB 三元组，不是 <color>')
    }
    /* ⚠️ 这条是上一条的"根因守卫"，比它更值钱：
       Prism 的模块色槽（--s / --s-<模块>）是 **RGB 三元组**，只能出现在 rgb() 里面。
       直接当 <color> 用不报错、不继承，而是静默落回 @property 的 initial-value ——
       九个模块于是同色，页面照常渲染，只有把两张截图并排看才发现。
       ⚠️ 有两种用法是**合法**的，不能一起拦掉（第一次写就把自己拦了，报 11 处全是误报）：
         ① rgb(var(--s) / α)        —— 三元组唯一被消费成颜色的方式
         ② --s: var(--s-dashboard)  —— 槽位之间的搬运，两边都是三元组
       所以判据是"这个 var 出现在什么位置"，而不是"它出现了"。 */
    {
      /* ⚠️ 先剥注释：上面这段说明文字里就写着「var(--s)」这个反例，
         不剥的话守卫会自己触发自己（同一个坑本仓库踩过一次，见类名 ring 那条）。 */
      const code = stripComments(html)
      const bad = []
      for (const m of code.matchAll(/(^|[^a-zA-Z0-9-])var\((--s(?:-[a-z]+)?)\)/g)) {
        const at = m.index + m[0].indexOf('var(')
        const before = code.slice(Math.max(0, at - 26), at)
        const asColor = /rgb\($/.test(before) || /color-mix\(in srgb,\s*$/.test(before)
        const slot = before.match(/--[a-z0-9-]*:\s*$/)
        // ⚠️ 取值时要去掉尾随空白：`--s: ` 与 `--s:` 是同一个声明，
        //    正则里带了 \s* 就会把空格一起捕获进来（第一次写就栽在这一个字符上）。
        const slotCopy = !!slot && /^--(s|m)[a-z0-9-]*:$/.test(slot[0].trim())
        if (!asColor && !slotCopy) bad.push(code.slice(Math.max(0, at - 44), at + 26).replace(/\s+/g, ' '))
      }
      if (bad.length) {
        throw new Error(`模块色槽是 RGB 三元组，当颜色用时必须包在 rgb(...) 里，共 ${bad.length} 处：\n    ` + bad.slice(0, 3).join('\n    '))
      }
      /* ⚠️ 另一条同源的坑：**变量名撞车**。
         原型原来用 --s 表示"瓦片缩放"，而 Prism 用 --s 表示"模块强调色（三元组）"。
         两者落在同一个元素上（环上瓦片既有 .radial__item 又有 [data-module]），
         后声明的赢 → --s 恒为 1 → rgb(var(--s) / 0.1) 非法被丢弃 → 瓦片底色退回中性玻璃。
         恶心的点在于：**图标仍然是彩色的**（那走 --brand-ink），
         所以九个入口"看起来都有颜色"，只有量像素才发现底色根本没变。 */
      if (/\.radial__item[^{]*\{[^}]*--s:/.test(code)) {
        throw new Error('瓦片不要再声明 --s（与 Prism 的模块强调色槽撞名，会把入口底色静默打回中性玻璃）')
      }
    }
    if (!/\[data-accent\]\s*\{[^}]*--accent-deep:\s*var\(--brand-a\)/.test(html)) {
      throw new Error('实底要用 --brand-a（白字可行的窄窗口），不能用强调色 --s')
    }
    /* ⑥ 选中态与 hover 同特异性（0,3,0），**靠源码顺序裁决** —— 顺序就是这条规则的全部保障。 */
    {
      const hoverAt = html.indexOf('.g.mod-tile:hover')
      const selAt = html.indexOf(".g.mod-tile[data-current='true']")
      if (hoverAt < 0 || selAt < 0) throw new Error('prism 缺入口瓦片的 hover / 选中态规则')
      if (selAt < hoverAt) {
        throw new Error('选中态必须排在 .g.mod-tile:hover 之后（同特异性时靠顺序裁决，反了就会被 hover 盖掉）')
      }
    }
    /* ⑦ 切换模块时整页底衬也要换色 —— ambient 在 #root 之外，继承不到 section 上的变量，
       必须由脚本写到 <html> 上。漏了不会报错，只会"Hero 换色了、背景没换"。 */
    if (!/setAttribute\('data-series'/.test(html)) {
      throw new Error('脚本必须把当前模块写到 <html> 的 data-series（否则整页底衬不换色）')
    }
  }

  /* 主题：两套数值 + 一个只切属性的开关。
     ⚠️ 暗色是**缺省**（「:root」）、亮色是覆盖（html[data-theme='light']），
     所以暗色图标的选择器必须写成 「:not([data-theme='light'])」 ——
     写成 「[data-theme='dark']」 时，"没有属性"这个状态会匹配不上，
     现象是"默认主题下图标反了"，而这是肉眼最容易忽略的一类错误。 */
  if (!html.includes('data-theme-toggle')) throw new Error('缺主题切换的挂点：data-theme-toggle')
  if (!/:root:not\(\[data-theme='light'\]\)\s+\.theme-toggle/.test(html)) {
    throw new Error('主题图标的选择器必须是 :root:not([data-theme=\'light\'])（暗色是缺省，不能写死 dark）')
  }
  for (const k of ['html[data-theme=\'light\']', '--g-panel-rgb', '--g-ctl-line', '--g-pa-4', '--g-oc-field']) {
    if (!html.includes(k)) throw new Error(`prism 令牌缺件：${k}`)
  }
  if (!html.includes('@derived:modules:start')) {
    throw new Error('prism.css 缺派生区标记 —— --brand-* / --m-a* 必须由 prism-derive-colors.mjs 反解写入')
  }

  log.push(`结构自检：div ${d.length}/${dc.length} 平衡 · 九面板齐 · 能量层两件齐 · 无旧属性残留 · Prism 九域色齐`)
}

if (!DRY) fs.writeFileSync(PAGE, html)
console.log(log.map((l) => '  · ' + l).join('\n'))
console.log(`\n${DRY ? '（--dry，未写文件）' : '✅ 已写入'} ${path.relative(process.cwd(), PAGE)} · ${html.length} 字符`)

/* ============================================================================
   7. 核算表：逐条对账，确认页面上的数字都是算出来的、不是编的
   ========================================================================= */
console.log(`
核算表
  项目 ${P.length} · 状态 待启动 ${planned.length}/进行中 ${active.length}/风险 ${risky.length}/已完成 ${completed.length}
  任务 ${TASKS.done}/${TASKS.total} = ${TASKS.rate}% · 待办 ${TASKS.todo}
  域均值 生活 ${DOM.life.avg}%/工作 ${DOM.work.avg}%/学习 ${DOM.learn.avg}% · 全域 ${GLOBAL_AVG}%
  域任务 生活 ${DOM.life.done}/${DOM.life.total} · 工作 ${DOM.work.done}/${DOM.work.total} · 学习 ${DOM.learn.done}/${DOM.learn.total}
  待到期 ${BY_DAYS.map((p) => p.days).join(' / ')} 天 · 按月 ${MONTHS.map((m) => m + '月 ' + monthCount[m]).join(' · ')}
  预算 ${BUDGET.map((p) => p.short + ' ¥' + p.budget.toLocaleString('en-US')).join(' · ')} = ¥${BUDGET_TOTAL.toLocaleString('en-US')}
  可见性 ${VIS.map(([v, n]) => v + ' ' + n).join(' · ')}
`)
