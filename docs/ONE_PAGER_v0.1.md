# Campaign One-Pager (v0.1) — LOCKED

Bath-inspired Florida async war campaign. Source of truth for the first web app draft.
Defaults marked *adjustable*.

## Pitch
Two generals command factions on a shared Florida campaign map (fog of war). They move armies async. When opposing forces meet, the system creates an **OPR mission brief** for enrolled players. Players fight the tabletop battle with **One Page Rules**, report the result, and the map updates.

## Roles
- **General A / General B** — issue moves & orders; see only their fogged map; get sitreps
- **Players** — enroll under a faction; get assigned briefs; fight OPR; report outcome
- **Umpire / System** — movement, contacts, fog, briefs, apply reported results (override allowed)

## Map & time
- Theater: **Florida** (abstract regions/hexes first — *adjustable*: counties vs hex grid)
- Turn: **1 campaign week** per turn (*adjustable*)
- Flow: Generals submit orders → resolve all moves → detect contacts → issue briefs → wait for results → next turn

## Movement & contact
- Armies have a move allowance (infantry slower than cavalry/mech — *adjustable* rates)
- Same region/hex as enemy → **contact**
- Optional later: roads / rough / water modify speed (*v2*)

## Fog of war & scouts
- Default: you see your armies + regions you’ve occupied/adjacent (*adjustable*)
- Enemy: only if **scouted** or in contact
- Scout action: reveals presence + rough size band (small/medium/large), not full composition (*adjustable*)

## Clashes → OPR briefs
On contact, auto-generate a brief:
- Mission name, attacker/defender, force hints
- **Objective** (seize, hold, destroy, delay — from a template list)
- **Terrain layout notes** for the OPR table (e.g. 3–4 terrain pieces, open flank, river, urban)
- Reporting deadline (optional)

App does **not** play OPR — only issues the brief and accepts the result.

## After the battle (reported result)
Report: **win / loss / draw** (+ optional notes; casualties later).
Simple first effects (*adjustable*):
- Winner: holds the region; loser retreats one step (or destroyed if no retreat)
- Draw: both hold adjacent / standoff
- Destroyed remnant rule later

## Enrollment
- Player joins Faction A or B
- When a clash needs fighters, assign available players (or general picks)

## Explicitly out of v1
Supply, politics, navy, money, character intrigue (classic Bath extras) — later.

Locked: 2026-09-07
