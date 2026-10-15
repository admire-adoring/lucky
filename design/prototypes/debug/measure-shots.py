"""量截图，不靠肉眼。

三件事，都是"看截图看不出来、必须算"的：
 ① **九个模块真的各是一色吗**？量页面底衬的平均色相与彩度。若九个几乎一样，
    说明模块色槽没接上（本轮就踩过两次：--accent 当颜色用、--s 撞名）。
 ② 两套主题是否都成立 —— 底衬亮度必须分处两端，而不是"都挺亮"。
 ③ 面板与底衬的**分离度 ΔL** —— 规范 §6 门禁②-A 的判据（≥0.02 可辨 / ≥0.045 清晰）。
    玻璃上的分离度无法从令牌推算，只能实测。

用法：python3 _measure.py <shotsDir>
"""
import sys, glob, os, math
from PIL import Image

def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def rel_lum(rgb):
    r, g, b = (lin(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast(a, b):
    la, lb = rel_lum(a), rel_lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

# sRGB -> OKLCH 的彩度（只用来判"有没有颜色"，不判对比度）
def to_oklab(rgb):
    r, g, b = (lin(v) for v in rgb)
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    return (
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    )

def chroma(rgb):
    _, a, b = to_oklab(rgb)
    return math.hypot(a, b) * 100

def hue(rgb):
    _, a, b = to_oklab(rgb)
    return (math.degrees(math.atan2(b, a)) + 360) % 360

def patch(img, box):
    """返回区域平均色（去饱和区噪声：用均值就够，我们看的是大面积趋势）"""
    x0, y0, x1, y1 = box
    px = img.crop((x0, y0, x1, y1)).resize((1, 1), Image.BOX)
    return px.getpixel((0, 0))[:3]

DIR = sys.argv[1] if len(sys.argv) > 1 else '/tmp/prism-shot2'

# 取样框必须先"证明它落在什么上"，再谈数值 —— 第一版随便挑了两处，
# 结果量到的是卡片内部而不是底衬，于是"九个模块颜色一样"这个结论完全是假的（自己骗自己）。
# 所以每个框都要在下面的输出里能看到实测色，能一眼判断它落在底衬还是卡片上。
AMBIENT = (8, 500, 20, 700)      # 主列左内边距：整条竖带都是环境底衬（两种主题都成立）
PANEL = (430, 850, 470, 880)     # 「项目明细」磁贴内部：避开文字

print('① 九个模块的页面底衬（取样：左侧内容空带 x160-320, y470-700 —— 没有卡片的地方）')
print(f"{'模块':<10}{'亮·色相':>9}{'亮·彩度':>9}{'亮·L':>8}   {'暗·色相':>9}{'暗·彩度':>9}{'暗·L':>8}")
print('-' * 72)
rows = {}
for key in ['home', 'tasks', 'schedule', 'life', 'work', 'learn', 'knowledge', 'project', 'settings']:
    r = {}
    for theme in ['light', 'dark']:
        p = os.path.join(DIR, f'{theme}-{key}.png')
        if not os.path.exists(p):
            continue
        img = Image.open(p).convert('RGB')
        c = patch(img, AMBIENT)
        r[theme] = (round(hue(c)), round(chroma(c), 1), round(rel_lum(c), 4), c)
    rows[key] = r
    if 'light' in r and 'dark' in r:
        print(f"{key:<10}{r['light'][0]:>9}{r['light'][1]:>9}{r['light'][2]:>8}   {r['dark'][0]:>9}{r['dark'][1]:>9}{r['dark'][2]:>8}")

print()
print('② 主题成立性（底衬亮度必须分处两端）')
for theme in ['light', 'dark']:
    ls = [rows[k][theme][2] for k in rows if theme in rows[k]]
    print(f"  {theme:<6} 底衬 L 范围 {min(ls):.4f} ~ {max(ls):.4f}")

print()
print('③ 九个模块的色相是否真的互不相同（间距是"可分辨"的代理指标）')
for theme in ['light', 'dark']:
    hs = sorted(round(rows[k][theme][0]) for k in rows if theme in rows[k])
    gaps = [round((hs[(i + 1) % len(hs)] - hs[i]) % 360) for i in range(len(hs))]
    print(f"  {theme:<6} 色相 {hs}")
    print(f"         相邻间距 {gaps} · 最小 {min(gaps)}°")

print()
print('④ 面板分离度 ΔL（规范 §6 门禁②-A：≥0.02 可辨 / ≥0.045 清晰）')
# 取样：磁贴内部 vs 主列左内边距的环境底衬。两个框的实测色都打印出来，便于核对落在哪一层。
for theme in ['light', 'dark']:
    p = os.path.join(DIR, f'{theme}-home.png')
    img = Image.open(p).convert('RGB')
    panel = patch(img, PANEL)
    sub = patch(img, AMBIENT)
    d = abs(rel_lum(panel) - rel_lum(sub))
    judge = '清晰' if d >= 0.045 else ('可辨' if d >= 0.02 else '**不可辨**')
    print(f"  {theme:<6} 磁贴 {panel} L={rel_lum(panel):.4f} · 底衬 {sub} L={rel_lum(sub):.4f} · ΔL={d:.4f} → {judge}")

print()
print('⑤ 关键文字在实测底衬上的对比度（规范 §6 门禁①：正文 ≥4.5:1，元信息 ≥3:1）')
# 直接采"文字像素"不可靠（抗锯齿会把笔画边缘混进来），所以文字色取令牌值、
# **底衬取实测值** —— 玻璃上的对比度无法从令牌推算，这才是唯一可信的做法。
for theme in ['light', 'dark']:
    p = os.path.join(DIR, f'{theme}-home.png')
    img = Image.open(p).convert('RGB')
    panel = patch(img, PANEL)
    fg_light = (14, 18, 36) if theme == 'light' else (247, 249, 252)
    fg2 = (60, 68, 99) if theme == 'light' else (210, 216, 231)
    fg3 = (74, 83, 112) if theme == 'light' else (201, 208, 225)
    mute = (95, 103, 133) if theme == 'light' else (170, 179, 198)
    a, b, c, d = (round(contrast(f, panel), 2) for f in (fg_light, fg2, fg3, mute))
    print(f"  {theme:<6} 磁贴底衬 {panel} → --fg {a}:1 · --fg-2 {b}:1 · --fg-3 {c}:1 · --fg-mute {d}:1")
