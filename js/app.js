/* App shell: role switcher, panels, localStorage. Hex map v0.2. Loads data/*.json (with embedded fallback).
   Map Systems v0.2 — does not roll OPR combat; MP/vision/terrain numbers are provisional. */
(function () {
  const Game = () => window.Campaign.Game;
  const MapUI = () => window.Campaign.MapUI;

  const ROLES = [
    { id: 'generalA', label: 'General A' },
    { id: 'generalB', label: 'General B' },
    { id: 'player', label: 'Player' },
    { id: 'umpire', label: 'Umpire' },
  ];

  /** Embedded fallbacks so file:// open works without a server. Prefer fetched JSON when available. */
  const FALLBACK_RULES = {
    _note: 'PROVISIONAL balance placeholders — dial after playtest.',
    turnLabel: 'Campaign Week',
    moveRates: { _note: 'provisional — dial after playtest', infantry: 3, cavalry: 5, mech: 4 },
    terrainCosts: {
      _note: 'provisional — dial after playtest',
      clear: 1, urban: 1, coast: 1, hill: 1, rough: 2, swamp: 2, forest: 2, sea: null,
    },
    vision: {
      _note: 'provisional — dial after playtest',
      baseRadius: 2, forestPenalty: 1, hillBonus: 1, minRadius: 1,
    },
    fog: { seeOwnArmies: true, scoutRevealsSizeBand: true },
    sizeBands: { small: [1, 3], medium: [4, 6], large: [7, 99] },
    objectiveTemplates: {
      seize: [
        'Seize and hold the key junction in this region by the end of the battle.',
        'Drive the enemy from the objective marker and secure it.',
      ],
      hold: [
        'Hold the defensive line for the duration of the engagement.',
        'Prevent the attacker from capturing your primary strongpoint.',
      ],
      destroy: [
        'Destroy or break the enemy spearhead before they consolidate.',
        'Eliminate the opposing command element (use an objective token as proxy).',
      ],
      delay: [
        'Delay the enemy advance — survive and contest until turn limit.',
        'Buy time: keep at least one unit within scoring range until the end.',
      ],
    },
    terrainNoteTemplates: [
      'Layout: 4 pieces — central hill, two woods, one ruin. Open flank on the east.',
      'Layout: urban cluster (3 buildings), a river/stream across mid-table, one bridge.',
      'Layout: dense scrub and one large ruin; both flanks relatively open.',
      'Layout: coastal scrub — 3 terrain pieces, long open approaches, one bunker/ruin.',
      'Layout: swampy ground (rough patches), one elevated road, scattered woods.',
    ],
    missionNameTemplates: [
      'Clash at {region}',
      'Battle of {region}',
      'Skirmish near {region}',
      'Push for {region}',
      'Stand at {region}',
    ],
    forceHintTemplates: {
      small: ['Light detachment', 'Raiding party', 'Scout company'],
      medium: ['Battle group', 'Combined arms column', 'Reinforced company'],
      large: ['Full brigade', 'Heavy assault force', 'Corps detachment'],
    },
  };

  // Minimal embedded hexmap fallback (landmarks + tiny land strip) if fetch fails
  const FALLBACK_HEXMAP = {
    meta: { coord: 'axial', orientation: 'flat-top', width: 6, height: 6 },
    landmarks: [
      { id: 'orlando', name: 'Orlando', q: 2, r: 3 },
      { id: 'tampa', name: 'Tampa', q: 1, r: 4 },
    ],
    hexes: [],
    edges: [],
  };
  for (let r = 0; r < 6; r++) {
    for (let q = 0; q < 6; q++) {
      const land = q >= 1 && q <= 4 && r >= 1 && r <= 4;
      const hex = { q, r, terrain: land ? 'clear' : 'sea' };
      if (q === 2 && r === 3) { hex.terrain = 'urban'; hex.landmark = 'Orlando'; hex.landmarkId = 'orlando'; }
      if (q === 1 && r === 4) { hex.terrain = 'urban'; hex.landmark = 'Tampa'; hex.landmarkId = 'tampa'; }
      if (q === 2 && r === 2) hex.terrain = land ? 'hill' : 'sea';
      if (q === 3 && r === 3) hex.terrain = land ? 'forest' : 'sea';
      FALLBACK_HEXMAP.hexes.push(hex);
    }
  }

  const FALLBACK_SEED = {
    turn: 1,
    turnPhase: 'orders',
    armies: [
      { id: 'a-3', name: 'Gator Cavalry', faction: 'A', type: 'cavalry', q: 2, r: 2, strength: 3 },
      { id: 'b-1', name: 'Orlando Battle Group', faction: 'B', type: 'mech', q: 2, r: 3, strength: 5 },
    ],
    ownership: { '2,2': 'A', '2,3': 'B', '1,4': 'B' },
    players: [
      { id: 'p1', name: 'Alex (Faction A)', faction: 'A' },
      { id: 'p2', name: 'Blake (Faction B)', faction: 'B' },
    ],
    sitrep: [
      'Embedded fallback map (fetch failed). Demo: move Gator Cavalry into Orlando.',
    ],
  };

  let hexmapData = FALLBACK_HEXMAP;
  let seedData = FALLBACK_SEED;
  let state = null;
  let role = 'generalA';
  let selectedArmyId = null;
  let selectedHexKey = null;
  let reportNotes = {};
  let reporterId = 'p1';
  let dataSourceNote = 'embedded fallback';

  function factionForRole() {
    if (role === 'generalA') return 'A';
    if (role === 'generalB') return 'B';
    return null;
  }

  function makeSeed() {
    return Game().buildSeedState(hexmapData, seedData);
  }

  function setState(next) {
    state = next;
    Game().saveState(state);
    render();
  }

  async function loadJson(path, fallback) {
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } catch (_) {
      return fallback;
    }
  }

  async function boot() {
    const [rules, hexmap, seed] = await Promise.all([
      loadJson('data/rules.json', FALLBACK_RULES),
      loadJson('data/hexmap.json', FALLBACK_HEXMAP),
      loadJson('data/seed.json', FALLBACK_SEED),
    ]);
    window.Campaign.rules = rules;
    hexmapData = hexmap;
    seedData = seed;
    const usedFetch =
      rules !== FALLBACK_RULES || hexmap !== FALLBACK_HEXMAP || seed !== FALLBACK_SEED;
    dataSourceNote = usedFetch ? 'data/*.json (hex v0.2)' : 'embedded fallback (file:// or fetch blocked)';

    state = Game().loadState(makeSeed());
    if (!state.hexes || !state.hexes.length) state = makeSeed();
    role = Game().loadRole();
    reporterId = state.players[0]?.id || 'p1';
    render();
  }

  function renderTopbar() {
    const el = document.getElementById('topbar');
    const phase = (state.turnPhase || '').replace(/_/g, ' ');
    const label = window.Campaign.rules.turnLabel || 'Campaign Week';
    el.innerHTML = `
      <div>
        <h1>Florida Campaign</h1>
        <p class="muted">${label} ${state.turn} · Phase: ${phase} · Hex Map v0.2 · Demo mode (no auth)</p>
      </div>
      <div class="role-switcher" role="group" aria-label="Role">
        ${ROLES.map(
          (r) =>
            `<button type="button" data-role="${r.id}" class="${role === r.id ? 'active' : ''}">${r.label}</button>`
        ).join('')}
      </div>
    `;
    el.querySelectorAll('[data-role]').forEach((btn) => {
      btn.addEventListener('click', () => {
        role = btn.getAttribute('data-role');
        Game().saveRole(role);
        selectedArmyId = null;
        render();
      });
    });
  }

  function armyPosLabel(army) {
    return Game().hexLabel(state, army.q, army.r);
  }

  function renderOrders() {
    const panel = document.getElementById('orders-panel');
    const faction = factionForRole();
    if (!faction) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    panel.hidden = false;
    const armies = state.armies.filter((a) => a.faction === faction && !a.destroyed);
    const turnOrders = state.orders.filter((o) => o.turn === state.turn && o.faction === faction);
    const canOrder = state.turnPhase === 'orders';
    const selected = armies.find((a) => a.id === selectedArmyId) || null;

    let html = `<h2>General ${faction} — Orders</h2>`;
    html += `<p class="muted small">MP rates &amp; vision numbers are <strong>provisional</strong> (edit <code>data/rules.json</code>).</p>`;
    if (!canOrder) {
      html += `<p class="banner warn">Orders locked this phase. Wait for umpire to advance the turn.</p>`;
    }
    html += '<ul class="army-list">';
    for (const army of armies) {
      const order = turnOrders.find((o) => o.armyId === army.id);
      html += `<li class="${selectedArmyId === army.id ? 'selected' : ''}">
        <button type="button" class="linkish" data-select-army="${army.id}"><strong>${army.name}</strong></button>
        <div class="muted small">${army.type} · str ${army.strength} · @ ${armyPosLabel(army)} (${army.q},${army.r}) · MP ${Game().moveRate(army.type)}</div>
        ${
          order
            ? `<div class="order-chip">Ordered: ${order.kind}${
                order.targetQ != null
                  ? ' → ' + Game().hexLabel(state, order.targetQ, order.targetR)
                  : ''
              }</div>`
            : ''
        }
      </li>`;
    }
    html += '</ul>';

    if (selected && canOrder) {
      const reach = Game().reachableHexes(state, selected);
      const reachList = [...reach.entries()]
        .map(([key, spent]) => {
          const [q, r] = key.split(',').map(Number);
          return { q, r, key, spent, label: Game().hexLabel(state, q, r) };
        })
        .sort((a, b) => a.spent - b.spent || a.label.localeCompare(b.label));

      const scoutTargets = Game()
        .neighbors(state, selected.q, selected.r)
        .filter((h) => h.terrain !== 'sea');

      html += `<div class="order-form">
        <h3>Orders for ${selected.name}</h3>
        <p class="muted small">Click a highlighted hex on the map, or pick from the lists. Reachable = within MP.</p>
        <div class="btn-row">
          <button type="button" data-order="hold">Hold</button>
        </div>
        <h4>Move to (reachable)</h4>
        <div class="chip-row chip-scroll">
          ${
            reachList.length
              ? reachList
                  .slice(0, 40)
                  .map(
                    (t) =>
                      `<button type="button" class="${selectedHexKey === t.key ? 'active' : ''}" data-order="move" data-q="${t.q}" data-r="${t.r}">${t.label} <span class="muted">(${t.spent} MP)</span></button>`
                  )
                  .join('')
              : '<span class="muted">No reachable hexes</span>'
          }
        </div>
        <h4>Scout adjacent</h4>
        <div class="chip-row">
          ${scoutTargets
            .map(
              (h) =>
                `<button type="button" data-order="scout" data-q="${h.q}" data-r="${h.r}">Scout ${Game().hexLabel(state, h.q, h.r)}</button>`
            )
            .join('')}
        </div>
      </div>`;
    }

    panel.innerHTML = html;
    panel.querySelectorAll('[data-select-army]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedArmyId = btn.getAttribute('data-select-army');
        render();
      });
    });
    panel.querySelectorAll('[data-order]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!selected) return;
        const kind = btn.getAttribute('data-order');
        const qAttr = btn.getAttribute('data-q');
        const rAttr = btn.getAttribute('data-r');
        const targetQ = qAttr != null ? Number(qAttr) : undefined;
        const targetR = rAttr != null ? Number(rAttr) : undefined;
        setState(
          Game().submitOrder(state, {
            turn: state.turn,
            faction,
            armyId: selected.id,
            kind,
            targetQ,
            targetR,
          })
        );
      });
    });
  }

  function renderUmpire() {
    const panel = document.getElementById('umpire-panel');
    if (role !== 'umpire') {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    panel.hidden = false;
    const pendingOrders = state.orders.filter((o) => o.turn === state.turn);
    const openBriefs = state.briefs.filter(
      (b) => b.turn === state.turn && b.status !== 'resolved'
    );

    panel.innerHTML = `
      <h2>Umpire / System</h2>
      <p class="muted">Resolve moves, detect contacts, issue briefs, then advance after results are in.</p>
      <div class="stat-grid">
        <div><div class="stat">${pendingOrders.length}</div><div class="muted small">Orders this week</div></div>
        <div><div class="stat">${openBriefs.length}</div><div class="muted small">Open briefs</div></div>
        <div><div class="stat">${state.turnPhase}</div><div class="muted small">Phase</div></div>
      </div>
      <div class="btn-row">
        <button type="button" class="primary" id="btn-resolve" ${
          state.turnPhase !== 'orders' ? 'disabled' : ''
        }>Resolve turn (moves → contacts → briefs)</button>
        <button type="button" id="btn-advance" ${
          state.turnPhase === 'orders' || openBriefs.length > 0 ? 'disabled' : ''
        }>Advance to next week</button>
        <button type="button" class="danger" id="btn-reset">Reset demo</button>
      </div>
      <h3>This week's orders</h3>
      ${
        pendingOrders.length === 0
          ? '<p class="muted">No orders submitted yet.</p>'
          : `<ul class="plain-list">${pendingOrders
              .map((o) => {
                const army = state.armies.find((a) => a.id === o.armyId);
                return `<li>Faction ${o.faction}: ${army?.name} — ${o.kind}${
                  o.targetQ != null
                    ? ' → ' + Game().hexLabel(state, o.targetQ, o.targetR)
                    : ''
                }</li>`;
              })
              .join('')}</ul>`
      }
      <h3>Contacts</h3>
      ${
        state.contacts.filter((c) => c.turn === state.turn).length === 0
          ? '<p class="muted">No contacts this week.</p>'
          : `<ul class="plain-list">${state.contacts
              .filter((c) => c.turn === state.turn)
              .map(
                (c) =>
                  `<li>${Game().nearestLandmarkName(state, c.q, c.r)} (${c.q},${c.r}): ${c.armyAId} vs ${c.armyBId}</li>`
              )
              .join('')}</ul>`
      }
    `;

    panel.querySelector('#btn-resolve')?.addEventListener('click', () => {
      setState(Game().resolveTurnOrders(state));
    });
    panel.querySelector('#btn-advance')?.addEventListener('click', () => {
      setState(Game().advanceTurn(state));
    });
    panel.querySelector('#btn-reset')?.addEventListener('click', () => {
      selectedArmyId = null;
      selectedHexKey = null;
      reportNotes = {};
      setState(Game().resetState(makeSeed));
    });
  }

  function renderBriefs() {
    const panel = document.getElementById('briefs-panel');
    const playerMode = role === 'player' || role === 'umpire';
    const canReport = role === 'player' || role === 'umpire' || role === 'generalA' || role === 'generalB';
    panel.hidden = false;
    const briefs = [...state.briefs].reverse();

    let html = `<h2>${playerMode ? 'Mission Briefs & Results' : 'Mission Briefs'}</h2>
      <p class="muted small">Fight OPR on the tabletop outside this app, then report win / loss / draw here. The app does not roll combat.</p>`;

    if (playerMode) {
      html += `<label class="field">Reporting as
        <select id="reporter-select">
          ${state.players
            .map(
              (p) =>
                `<option value="${p.id}" ${p.id === reporterId ? 'selected' : ''}>${p.name}</option>`
            )
            .join('')}
        </select>
      </label>`;
    }

    if (briefs.length === 0) {
      html += `<p class="muted">No briefs yet. Create a contact by moving onto an enemy hex.</p>`;
    } else {
      html += '<div class="brief-list">';
      for (const b of briefs) {
        const region = b.regionLabel || Game().nearestLandmarkName(state, b.q, b.r);
        const attacker = state.armies.find((a) => a.id === b.attackerArmyId);
        const defender = state.armies.find((a) => a.id === b.defenderArmyId);
        html += `<article class="brief-card status-${b.status}">
          <header><h3>${b.missionName}</h3><span class="badge">${b.status}</span></header>
          <p><strong>Location:</strong> ${region} (${b.q},${b.r}) · Week ${b.turn}</p>
          <p><strong>Attacker (Faction ${b.attackerFaction}):</strong> ${attacker?.name} — ${b.attackerForceHint}</p>
          <p><strong>Defender (Faction ${b.defenderFaction}):</strong> ${defender?.name} — ${b.defenderForceHint}</p>
          <p><strong>Objective (${b.objective}):</strong> ${b.objectiveText}</p>
          <p><strong>Terrain notes:</strong> ${b.terrainNotes}</p>
          ${
            b.result
              ? `<p class="result-line">Result: <strong>${b.result}</strong>${
                  b.resultNotes ? ' — ' + b.resultNotes : ''
                }</p>`
              : ''
          }
          ${
            b.status === 'open' && canReport
              ? `<div class="report-box">
                  <textarea data-notes-for="${b.id}" placeholder="Optional notes (casualties, narrative…)">${
                    reportNotes[b.id] || ''
                  }</textarea>
                  <div class="btn-row">
                    <button type="button" class="primary" data-report="${b.id}" data-result="win">Attacker win</button>
                    <button type="button" data-report="${b.id}" data-result="loss">Attacker loss</button>
                    <button type="button" data-report="${b.id}" data-result="draw">Draw</button>
                  </div>
                </div>`
              : ''
          }
        </article>`;
      }
      html += '</div>';
    }

    panel.innerHTML = html;

    panel.querySelector('#reporter-select')?.addEventListener('change', (e) => {
      reporterId = e.target.value;
    });
    panel.querySelectorAll('textarea[data-notes-for]').forEach((ta) => {
      ta.addEventListener('input', () => {
        reportNotes[ta.getAttribute('data-notes-for')] = ta.value;
      });
    });
    panel.querySelectorAll('[data-report]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const briefId = btn.getAttribute('data-report');
        const result = btn.getAttribute('data-result');
        const notes = reportNotes[briefId] || '';
        const reporter =
          state.players.find((p) => p.id === reporterId)?.name || 'Player';
        setState(Game().applyBattleResult(state, briefId, result, notes, reporter));
      });
    });
  }

  function renderSitrep() {
    const panel = document.getElementById('sitrep-panel');
    panel.innerHTML = `
      <h2>Sitrep</h2>
      <ul class="sitrep-list">
        ${(state.sitrep || []).map((line) => `<li>${line}</li>`).join('') || '<li class="muted">No events yet.</li>'}
      </ul>
    `;
  }

  function currentReachableKeys() {
    const faction = factionForRole();
    if (!faction || state.turnPhase !== 'orders' || !selectedArmyId) return [];
    const army = state.armies.find(
      (a) => a.id === selectedArmyId && a.faction === faction && !a.destroyed
    );
    if (!army) return [];
    return [...Game().reachableHexes(state, army).keys()];
  }

  function renderMap() {
    const panel = document.getElementById('map-panel');
    MapUI().render(panel, {
      state,
      role,
      factionView: factionForRole(),
      selectedArmyId,
      selectedHexKey,
      reachableKeys: currentReachableKeys(),
      onSelectArmy: (id) => {
        selectedArmyId = id;
        render();
      },
      onSelectHex: (q, r) => {
        selectedHexKey = Game().hexKey(q, r);
        const faction = factionForRole();
        const canOrder = state.turnPhase === 'orders' && faction;
        const selected = state.armies.find(
          (a) => a.id === selectedArmyId && a.faction === faction && !a.destroyed
        );
        if (canOrder && selected) {
          const reach = Game().reachableHexes(state, selected);
          if (reach.has(selectedHexKey)) {
            setState(
              Game().submitOrder(state, {
                turn: state.turn,
                faction,
                armyId: selected.id,
                kind: 'move',
                targetQ: q,
                targetR: r,
              })
            );
            return;
          }
        }
        render();
      },
    });
  }

  function renderFooter() {
    const el = document.getElementById('footer');
    el.innerHTML = `Florida Campaign · Hex Map Systems v0.2 · Balance numbers provisional · OPR off-app · <code>${dataSourceNote}</code>`;
  }

  function render() {
    renderTopbar();
    renderMap();
    renderOrders();
    renderUmpire();
    renderBriefs();
    renderSitrep();
    renderFooter();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
