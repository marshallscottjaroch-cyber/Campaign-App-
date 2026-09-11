# Florida Campaign — Vanilla MVP (Hex Map Systems v0.2)

**One-liner:** A web app for two faction generals to run a fog-of-war Florida **hex** map campaign, assign OPR tabletop mission briefs to players, and update the map from reported battle results.

No build step. No package manager. No React.

## Map Systems v0.2

- Axial **flat-top hex** theater (stylized Florida)
- Free movement with **MP** pathfinding + terrain / river-edge costs
- **Vision radius** FoW (observer terrain mods)
- Contact = enemy armies on the **same hex** → existing OPR brief + W/L/D loop

**Architecture locked.** **Numbers not locked.** MP rates, vision radius, and terrain costs in `data/rules.json` are **provisional placeholders** (labeled `_note: provisional — dial after playtest`). They are TBD after playtest — not campaign defaults. See [docs/MAP_SYSTEMS_v0.2.md](docs/MAP_SYSTEMS_v0.2.md).

## How to open

**From GitHub**

1. Click **Code → Download ZIP**.
2. Unzip the folder.
3. Use Option A or B below.

**Option A — open the file**

1. Open `index.html` in a modern browser.
2. Built-in fallback data is used if remote JSON cannot load.

**Option B — simple static server (recommended)**

From this folder run:

    python3 -m http.server 8080

Then visit http://localhost:8080/

With a server, edits to `data/*.json` load on refresh (use **Reset demo** if you have saved progress).

## Demo click-path

1. Start as **General A** (default).
2. Click **Gator Cavalry** in the orders list (starts on a hill hex north of Orlando).
3. Reachable hexes highlight on the map. Click **Orlando** (or pick it under Move to) — cavalry can reach it within provisional MP.
4. Switch role to **Umpire**.
5. Click **Resolve turn** (moves → contacts → briefs).
6. Confirm a contact brief appears (label uses nearest landmark, e.g. Orlando).
7. Switch to **Player** (or stay on Umpire).
8. Report Attacker win, Attacker loss, or Draw.
9. Map updates: winner holds hex; loser retreats to an adjacent passable hex or is destroyed; draw = standoff (defender falls back adjacent when possible).
10. As Umpire, click **Advance to next week** when all briefs are resolved.
11. Optional: **Scout** an adjacent hex to reveal presence + size band only.
12. **Reset demo** (Umpire panel) restores the seed.

## Roles

- **General A / B:** submit move / scout / hold orders; vision-fogged map
- **Player:** read briefs; fight OPR off-app; report win/loss/draw
- **Umpire:** resolve turn, advance week, reset, override reports

The app does **not** roll OPR combat. It only issues briefs and accepts results.

## Tweaking data

- `data/hexmap.json` — hexes `{q,r,terrain,landmark?}`, river `edges` with `bridge`
- `data/rules.json` — **provisional** `moveRates`, `terrainCosts`, `vision`, size bands, brief templates
- `data/seed.json` — armies with `{q,r}`, ownership keys `"q,r"`, players, sitrep
- `data/map.json` — legacy region catalog (kept for reference; hexmap is SoT for play)

After changing seed or hexmap, use **Reset demo** so old localStorage progress is cleared.

## Smoke test

    node scripts/smoke-hex-v02.js

Checks MP pathfinding, vision radius mods, river blocking, and contact → brief generation.

## Out of v1

Supply, politics, navy, money, intrigue, road network, intervening LOS — not included.

See `docs/MAP_SYSTEMS_v0.2.md` and `docs/ONE_PAGER_v0.1.md`.
