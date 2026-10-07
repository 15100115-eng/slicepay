# Design-parity compare: design frame vs app screenshot for every case in tests/visual/cases.json.
# usage: python3 tests/visual/compare.py <shotsDir> [id,id,...]
# Writes <shotsDir>/cmp_<id>.png = [design | app | diff overlay] and <shotsDir>/scores.json:
#   [[id, mean, pct], ...]  mean = mean abs grey diff (0..255, lower = better), pct = % of pixels with diff > 40.
# Needs Pillow (pip3 install pillow).
import json, sys, os
from PIL import Image, ImageChops, ImageOps, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
FRAMES = os.path.join(os.path.dirname(HERE), 'fixtures', 'frames')
shots = sys.argv[1]
only = [x for x in (sys.argv[2].split(',') if len(sys.argv) > 2 else []) if x]
cases = json.load(open(os.path.join(HERE, 'cases.json'), encoding='utf-8'))
res = []
for c in cases:
    if only and c['id'] not in only: continue
    a = os.path.join(shots, c['id'] + '.png')
    if not os.path.exists(a): continue
    des = Image.open(os.path.join(FRAMES, c['frame'])).convert('RGB')
    app = Image.open(a).convert('RGB')
    if app.size != des.size: app = app.resize(des.size)
    diff = ImageChops.difference(des, app)
    g = ImageOps.grayscale(diff)
    hist = g.histogram(); n = sum(hist); mean = sum(i * h for i, h in enumerate(hist)) / n
    bad = sum(h for i, h in enumerate(hist) if i > 40) / n * 100
    W, H = des.size
    canvas = Image.new('RGB', (W * 3 + 40, H + 40), 'white')
    canvas.paste(des, (0, 40)); canvas.paste(app, (W + 20, 40))
    # diff overlay: design faded + diff in red
    over = Image.blend(des, Image.new('RGB', des.size, 'white'), 0.7)
    red = Image.new('RGB', des.size, (255, 0, 0))
    mask = g.point(lambda v: 255 if v > 40 else 0)
    over.paste(red, (0, 0), mask)
    canvas.paste(over, (2 * W + 40, 40))
    d = ImageDraw.Draw(canvas)
    d.text((10, 10), 'DESIGN ' + c['frame'], fill='black')
    d.text((W + 30, 10), 'APP ' + c['hash'], fill='black')
    d.text((2 * W + 50, 10), 'DIFF mean=%.1f  >40: %.1f%%' % (mean, bad), fill='red')
    if W > 1000: canvas = canvas.resize((canvas.size[0] // 2, canvas.size[1] // 2))
    canvas.save(os.path.join(shots, 'cmp_' + c['id'] + '.png'))
    res.append((c['id'], round(mean, 2), round(bad, 2)))
for r in res: print('%s  mean=%6.2f  pct>40=%6.2f%%' % r)
json.dump(res, open(os.path.join(shots, 'scores.json'), 'w'))
