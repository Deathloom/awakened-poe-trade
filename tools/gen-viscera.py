#!/usr/bin/env python3
# Deathloom fork (Q12): builds renderer/src/web/money/viscera-data.json from the
# Path of Building data files (src/Data/Viscera.lua + src/Data/Bases/wickerman.lua,
# PoB 2.69+, item data (c) Grinding Gear Games). Run when PoB's Viscera data changes:
#   python3 tools/gen-viscera.py <PathOfBuilding checkout>
import json, os, re, sys
src = os.path.join(sys.argv[1], 'src', 'Data')
# PoB's base ids name the boss (VisceraAureltheHungry -> Aurel the Hungry). A
# readable label, not the exact in-game name.
def boss_label(boss_id):
    s = re.sub(r'(?<=[a-z])(the|of|ofthe)(?=[A-Z])', lambda m: ' of the ' if m.group(1) == 'ofthe' else f' {m.group(1)} ', boss_id)
    s = re.sub(r'(?<=[a-z])(?=[A-Z0-9])', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()
bases_lua = open(os.path.join(src, 'Bases', 'wickerman.lua'), encoding='utf-8').read()
slots = {}
for m in re.finditer(r'itemBases\["((?:[^"\\]|\\.)*)"\] = \{.*?baseId = "([^"]+)".*?tags = \{ viscera_(\w+) = true', bases_lua, re.S):
    name = m.group(1).replace('\\"', '"')
    slots[name] = {'slot': m.group(3), 'boss': boss_label(m.group(2).rsplit('/', 1)[-1].removeprefix('Viscera'))}
items_lua = open(os.path.join(src, 'Viscera.lua'), encoding='utf-8').read()
out = []
for block in re.findall(r'\[\[\n(.*?)\]\]', items_lua, re.S):
    lines = [l for l in block.split('\n') if l.strip()]
    name, base = lines[0], lines[1]
    n = 0
    for i, l in enumerate(lines):
        if l.startswith('Implicits:'):
            n = int(l.split(':')[1])
            mods = lines[i + 1:i + 1 + n]
            break
    else:
        mods = []
    if base not in slots:
        print('no base for', name, file=sys.stderr)
        continue
    tier = 1 if name.startswith('Lesser ') else 3 if name.startswith('Greater ') else 2
    out.append({'name': name, 'base': base, 'slot': slots[base]['slot'], 'boss': slots[base]['boss'], 'tier': tier, 'mods': mods})
dst = os.path.join(os.path.dirname(__file__), '..', 'renderer', 'src', 'web', 'money', 'viscera-data.json')
with open(dst, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print(len(out), 'viscera,', len(slots), 'bases')
