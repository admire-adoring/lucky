/* ============================================================================
   知识库 · 双链图谱的笔记池
   ----------------------------------------------------------------------------
   事实源：`design/know/知识图谱.html`（2026-09-28）。数据是机器转写的（原文切片），
   不手抄 —— 手抄 31 条笔记的正文与出链，改一个错一个。

   双链只写在 `out` 里（有向：这一条链到谁）。反向链接、图谱、两类巡检、
      成熟度全部由它派生（见文件尾的 `buildNoteGraph`）—— 别在别处再存一份 `backlinks`，
      否则「图上连着、列表里没列」会当场自相矛盾，而且不报错。
   成熟度不新增字段（原型的判据）：同一条笔记会跨层，做成三个分区就违反"互斥"；
      判据是"有入链 ⇒ 生产层，没有 ⇒ 加工层"（还在收件箱的 5 条不进图谱）。
   ============================================================================ */

/** 一篇笔记。字段与原型逐字一致。 */
export interface KnowNote {
  id: string
  title: string
  /** 主题（细维）：与 `NOTE_TOPIC_GROUP` 一起决定它属于哪一组 */
  topic: string
  tags: string[]
  date: string
  /** 正文（这一份是笔记，不是"只存索引"的文档） */
  body: string
  /** 双链的出边（目标 id） */
  out: string[]
}

/** 三个粗组（粗维）。 */
export const NOTE_GROUPS = { tech: '技术', product: '产品与系统', life: '生活' } as Record<string, string>;

/** 主题 → 组。`groupOf` 的兜底是 `tech`。 */
export const NOTE_TOPIC_GROUP = {
        '前端工程化': 'tech', '构建工具': 'tech', '后端架构': 'tech', '数据库': 'tech',
        '个人系统': 'product', 'UI 设计': 'product',
        '养猫': 'life', '健身与饮食': 'life', '读书': 'life'
    } as Record<string, string>;

export const NOTES: KnowNote[] = [
  { id:'n01', title:'个人系统', topic:'个人系统', tags:['个人系统','架构'], date:'2026-09-22',
    body:'一个人的系统先要能长期跑：模块边界清楚、数据只有一处真相、每周有固定的整理动作。',
    out:['n02','n25','n07','n17'] },
  { id:'n02', title:'React 19 新特性整理', topic:'前端工程化', tags:['React','前端'], date:'2026-09-19',
    body:'ref 可直接作为 prop；Actions 让表单提交更简单；use() 能读 Promise 与 Context；useOptimistic 做乐观更新。',
    out:['n03','n25','n07'] },
  { id:'n03', title:'React 19 服务端组件', topic:'前端工程化', tags:['React','SSR'], date:'2026-08-02',
    body:'服务端组件把数据获取推到服务端，客户端只留交互。边界画在「需要状态的那一层」。',
    out:[] },
  { id:'n04', title:'Vite 构建优化记录', topic:'构建工具', tags:['Vite','构建'], date:'2026-09-18',
    body:'用 manualChunks 把 react / react-dom / router 单独拆包，首屏构建从 12s 降到 6s。',
    out:['n02'] },
  { id:'n05', title:'Vite 插件机制梳理', topic:'构建工具', tags:['Vite','插件'], date:'2026-08-27',
    body:'插件就是一组带 enforce 时机的钩子。改产物用 renderChunk，改配置用 config。',
    out:['n04'] },
  { id:'n06', title:'前端性能优化清单', topic:'前端工程化', tags:['性能','前端'], date:'2026-09-11',
    body:'关键渲染路径、懒加载、虚拟列表、Web Worker、Canvas 与 SVG 的取舍。先量再改。',
    out:['n03','n07','n10'] },
  { id:'n07', title:'组件边界与数据流', topic:'前端工程化', tags:['React','架构'], date:'2026-09-09',
    body:'边界按「谁会变」切，不按「谁长什么样」切。数据流只允许一个方向，例外写在注释里。',
    out:['n02','n08'] },
  { id:'n08', title:'TypeScript 类型体操笔记', topic:'前端工程化', tags:['TypeScript'], date:'2026-07-21',
    body:'映射类型 + 条件类型 + infer。类型是给未来的自己看的文档，不是炫技。',
    out:['n07'] },
  { id:'n09', title:'CSS 容器查询实践', topic:'前端工程化', tags:['CSS','布局'], date:'2026-08-14',
    body:'组件按容器宽度自适应，而不是按视口 —— 同一个卡片放进侧栏和正文都能站得住。',
    out:['n25'] },
  { id:'n10', title:'微前端拆分的代价', topic:'前端工程化', tags:['架构','前端'], date:'2026-07-30',
    body:'拆解决的是团队并行问题，不是技术问题。拆完要多付：路由、样式隔离、状态共享三份成本。',
    out:['n07','n05'] },
  { id:'n11', title:'流式渲染与首屏', topic:'前端工程化', tags:['SSR','性能'], date:'2026-08-19',
    body:'先把骨架流下去，再补数据块。首屏指标看的是「什么时候能用」，不是「什么时候全到」。',
    out:['n03','n06'] },
  { id:'n12', title:'灰度发布与回滚', topic:'后端架构', tags:['发布','稳定性'], date:'2026-09-05',
    body:'灰度按用户维度切，不按机器维度切 —— 否则同一个用户会在新旧逻辑间来回跳。',
    out:['n14','n13','n19'] },
  { id:'n13', title:'灰度流量染色', topic:'后端架构', tags:['发布','网关'], date:'2026-08-24',
    body:'入口打标，链路透传，出口按标路由。染色字段要和日志 trace id 绑在一起。',
    out:['n12'] },
  { id:'n14', title:'支付对账的三种口径', topic:'后端架构', tags:['支付','对账'], date:'2026-07-16',
    body:'渠道对账、内部账对账、业务对账，三种口径的时间窗和状态机都不一样，不能混用一套规则。',
    out:[] },
  { id:'n15', title:'幂等设计清单', topic:'后端架构', tags:['幂等','支付'], date:'2026-08-08',
    body:'唯一键、状态机前置校验、结果回放三段式。重试前先问「最坏重复一次会怎样」。',
    out:['n14','n21'] },
  { id:'n16', title:'消息队列削峰实践', topic:'后端架构', tags:['MQ','稳定性'], date:'2026-08-30',
    body:'削峰靠拉模式 + 限流，不靠堆消费者。积压要看「最老消息年龄」，不看条数。',
    out:['n14','n15'] },
  { id:'n17', title:'权限模型 RBAC 拆解', topic:'后端架构', tags:['权限','架构'], date:'2026-06-28',
    body:'用户、角色、资源、动作四张表。角色只做权限集合，不承载组织关系。',
    out:[] },
  { id:'n18', title:'多租户数据隔离方案', topic:'后端架构', tags:['权限','多租户'], date:'2026-07-09',
    body:'行级隔离最省，库级隔离最稳。选型看合规要求，不看当前数据量。',
    out:['n17'] },
  { id:'n19', title:'审计日志该记什么', topic:'后端架构', tags:['审计','合规'], date:'2026-08-05',
    body:'谁、什么时候、对什么、做了什么、结果如何。只记变更，不记查询；查询另行采样。',
    out:['n17','n14','n20'] },
  { id:'n20', title:'对账差错处理流程', topic:'后端架构', tags:['支付','对账'], date:'2026-07-24',
    body:'差错分四类：漏单、重复、金额不符、状态不同步。先定位口径，再做幂等重放。',
    out:['n14','n15','n16'] },
  { id:'n21', title:'缓存失效的三种策略', topic:'后端架构', tags:['缓存','性能'], date:'2026-08-16',
    body:'过期、主动失效、写时更新。三种混着用会出现「旧值回填」，必须配版本号。',
    out:['n15'] },
  { id:'n22', title:'组织架构与权限的映射', topic:'后端架构', tags:['权限','组织'], date:'2026-07-02',
    body:'组织变更是低频高影响事件：先把权限算出来冻结，再切组织，最后解冻。',
    out:['n17','n18'] },
  { id:'n23', title:'SQLite 全文索引选型', topic:'数据库', tags:['SQLite','检索'], date:'2026-06-11',
    body:'FTS5 够用到十万级；中文要自己配分词。上量之前先量一次写放大的代价。',
    out:[] },
  { id:'n24', title:'个人记账的账户结构', topic:'个人系统', tags:['记账','个人系统'], date:'2026-08-21',
    body:'账户分资产、负债、收入、支出四类，转账只在账户之间走，不进收支。',
    out:[] },
  { id:'n25', title:'弥散风格 UI 设计要点', topic:'UI 设计', tags:['设计','UI'], date:'2026-09-20',
    body:'低饱和色团 + 半透明卡片只适合做大面积背景；正文与文字层最终仍要落到纯色，否则对比度过不了。',
    out:['n02','n09','n01'] },
  { id:'n26', title:'养猫经验：疫苗与驱虫', topic:'养猫', tags:['宠物','养猫'], date:'2026-09-07',
    body:'幼猫三针疫苗、间隔 21 天；体内驱虫三个月一次，体外一个月一次；疫苗与驱虫不要同一天做。',
    out:[] },
  { id:'n27', title:'健身与饮食清单', topic:'健身与饮食', tags:['健身','饮食'], date:'2026-09-12',
    body:'一周三练，推拉腿分开；蛋白质按体重每公斤 1.6g 起。先固定时间，再谈强度。',
    out:[] },
  { id:'n28', title:'通勤时间怎么用', topic:'读书', tags:['读书','时间'], date:'2026-08-03',
    body:'通勤只适合输入不适合输出：听书、听播客；需要写的东西留到有桌子的时段。',
    out:[] }
];

/** 提到但没建链（这是「未链接提及」，不是双链 —— 别混进 `out`）。 */
export const NOTE_MENTIONS = {
  n06: [{ id:'n09', context:'提到「容器查询能减少重排」，但没建链' }],
  n19: [{ id:'n16', context:'提到「削峰队列也要留审计」，但没建链' }],
  n20: [{ id:'n13', context:'差错的幂等重放也可能复用灰度链路' }]
} as Record<string, { id: string; context: string }[]>;

/** 成熟度三档的文案（判据见文件头）。 */
export const NOTE_STAGE_TEXT = { record: '记录', process: '加工', produce: '生产' } as Record<string, string>;

/* ---------- 派生：出链 / 入链 / 巡检 / 成熟度 / 组 ----------
   全部由 `out` 算出来，不手挂第二份（原型那条判据：图上连着、列表里没列，会当场
      自相矛盾且不报错，所以只允许一个事实源）。 */
export const NOTE_BY_ID: Record<string, KnowNote> = {};
NOTES.forEach((n) => { NOTE_BY_ID[n.id] = n });

/** 出链（过滤掉指向不存在笔记的 id —— 池子里有一篇被删掉时不会画出一条悬空的边）。 */
export const NOTE_OUT: Record<string, string[]> = {};
/** 入链 / 反链。 */
export const NOTE_IN: Record<string, string[]> = {};
NOTES.forEach((n) => {
  NOTE_OUT[n.id] = (n.out || []).filter((t) => NOTE_BY_ID[t]);
  NOTE_IN[n.id] = [];
});
NOTES.forEach((n) => NOTE_OUT[n.id].forEach((t) => NOTE_IN[t].push(n.id)));

/** 成熟度：有入链 ⇒ 生产层，没有 ⇒ 加工层（原型 `stageOf`）。 */
export const noteStageOf = (id: string) => (NOTE_IN[id].length > 0 ? 'produce' : 'process');
/** 孤点：既不连出、也没被连到。 */
export const isNoteOrphan = (id: string) => NOTE_IN[id].length === 0 && NOTE_OUT[id].length === 0;
/** 黑洞：被 3 篇以上连到、自己一条都不出。 */
export const isNoteBlackhole = (id: string) => NOTE_IN[id].length >= 3 && NOTE_OUT[id].length === 0;
/** 组（粗维）：主题 → 组，认不出的落 `tech`（原型 `groupOf` 的兜底）。 */
export const noteGroupOf = (id: string) => NOTE_TOPIC_GROUP[NOTE_BY_ID[id]?.topic] || 'tech';
/** 双链表（去重后的一对一，供画边用）—— 双向各存一条 ⇒ 画之前按 min|max 去重，
    否则同一对节点上会画出两条重合的路径。 */
export const NOTE_LINKS: [string, string][] = [];
NOTES.forEach((n) => NOTE_OUT[n.id].forEach((t) => NOTE_LINKS.push([n.id, t])));
