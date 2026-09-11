# Florida Campaign App

**One-liner:** Two faction generals run a fog-of-war Florida **hex** campaign, issue OPR tabletop mission briefs, and update the map from reported battle results.

This repo is the playable **Map Systems v0.2** MVP. No build step. No package manager. Open `index.html` (or a tiny local server) and play.

The app does **not** roll One Page Rules combat. It only issues briefs and accepts win / loss / draw.

## What this version does

- Shared Florida **hex** theater (axial flat-top grid)
- Two generals (Faction A / Faction B) + Player + Umpire roles
- Move / scout / hold orders with **move-point** pathfinding
- Fog of war from army **vision radius** (terrain mods)
- Contact on the same hex → OPR mission brief (objective + terrain notes)
- Report win / loss / draw → winner holds hex, loser retreats
- Scouts reveal presence + size band (small / medium / large), not full lists
- Rules live in `data/rules.json` so numbers can be tweaked without rewriting code

**Out of v1:** supply, politics, navy, money, intrigue.

## How to open (no engineering required)

**Option A — open the file**

1. On GitHub, click `index.html`.
2. Click the raw file, save it with the rest of the folder, **or** download the repo ZIP: **Code → Download ZIP**.
3. Unzip and open `index.html` in Chrome / Edge / Firefox.

If the full Florida hex map does not load from a `file://` page, use Option B.

**Option B — recommended**

1. Download the ZIP (**Code → Download ZIP**) and unzip it.
2. On a computer with Python, in that folder run: `python3 -m http.server 8080`
3. Open http://localhost:8080/

Progress is saved in the browser (`localStorage`). Use **Reset demo** in the Umpire panel after changing data files.

## Demo click-path

1. Start as **General A**.
2. Click **Gator Cavalry** (hill hex north of Orlando).
3. Click **Orlando** (reachable hexes highlight).
4. Switch to **Umpire** → **Resolve turn**.
5. Confirm a contact brief (labeled near Orlando).
6. Report Attacker win, Attacker loss, or Draw.
7. Map updates. Umpire **Advance to next week** when briefs are done.
8. Optional: **Scout** an adjacent hex.

## Tweaking data (no rewrite)

- `data/hexmap.json` — hexes `{q,r,terrain,landmark?}`, river `edges` with `bridge`
- `data/rules.json` — **provisional** MP rates, terrain costs, vision, size bands, brief templates
- `data/seed.json` — starting armies, ownership, players, sitrep
- `data/map.json` — legacy region catalog (reference only; hexmap is the source of truth)

Balance numbers in `rules.json` are **placeholders** — dial after playtest. Architecture (hex MP, rivers need bridges, vision radius) is locked.

## Smoke test

```
node scripts/smoke-hex-v02.js
```

Checks MP pathfinding, vision mods, river blocking, and contact → brief generation.

## Docs

- [One-Pager v0.1](docs/ONE_PAGER_v0.1.md) — locked product
- [Map Systems v0.2](docs/MAP_SYSTEMS_v0.2.md) — hex movement / fog delta
