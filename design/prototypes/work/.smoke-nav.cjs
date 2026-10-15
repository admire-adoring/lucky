/* 导航挂载后的交互冒烟测试（jsdom，无头）。
   用法：NODE_PATH=<node workspace>/node_modules node .smoke-nav.js */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('work_index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window, d = w.document;

// jsdom 里真实浏览器正常、这里会报错的两个补丁（别误判成代码 bug）
w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));
w.Element.prototype.animate = w.Element.prototype.animate || (() => ({ finished: Promise.resolve() }));
w.alert = () => {};

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  → ' + extra : '')); }
};
const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const ring = () => [...d.querySelectorAll('#moduleRing .radial__item')];
const rail = () => [...d.querySelectorAll('#moduleRail .rail__item')];
const path = () => d.getElementById('pagePath').textContent.trim();
const panels = () => [...d.querySelectorAll('.panel')];
const visiblePanel = () => panels().find(p => p.classList.contains('active'));

console.log('\n── 结构 ──');
ok('页签死组件已删干净', !d.querySelector('.tabs') && !d.querySelector('.tab'));
ok('顶栏 + 侧栏两件都在', !!d.querySelector('.topbar') && !!d.querySelector('.sidebar'));
ok('圆盘项数 = 12 个分区', ring().length === 12, 'ring=' + ring().length);
ok('面板数 = 12', panels().length === 12, 'panels=' + panels().length);
ok('默认选中 工作台',
   d.querySelector('.radial__item.active').dataset.key === 'dashboard' &&
   visiblePanel().dataset.panel === 'dashboard');
ok('一级选中项是「工作」',
   d.querySelector('.nav-p-item.active').dataset.module === 'work');

// 图标去重：iconSvg() 找不到名字会静默回退到 grid ⇒ N 个分区全变成同一个图形
const bodies = sel => [...d.querySelectorAll(sel)].map(s => s.innerHTML.trim());
const uniq = arr => new Set(arr).size === arr.length;
ok('圆盘图标互不相同', uniq(bodies('#moduleRing .radial__item svg')),
   '重了 ' + (bodies('#moduleRing .radial__item svg').length - new Set(bodies('#moduleRing .radial__item svg')).size) + ' 个');
ok('平铺列图标互不相同', uniq(bodies('#moduleRail .rail__item svg')));

console.log('\n── 二级：点非当前项只切内容 ──');
click(ring()[7]);                                  // 部署
ok('面板切到 deploy', visiblePanel().dataset.panel === 'deploy');
ok('面包屑 = 工作 / 部署', path().replace(/\s+/g, '') === '工作/部署', path());
ok('环没有下钻（项数仍是 12）', ring().length === 12);
ok('平铺列与圆盘同源（12 项）', rail().length === 12);

console.log('\n── 三级：点当前项才下钻 ──');
click(ring()[7]);                                  // 再点一次「部署」= 当前项
ok('下钻到 6 个子项', ring().length === 6, 'ring=' + ring().length);
ok('环加了 is-nested', d.getElementById('moduleRing').classList.contains('is-nested'));
ok('面包屑到三级', path().replace(/\s+/g, '') === '工作/部署/全部', path());

console.log('\n── 三级 = 同一面板内的真过滤 ──');
click(ring()[3]);                                  // 部署 → 配置
ok('面包屑跟踪子项', path().replace(/\s+/g, '') === '工作/部署/配置', path());
const hostRows = d.querySelectorAll('.panel[data-panel="deploy"] .doc-item');
const shown = [...hostRows].filter(r => !r.hidden);
ok('面板内容真的被过滤了（配置只剩 1 条）', shown.length === 1 && hostRows.length === 5,
   'shown=' + shown.length + ' / all=' + hostRows.length);
ok('过滤是 hidden、不是删行', hostRows.length === 5);

console.log('\n── 中心门返回二级 ──');
click(d.querySelector('[data-hub-door]'));
ok('回到二级（12 项）', ring().length === 12 && !d.getElementById('moduleRing').classList.contains('is-nested'));
const backRows = [...d.querySelectorAll('.panel[data-panel="deploy"] .doc-item')].filter(r => !r.hidden);
ok('返回后子视图复位（5 条全出）', backRows.length === 5, 'shown=' + backRows.length);

console.log('\n── 一级：非本模块不许进来 ──');
const beforeActive = d.querySelector('.nav-p-item.active').dataset.module;
const beforeRing = ring().map(b => b.dataset.key).join(',');
click(d.querySelector('.nav-p-item[data-module="learning"]'));
ok('active 没变', d.querySelector('.nav-p-item.active').dataset.module === beforeActive);
ok('圆盘没被重建', ring().map(b => b.dataset.key).join(',') === beforeRing);

console.log('\n── 超级菜单 ──');
const mega = d.getElementById('mega');
ok('mega 挂在 .topbar 上', mega.parentElement.classList.contains('topbar'));
click(d.querySelector('.nav-p-item[data-module="life"]'));
ok('二级项数 = 该模块 items 数', mega.querySelectorAll('.mega-item').length === 7,
   'n=' + mega.querySelectorAll('.mega-item').length);
ok('面板已展开', mega.classList.contains('is-open'));

console.log('\n── 命令面板 ──');
w.openCmd();
ok('面板打开', d.getElementById('cmdMask').classList.contains('open'));
ok('列出 12 个分区', d.querySelectorAll('#cmdList [data-goto]').length === 12);
click(d.querySelector('#cmdList [data-goto="9"]'));   // OKR
ok('直达分区', visiblePanel().dataset.panel === 'okr' && path().replace(/\s+/g, '') === '工作/OKR', path());
ok('点完自动关闭', !d.getElementById('cmdMask').classList.contains('open'));

console.log('\n── 折叠 / 主题 ──');
click(d.getElementById('collapseBtn'));
ok('侧栏折叠类都挂上了',
   d.getElementById('sidebar').classList.contains('collapsed') &&
   d.getElementById('app').classList.contains('sidebar-collapsed'));
click(d.getElementById('collapseBtn'));
const before = d.documentElement.classList.contains('dark');
click(d.getElementById('themeBtn'));
ok('主题可切', d.documentElement.classList.contains('dark') !== before);

console.log('\n── 原有功能没被碰坏 ──');
w.openModal && w.openModal('测试', '<b>x</b>');
click(d.querySelector('[data-panel="clients"] .client-card'));
ok('客户弹窗仍能打开', d.getElementById('modalMask').classList.contains('open'));
ok('弹窗标题带客户名', d.getElementById('modalTitle').textContent.includes('星辰科技'));
w.closeModal();
ok('弹窗能关', !d.getElementById('modalMask').classList.contains('open'));

click(ring()[1]);   // 任务 → 切到任务面板（任务不是当前项，只切内容）
ok('任务面板可见', visiblePanel().dataset.panel === 'tasks');
click(ring()[1]);   // 再点 = 下钻到任务子视图
ok('任务子视图 4 项', ring().length === 4, 'ring=' + ring().length);
click(ring()[3]);   // 已完成
const taskRows = [...d.querySelectorAll('.panel[data-panel="tasks"] .task-item')];
ok('任务按状态过滤（已完成 2 条）',
   taskRows.filter(r => !r.hidden).length === 2 && taskRows.length === 6,
   'shown=' + taskRows.filter(r => !r.hidden).length);

console.log('\n── 书架飞入 / 飞出（原有行为）──');
click(d.querySelector('.panel[data-panel="projects"] .book-flat'));
ok('点书后弹窗打开', d.getElementById('modalMask').classList.contains('open'));
ok('弹窗标题是那本书', d.getElementById('modalTitle').textContent.includes('支付系统重构'),
   d.getElementById('modalTitle').textContent);

console.log('\n结果（含书架）：' + pass + ' 通过 / ' + fail + ' 失败\n');
process.exit(fail ? 1 : 0);
