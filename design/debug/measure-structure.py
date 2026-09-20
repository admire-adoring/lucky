"""量化「底衬有没有可供玻璃显示的结构」。

判据：把整图降采样成粗网格（大尺度），再算两个量
  · 格间标准差 σ_cell  —— 大尺度**颜色变化**（色块/色带有没有）
  · 格间彩度极差 range —— 颜色的**跨度**（是不是同一片色）
玻璃能吃到的"结构"就是这两个：σ_cell 大 → 卡下有色块边缘；range 大 → 透过率再低也认得出。
⚠️ 不测高频（颗粒）：颗粒是"质地"，上面这两个才是"看得见的东西"。
"""
import sys, colorsys
from PIL import Image, ImageStat

def grid_of(path, n=8, m=6):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    cells = []
    for j in range(m):
        row = []
        for i in range(n):
            box = (i * w // n, j * h // m, (i + 1) * w // n, (j + 1) * h // m)
            row.append(im.crop(box).resize((1, 1), Image.BOX).getpixel((0, 0))[:3])
        cells.append(row)
    return cells

def stats(cells):
    flat = [c for row in cells for c in row]
    means = [sum(c[k] for c in flat) / len(flat) for k in range(3)]
    var = [sum((c[k] - means[k]) ** 2 for c in flat) / len(flat) for k in range(3)]
    sd = [v ** 0.5 for v in var]
    sats = [colorsys.rgb_to_hsv(*[v / 255 for v in c])[1] for c in flat]
    lums = [0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] for c in flat]
    return sd, max(sats) - min(sats), max(lums) - min(lums), max(sats)

def show(name, path):
    cells = grid_of(path)
    sd, sat_range, lum_range, sat_max = stats(cells)
    print(f'--- {name} ---')
    print(f'  格间标准差(大尺度)  R {sd[0]:6.2f}  G {sd[1]:6.2f}  B {sd[2]:6.2f}')
    print(f'  彩度极差 {sat_range:.3f} · 最大彩度 {sat_max:.3f} · 亮度极差 {lum_range:5.1f} / 255')
    print('  粗网格色图（每格 = 1/8 × 1/6 屏）:')
    for row in cells:
        print('    ' + ' '.join(f'{c[0]:3d},{c[1]:3d},{c[2]:3d}' for c in row))
    print()

for name, path in [(a.split('=')[0], a.split('=')[1]) for a in sys.argv[1:]]:
    show(name, path)
