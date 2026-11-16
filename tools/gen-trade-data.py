#!/usr/bin/env python3
"""Add new league data to the price check data from the trade site's data lists.

Merge only: everything already in renderer/public/data/<lang>/{items,stats}.ndjson
stays as it is (negative wordings, unique bases, gem info, groups). This adds:
  - uniques and base types the trade site lists that we don't have
    (base category from the PoB fork's item bases, MIT; icons stay empty)
  - exchange tags (tradeTag) from the trade site's static list, and new
    exchange items with their icon link on GGG's image server
  - stat lines the trade site lists that we don't have (new league mods),
    and missing trade ids (implicit / fractured / crafted ...) on known lines

Sources: the trade site's public data lists, fetched once per league by the
"Trade data refresh" workflow (never by players' installs):
  <dumps>/<lang>/{items,stats,static}.json   from /api/trade/data/{items,stats,static}
en is required; ru, ko, cmn-Hant are used when present.

Usage: python3 -I tools/gen-trade-data.py <dumps dir> <PoB src/Data/Bases dir> [--report out.md]
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'renderer', 'public', 'data')
LANGS = ['en', 'ru', 'ko', 'cmn-Hant']
ICON_HOST = 'https://web.poecdn.com'
# trade stat types the price check knows
STAT_TYPES = {'explicit', 'implicit', 'fractured', 'enchant', 'pseudo', 'crafted', 'imbued', 'veiled'}
# trade item groups whose base types are gear we can give a category
GEAR_GROUPS = {'accessory', 'armour', 'weapon', 'jewel', 'flask'}

# trade static groups: namespace for new rows, and groups whose entries are search options
STATIC_NS = {'Cards': 'DIVINATION_CARD', 'Beasts': 'CAPTURED_BEAST'}
STATIC_NO_NEW = {'MapKey', 'MapsUnique', 'MapsSpecial', 'Heist', 'Sanctum', 'Misc'}

POB_TYPE = {
  'One Handed Axe': 'One-Handed Axe', 'One Handed Mace': 'One-Handed Mace', 'One Handed Sword': 'One-Handed Sword',
  'Two Handed Axe': 'Two-Handed Axe', 'Two Handed Mace': 'Two-Handed Mace', 'Two Handed Sword': 'Two-Handed Sword',
}


def read_ndjson (path):
  with open(path, encoding='utf-8') as f:
    return [json.loads(l) for l in f if l.strip()]


def write_ndjson (path, rows):
  with open(path, 'w', encoding='utf-8', newline='\n') as f:
    for r in rows:
      f.write(json.dumps(r, ensure_ascii=False, separators=(',', ':')) + '\n')


def read_dump (dumps, lang, name):
  p = os.path.join(dumps, lang, name + '.json')
  if not os.path.isfile(p):
    return None
  with open(p, encoding='utf-8') as f:
    d = json.load(f)
  return d.get('result', d)


def pob_categories (bases_dir):
  """base name -> ItemCategory, from PoB's src/Data/Bases/*.lua"""
  out = {}
  name_re = re.compile(r'^itemBases\["(.+?)"\] = \{')
  for fn in sorted(os.listdir(bases_dir)):
    if not fn.endswith('.lua'):
      continue
    name = typ = sub = None
    with open(os.path.join(bases_dir, fn), encoding='utf-8') as f:
      for line in f:
        m = name_re.match(line)
        if m:
          name, typ, sub = m.group(1), None, None
          continue
        if name is None:
          continue
        m = re.match(r'\s*type = "(.+?)"', line)
        if m:
          typ = m.group(1)
        m = re.match(r'\s*subType = "(.+?)"', line)
        if m:
          sub = m.group(1)
        if line.startswith('}'):
          cat = category(typ, sub)
          if cat:
            out[name] = cat
          name = None
  return out


def category (typ, sub):
  if typ is None or typ == 'Graft':
    return None
  if typ == 'Dagger' and sub == 'Rune Dagger':
    return 'Rune Dagger'
  if typ == 'Staff' and sub == 'Warstaff':
    return 'Warstaff'
  if typ == 'Jewel':
    return {'Abyss': 'Abyss Jewel', 'Cluster': 'Cluster Jewel'}.get(sub, 'Jewel')
  return POB_TYPE.get(typ, typ)


def matcher_text (text):
  return text.replace('+#', '#')


def iter_stats (rows):
  for r in rows:
    for s in r.get('stats', [r]):
      yield s


# ---------- items ----------

def item_entries (groups):
  """(group id, index in group, entry) in the trade site's order"""
  for g in groups:
    for i, e in enumerate(g.get('entries', [])):
      yield g.get('id'), i, e


def refresh_items (dumps, cats, report):
  en_groups = read_dump(dumps, 'en', 'items')
  en_static = read_dump(dumps, 'en', 'static') or []
  if en_groups is None:
    sys.exit('en/items.json missing')
  rows = {lang: read_ndjson(os.path.join(DATA, lang, 'items.ndjson')) for lang in LANGS}

  en_rows = rows['en']
  uniques = {(r['refName'], r.get('unique', {}).get('base')) for r in en_rows if r['namespace'] == 'UNIQUE'}
  bases = {r['refName'] for r in en_rows if r['namespace'] == 'ITEM'}
  new_rows = []  # (en row, key to find it in other languages)

  en_list = list(item_entries(en_groups))
  for gid, gi, e in en_list:
    flags = e.get('flags', {})
    if flags.get('unique'):
      if 'name' not in e or (e['name'], e['type']) in uniques:
        continue
      uniques.add((e['name'], e['type']))
      row = {'name': e['name'], 'refName': e['name'], 'namespace': 'UNIQUE', 'unique': {'base': e['type']}, 'icon': ''}
      new_rows.append((row, ('pos', gid, gi)))
      report['uniques'].append(f"{e['name']} ({e['type']})")
    elif gid in GEAR_GROUPS and 'name' not in e and e['type'] not in bases:
      cat = cats.get(e['type'])
      if not cat:
        report['skipped'].append(f"base {e['type']}: no category in PoB data")
        continue
      bases.add(e['type'])
      row = {'name': e['type'], 'refName': e['type'], 'namespace': 'ITEM', 'craftable': {'category': cat}, 'icon': ''}
      new_rows.append((row, ('pos', gid, gi)))
      report['bases'].append(f"{e['type']} ({cat})")

  # exchange tags
  static_en = {}
  for g in en_static:
    for e in g.get('entries', []):
      if e.get('id') and e.get('text'):
        static_en[e['id']] = dict(e, group=g.get('id'))
  by_ref = {}
  for r in en_rows:
    by_ref.setdefault(r['refName'], []).append(r)
  tagged = {r['tradeTag'] for r in en_rows if 'tradeTag' in r}
  tag_fix = {}  # refName -> tag, applied to all languages
  for tid, e in static_en.items():
    if tid in tagged:
      continue
    cands = [r for r in by_ref.get(e['text'], []) if r['namespace'] in ('ITEM', 'DIVINATION_CARD', 'CAPTURED_BEAST')]
    if len(cands) == 1:
      tag_fix[e['text']] = tid
      report['tags'].append(f"{e['text']} → {tid}")
    elif not cands and not any(r[0]['refName'] == e['text'] for r in new_rows):
      if e['group'] in STATIC_NO_NEW or ' (' in e['text']:
        continue  # map tiers, contract / tome levels, headers: search options, not item names
      ns = STATIC_NS.get(e['group'], 'ITEM')
      row = {'name': e['text'], 'refName': e['text'], 'namespace': ns, 'tradeTag': tid, 'exchangeable': True,
             'icon': ICON_HOST + e['image'] if e.get('image', '').startswith('/') else e.get('image', '')}
      new_rows.append((row, ('static', tid)))
      report['exchange'].append(f"{e['text']} ({tid})")

  # write each language
  for lang in LANGS:
    lrows = rows[lang]
    if lang == 'en':
      local = lambda key: None  # noqa: E731
    else:
      local = localiser(dumps, lang, en_list, lrows, report)
    for r in lrows:
      if r['refName'] in tag_fix and r['namespace'] in ('ITEM', 'DIVINATION_CARD', 'CAPTURED_BEAST') and 'tradeTag' not in r:
        r['tradeTag'] = tag_fix[r['refName']]
        r['exchangeable'] = True
    added = 0
    for row, key in new_rows:
      r = json.loads(json.dumps(row))
      if lang != 'en':
        name = local(key)
        if name is None:
          report['skipped'].append(f"{lang}: no translation for {row['refName']}")
          continue
        r['name'] = name
      insert_next_to(lrows, r)
      added += 1
    write_ndjson(os.path.join(DATA, lang, 'items.ndjson'), lrows)
    report['langs'][lang] = report['langs'].get(lang, '') + f'items +{added} '


def insert_next_to (rows, row):
  """Rows with the same namespace + name must be next to each other (the index
  reads them in a run), so a new row goes after the last one like it, else at the end.
  Existing rows keep their order."""
  for i in range(len(rows) - 1, -1, -1):
    r = rows[i]
    if r['namespace'] == row['namespace'] and (r['name'] == row['name'] or r['refName'] == row['refName']):
      rows.insert(i + 1, row)
      return
  rows.append(row)


def localiser (dumps, lang, en_list, lrows, report):
  """Translated names: exchange items by trade id; uniques and bases by their
  position in the same trade group, only for groups whose order checks out
  against names we already have translated (>95% of at least 5)."""
  groups = read_dump(dumps, lang, 'items') or []
  static = read_dump(dumps, lang, 'static') or []
  st = {e['id']: e['text'] for g in static for e in g.get('entries', []) if e.get('id') and e.get('text')}
  known = {}
  for r in lrows:
    if r['namespace'] in ('UNIQUE', 'ITEM'):
      known.setdefault(r['refName'], r['name'])
  en_groups = {}
  for gid, _, e in en_list:
    en_groups.setdefault(gid, []).append(e)
  ok = {}
  notes = []
  for g in groups:
    gid, le = g.get('id'), g.get('entries', [])
    ee = en_groups.get(gid)
    if ee is None:
      continue
    if len(ee) != len(le):
      notes.append(f'{gid} length {len(le)}/{len(ee)}')
      continue
    hit = tot = 0
    for a, b in zip(ee, le):
      ref = a.get('name', a['type'])
      if ref in known:
        tot += 1
        hit += known[ref] == b.get('name', b['type'])
    if tot >= 5 and hit / tot > 0.95:
      ok[gid] = le
    else:
      notes.append(f'{gid} order {hit}/{tot}')
  report['langs'][lang] = f'item groups matched {len(ok)}/{len(en_groups)}' + (f' (not: {", ".join(notes)})' if notes else '') + '; '

  def local (key):
    if key[0] == 'static':
      return st.get(key[1])
    _, gid, gi = key
    le = ok.get(gid)
    if le is None:
      return None
    e = le[gi]
    return e.get('name', e['type'])
  return local


# ---------- stats ----------

def refresh_stats (dumps, report):
  en = read_dump(dumps, 'en', 'stats')
  if en is None:
    sys.exit('en/stats.json missing')
  rows = {lang: read_ndjson(os.path.join(DATA, lang, 'stats.ndjson')) for lang in LANGS}
  texts = {}
  for lang in LANGS:
    d = read_dump(dumps, lang, 'stats')
    if d:
      texts[lang] = {e['id']: e['text'] for g in d for e in g.get('entries', [])}

  known_ids = {i for s in iter_stats(rows['en']) for ids in s['trade']['ids'].values() for i in ids}
  plain = {}  # ref -> index of a top-level single stat
  in_group = set()
  for i, r in enumerate(rows['en']):
    if 'stats' in r:
      in_group.update(s['ref'] for s in r['stats'])
    else:
      plain.setdefault(r['ref'], i)

  matchers = {lang: {m['string'] for s in iter_stats(rows[lang]) for m in s['matchers']} for lang in LANGS}
  adds = []  # ('id', ref, type, id) or ('new', stat dict, id)
  new_by_ref = {}
  for g in en:
    for e in g.get('entries', []):
      sid, text = e['id'], e['text']
      typ = e.get('type', sid.split('.')[0])
      if typ not in STAT_TYPES or sid in known_ids:
        continue
      if '\n' in text or e.get('option') or '(Local)' in text or text.endswith(')') and ' (' in text:
        report['skipped'].append(f'stat {sid}: "{text}" (multi-line, option or variant; add by hand if needed)')
        continue
      ref = text
      if ref in in_group:
        report['skipped'].append(f'stat {sid}: "{text}" (ref is in a stat group)')
        continue
      if ref in plain:
        if rows['en'][plain[ref]]['trade']['ids'].get(typ):
          report['skipped'].append(f'stat {sid}: "{text}" (another {typ} id already on this line)')
          continue
        adds.append(('id', ref, typ, sid))
        report['stat_ids'].append(f'{ref} + {sid}')
      elif ref not in new_by_ref and matcher_text(text) in matchers['en']:
        report['skipped'].append(f'stat {sid}: "{text}" (same wording as a line we have under another ref)')
        continue
      elif ref in new_by_ref:
        new_by_ref[ref]['trade']['ids'].setdefault(typ, []).append(sid)
      else:
        stat = {'ref': ref, 'better': 1, 'matchers': [{'string': matcher_text(text)}], 'trade': {'ids': {typ: [sid]}}}
        new_by_ref[ref] = stat
        adds.append(('new', stat, sid))
        report['stats'].append(f'{ref} ({sid})')
      known_ids.add(sid)

  for lang in LANGS:
    lrows = rows[lang]
    lt = texts.get(lang, {})
    idx = {r['ref']: r for r in lrows if 'stats' not in r}
    n_new = n_ids = 0
    for a in adds:
      if a[0] == 'id':
        _, ref, typ, sid = a
        r = idx.get(ref)
        if r is not None and not r['trade']['ids'].get(typ):
          r['trade']['ids'][typ] = [sid]
          n_ids += 1
      else:
        _, stat, sid = a
        s = json.loads(json.dumps(stat))
        if lang != 'en':
          t = lt.get(sid)
          if t is None:
            report['skipped'].append(f'{lang}: no translation for stat "{stat["ref"]}"')
            continue
          if matcher_text(t) in matchers[lang]:
            report['skipped'].append(f'{lang}: stat "{stat["ref"]}" wording already used by another line')
            continue
          s['matchers'] = [{'string': matcher_text(t)}]
          matchers[lang].add(matcher_text(t))
        lrows.append(s)
        n_new += 1
    write_ndjson(os.path.join(DATA, lang, 'stats.ndjson'), lrows)
    report['langs'][lang] = report['langs'].get(lang, '') + f'stats +{n_new} lines, +{n_ids} ids'


def main ():
  args = sys.argv[1:]
  out = None
  if '--report' in args:
    i = args.index('--report')
    out = args[i + 1]
    del args[i:i + 2]
  if len(args) != 2:
    sys.exit(__doc__)
  dumps, bases = args
  report = {k: [] for k in ('uniques', 'bases', 'exchange', 'tags', 'stats', 'stat_ids', 'skipped')}
  report['langs'] = {}
  refresh_items(dumps, pob_categories(bases), report)
  refresh_stats(dumps, report)

  lines = ['## Trade data refresh', '']
  for lang, s in report['langs'].items():
    lines.append(f'- **{lang}**: {s}')
  for key, title in (('uniques', 'New uniques'), ('bases', 'New base types'), ('exchange', 'New exchange items'),
                     ('tags', 'Exchange tags added'), ('stats', 'New stat lines'), ('stat_ids', 'Trade ids added to known lines'),
                     ('skipped', 'Skipped (check by hand)')):
    v = report[key]
    lines += ['', f'<details><summary>{title}: {len(v)}</summary>', '']
    lines += [f"- {x}" for x in v[:120]]
    if len(v) > 120:
      lines.append(f"- … and {len(v) - 120} more (full list: run the tool with --report)")
    lines += ['', '</details>']
  text = '\n'.join(lines) + '\n'
  if out:
    with open(out, 'w', encoding='utf-8') as f:
      f.write(text)
  print(text)


if __name__ == '__main__':
  main()
