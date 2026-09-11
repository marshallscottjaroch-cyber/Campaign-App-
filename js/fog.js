/* Vision / fog-of-war for Map Systems v0.2 — hex radius from friendly armies. */
(function (global) {
  const Fog = {};

  function rules() {
    return global.Campaign.rules;
  }

  function hexKey(q, r) {
    return `${q},${r}`;
  }

  Fog.hexDistance = function (a, b) {
    const aq = a.q;
    const ar = a.r;
    const as = -aq - ar;
    const bq = b.q;
    const br = b.r;
    const bs = -bq - br;
    return Math.max(Math.abs(aq - bq), Math.abs(ar - br), Math.abs(as - bs));
  };

  Fog.visionRadiusForArmy = function (state, army) {
    const v = rules().vision || { baseRadius: 2, forestPenalty: 1, hillBonus: 1, minRadius: 1 };
    let radius = v.baseRadius ?? 2;
    const hex = global.Campaign.Game.getHex(state, army.q, army.r);
    if (!hex) return Math.max(v.minRadius ?? 1, radius);
    if (hex.terrain === 'forest') radius -= v.forestPenalty ?? 1;
    if (hex.terrain === 'hill' || hex.terrain === 'elevated') radius += v.hillBonus ?? 1;
    return Math.max(v.minRadius ?? 1, radius);
  };

  /** Set of hex keys currently in vision for a faction (from live armies + known). */
  Fog.visionHexKeys = function (state, faction) {
    const keys = new Set(state.knownHexes?.[faction] || []);
    for (const army of state.armies) {
      if (army.destroyed || army.faction !== faction) continue;
      const radius = Fog.visionRadiusForArmy(state, army);
      for (const hex of state.hexes) {
        if (hex.terrain === 'sea') continue;
        if (Fog.hexDistance(army, hex) <= radius) {
          keys.add(hexKey(hex.q, hex.r));
        }
      }
      keys.add(hexKey(army.q, army.r));
    }
    return keys;
  };

  Fog.isHexVisible = function (state, faction, q, r) {
    if (faction == null) return true;
    const key = hexKey(q, r);
    if (state.knownHexes?.[faction]?.includes(key)) return true;
    for (const army of state.armies) {
      if (army.destroyed || army.faction !== faction) continue;
      if (Fog.hexDistance(army, { q, r }) <= Fog.visionRadiusForArmy(state, army)) return true;
    }
    return false;
  };

  Fog.visibleEnemyArmies = function (state, faction) {
    const enemy = state.armies.filter((a) => a.faction !== faction && !a.destroyed);
    const result = [];
    for (const army of enemy) {
      const inVision = Fog.isHexVisible(state, faction, army.q, army.r);
      const ownHere = state.armies.some(
        (a) =>
          a.faction === faction &&
          !a.destroyed &&
          a.q === army.q &&
          a.r === army.r
      );
      if (ownHere || inVision) {
        const scout = state.scoutReveals.find(
          (s) =>
            s.faction === faction &&
            s.enemyArmyId === army.id &&
            (s.turn === state.turn || s.turn === state.turn - 1)
        );
        result.push({
          army,
          sizeBand: scout
            ? scout.sizeBand
            : ownHere
              ? global.Campaign.Game.sizeBandForStrength(army.strength)
              : null,
          reason: ownHere ? 'contact' : scout ? 'scout' : 'vision',
        });
        continue;
      }
      const scout = state.scoutReveals.find(
        (s) =>
          s.faction === faction &&
          s.enemyArmyId === army.id &&
          (s.turn === state.turn || s.turn === state.turn - 1)
      );
      if (scout) {
        result.push({ army, sizeBand: scout.sizeBand, reason: 'scout' });
      }
    }
    return result;
  };

  Fog.revealHex = function (state, faction, q, r) {
    const key = hexKey(q, r);
    if (!state.knownHexes[faction]) state.knownHexes[faction] = [];
    if (!state.knownHexes[faction].includes(key)) {
      state.knownHexes[faction] = [...state.knownHexes[faction], key];
    }
  };

  Fog.revealVisionAroundArmy = function (state, army) {
    const radius = Fog.visionRadiusForArmy(state, army);
    for (const hex of state.hexes) {
      if (hex.terrain === 'sea') continue;
      if (Fog.hexDistance(army, hex) <= radius) {
        Fog.revealHex(state, army.faction, hex.q, hex.r);
      }
    }
  };

  global.Campaign = global.Campaign || {};
  global.Campaign.Fog = Fog;
})(typeof window !== 'undefined' ? window : globalThis);
