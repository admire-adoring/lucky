"""三个玻璃档位并排出图，供人工选点。

为什么观感问题最后一定要出图："分离度 ΔL / 文字对比 / 结构衰减"都是**必要条件** ——
它们都通过，也不代表好看。充分条件只能是人眼。所以流程是：
用数值排掉"不可能好看"的候选（这里排掉了 ΔL 掉出"清晰"的暗色 strong 初版），
然后把剩下的并排放在一起给人挑，而不是拿一个数字声称"已经好了"。
"""
import os
from PIL import Image, ImageDraw, ImageFont

PANELS = [
    ('quiet · 安静', '/tmp/presets/quiet-light.png'),
    ('standard · 标准', '/tmp/presets/standard-light.png'),
    ('strong · 通透（默认）', '/tmp/presets/strong-light.png'),
    ('strong · 通透（暗色）', '/tmp/presets/strong-dark.png'),
]
W, BAR, GAP = 700, 34, 10

font = None
for f in ('/System/Library/Fonts/Hiragino Sans GB.ttc',
          '/System/Library/Fonts/STHeiti Medium.ttc',
          '/System/Library/Fonts/Supplemental/Arial Unicode.ttf'):
    if os.path.exists(f):
        try:
            cand = ImageFont.truetype(f, 19, index=0)
        except Exception:
            continue
        if cand.getlength('玻璃感') > 20:   # 静止加载成功但缺中文字形的字体
            font = cand
            break

imgs = []
for label, path in PANELS:
    if not os.path.exists(path):
        print(f'✗ 缺图 {path}')
        continue
    im = Image.open(path).convert('RGB')
    imgs.append((label, im.resize((W, round(im.size[1] * W / im.size[0])), Image.LANCZOS)))

H = max(im.size[1] for _, im in imgs) + BAR
out = Image.new('RGB', (W * len(imgs) + GAP * (len(imgs) - 1), H), (250, 250, 252))
d = ImageDraw.Draw(out)
for i, (label, im) in enumerate(imgs):
    x = i * (W + GAP)
    out.paste(im, (x, BAR))
    d.text((x + 10, 7), label, fill=(30, 32, 44), font=font)

dest = '/tmp/presets/对照-玻璃档位.png'
out.save(dest)
print(f'✓ {dest}  {out.size[0]}x{out.size[1]}')
