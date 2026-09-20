"""沿扫描线找"卡片内 / 卡片外"两种平坦区，再比高频能量。

为什么要自适应而不是写死坐标：新旧两版**版式不同**（旧版有侧栏），
同一组坐标在两版里落在完全不同的东西上（上一版就把取样框打在文字里，
量到 σ 20~31、结论全废）。判据必须落到"这块像素是什么"上，而不是"它在第几行"。

用法：python3 measure-frost2.py <png> [y]
"""
import sys
from PIL import Image

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

def mean_of(img, box):
    px = list(img.crop(box).convert('RGB').get_flattened_data())
    n = len(px)
    return [round(sum(c[i] for c in px) / n) for i in range(3)]

path = sys.argv[1]
y = int(sys.argv[2]) if len(sys.argv) > 2 else 470
img = Image.open(path).convert('RGB')
print(f'{path}  {img.size[0]}x{img.size[1]}  扫描线 y={y}\n')
print(f"{'x':>5} {'高频':>7}  {'均值':<18} 判定")
rows = []
for x in range(4, img.size[0] - 60, 28):
    box = (x, y - 16, x + 40, y + 16)
    n = needle(img, box)
    m = mean_of(img, box)
    rows.append((x, n, m))
    tag = '面板内（高频低）' if n < 4 else ('底衬（高频高）' if n > 8 else '')
    print(f'{x:>5} {n:>7.2f}  {str(m):<18} {tag}')

lo = [r[1] for r in rows]
print(f'\n全场高频能量范围 {min(lo):.2f} ~ {max(lo):.2f}')
