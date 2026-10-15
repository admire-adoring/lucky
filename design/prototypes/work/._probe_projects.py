#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""静态探针（不启浏览器、不截图）。

⚠️ 两条"假阳性"必须先在探针里挡掉，否则每轮都在看它们：
   ① **注释里也会出现类名 / 标签名**（本仓的注释爱举反例）⇒ 抽类名与数标签前先剥注释；
   ② `:root { --a: 1; --b: 2; }` 这种**同行多支**的令牌定义，行首正则抓不到。
"""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
F = HERE / '工作-项目-项目台账-index.html'
s = F.read_text(encoding='utf-8')
bad = []


def chk(cond, msg):
    print(('  ok  ' if cond else '  ✗   ') + msg)
    if not cond:
        bad.append(msg)


def strip_css_comments(t):
    return re.sub(r'/\*.*?\*/', '', t, flags=re.S)


def strip_html_comments(t):
    return re.sub(r'<!--.*?-->', '', t, flags=re.S)


def strip_js_comments(t):
    t = re.sub(r'/\*.*?\*/', '', t, flags=re.S)
    return re.sub(r'(?m)^\s*//.*$', '', t)


css = re.search(r'<style>(.*?)</style>', s, re.S).group(1)
js = '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', s, re.S))
body_raw = s[s.index('<div class="app"'):s.index('\n<script>')]
body = strip_html_comments(body_raw)

print('== ① CSS 大括号 ==')
chk(css.count('{') == css.count('}'), '大括号 %d / %d' % (css.count('{'), css.count('}')))

print('== ② 块注释配对（词法配对，不看总数）==')


def pair_comments(name, text):
    toks = [(m.start(), m.group()) for m in re.finditer(r'/\*|\*/', text)]
    stack, bad_tok = [], []
    for pos, tk in toks:
        if tk == '/*':
            stack.append(pos)
        elif stack:
            stack.pop()
        else:
            bad_tok.append(('多余的 */', pos))
    bad_tok += [('未闭合的 /*', p) for p in stack]
    for kind, pos in bad_tok:
        print('       %s 行 %d：%s …' % (kind, text[:pos].count('\n') + 1,
                                       text[pos:pos + 70].replace('\n', ' | ')))
    return not bad_tok


chk(pair_comments('CSS', css), 'CSS 注释词法配对')
chk(pair_comments('JS', js), 'JS 注释词法配对')

print('== ③ 令牌双向差集 ==')
used = set(re.findall(r'var\((--[a-z0-9-]+)', s))
defined = set(re.findall(r'(--[a-z0-9-]+)\s*:', s))
defined |= set(re.findall(r"setProperty\(\s*'(--[a-z0-9-]+)'", s))
skip = {'--a', '--i', '--r', '--icon', '--arcs', '--cols', '--na', '--dial'}
chk(not (used - defined - skip), '用了没定义：%s' % sorted(used - defined - skip))
chk(not (defined - used), '定义了没用：%s' % sorted(defined - used))

print('== ④ 标签开合 / div 深度（已剥注释）==')
depth, mn, at = 0, 0, 0
for i, line in enumerate(body.split('\n'), 1):
    depth += len(re.findall(r'<div\b', line)) - len(re.findall(r'</div>', line))
    if depth < mn:
        mn, at = depth, i
chk(depth == 0, 'div 深度终值 %d（最小 %d @ %d 行）' % (depth, mn, at))
trouble = []
for tag in ['section', 'main', 'aside', 'header', 'nav', 'details', 'button', 'span', 'a', 'p', 'h1', 'style', 'textarea']:
    o = len(re.findall(r'<%s[\s>]' % tag, body))
    c = len(re.findall(r'</%s>' % tag, body))
    if o != c:
        trouble.append('<%s> 开 %d 合 %d' % (tag, o, c))
chk(not trouble, '块级标签配平：%s' % (trouble or 'ok'))

print('== ⑤ 类名双向差集（已剥注释）==')
markup = set()
for m in re.findall(r'class="([^"]*)"', body):
    markup |= set(m.split())
js_cls = set()       # 窄：真正会被挂到 DOM 上的类（class=" / classList / className）
for m in re.findall(r'class=\\?["\']([^"\'\\$]*)', js):
    js_cls |= set(m.split())
for m in re.findall(r"classList\.(?:add|remove|toggle)\('([\w-]+)'", js):
    js_cls.add(m)
for m in re.findall(r"className\s*=\s*'([^']*)'", js):
    js_cls |= set(m.split())
js_all = set(js_cls)   # 宽：再加上三元 / 模板串里拼出来的（`? 'btn-danger' : ...`）
for m in re.findall(r"'([^'\\\n]*)'", js):
    js_all |= {w for w in m.split() if re.fullmatch(r'[a-z][\w-]*', w)}
markup = set()
for m in re.findall(r'class="([^"]*)"', body):
    markup |= set(m.split())
inall_narrow = markup | js_cls          # 用于"标记有、CSS 没有"
inall_wide = markup | js_all            # 用于"CSS 有、标记没有"（宽一点，少报假孤儿）
css_cls = set(re.findall(r'\.([a-zA-Z][\w-]*)(?![\w-])', strip_css_comments(css)))
orphan_css = sorted(c for c in css_cls - inall_wide if c not in {'dark'})
orphan_mk = sorted(c for c in inall_narrow - css_cls if c not in {'app', 'detail'})
chk(not orphan_css, 'CSS 有、标记没有：%s' % orphan_css)
chk(not orphan_mk, '标记有、CSS 没有：%s' % orphan_mk)

print('== ⑥ 标记区 id 不重复 ==')
ids = re.findall(r'\sid="([^"]+)"', body)
dup = sorted({i for i in ids if ids.count(i) > 1})
chk(not dup, '重复 id：%s' % dup)

print('== ⑦ getElementById / querySelector 的 id 都存在 ==')
used_ids = set(re.findall(r"getElementById\('([^']+)'\)", js))
chk(not (used_ids - set(ids)), '脚本取了不存在的 id：%s' % sorted(used_ids - set(ids)))

print('== ⑧ 内联 handler 都有定义 ==')
names = set()
for c in re.findall(r'on(?:click|input|change|keydown|submit)="([^"]*)"', body):
    names |= set(re.findall(r'([A-Za-z_$][\w$]*)\s*\(', c))
white = {'if', 'event', 'alert', 'console', 'return', 'String', 'Number', 'location',
         'window', 'document', 'localStorage', 'setTimeout', 'confirm', 'this', 'stopPropagation'}
undef = [n for n in sorted(names)
         if n not in white and not re.search(r'(function\s+|\b(?:const|let|var)\s+)' + re.escape(n) + r'\b', js)]
chk(not undef, '内联 handler 指向未定义的函数：%s' % undef)

print('== ⑨ 圆盘分区图标互不相同 ==')
seg = re.search(r'const PROJECTS = \[(.*?)\n    \];', js, re.S)
chk(bool(seg), '找得到 PROJECTS 定义')
if seg:
    icons = re.findall(r"icon: '([a-z]+)'", seg.group(1))
    chk(len(set(icons)) == len(icons) and len(icons) == 4,
        '圆盘图标来自 PROJECTS（SECTIONS 现算）—— %d 个：%s' % (len(icons), icons))

print('== ⑩ JS 声明没被块注释吞掉 ==')
for fn in ['function syncCounts()', 'function openProject(', 'function cardKey(', 'function newProject(',
           'function focusProject(', 'function focusLate(', 'function renderAll()', 'const sectionEl =',
           'function activatePanel(', 'function renderRing(', 'function spy()', 'function openConfirm(',
           'function toast(', 'function renderCmdList()', 'function sectionCount(']:
    if fn not in js:
        chk(False, 'JS 里找不到 %s' % fn)
        break
else:
    print('  ok   15 个关键函数都在')

print('== ⑪ 与静态标记对齐（4 张项目卡 / 4 个分区）==')
cards = re.findall(r'data-project="([a-z]+)"', body)
chk(len(cards) == len(set(cards)), '项目 slug 重复：%s' % [r for r in cards if cards.count(r) > 1][:5])
chk(len(cards) == 4, '项目卡 %d 张（应为 3 进行中 + 1 归档 = 4）' % len(cards))
for k in ['dash', 'pay', 'uc', 'perf']:
    chk(('data-section="%s"' % k) in body, '缺分区 %s' % k)
chk(body.count('class="pj-card') == 4, 'pj-card 应该是 4 个，实际 %d' % body.count('class="pj-card'))
chk('is-off' in body and '已归档' in body, '归档那张卡的降级形态丢了')

print()
print('总计 %d 条不合格' % len(bad))
sys.exit(1 if bad else 0)
