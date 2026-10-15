"""玻璃感的**唯一可信指标**：同一块玻璃**内外的高频能量差**（规范 §6 门禁③ 的"结构衰减"）。

原理（规范 §2.2 的警告 + §7③）：
    `blur` 只降方差、不改均值 —— 底衬里没有可辨认的结构时，模糊"无从感知"。
    所以"看得出玻璃"这件事可以完全量化为：
        σ(面板内的像素) / σ(紧邻面板外的像素)  应当明显 < 1
    比值越接近 1，越说明"糊了个寂寞"（面板内外一样清晰或一样糊），玻璃感就越弱。

顺带量"均值差 ΔL"（那是上一轮已经调好的东西），用来区分
"没有分离度"与"有分离度但看不出是玻璃"——这是两个不同的问题。
"""
import sys
from PIL import Image

def stats(img, box):
    px = list(img.crop(box).getdata())
    n = len(px)
    m = [sum(c[i] for c in px) / n for i in range(3)]
    var = sum((c[i] - m[i]) ** 2 for c in px for i in range(3)) / (n * 3)
    return m, var ** 0.5

def needle(img, box):
    """高频能量：与 3x3 均值的差的均方根（比原始 σ 更能反映"颗粒感"）"""
    x0, y0, x1, y1 = box
    crop = img.crop(box).convert('L')
    w, h = crop.size
    p = crop.load()
    acc = 0.0
    cnt = 0
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            s = 0
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    s += p[x + dx, y + dy]
            acc += (p[x, y] - s / 9) ** 2
            cnt += 1
    return (acc / max(cnt, 1)) ** 0.5

# 取样：一块**纯底衬** + 一块**面板内部**，两处都要避开文字
CASES = [
    ('旧版 A（玻璃感被认可的那版）', '/tmp/cmp/old-a.png', 'ambient', 'panel'),
    ('当前 Prism 落地版', '/tmp/prism-v3/light-home.png', 'ambient', 'panel'),
]

GEOMETRY = {
    # 旧版 A：左列没有卡片时的一段空白 = 底衬；「域三概览」卡内部 = 面板
    'ambient': (500, 140, 560, 200),
    'panel': (960, 460, 1020, 520),
}

for label, path, _, _ in CASES:
    img = Image.open(path).convert('RGB')
    print(f'=== {label} === {img.size[0]}x{img.size[1]}')
    a, va = stats(img, GEOMETRY['ambient'])
    na = needle(img, GEOMETRY['ambient'])
    p, vp = stats(img, GEOMETRY['panel'])
    np_ = needle(img, GEOMETRY['panel'])
    print(f'   底衬 (500,140)-(560,200)  均值 {[round(v) for v in a]}  σ {va:5.2f}  高频 {na:5.2f}')
    print(f'   面板 (960,460)-(1020,520) 均值 {[round(v) for v in p]}  σ {vp:5.2f}  高频 {np_:5.2f}')
    if na > 0.01:
        print(f'   → 结构衰减 = {100 * (1 - np_ / na):5.1f}%（规范 §6 门禁③ 要求 ≥60%）')
    else:
        print('   → 底衬几乎没有高频结构（高频≈0）: 模糊"无从感知"')
    print()
