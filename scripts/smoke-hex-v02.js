#!/usr/bin/env node
/**
 * Smoke test for Map Systems v0.2 — movement costs, vision, river block, contact→brief.
 * Play map is data/hexmap.json (data/map.json is legacy). MP/vision/terrain are provisional.
 * Run: node scripts/smoke-hex-v02.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}
function loadScript(rel) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  vm.runInThisContext(code, { filename: rel });
}

const rules = loadJson('data/rules.json');
const hexmap = loadJson('data/hexmap.json');
const seed = loadJson('data/seed.json');

global.Campaign = { rules };
loadScript('js/fog.js');
loadScript('js/game.js');

const Game = global.Campaign.Game;
const Fog = global.Campaign.Fog;

let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed++;
  } else {
    console.log('OK  ', msg);
  }
}

assert(rules._note && /provisional/i.test(rules._note), 'rules.json top-level provisional note');
assert(rules.moveRates._note && /provisional/i.test(rules.moveRates._note), 'moveRates provisional note');
assert(rules.vision._note && /provisional/i.test(rules.vision._note), 'vision provisional note');
assert(rules.terrainCosts._note && /provisional/i.test(rules.terrainCosts._note), 'terrainCosts provisional note');

assert(Game.moveRate('infantry') === 3, 'provisional infantry MP = 3');
assert(Game.moveRate('cavalry') === 5, 'provisional cavalry MP = 5');
assert(Game.moveRate('mech') === 4, 'provisional mech MP = 4');
assert(Game.terrainCost('clear') === 1, 'clear cost 1');
assert(Game.terrainCost('forest') === 2, 'forest cost 2');
assert(Game.terrainCost('sea') == null, 'sea impassable');

const state = Game.buildSeedState(hexmap, seed);
assert(state.hexes.length > 100, `hexes loaded (${state.hexes.length})`);
assert(state.landmarks.length === 12, '12 landmarks');

const gator = state.armies.find((a) => a.id === 'a-3');
assert(gator && gator.q === 10 && gator.r === 14, 'Gator Cavalry at 10,14');
const orlando = state.landmarks.find((l) => l.id === 'orlando');
assert(orlando && orlando.q === 10 && orlando.r === 16, 'Orlando landmark at 10,16');

const reach = Game.reachableHexes(state, gator);
assert(reach.has('10,16'), 'Orlando reachable from Gator Cavalry within provisional cavalry MP');
assert(reach.size > 5, `reachable set non-trivial (${reach.size})`);

// Sea not reachable
assert(!reach.has('0,0') || Game.getHex(state, 0, 0)?.terrain !== 'sea' || !reach.has('0,0'), 'sea not in reach');
for (const key of reach.keys()) {
  const [q, r] = key.split(',').map(Number);
  const h = Game.getHex(state, q, r);
  assert(h && h.terrain !== 'sea', `reachable ${key} not sea`);
  if (h.terrain === 'sea') failed++;
}

// Vision: gator on hill → base 2 + 1 = 3
const vHill = Fog.visionRadiusForArmy(state, gator);
assert(vHill === 3, `hill observer vision = 3 (got ${vHill})`);

// Forest observer −1
const forestArmy = { ...gator, q: 8, r: 13 }; // forest hex if present
const fHex = Game.getHex(state, 8, 13);
if (fHex && fHex.terrain === 'forest') {
  const vForest = Fog.visionRadiusForArmy(state, forestArmy);
  assert(vForest === 1, `forest observer vision = 1 (got ${vForest})`);
} else {
  // find any forest
  const fh = state.hexes.find((h) => h.terrain === 'forest');
  assert(!!fh, 'has a forest hex');
  const vForest = Fog.visionRadiusForArmy(state, { ...gator, q: fh.q, r: fh.r });
  assert(vForest === 1, `forest observer vision = 1 (got ${vForest})`);
}

// River edge blocking: find a river without bridge
const blocked = (state.edges || []).find((e) => e.river && !e.bridge);
assert(!!blocked, 'has a blocked river edge');
if (blocked) {
  const can = Game.canEnter(state, blocked.a, Game.getHex(state, blocked.b.q, blocked.b.r));
  assert(can === false, 'cannot cross river without bridge');
  const bridged = (state.edges || []).find((e) => e.river && e.bridge);
  assert(!!bridged, 'has a bridged river edge');
  if (bridged) {
    const canB = Game.canEnter(state, bridged.a, Game.getHex(state, bridged.b.q, bridged.b.r));
    assert(canB === true, 'can cross river with bridge');
  }
}

// Contact → brief
let s = state;
s = Game.submitOrder(s, {
  turn: s.turn,
  faction: 'A',
  armyId: 'a-3',
  kind: 'move',
  targetQ: 10,
  targetR: 16,
});
s = Game.resolveTurnOrders(s);
const contacts = s.contacts.filter((c) => c.turn === 1);
assert(contacts.length >= 1, `contact created (${contacts.length})`);
assert(s.briefs.length >= 1, `brief issued (${s.briefs.length})`);
const brief = s.briefs[0];
assert(/Orlando/i.test(brief.regionLabel) || /Orlando/i.test(brief.missionName), `brief labeled near Orlando (${brief.regionLabel} / ${brief.missionName})`);
assert(s.turnPhase === 'awaiting_results', 'phase awaiting_results');

// Battle result retreat
s = Game.applyBattleResult(s, brief.id, 'win', 'smoke test', 'tester');
assert(brief.status === 'resolved' || s.briefs.find((b) => b.id === brief.id).status === 'resolved', 'brief resolved');
const loser = s.armies.find((a) => a.id === brief.defenderArmyId);
const winner = s.armies.find((a) => a.id === brief.attackerArmyId);
assert(winner && winner.q === 10 && winner.r === 16, 'winner holds Orlando hex');
assert(loser && (loser.destroyed || loser.q !== 10 || loser.r !== 16), 'loser retreated or destroyed');

console.log('\n' + (failed === 0 ? 'ALL SMOKE CHECKS PASSED' : `${failed} FAILURE(S)`));
process.exit(failed === 0 ? 0 : 1);
