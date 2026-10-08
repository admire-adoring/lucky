/**
 * 机器「连上了没」——全站唯一一份。
 *
 * 原型把这件事写在 `localStorage` 的 `ops-term:<机器>` 上，好让终端窗口用 `storage`
 * 事件同步回页面。应用里终端页的连接是它自己的页面状态，没有可共享的通道
 * ⇒ 退成模块级集合：切分区 / 换页再回来还在，刷新回到初值（SSH 是这次会话里按下去的）。
 *
 * 为什么必须是"一份"、不能每页各持一份：同一台机器在运维分区（`OpsPanel`）与
 *    服务器台账（`ServersLedger`）上各有一枚 `.conn` 徽标。两页各写一个模块级 Set
 *    的话，在 A 页连上、切到 B 页会显示「未连接」—— 而原型在那两页的注释里各写了一遍
 *    「键口径必须是同一个（`ops-term:<机器>`）：同一台机器在两个页面上不该有两种状态」。
 *    这里把那句话落成同一个模块（storage 那半条通道仍然不做，见上）。
 *
 * 只存状态、不叫重渲：调用方各自持一个计数器（`useReducer((n) => n + 1, 0)`）。
 *    两页是两条路由，不会同时挂载，所以不需要订阅机制。
 */
const CONNECTED = new Set<string>()

export function isConnected(host: string): boolean {
  return CONNECTED.has(host)
}

export function markConnected(host: string, on: boolean): void {
  if (on) CONNECTED.add(host)
  else CONNECTED.delete(host)
}
