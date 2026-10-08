import { useNavigate, useParams } from 'react-router-dom'
import { ServerDetail } from '../../components/workspace/work/ServerDetail'
import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import { tabPath } from '../../data/workspace/shell-nav'
import { TABS } from './work/panels'

/* ============================================================================
   工作模块内的服务器详情 —— `/work/servers/:host`
   ----------------------------------------------------------------------------
   台账页（`/work/servers`）那张卡片浮层底部的「详情」出口点进来的一页：一台机器的全部。
   它是「服务器」这一项的下钻视图，与 `/work/projects/:id` 对「项目」那一项是同一形态。

   这一页不占工作模块的分区表：`TABS` 里没有、也不该有第八项 —— 环上的高亮
      停在「服务器」上（`active="servers"`），地址落在 `/work/servers/` 这一段下面。
   与 `/work/:tab` 不冲突：那一条是两段（`/work/servers` 落进去、给卡片墙），
      这一条是三段。React Router 按特异性排序，段数不同本来也不会互相抢。
   环上的点击要自己算地址（`tabPath`），不能写成 `navigate(\`/work/${key}\`)`：
      "首个分区用裸路径"那条约定是 `useModuleTab` 定的，两处算法不一致会出现
      "点了工作台、地址变了、高亮还停在别处"。
   ============================================================================ */

export function WorkServerDetailPage() {
  const { host } = useParams<{ host: string }>()
  const navigate = useNavigate()

  const selectWorkTab = (key: string) => {
    const index = TABS.findIndex((tab) => tab.key === key)
    navigate(tabPath('work', key, index === 0))
  }

  return (
    /* `topbarTitle` 给机器名：侧栏头部与文档标题都会显示它，比显示「服务器」这一格更有信息量
       （原型也是 `document.title = host + ' · 服务器 · 工作'`）。环上的高亮仍由
       `active="servers"` 决定，两者互不影响。 */
    <WorkspaceLayout
      module="work"
      tabs={TABS}
      active="servers"
      onSelectTab={selectWorkTab}
      topbarTitle={host}
    >
      {/* 加载 / 找不到两态在正文里（那时页面根已经渲染、Hero 空的反而更难看） */}
      <ServerDetail host={host ?? ''} />
    </WorkspaceLayout>
  )
}
