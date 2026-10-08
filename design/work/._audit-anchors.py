#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""**锚点体检**（只读，不改任何文件）。

派生脚本（`.build-*.py`）做的是"从母页切壳 + 一串文本替换"。母页被改名 / 重做过之后，
那些**按行号**的段与**按旧文本**的锚点会失效 —— 而失效方式往往是**静默**的：

  · 按行号取的段（`rows(a, b)`）：行号漂了就取到别的内容。份内的事那几段有
    `assert must in chunk` 兜着；**壳的窄屏段那类"顺手多切一段"的没有** ⇒ 悄悄少切几行。
  · 按旧文本的锚点（`rep(D, '…', '…')`）：**最隐蔽的一类** —— 锚点看着像"结构"，
    其实带着**母页当前的数据**（`支付系统重构 · 2 台`）。数据一变（2 台 → 3 台），
    这一条就永远匹配不上，脚本直接 AssertionError 停在半路。

跑法：
  python3 ._audit-anchors.py .build-overview.py

它把脚本里所有 `rep()` / `swap()` 的**字面锚点**抽出来，逐个在目录里所有 `.html`
里找存在性；两边都找不到的就是失效点（带行号）。
⚠️ 有少数锚点是对**上一次替换的输出**做的（累进替换），那份会在这张表里显成"找不到"
   —— 逐个看一眼原文就能分辨。
"""
import ast
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
target = (HERE / (sys.argv[1] if len(sys.argv) > 1 else '.build-overview.py'))
src = target.read_text(encoding='utf-8')

pages = {}
for f in sorted(HERE.glob('*.html')):
    try:
        pages[f.name] = f.read_text(encoding='utf-8')
    except Exception:
        pass

tree = ast.parse(src)
miss = []
for node in ast.walk(tree):
    if not isinstance(node, ast.Call):
        continue
    fname = node.func.id if isinstance(node.func, ast.Name) else None
    if fname not in ('rep', 'swap'):
        continue
    args = node.args
    if len(args) < 2 or not (isinstance(args[1], ast.Constant) and isinstance(args[1].value, str)):
        continue
    anchor = args[1].value
    if len(anchor) < 8:
        continue
    hits = [n for n, body in pages.items() if anchor in body]
    if not hits:
        miss.append((node.lineno, fname, anchor))

print('%s：%d 条锚点在任何 .html 里都找不到' % (target.name, len(miss)))
for ln, fn, a in miss:
    print('  L%-5d %-5s %r' % (ln, fn, a[:96]))
if not miss:
    print('  （干净）')
