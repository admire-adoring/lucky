"""按模块比较整图 / Hero 区 / 磁贴区的均值 —— 判断"整页是否随模块变色"。

为什么要分区域：Hero 底色带用的是 --accent（模块强调色），环境底衬用的是 --m-lt/dk 色团。
两者是**两条独立的链**，合成一张图看均值会把它们混在一起；
一旦混了，"两条链只通了一条"就会被读成"都通了"或"都没通"。
"""
import sys
from PIL import Image, ImageStat

DIR = sys.argv[1] if len(sys.argv) > 1 else '/tmp/prism-shot2'
KEYS = ['home', 'tasks', 'schedule', 'life', 'work', 'learn', 'knowledge', 'project', 'settings']
REGIONS = {
    '全图': (0, 0, 1440, 900),
    'Hero': (0, 60, 830, 400),
    '磁贴区': (0, 430, 830, 900),
    '助手栏': (830, 60, 1440, 900),
}
print('各区域均值（RGB）—— 同一个区域内，九个模块的数值应当**互不相同**')
for theme in ['light', 'dark']:
    print(f'--- {theme} ---')
    for name, box in REGIONS.items():
        print(f'  [{name}]')
        for k in KEYS:
            im = Image.open(f'{DIR}/{theme}-{k}.png').convert('RGB')
            m = [round(v, 1) for v in ImageStat.Stat(im.crop(box)).mean[:3]]
            print(f'    {k:<10} {m}')
