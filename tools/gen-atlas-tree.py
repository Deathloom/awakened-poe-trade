#!/usr/bin/env python3
"""Deathloom fork: build renderer/src/web/atlas/atlas-tree.json from GGG's
official Atlas tree export (https://github.com/grindinggear/atlastree-export).

Usage: python3 tools/gen-atlas-tree.py <path to atlastree-export/data.json> <version, e.g. 3.30.0>

Output (compact, same node tuple as the passive tree map):
  nodes: [id, x, y, kind, group, orbit, name, false, stats]
         kind 0 normal, 1 notable, 2 keystone, 3 mastery (art label), 5 start
  groups: {group: [x, y]}, orbitRadii, links: [[a, b]] (straight or same-orbit arc),
  arcs: [[a, b, cx, cy]] (long curved links between groups, centre given by GGG),
  variants: {node: [[effect, [stats]]]} (multiple-choice notables)
"""
import json
import math
import sys

A16 = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330]
A40 = [0, 10, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130, 135, 140, 150, 160, 170,
       180, 190, 200, 210, 220, 225, 230, 240, 250, 260, 270, 280, 290, 300, 310, 315, 320, 330, 340, 350]


def main(src, version):
    d = json.load(open(src, encoding='utf-8'))
    nodes, groups = d['nodes'], d['groups']
    radii = d['constants']['orbitRadii']
    per_orbit = d['constants']['skillsPerOrbit']
    starts = {int(x) for x in nodes.get('root', {}).get('out', [])}

    def pos(v):
        g = groups[str(v['group'])]
        o, i = v['orbit'], v['orbitIndex']
        c = per_orbit[o]
        a = math.radians(A16[i]) if c == 16 else math.radians(A40[i]) if c == 40 else 2 * math.pi * i / c
        return g['x'] + math.sin(a) * radii[o], g['y'] - math.cos(a) * radii[o]

    out_nodes = []
    used_groups = set()
    variants = {}
    for key, v in nodes.items():
        if key == 'root' or 'skill' not in v:
            continue
        sid = int(v['skill'])
        x, y = pos(v)
        kind = 5 if sid in starts else 2 if v.get('isKeystone') else 3 if v.get('isMastery') else 1 if v.get('isNotable') else 0
        stats = [line for s in v.get('stats', []) for line in s.split('\n') if line.strip()]
        out_nodes.append([sid, round(x), round(y), kind, v['group'], v['orbit'], v.get('name', ''), False, stats])
        used_groups.add(str(v['group']))
        if v.get('variantEffects'):
            variants[str(sid)] = [[int(e['effect']), [line for s in e.get('stats', []) for line in s.split('\n') if line.strip()]]
                                  for e in v['variantEffects']]

    links, arcs, seen = [], [], set()
    for key, v in nodes.items():
        if key == 'root' or 'skill' not in v:
            continue
        a = int(v['skill'])
        special = {c['to']: c for c in v.get('connections', []) if c.get('orbit', 0) != 0}
        for to in v.get('out', []):
            if to not in nodes or 'skill' not in nodes[to]:
                continue
            b = int(nodes[to]['skill'])
            pair = (min(a, b), max(a, b))
            if pair in seen:
                continue
            seen.add(pair)
            # masteries are art labels, never linked
            if nodes[to].get('isMastery') or v.get('isMastery'):
                continue
            c = special.get(to)
            if c:
                arcs.append([a, b, round(c['orbitX']), round(c['orbitY'])])
            else:
                links.append([a, b])

    out = {
        'version': version,
        'nodes': sorted(out_nodes, key=lambda n: n[0]),
        'groups': {k: [round(groups[k]['x']), round(groups[k]['y'])] for k in sorted(used_groups, key=int)},
        'orbitRadii': radii,
        'links': links,
        'arcs': arcs,
        'variants': variants,
        'points': d.get('points', {}).get('totalPoints')
    }
    json.dump(out, open('renderer/src/web/atlas/atlas-tree.json', 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
    print(f"{len(out_nodes)} nodes, {len(links)} links, {len(arcs)} arcs, {len(variants)} multiple-choice")


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
