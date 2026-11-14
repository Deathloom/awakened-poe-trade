#!/usr/bin/env python3
# Deathloom fork: builds renderer/src/web/companion/campaign-route.json (the
# campaign guide) from Exile Leveling's route files and area data (MIT,
# (c) 2025 HeartofPhos, https://github.com/HeartofPhos/exile-leveling,
# common/data/routes + common/data/json). Run at each league start:
#   python3 tools/gen-campaign-route.py <exile-leveling checkout>
#
# One step per zone you enter (➞ / waypoint / logout to town). The guide moves
# to the next step when Client.txt says "You have entered <zone>".
# Flags: LEAGUE_START on (fresh character), BANDIT_KILL on (kill all three).
import json, os, re, sys

FLAGS = {'LEAGUE_START', 'BANDIT_KILL'}
root = sys.argv[1]
data = os.path.join(root, 'common', 'data')
areas = json.load(open(os.path.join(data, 'json', 'areas.json'), encoding='utf-8'))
quests = json.load(open(os.path.join(data, 'json', 'quests.json'), encoding='utf-8'))

TOKEN = re.compile(r'\{([a-z_]+)(?:\|([^}]*))?\}')


def parts_of(text):
    """Line text -> list of parts: plain strings and {k: kind, ...} dicts."""
    out = []
    pos = 0
    for m in TOKEN.finditer(text):
        if m.start() > pos:
            out.append(text[pos:m.start()])
        kind, arg = m.group(1), m.group(2)
        args = arg.split('|') if arg else []
        if kind == 'quest':
            q = quests.get(args[0], {})
            out.append({'k': 'quest', 'id': args[0], 'offer': args[1] if len(args) > 1 else args[0], 'v': q.get('name', args[0])})
        elif kind in ('enter', 'area', 'waypoint') and args:
            out.append({'k': 'area' if kind != 'waypoint' else 'waypoint', 'v': areas.get(args[0], {}).get('name', args[0])})
        elif kind == 'waypoint':
            out.append({'k': 'waypoint'})
        elif kind == 'dir':
            out.append({'k': 'dir', 'v': int(args[0])})
        elif kind == 'portal':
            out.append({'k': 'portal', 'v': args[0] if args else 'use'})
        elif kind == 'ascend':
            out.append({'k': 'ascend', 'v': args[0] if args else ''})
        else:
            # kill, arena, generic, quest_text, trial, logout, waypoint_get, crafting
            part = {'k': kind}
            if args:
                part['v'] = args[0]
            out.append(part)
        pos = m.end()
    if pos < len(text):
        out.append(text[pos:])
    # tidy plain text
    cleaned = []
    for p in out:
        if isinstance(p, str):
            p = re.sub(r'\s+', ' ', p)
            if not p.strip():
                if cleaned:
                    cleaned.append(' ')
                continue
        cleaned.append(p)
    while cleaned and cleaned[-1] == ' ':
        cleaned.pop()
    if cleaned and isinstance(cleaned[0], str):
        cleaned[0] = cleaned[0].lstrip()
    return cleaned


steps = []


def new_step(area_id, via):
    a = areas[area_id]
    if steps and steps[-1]['areaId'] == area_id:
        return  # same zone (logout while in town, …)
    steps.append({'zone': a['name'], 'areaId': area_id, 'act': a['act'], 'town': bool(a.get('is_town_area')),
                  'via': via, 'tasks': []})


def add_task(parts):
    if parts and steps:
        steps[-1]['tasks'].append({'parts': parts})


def current_area():
    return steps[-1]['areaId'] if steps else None


for act in range(1, 11):
    lines = open(os.path.join(data, 'routes', f'act-{act}.txt'), encoding='utf-8').read().splitlines()
    stack = []  # include flags of #if blocks
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if line.startswith('#ifdef ') or line.startswith('#ifndef '):
            flag = line.split()[1]
            on = flag in FLAGS
            stack.append(on if line.startswith('#ifdef') else not on)
            continue
        if line == '#endif':
            stack.pop()
            continue
        if not all(stack):
            continue
        if line.startswith('#section'):
            continue
        if line.startswith('#sub '):
            if steps and steps[-1]['tasks']:
                steps[-1]['tasks'][-1].setdefault('subs', []).append(parts_of(line[5:]))
            continue
        # trailing " #Label" comments are only for readers of the file
        line = re.sub(r'\s+#[^{}]*$', '', line)
        if not steps:
            steps.append({'zone': areas['1_1_1']['name'], 'areaId': '1_1_1', 'act': 1, 'town': False, 'via': 'start', 'tasks': []})
        m = re.search(r'\{enter\|([^}]+)\}', line)
        if m:
            before, after = line[:m.start()], line[m.end():]
            before = before.replace('➞', '').strip()
            if before:
                add_task(parts_of(before))
            new_step(m.group(1), 'enter')
            after = after.lstrip(' ,')
            if after:
                add_task(parts_of(after))
            continue
        m = re.fullmatch(r'\{waypoint\|([^}]+)\}', line)
        if m:
            new_step(m.group(1), 'waypoint')
            continue
        if line == '{logout}':
            cur = current_area()
            town = areas[cur].get('parent_town_area_id') if cur else None
            if town and town in areas:
                new_step(town, 'logout')
            continue
        add_task(parts_of(line.replace('➞', '→')))

# Quest passive / respec points (checked 2026-11-14 against poedb's passive
# skill list, mobalytics' "All 24 Passive Point Quests" and the quest pages).
# Keyed by quest name; shown on the quest's hand-in line.
REWARDS = {
    'The Dweller of the Deep': (1, 0), 'The Marooned Mariner': (1, 0), 'Through Sacred Ground': (1, 2),
    'The Way Forward': (1, 0), 'Deal with the Bandits': (1, 0), "Victario's Secrets": (1, 2),
    "Piety's Pets": (1, 0), 'An Indomitable Spirit': (1, 2), 'In Service to Science': (1, 0),
    "Kitava's Torments": (1, 2), 'Fallen from Grace': (0, 2), 'The Father of War': (1, 0),
    'The Cloven One': (1, 0), 'The Puppet Mistress': (1, 0), 'The Master of a Million Faces': (1, 0),
    'Queen of Despair': (1, 0), "Kishara's Star": (1, 2), 'Reflection of Terror': (1, 0),
    'Love is Dead': (1, 2), 'The Gemling Legion': (1, 0), 'Queen of the Sands': (1, 0),
    'The Ruler of Highgate': (1, 0), "Vilenta's Vengeance": (1, 0), 'An End to Hunger': (2, 0),
}
seen = set()
missing = set(REWARDS)
for s in steps:
    for t in s['tasks']:
        for p in t['parts']:
            if isinstance(p, dict) and p['k'] == 'quest' and p['v'] in REWARDS:
                missing.discard(p['v'])
                if p['v'] in seen:
                    continue  # only the first hand-in line gets the badge
                seen.add(p['v'])
                passive, respec = REWARDS[p['v']]
                if passive:
                    p['passive'] = passive
                if respec:
                    p['respec'] = respec

out = {'source': 'Exile Leveling route + area data (MIT, (c) 2025 HeartofPhos)', 'steps': steps}
dst = os.path.join(os.path.dirname(__file__), '..', 'renderer', 'src', 'web', 'companion', 'campaign-route.json')
json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
total = sum(p.get('passive', 0) for s in steps for t in s['tasks'] for p in t['parts'] if isinstance(p, dict))
print(len(steps), 'steps,', os.path.getsize(dst), 'bytes,', total, 'quest passives; no hand-in line for:', sorted(missing))
