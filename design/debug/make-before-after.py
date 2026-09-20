"""把"旧版（玻璃感被认可）/ 优化前 / 优化后"并排出图，供人工判定。

为什么必须出对照图：观感问题**没有单一可判定的数值**。
能算的只有"分离度 ΔL""结构衰减""对比度"这些**必要条件**（它们都通过也不代表好看），
充分条件只能是人眼。所以流程是：用数值排掉"不可能好看"的候选，
最后把候选并排放在一起给人挑 —— 而不是拿一个数字声称"已经好了"。
"""
from PIL import Image, ImageDraw, ImageFont
import os

PANELS = [
    ('旧版（用户认可的玻璃感）', '/tmp/cmp/old-a.png'),
    ('Prism 初版落地（玻璃感丢失）', '/tmp/prism-v3/light-home.png'),
    ('本轮令牌优化后', '/tmp/glass2/light-home.png'),
    ('本轮令牌优化后·暗色', '/tmp/glass2/dark-home.png'),
]
W = 700
BAR = 34

imgs = []
for label, path in PANELS:
    if not os.path.exists(path):
        print(f'✗ 缺图 {path}')
        continue
    im = Image.open(path).convert('RGB')
    h = round(im.size[1] * W / im.size[0])
    imgs.append((label, im.resize((W, h), Image.LANCZOS)))

if not imgs:
    raise SystemExit('没有可用的图')

H = max(im.size[1] for _, im in imgs) + BAR
gap = 10
out = Image.new('RGB', (W * len(imgs) + gap * (len(imgs) - 1), H), (250, 250, 252))
d = ImageDraw.Draw(out)

font = None
# ⚠️ PingFang.ttc 在 Pillow 下会**静默**加载成功、但中文渲染成方框（不是抛错，是缺字形）。
#    所以这里优先用明确带中文字形的集合，并且**验证一次**（渲染后宽度不能是 0）。
for f in ('/System/Library/Fonts/Hiragino Sans GB.ttc',
          '/System/Library/Fonts/STHeiti Medium.ttc',
          '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
          '/System/Library/Fonts/PingFang.ttc'):
    if not os.path.exists(f):
        continue
    try:
        cand = ImageFont.truetype(f, 19, index=0)
    except Exception:
        continue
    if cand.getbbox('玻璃感') and cand.getlength('玻璃感') > 20:
        font = cand
        print(f'字体：{f}')
        break

for i, (label, im) in enumerate(imgs):
    x = i * (W + gap)
    out.paste(im, (x, BAR))
    d.text((x + 10, 8), label, fill=(30, 32, 44), font=font)

dest = '/tmp/glass2/对照-玻璃感.png'
out.save(dest)
print(f'✓ {dest}  {out.size[0]}x{out.size[1]}')
