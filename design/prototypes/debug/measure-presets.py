"""三档玻璃预设 × 两主题：逐档实测"分离度 / 文字对比 / 结构衰减"。

为什么要逐档测：档位是"选点"，很容易只调好一档、另一档悄悄掉出判据
（α 一降 ΔL 就掉，这是耦合不是巧合）。三档必须**都**过门禁，用户才敢任选一档。
"""
import sys, os, math
from PIL import Image

def lin(c):
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def rel_lum(rgb):
    r, g, b = (lin(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast(a, b):
    la, lb = rel_lum(a), rel_lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

def patch(img, box):
    return img.crop(box).resize((1, 1), Image.BOX).getpixel((0, 0))[:3]

def needle(img, box):
    crop = img.crop(box).convert('L')
    w, h = crop.size
    p = crop.load()
    acc, cnt = 0.0, 0
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            s = sum(p[x + dx, y + dy] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
            acc += (p[x, y] - s / 9) ** 2
            cnt += 1
    return (acc / max(cnt, 1)) ** 0.5

AMBIENT = (8, 500, 20, 700)
PANEL = (430, 850, 470, 880)
DIR = sys.argv[1] if len(sys.argv) > 1 else '/tmp/presets'

FG = {'light': ((14, 18, 36), (60, 68, 99), (74, 83, 112), (95, 103, 133)),
      'dark': ((247, 249, 252), (210, 216, 231), (201, 208, 225), (170, 179, 198))}

print(f"{'档位':<10}{'主题':<7}{'面板':<18}{'底衬':<18}{'ΔL':>8}  {'判定':<6}{'fg':>7}{'fg-2':>7}{'fg-3':>7}{'mute':>7}{'结构衰减':>9}")
print('-' * 116)
for preset in ['quiet', 'standard', 'strong']:
    for theme in ['light', 'dark']:
        p = os.path.join(DIR, f'{preset}-{theme}.png')
        if not os.path.exists(p):
            print(f'{preset:<10}{theme:<7} 缺图 {p}')
            continue
        img = Image.open(p).convert('RGB')
        panel = patch(img, PANEL)
        sub = patch(img, AMBIENT)
        d = abs(rel_lum(panel) - rel_lum(sub))
        judge = '清晰' if d >= 0.045 else ('可辨' if d >= 0.02 else '不可辨')
        c = [round(contrast(f, panel), 2) for f in FG[theme]]
        na = needle(img, (14, 480, 54, 520))
        np_ = needle(img, (430, 760, 470, 800))
        att = f'{100 * (1 - np_ / na):.0f}%' if na > 0.01 else 'n/a'
        print(f'{preset:<10}{theme:<7}{str(panel):<18}{str(sub):<18}{d:>8.4f}  {judge:<6}'
              f'{c[0]:>7}{c[1]:>7}{c[2]:>7}{c[3]:>7}{att:>9}')
