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

FLAGS = {'LEAGUE_START'}
# Optional branches kept in the route, tagged only="OPTIONAL" (the guide shows
# them unless "Show optional quests" is off): A Fixture of Fate (the Library)
OPTIONAL_FLAGS = {'LIBRARY'}
# Bandit branches are all kept, tagged with `only` ("BANDIT_ALIRA", "!BANDIT_KILL", …);
# the guide shows the branch for the build's bandit choice (PoB Configuration tab)
BANDITS = {'BANDIT_KILL', 'BANDIT_ALIRA', 'BANDIT_KRAITYN', 'BANDIT_OAK'}
only_stack = []
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
            offer = args[1] if len(args) > 1 else args[0]
            part = {'k': 'quest', 'id': args[0], 'offer': offer, 'v': q.get('name', args[0])}
            # what the hand-in gives (game data): quest items (keys, books), other items, gems
            o = q.get('reward_offers', {}).get(offer, {})
            ids = list(o.get('quest', {}).keys())
            kinds = set()
            for i in ids:
                if '/QuestItems/' in i:
                    kinds.add('questItem')
                elif '/Gems/' in i:
                    kinds.add('gems')
                else:
                    kinds.add('items')
            if o.get('vendor'):
                kinds.add('vendor')
            part['rewards'] = sorted(kinds)
            out.append(part)
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
            if kind == 'crafting' and current_area_for_parts[0]:
                recipes = areas.get(current_area_for_parts[0], {}).get('crafting_recipes', [])
                if recipes:
                    part['recipes'] = recipes
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
current_area_for_parts = [None]


def cur_only():
    return only_stack[-1] if only_stack else None


def new_step(area_id, via):
    a = areas[area_id]
    if steps and steps[-1]['areaId'] == area_id and steps[-1].get('only') == cur_only():
        return  # same zone (logout while in town, …)
    step = {'zone': a['name'], 'areaId': area_id, 'act': a['act'], 'town': bool(a.get('is_town_area')),
            'via': via, 'tasks': []}
    if cur_only():
        step['only'] = cur_only()
    steps.append(step)


def add_task(parts):
    if parts and steps:
        task = {'parts': parts}
        if cur_only() and steps[-1].get('only') != cur_only():
            task['only'] = cur_only()
        steps[-1]['tasks'].append(task)


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
            if flag in BANDITS:
                only_stack.append(flag if line.startswith('#ifdef') else '!' + flag)
                stack.append('bandit')
                continue
            if flag in OPTIONAL_FLAGS and line.startswith('#ifdef'):
                only_stack.append('OPTIONAL')
                stack.append('bandit')
                continue
            on = flag in FLAGS
            stack.append(on if line.startswith('#ifdef') else not on)
            continue
        if line == '#endif':
            if stack.pop() == 'bandit':
                only_stack.pop()
            continue
        if not all(x is True or x == 'bandit' for x in stack):
            continue
        if line.startswith('#section'):
            continue
        if line.startswith('#sub '):
            if steps and steps[-1]['tasks']:
                steps[-1]['tasks'][-1].setdefault('subs', []).append(parts_of(line[5:]))
            continue
        # trailing " #Label" comments are only for readers of the file
        line = re.sub(r'\s+#[^{}]*$', '', line)
        current_area_for_parts[0] = steps[-1]['areaId'] if steps else '1_1_1'
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
    'A Dirty Job': (0, 2),
}
# Optional quests that aren't in Exile Leveling's route (checked 2026-11-14
# against maxroll's PoE1 campaign guide). Added to the zone where you'd branch
# off, plus a hand-in line in the next town of that act. Tagged only="OPTIONAL".
EXTRA_OPTIONAL = [
    # (act, zone the task goes in, task, quest id, offer)
    (1, '1_1_3', 'Optional: ➞ {area|1_1_3a}, kill every monster incl. {kill|Kadavrus}', 'a1q8', 'a1q8'),
    (5, '1_5_3b', 'Optional: kill {kill|Utula, Hunger Incarnate}', 'a5q5', 'a5q5'),
    (6, '2_6_2', 'Optional: ➞ {area|2_6_3}, kill {kill|Riptide}, take {quest_text|Bestel\'s Manuscript}', 'a6q5', 'a6q5'),
    (7, '2_7_8', 'Optional: place {quest_text|Greust\'s Necklace} on the {quest_text|Azmeri Shrine}', 'a7q8', 'a7q8'),
    (8, '2_8_5', 'Optional: kill {kill|Hector Titucius}, take {quest_text|Wings of Vastiri}', 'a8q5', 'a8q5'),
]
for act, area, text, qid, offer in EXTRA_OPTIONAL:
    at = next((i for i, st in enumerate(steps) if st['areaId'] == area and st['act'] == act and not st.get('only')), None)
    if at is None:
        print('optional quest zone not in route:', area)
        continue
    town = next((i for i in range(at + 1, len(steps)) if steps[i]['town'] and steps[i]['act'] == act and not steps[i].get('only')), None)
    if town is None:
        # the route doesn't go back to this act's town: hand it in next time you're there
        steps[at]['tasks'].append({'parts': parts_of((text + ', then hand in {quest|%s|%s} in town' % (qid, offer)).replace('➞', '→')), 'only': 'OPTIONAL'})
        continue
    steps[at]['tasks'].append({'parts': parts_of(text.replace('➞', '→')), 'only': 'OPTIONAL'})
    steps[town]['tasks'].append({'parts': parts_of('Hand in {quest|%s|%s}' % (qid, offer)), 'only': 'OPTIONAL'})

# A quest can have more than one reward offer (Mercy Mission: Tarkleigh's flask
# and Nessa's support gem; Breaking Some Eggs: two gem picks). Offers the route
# never names come with the hand-in line of that quest.
named = set()
for st in steps:
    for t in st['tasks']:
        for p in t['parts']:
            if isinstance(p, dict) and p.get('k') == 'quest':
                named.add(p['offer'])
done_more = set()
for st in steps:
    for t in st['tasks']:
        for p in t['parts']:
            if isinstance(p, dict) and p.get('k') == 'quest':
                offers = quests.get(p['id'], {}).get('reward_offers', {})
                more = [o for o in offers if o not in named and 'tencent' not in o and (offers[o].get('quest') or offers[o].get('vendor'))]
                key = (p['id'], t.get('only') or st.get('only'))
                if more and key not in done_more:
                    done_more.add(key)
                    p['more'] = more
                    kinds = set(p.get('rewards', []))
                    for o in more:
                        for i in offers[o].get('quest', {}):
                            kinds.add('questItem' if '/QuestItems/' in i else 'gems' if '/Gems/' in i else 'items')
                        if offers[o].get('vendor'):
                            kinds.add('vendor')
                    p['rewards'] = sorted(kinds)

seen = set()
missing = set(REWARDS)
for s in steps:
    for t in s['tasks']:
        only = t.get('only') or s.get('only')
        for p in t['parts']:
            if isinstance(p, dict) and p['k'] == 'quest' and p['v'] in REWARDS:
                missing.discard(p['v'])
                # the bandit passive point is only for killing all three
                if p['v'] == 'Deal with the Bandits' and only not in (None, 'BANDIT_KILL'):
                    continue
                key = (p['v'], only)
                if key in seen:
                    continue  # only the first hand-in line (per bandit branch) gets the badge
                seen.add(key)
                passive, respec = REWARDS[p['v']]
                if passive:
                    p['passive'] = passive
                if respec:
                    p['respec'] = respec

out = {'source': 'Exile Leveling route + area data (MIT, (c) 2025 HeartofPhos)', 'steps': steps}
dst = os.path.join(os.path.dirname(__file__), '..', 'renderer', 'src', 'web', 'companion', 'campaign-route.json')
json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
total = sum(p.get('passive', 0) for s in steps if s.get('only') in (None, 'BANDIT_KILL', '!BANDIT_ALIRA') for t in s['tasks'] if t.get('only') in (None, 'BANDIT_KILL') for p in t['parts'] if isinstance(p, dict))
print(len(steps), 'steps,', os.path.getsize(dst), 'bytes,', total, 'quest passives; no hand-in line for:', sorted(missing))
