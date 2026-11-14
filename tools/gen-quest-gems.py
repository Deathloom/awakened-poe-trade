#!/usr/bin/env python3
# Deathloom fork: builds renderer/src/web/companion/quest-gems.json from Exile
# Leveling's game-data export (MIT, (c) 2025 HeartofPhos,
# https://github.com/HeartofPhos/exile-leveling, common/data/json/).
# Run at each league start:  python3 tools/gen-quest-gems.py <exile-leveling checkout>
import json, sys, os
src = os.path.join(sys.argv[1], 'common', 'data', 'json')
quests = json.load(open(os.path.join(src, 'quests.json'), encoding='utf-8'))
gems = json.load(open(os.path.join(src, 'gems.json'), encoding='utf-8'))
chars = json.load(open(os.path.join(src, 'characters.json'), encoding='utf-8'))
CLASSES = ['Marauder', 'Ranger', 'Witch', 'Duelist', 'Templar', 'Shadow', 'Scion']
# class bitmask (index in CLASSES); 0 = every class (e.g. Lilly Roth, act 6)
def mask(classes):
    m = 0
    for c in classes:
        m |= 1 << CLASSES.index(c)
    return m
def name(gid):
    return gems[gid]['name'] if gid in gems else None
out_q = []
for qid, q in quests.items():
    act = int(q['act']) if str(q['act']).isdigit() else 0
    if act < 1 or act > 10:
        continue
    for oid, offer in q['reward_offers'].items():
        if 'tencent' in oid:
            continue  # China-client variant
        take = {name(g): mask(v['classes']) for g, v in offer.get('quest', {}).items() if name(g) and gems[g].get('required_level') is not None and 'Gems/' in g}
        buy = {}
        for g, v in offer.get('vendor', {}).items():
            n = name(g)
            if n:
                buy[n] = [mask(v['classes']), v.get('npc', offer.get('quest_npc'))]
        if take or buy:
            out_q.append({'quest': q['name'], 'id': oid, 'act': act, 'npc': offer.get('quest_npc'), 'take': take, 'buy': buy})
out = {
    'source': 'Exile Leveling game-data export (MIT, (c) 2025 HeartofPhos)',
    'classes': CLASSES,
    'start': {c: [name(v['start_gem_id']), name(v['chest_gem_id'])] for c, v in chars.items()},
    'gems': {v['name']: [v['required_level'], 1 if v.get('is_support') else 0] for v in gems.values()},
    'quests': out_q,
}
dst = os.path.join(os.path.dirname(__file__), '..', 'renderer', 'src', 'web', 'companion', 'quest-gems.json')
json.dump(out, open(dst, 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
print(len(out_q), 'offers,', os.path.getsize(dst), 'bytes')
