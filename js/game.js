/* Core campaign logic for Map Systems v0.2 (axial hex / MP / vision).
   Does NOT implement OPR combat dice — only briefs + accept reported results. */
(function (global) {
  const Game = {};
  const STATE_KEY = 'florida-campaign-vanilla-mvp-hex-v02';
  const ROLE_KEY = 'florida-campaign-vanilla-mvp-role';

  const AXIAL_DIRS = [
    [+1, 0],
    [+1, -1],
    [0, -1],
    [-1, 0],
    [-1, +1],
    [0, +1],
  ];

  function uid(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  function hexKey(q, r) {
    return `${q},${r}`;
  }

  function parseKey(key) {
    const [q, r] = String(key).split(',').map(Number);
    return { q, r };
  }

  Game.hexKey = hexKey;
  Game.AXIAL_DIRS = AXIAL_DIRS;

  Game.getHex = function (state, q, r) {
    if (!state.hexIndex) {
      state.hexIndex = {};
      for (const h of state.hexes) state.hexIndex[hexKey(h.q, h.r)] = h;
    }
    return state.hexIndex[hexKey(q, r)] || state.hexes.find((h) => h.q === q && h.r === r);
  };

  Game.ensureEdgeIndex = function (state) {
    if (state.edgeIndex) return state.edgeIndex;
    const idx = {};
    for (const e of state.edges || []) {
      const k1 = `${hexKey(e.a.q, e.a.r)}|${hexKey(e.b.q, e.b.r)}`;
      const k2 = `${hexKey(e.b.q, e.b.r)}|${hexKey(e.a.q, e.a.r)}`;
      idx[k1] = e;
      idx[k2] = e;
    }
    state.edgeIndex = idx;
    return idx;
  };

  Game.getEdge = function (state, a, b) {
    const idx = Game.ensureEdgeIndex(state);
    return idx[`${hexKey(a.q, a.r)}|${hexKey(b.q, b.r)}`] || null;
  };

  Game.neighbors = function (state, q, r) {
    const out = [];
    for (const [dq, dr] of AXIAL_DIRS) {
      const h = Game.getHex(state, q + dq, r + dr);
      if (h) out.push(h);
    }
    return out;
  };

  Game.terrainCost = function (terrain) {
    const costs = global.Campaign.rules.terrainCosts || {};
    if (terrain === 'sea' || costs[terrain] == null) return null;
    return costs[terrain];
  };

  Game.canEnter = function (state, from, toHex) {
    if (!toHex || toHex.terrain === 'sea') return false;
    const cost = Game.terrainCost(toHex.terrain);
    if (cost == null) return false;
    const edge = Game.getEdge(state, from, toHex);
    if (edge && edge.river && !edge.bridge) return false;
    return true;
  };

  Game.sizeBandForStrength = function (strength) {
    const { small, medium, large } = global.Campaign.rules.sizeBands;
    if (strength >= small[0] && strength <= small[1]) return 'small';
    if (strength >= medium[0] && strength <= medium[1]) return 'medium';
    if (strength >= large[0]) return 'large';
    return 'small';
  };

  Game.moveRate = function (type) {
    return global.Campaign.rules.moveRates[type] ?? 1;
  };

  Game.pickTemplate = function (list, seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return list[h % list.length];
  };

  Game.nearestLandmarkName = function (state, q, r) {
    const here = Game.getHex(state, q, r);
    if (here?.landmark) return here.landmark;
    let best = null;
    let bestD = Infinity;
    const Fog = global.Campaign.Fog;
    for (const lm of state.landmarks || []) {
      const d = Fog.hexDistance({ q, r }, lm);
      if (d < bestD) {
        bestD = d;
        best = lm.name;
      }
    }
    return best || `Hex ${q},${r}`;
  };

  Game.hexLabel = function (state, q, r) {
    const here = Game.getHex(state, q, r);
    if (here?.landmark) return here.landmark;
    return `${Game.nearestLandmarkName(state, q, r)} (${q},${r})`;
  };

  /** Dijkstra: map of hexKey -> remaining MP cost from start (spent). */
  Game.reachableHexes = function (state, army) {
    const maxMp = Game.moveRate(army.type);
    const startKey = hexKey(army.q, army.r);
    const best = new Map([[startKey, 0]]);
    const queue = [{ q: army.q, r: army.r, spent: 0 }];
    while (queue.length) {
      queue.sort((a, b) => a.spent - b.spent);
      const cur = queue.shift();
      const curKey = hexKey(cur.q, cur.r);
      if (cur.spent > (best.get(curKey) ?? Infinity)) continue;
      for (const n of Game.neighbors(state, cur.q, cur.r)) {
        if (!Game.canEnter(state, cur, n)) continue;
        const step = Game.terrainCost(n.terrain);
        if (step == null) continue;
        const spent = cur.spent + step;
        if (spent > maxMp) continue;
        const nk = hexKey(n.q, n.r);
        if (spent < (best.get(nk) ?? Infinity)) {
          best.set(nk, spent);
          queue.push({ q: n.q, r: n.r, spent });
        }
      }
    }
    best.delete(startKey);
    return best;
  };

  Game.canReach = function (state, army, tq, tr) {
    if (army.q === tq && army.r === tr) return true;
    const reach = Game.reachableHexes(state, army);
    return reach.has(hexKey(tq, tr));
  };

  Game.buildSeedState = function (hexmap, seedData) {
    const hexes = hexmap.hexes.map((h) => ({ ...h }));
    const landmarks = (hexmap.landmarks || []).map((l) => ({ ...l }));
    const edges = (hexmap.edges || []).map((e) => ({
      a: { ...e.a },
      b: { ...e.b },
      river: !!e.river,
      bridge: !!e.bridge,
    }));

    const ownership = { ...(seedData.ownership || {}) };
    const armies = seedData.armies.map((a) => ({
      ...a,
      q: a.q,
      r: a.r,
    }));

    const knownA = new Set();
    const knownB = new Set();
    for (const [key, owner] of Object.entries(ownership)) {
      if (owner === 'A') knownA.add(key);
      if (owner === 'B') knownB.add(key);
    }

    const state = {
      turn: seedData.turn || 1,
      turnPhase: seedData.turnPhase || 'orders',
      hexes,
      landmarks,
      edges,
      armies,
      ownership,
      knownHexes: { A: [], B: [] },
      orders: [],
      contacts: [],
      briefs: [],
      scoutReveals: [],
      players: seedData.players.map((p) => ({ ...p })),
      sitrep: [...(seedData.sitrep || [])],
      lastResolvedTurn: 0,
      meta: hexmap.meta || {},
    };

    const Fog = global.Campaign.Fog;
    for (const army of state.armies) {
      Fog.revealVisionAroundArmy(state, army);
      ownership[hexKey(army.q, army.r)] = army.faction;
    }
    // Merge any pre-seeded known from ownership into knownHexes already done via vision
    state.knownHexes.A = [...new Set([...state.knownHexes.A, ...knownA])];
    state.knownHexes.B = [...new Set([...state.knownHexes.B, ...knownB])];

    return state;
  };

  function generateBrief(state, contact, attacker, defender) {
    const rules = global.Campaign.rules;
    const label = Game.nearestLandmarkName(state, contact.q, contact.r);
    const objectives = Object.keys(rules.objectiveTemplates);
    const objective = Game.pickTemplate(objectives, contact.id + label);
    const objectiveText = Game.pickTemplate(rules.objectiveTemplates[objective], contact.id);
    const terrainNotes = Game.pickTemplate(rules.terrainNoteTemplates, contact.id + 'terrain');
    const missionName = Game.pickTemplate(rules.missionNameTemplates, contact.id).replace(
      '{region}',
      label
    );
    const aBand = Game.sizeBandForStrength(attacker.strength);
    const dBand = Game.sizeBandForStrength(defender.strength);
    const attackerForceHint = Game.pickTemplate(rules.forceHintTemplates[aBand], attacker.id);
    const defenderForceHint = Game.pickTemplate(rules.forceHintTemplates[dBand], defender.id);
    const players = state.players.filter((p) => p.faction === attacker.faction);
    const assigned = players[0]?.id;

    return {
      id: uid('brief'),
      turn: state.turn,
      contactId: contact.id,
      q: contact.q,
      r: contact.r,
      regionLabel: label,
      hexKey: hexKey(contact.q, contact.r),
      missionName,
      attackerFaction: attacker.faction,
      defenderFaction: defender.faction,
      attackerArmyId: attacker.id,
      defenderArmyId: defender.id,
      attackerForceHint: `${attackerForceHint} (${aBand})`,
      defenderForceHint: `${defenderForceHint} (${dBand})`,
      objective,
      objectiveText,
      terrainNotes,
      status: 'open',
      assignedPlayerId: assigned,
    };
  }

  Game.submitOrder = function (state, order) {
    const next = cloneState(state);
    next.hexIndex = null;
    next.edgeIndex = null;
    next.orders = next.orders.filter(
      (o) => !(o.turn === order.turn && o.armyId === order.armyId)
    );
    next.orders.push({
      ...order,
      id: uid('order'),
      submittedAt: new Date().toISOString(),
    });
    const army = next.armies.find((a) => a.id === order.armyId);
    let targetName = '';
    if (order.targetQ != null && order.targetR != null) {
      targetName = Game.hexLabel(next, order.targetQ, order.targetR);
    }
    next.sitrep = [
      `${army?.name ?? order.armyId}: ${order.kind}${targetName ? ' → ' + targetName : ''} (Week ${order.turn}).`,
      ...next.sitrep,
    ].slice(0, 40);
    return next;
  };

  Game.resolveTurnOrders = function (state) {
    const next = cloneState(state);
    next.hexIndex = null;
    next.edgeIndex = null;
    const turnOrders = next.orders.filter((o) => o.turn === next.turn);
    const log = [];
    const Fog = global.Campaign.Fog;

    for (const order of turnOrders.filter((o) => o.kind === 'scout')) {
      const army = next.armies.find((a) => a.id === order.armyId && !a.destroyed);
      if (!army || order.targetQ == null || order.targetR == null) continue;
      const dist = Fog.hexDistance(army, { q: order.targetQ, r: order.targetR });
      if (dist > 1) {
        log.push(`Scout by ${army.name} failed: target not adjacent.`);
        continue;
      }
      Fog.revealHex(next, army.faction, order.targetQ, order.targetR);
      // Also reveal radius-1 around target (scout pulse)
      for (const n of Game.neighbors(next, order.targetQ, order.targetR)) {
        if (n.terrain !== 'sea') Fog.revealHex(next, army.faction, n.q, n.r);
      }
      const enemies = next.armies.filter(
        (a) =>
          a.faction !== army.faction &&
          !a.destroyed &&
          a.q === order.targetQ &&
          a.r === order.targetR
      );
      const label = Game.hexLabel(next, order.targetQ, order.targetR);
      if (enemies.length === 0) {
        log.push(`${army.name} scouted ${label}: no enemy found.`);
      }
      for (const enemy of enemies) {
        const reveal = {
          turn: next.turn,
          faction: army.faction,
          q: order.targetQ,
          r: order.targetR,
          enemyArmyId: enemy.id,
          sizeBand: Game.sizeBandForStrength(enemy.strength),
        };
        next.scoutReveals.push(reveal);
        log.push(
          `${army.name} scouted ${label}: enemy ${reveal.sizeBand} force detected.`
        );
      }
    }

    for (const order of turnOrders.filter((o) => o.kind === 'move')) {
      const army = next.armies.find((a) => a.id === order.armyId && !a.destroyed);
      if (!army || order.targetQ == null || order.targetR == null) continue;
      if (!Game.canReach(next, army, order.targetQ, order.targetR)) {
        log.push(
          `${army.name} cannot reach ${Game.hexLabel(next, order.targetQ, order.targetR)} (MP ${Game.moveRate(army.type)}).`
        );
        continue;
      }
      const fromLabel = Game.hexLabel(next, army.q, army.r);
      army.q = order.targetQ;
      army.r = order.targetR;
      next.ownership[hexKey(order.targetQ, order.targetR)] = army.faction;
      Fog.revealVisionAroundArmy(next, army);
      log.push(
        `${army.name} moved ${fromLabel} → ${Game.hexLabel(next, order.targetQ, order.targetR)}.`
      );
    }

    const byHex = new Map();
    for (const army of next.armies.filter((a) => !a.destroyed)) {
      const key = hexKey(army.q, army.r);
      const list = byHex.get(key) ?? [];
      list.push(army);
      byHex.set(key, list);
    }

    const newContacts = [];
    for (const [key, armies] of byHex) {
      const aArmies = armies.filter((a) => a.faction === 'A');
      const bArmies = armies.filter((a) => a.faction === 'B');
      if (aArmies.length === 0 || bArmies.length === 0) continue;
      const { q, r } = parseKey(key);
      const armyA = aArmies[0];
      const armyB = bArmies[0];
      const existing = next.contacts.find(
        (c) =>
          c.turn === next.turn &&
          c.q === q &&
          c.r === r &&
          ((c.armyAId === armyA.id && c.armyBId === armyB.id) ||
            (c.armyAId === armyB.id && c.armyBId === armyA.id))
      );
      if (existing) continue;

      const contact = {
        id: uid('contact'),
        turn: next.turn,
        q,
        r,
        armyAId: armyA.id,
        armyBId: armyB.id,
      };
      const movedIn = turnOrders.find(
        (o) =>
          o.kind === 'move' &&
          o.targetQ === q &&
          o.targetR === r &&
          (o.armyId === armyA.id || o.armyId === armyB.id)
      );
      const attacker = movedIn
        ? next.armies.find((a) => a.id === movedIn.armyId)
        : armyA;
      const defender = attacker.id === armyA.id ? armyB : armyA;
      const brief = generateBrief(next, contact, attacker, defender);
      contact.briefId = brief.id;
      next.briefs.push(brief);
      newContacts.push(contact);
      Fog.revealHex(next, 'A', q, r);
      Fog.revealHex(next, 'B', q, r);
      log.push(
        `CONTACT near ${brief.regionLabel} (${q},${r}): ${armyA.name} vs ${armyB.name}. Brief issued: ${brief.missionName}.`
      );
    }
    next.contacts.push(...newContacts);

    next.turnPhase = newContacts.length > 0 ? 'awaiting_results' : 'resolved';
    next.lastResolvedTurn = next.turn;
    next.sitrep = [...log, ...next.sitrep].slice(0, 40);
    if (newContacts.length === 0) {
      next.sitrep = [
        `Week ${next.turn} resolved with no contacts. Advance when ready.`,
        ...next.sitrep,
      ];
    } else {
      next.sitrep = [
        `Week ${next.turn}: ${newContacts.length} contact(s). Players report battle results.`,
        ...next.sitrep,
      ];
    }
    return next;
  };

  function retreatTarget(state, army, fromQ, fromR) {
    const candidates = Game.neighbors(state, fromQ, fromR)
      .filter((h) => h.terrain !== 'sea' && Game.terrainCost(h.terrain) != null)
      .filter((h) => {
        const edge = Game.getEdge(state, { q: fromQ, r: fromR }, h);
        if (edge && edge.river && !edge.bridge) return false;
        return true;
      });

    candidates.sort((a, b) => {
      const score = (h) => {
        const key = hexKey(h.q, h.r);
        if (state.ownership[key] === army.faction) return 0;
        const enemy = state.armies.some(
          (x) => !x.destroyed && x.faction !== army.faction && x.q === h.q && x.r === h.r
        );
        if (enemy) return 3;
        if (state.ownership[key] == null) return 1;
        return 2;
      };
      return score(a) - score(b);
    });

    for (const h of candidates) {
      const enemy = state.armies.some(
        (x) => !x.destroyed && x.faction !== army.faction && x.q === h.q && x.r === h.r
      );
      if (!enemy) return h;
    }
    return null;
  }

  Game.applyBattleResult = function (state, briefId, result, notes, reportedBy) {
    const next = cloneState(state);
    next.hexIndex = null;
    next.edgeIndex = null;
    const brief = next.briefs.find((b) => b.id === briefId);
    if (!brief || brief.status === 'resolved') return next;

    brief.result = result;
    brief.resultNotes = notes;
    brief.reportedBy = reportedBy;
    brief.reportedAt = new Date().toISOString();
    brief.status = 'reported';

    const attacker = next.armies.find((a) => a.id === brief.attackerArmyId);
    const defender = next.armies.find((a) => a.id === brief.defenderArmyId);
    const label = brief.regionLabel || Game.nearestLandmarkName(next, brief.q, brief.r);
    const Fog = global.Campaign.Fog;

    if (result === 'draw') {
      brief.status = 'resolved';
      // Standoff: push defender to an adjacent passable hex if possible; else both remain.
      if (defender && attacker) {
        const retreat = retreatTarget(next, defender, brief.q, brief.r);
        if (retreat && defender.q === brief.q && defender.r === brief.r) {
          defender.q = retreat.q;
          defender.r = retreat.r;
          Fog.revealVisionAroundArmy(next, defender);
          next.sitrep = [
            `Draw at ${label}: standoff. ${defender.name} falls back to adjacent hex; ${attacker.name} holds.`,
            ...next.sitrep,
          ];
        } else {
          next.sitrep = [`Draw at ${label}: standoff. Both forces remain.`, ...next.sitrep];
        }
      } else {
        next.sitrep = [`Draw at ${label}: standoff. Both forces remain.`, ...next.sitrep];
      }
    } else if (attacker && defender) {
      const winnerFaction = result === 'win' ? brief.attackerFaction : brief.defenderFaction;
      const winner = winnerFaction === attacker.faction ? attacker : defender;
      const loser = winner.id === attacker.id ? defender : attacker;

      next.ownership[hexKey(brief.q, brief.r)] = winner.faction;
      winner.q = brief.q;
      winner.r = brief.r;
      Fog.revealVisionAroundArmy(next, winner);

      if (loser.q === brief.q && loser.r === brief.r) {
        const retreat = retreatTarget(next, loser, brief.q, brief.r);
        if (retreat) {
          loser.q = retreat.q;
          loser.r = retreat.r;
          Fog.revealVisionAroundArmy(next, loser);
          next.sitrep = [
            `${winner.name} holds ${label}. ${loser.name} retreats to ${Game.hexLabel(next, retreat.q, retreat.r)}.`,
            ...next.sitrep,
          ];
        } else {
          loser.destroyed = true;
          next.sitrep = [
            `${winner.name} holds ${label}. ${loser.name} destroyed (nowhere to retreat).`,
            ...next.sitrep,
          ];
        }
      }
      brief.status = 'resolved';
    }

    const open = next.briefs.filter((b) => b.turn === next.turn && b.status !== 'resolved');
    if (open.length === 0 && next.turnPhase === 'awaiting_results') {
      next.turnPhase = 'resolved';
      next.sitrep = [
        `All Week ${next.turn} battles resolved. Umpire may advance the turn.`,
        ...next.sitrep,
      ];
    }
    return next;
  };

  Game.advanceTurn = function (state) {
    const next = cloneState(state);
    next.hexIndex = null;
    next.edgeIndex = null;
    if (next.turnPhase === 'orders') {
      next.sitrep = ['Resolve current orders before advancing.', ...next.sitrep];
      return next;
    }
    const open = next.briefs.filter((b) => b.turn === next.turn && b.status !== 'resolved');
    if (open.length > 0) {
      next.sitrep = [
        `Cannot advance: ${open.length} open brief(s) still need results.`,
        ...next.sitrep,
      ];
      return next;
    }
    next.turn += 1;
    next.turnPhase = 'orders';
    next.sitrep = [
      `Campaign Week ${next.turn} begins. Generals submit new orders.`,
      ...next.sitrep,
    ];
    return next;
  };

  Game.loadState = function (fallbackSeed) {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.hexes && parsed.hexes.length) return parsed;
      }
    } catch (_) {
      /* ignore */
    }
    return fallbackSeed;
  };

  Game.saveState = function (state) {
    const copy = cloneState(state);
    delete copy.hexIndex;
    delete copy.edgeIndex;
    localStorage.setItem(STATE_KEY, JSON.stringify(copy));
  };

  Game.loadRole = function () {
    return localStorage.getItem(ROLE_KEY) || 'generalA';
  };

  Game.saveRole = function (role) {
    localStorage.setItem(ROLE_KEY, role);
  };

  Game.resetState = function (seedFactory) {
    const seed = seedFactory();
    Game.saveState(seed);
    return seed;
  };

  /** @deprecated region helper — returns landmark-like view for a hex key or landmark id */
  Game.getRegion = function (state, id) {
    if (id == null) return null;
    if (typeof id === 'string' && id.includes(',')) {
      const { q, r } = parseKey(id);
      const hex = Game.getHex(state, q, r);
      return {
        id,
        name: Game.hexLabel(state, q, r),
        q,
        r,
        adjacent: Game.neighbors(state, q, r)
          .filter((h) => h.terrain !== 'sea')
          .map((h) => hexKey(h.q, h.r)),
        landmark: hex?.landmark,
      };
    }
    const lm = (state.landmarks || []).find((l) => l.id === id || l.name === id);
    if (lm) {
      return {
        id: lm.id,
        name: lm.name,
        q: lm.q,
        r: lm.r,
        adjacent: Game.neighbors(state, lm.q, lm.r)
          .filter((h) => h.terrain !== 'sea')
          .map((h) => hexKey(h.q, h.r)),
      };
    }
    return null;
  };

  global.Campaign = global.Campaign || {};
  global.Campaign.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
