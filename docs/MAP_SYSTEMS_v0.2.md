# Map Systems v0.2 — Design Delta

Delta to locked Campaign One-Pager v0.1. How to run the demo: see README.md. MP / vision / terrain integers are provisional (`data/rules.json`); architecture below is locked. Does **not** change OPR briefs/results loop. No in-app OPR combat.

## Lock status (2026-09-11)
- **LOCKED:** systems architecture — axial hex grid, MP pathfinding, terrain/edge types, river-needs-bridge, vision radius FoW, contact on same hex → existing briefs/results.
- **NOT LOCKED:** numeric balance (MP rates, vision radius, terrain cost values). Ship provisional placeholders in `rules.json` labeled adjustable; dial after playtest.

## Why
Marshall played the region-hop MVP and wants hex/grid free movement, terrain that blocks/slows, and vision range modified by terrain. Usable movement/map/terrain/FoW first; tune feel later.

## Hex model
- **Axial coordinates** `(q, r)` flat-top hexes.
- Theater: stylized Florida outline on a compact grid (~18–24 columns × ~28–36 rows; water hexes outside land are impassable “sea”).
- **City labels** (Pensacola, Orlando, etc.) remain as named **landmarks** on specific hexes — not separate movement nodes.
- Contact = two enemy armies on the **same hex** after move resolution.

## Movement (data-driven; numbers provisional)
Each army spends **move points (MP)** per turn from `rules.moveRates` by type.

**Provisional placeholders (TBD — not campaign defaults):** infantry 3, cavalry 5, mech 4.

| Terrain / edge | Provisional cost | Notes |
|---|---|---|
| Clear / urban / coast | 1 MP | Default land |
| Rough / swamp / forest | 2 MP | Difficult |
| Elevated / hill | 1 MP | May give sight bonus |
| Road (optional later) | 1 MP | Defer roads network |
| River **edge** | Blocked | Cannot cross unless edge has `bridge: true` |
| Sea / lake hex | Impassable | Navy later |

Pathfinding: shortest path by MP within remaining allowance; generals pick destination hex in range (highlight reachable).

## Fog & vision (numbers provisional)
- Vision **radius** from each friendly army (replaces region-adjacency fog).
- **Provisional:** `rules.vision.baseRadius` = 2; forest/dense on observer hex **−1** (min 1); hill/elevated **+1**.
- Revealed: hexes in vision + friendly armies + scout markers.
- Enemy in vision: token only; composition hidden unless scouted.
- Scout: presence + size band (same bands as v0.1).

## Data files
```
data/hexmap.json     # hexes: {q,r, terrain, landmark?, bridges?}
data/rules.json      # moveRates, terrainCosts, vision{} — all adjustable / not locked
data/seed.json       # armies with {q,r}
```

## Contact → briefs → results (unchanged)
Same week flow. Brief label = nearest landmark or hex id. Winner holds hex; loser retreats adjacent or destroyed; draw = standoff.

## First hex slice — SHIPS
1. Axial hex map UI with terrain colors + bridge marks
2. Reachable-hex highlighting + move orders by MP
3. River edge blocking without bridge; rough costs extra MP
4. Vision radius FoW with terrain modifiers
5. Contact on same hex → existing brief/result pipeline
6. Seed armies on hexes; reset demo
7. Docs: this file + README; rules.json comments/labels that numbers are provisional

## DEFER
- Balance pass on MP/vision/costs (after playtest)
- Full Florida geographic accuracy
- Road network, intervening LOS, ZOC/stacking, navy, supply/politics

## Architecture locked for build
Axial hexes; MP by unit type; river edges blocked unless bridge; vision = hex radius with terrain mods on observer; scouts size-band only. Exact integers live only in adjustable `rules.json`.
