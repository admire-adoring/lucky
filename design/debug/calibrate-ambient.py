"""标定：新旧两版**环境底衬的彩度**差多少。

玻璃感 = 背后有可辨认的颜色（被模糊、被染色）。背后是一片灰白时，
再好的材质也只是"一块灰板" —— 所以"玻璃没了"最先要查的是**背景彩度**，不是材质参数。

两个指标都算出来，因为规范里的"浓度 28~32"没有说明单位：
  · OKLCH 彩度 ×100       —— 感知均匀的彩度
  · 通道极差（max−min）    —— 若规范的"浓度"是这一种，数值量级才对得上（旧版 ~15 / 目标 28~32）
"""
import sys
from PIL import Image, ImageStat
import math

def lin(c):
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def oklch_chroma(rgb):
    r, g, b = (lin(v) for v in rgb)
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return math.hypot(a, bb) * 100

def spread(rgb):
    return max(rgb) - min(rgb)

def patch(img, box):
    return img.crop(box).resize((1, 1), Image.BOX).getpixel((0, 0))[:3]

# 取样点：**没有卡片、没有内容**的底衬。用同一组坐标量两版，才可比。
BOXES = {
    '左侧窄边 (0..20, 300..700)': (0, 300, 20, 700),
    '内容列上沿空白 (300..800, 100..130)': (300, 100, 800, 130),
    '主列右内边距 (1075..1095, 500..700)': (1075, 500, 1095, 700),
}

for name, path in [('旧版 workbench-a-sidebar', '/tmp/cmp/old-a.png'),
                   ('新版 workbench (Prism)', '/tmp/prism-final/light-home.png')]:
    img = Image.open(path).convert('RGB')
    print(f'=== {name} ===  {img.size[0]}x{img.size[1]}')
    for label, box in BOXES.items():
        try:
            c = patch(img, box)
        except Exception:
            continue
        print(f'   {label:<38} RGB{str(c):<18} 彩度 {oklch_chroma(c):5.1f}  通道极差 {spread(c):5.1f}')
    print()
