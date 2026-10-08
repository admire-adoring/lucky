import type { ReactNode } from 'react'

/* ============================================================================
   运维这一族的唯一一张图标表
   ----------------------------------------------------------------------------
   来源：原型 `工作-项目-项目详情-运维-index.html` 的 `ICON` 表（2026-09-27 收敛），
   与 `工作-项目-项目详情-运维-添加服务器.html` 的 `ICON` 表是同一张 ——
   原型自己在注释里写了「与「添加服务器」页同一套」，所以应用里也只留一份：
   两个页面各自抄一遍的那版已经删掉（同一份路径抄两遍，改一处必漏另一处，
   两个页面上同一个「编辑」图形迟早不一样）。

   不复用 `IconSprite`（应用公共资产）：这一族要的 server / rocket / plug /
      clipboard / window / undo / chevR 等在里面找不到对应形状；也不与日志页那套
      16 网格混用 —— 三页各自的网格是各自的（判据见 `LogViewerPage` 段首）。

   消费方三处，都是"同一个项目详情"里的：运维分区的全部图标、分区 Tab 行的 7 枚、
     以及添加服务器那张表单（它原来自带一份逐条同形的 `AS_ICON`，已并进来）。

   描边宽度由调用方给：运维页原型写的是 `stroke-width="2"`（13~16px 上更清楚），
      添加服务器页原型写的是 `1.6`。这不是随口定的数，所以不合并成一个默认值 ——
      合并了必然有一页的线重变了。
   ============================================================================ */

export const OPS_ICON: Record<string, ReactNode> = {
  /* —— 导航 / 分区（原型 24 网格表里的那一组） —— */
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  task: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  doc: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 3c3.5 1.5 5.5 4.6 5.5 8.2L12 21l-5.5-9.8C6.5 7.6 8.5 4.5 12 3z" />
      <circle cx="12" cy="10" r="1.6" />
    </>
  ),
  /** 「Bug」分区（Tab 行）：一只带腿的圆虫 + 两条触角 */
  bug: (
    <>
      <circle cx="12" cy="13" r="6" />
      <path d="M12 7V4M8 8 6 6M16 8l2-2M6 13H3M21 13h-3M8 18l-2 2M16 18l2 2" />
    </>
  ),
  /** 「会议」分区（Tab 行） */
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8-8" />
      <path d="m16 7 3 3" />
    </>
  ),
  /* —— 账户页带进来的三枚（2026-09-27）——
     `lock` = 凭据类型「密码」（能回显），`key` = 「密钥」（不回显）；
     `ban` = 行尾「停用」，`search` = 筛选框。图形取原型那张表的原值。 */
  lock: (
    <>
      <rect x="4.6" y="10.4" width="14.8" height="10.2" rx="2.4" />
      <path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8" />
      <path d="M12 14.6v2.4" />
    </>
  ),
  /* —— 工作台带进来的两枚（2026-09-28）——
     `star` = 收藏（实心 = 已收藏，靠 `fill` 由 CSS 给）、`expand` = 卡头那颗「放大」。 */
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  expand: (
    <>
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="m6.1 17.9 11.8-11.8" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7.2" />
      <path d="m16.3 16.3 4.3 4.3" />
    </>
  ),

  /* —— 实体 —— */
  /* —— 服务器台账带进来的四枚（2026-09-29）——
     这一页的机器清单横跨所有项目 ⇒ 它的组头要按项目换图形（`.card-icon`），
     卡面上还要按角色换一枚（Web 层 / 数据库）。四枚的图形取原型 `ICON` 表原值。 */
  database: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" />
    </>
  ),
  project: (
    <>
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 12l9 4 9-4" />
      <path d="M3 17l9 4 9-4" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3.6" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  graph: (
    <>
      <circle cx="6" cy="6" r="2.6" />
      <circle cx="18" cy="6" r="2.6" />
      <circle cx="12" cy="18" r="2.6" />
      <path d="M8.2 7.3 10.4 16M15.8 7.3 13.6 16M8.6 6h6.8" />
    </>
  ),
  server: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19h15" />
    </>
  ),
  tag: (
    <>
      <path d="M20.6 13.4 13 21l-9-9V4h8z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  file: (
    <>
      <path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z" />
      <path d="M13.5 3v5.5H19" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5.5" y="4.5" width="13" height="16" rx="2" />
      <path d="M9.5 4.5V3.4A1.4 1.4 0 0 1 10.9 2h2.2a1.4 1.4 0 0 1 1.4 1.4v1.1z" />
      <path d="M9.5 10.5h5M9.5 14.5h5" />
    </>
  ),
  window: (
    <>
      <rect x="2.6" y="4.6" width="18.8" height="14.8" rx="2.6" />
      <path d="m7 10 3 2.9-3 3" />
      <path d="M13.4 15.9h3.6" />
    </>
  ),
  terminal: (
    <>
      <path d="m5 8 4 4-4 4" />
      <path d="M12 16h7" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
    </>
  ),

  /* —— 动作 —— */
  alert: (
    <>
      <path d="M12 4.5 21 20H3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.6h.01" />
    </>
  ),
  check: <path d="m4 12.5 5 5L20 6.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v4h-4" />
    </>
  ),
  undo: (
    <>
      <path d="M9 7H4.5V2.5" />
      <path d="M4.9 7.2A8 8 0 1 1 4 13.5" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  chevD: <path d="m6 9.5 6 6 6-6" />,
  /** 与 `chevD` / `chevR` 配成一对的第三个方向（原型 `chevL`，服务器详情页的「返回」用） */
  chevL: <path d="m14.5 6-6 6 6 6" />,
  chevR: <path d="m9.5 6 6 6-6 6" />,
  external: (
    <>
      <path d="M14.5 4H20v5.5" />
      <path d="M20 4l-8.5 8.5" />
      <path d="M18 14v5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6h5" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M5 19.5h14" />
    </>
  ),
  more: (
    <>
      <circle cx="5.6" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18.4" cy="12" r="1.4" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9.5" width="11" height="11" rx="2" />
      <path d="M15 9.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3.5" />
    </>
  ),
  edit: (
    <>
      <path d="M17.4 3.9l2.7 2.7-11.3 11.3-3.7 1 .9-3.7z" />
      <path d="M15.6 5.7l2.7 2.7" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6.5V4.6a1.1 1.1 0 0 1 1.1-1.1h2.8a1.1 1.1 0 0 1 1.1 1.1v1.9" />
      <path d="M6.9 6.5l.9 12.1a1.1 1.1 0 0 0 1.1 1h6.2a1.1 1.1 0 0 0 1.1-1l.9-12.1" />
    </>
  ),

  /**
   * `plug` —— 页面级仪表「已连接」那一格。
   * 它不是名称行上那个连接开关的形状：开关是「圆点 + 文字」的状态胶囊，
   *    文字本身就在变（未连接 / 已连接），用不到"插头对插头"的两个形状。
   */
  plug: (
    <>
      <path d="M9.5 3v4.6M14.5 3v4.6" />
      <path d="M6.7 7.6h10.6v4.5a5.3 5.3 0 0 1-10.6 0z" />
      <path d="M12 17.4V21" />
    </>
  ),

  /* —— 添加服务器那张表单自己用的（原 `AS_ICON`） —— */
  back: (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5.5c0 4.2-2.9 7.6-7 9.5-4.1-1.9-7-5.3-7-9.5V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4 4l16 16" />
      <path d="M9.9 5.9A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.1 4M6.4 8.1A16.9 16.9 0 0 0 2.5 12S6 18.5 12 18.5c1.1 0 2.1-.2 3-.6" />
    </>
  ),

  /* —— 项目 Hero 的「⋯」菜单（原型本页那版：项目详情页用的是 emoji，这一页是一套图标制） —— */
  arrowLeft: (
    <>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4.5" width="18" height="4" rx="1.2" />
      <path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5" />
      <path d="M10 12.5h4" />
    </>
  ),
  pause: (
    <>
      <rect x="7" y="4.5" width="3.6" height="15" rx="1.2" />
      <rect x="13.4" y="4.5" width="3.6" height="15" rx="1.2" />
    </>
  ),
}

export type OpsIconName = keyof typeof OPS_ICON

/**
 * 24 网格、`stroke=currentColor`、尺寸走行内属性（原型是 `data-ico-size`）。
 *
 * 容器必须有显式的 color：`<button>` 不吃继承，不给色就拿到浏览器默认色
 *    （原型那段注释里第一条硬约束就是这个）。
 */
export function OpsIcon({
  name,
  size = 16,
  strokeWidth = 2,
}: {
  name: OpsIconName
  size?: number
  strokeWidth?: number
}) {
  return (
    <svg
      className="ico-svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {OPS_ICON[name]}
    </svg>
  )
}
