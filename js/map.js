/* SVG axial hex map rendering — Map Systems v0.2.
   Terrain colors only; MP/terrain costs live in data/rules.json (provisional). */
(function (global) {
  const MapUI = {};

  const TERRAIN_FILL = {
    sea: '#0c1520',
    clear: '#2a4a32',
    urban: '#4a5560',
    coast: '#2f5a4a',
    hill: '#5a6a3a',
    rough: '#4a4030',
    swamp: '#1e3a2e',
    forest: '#1a3a24',
  };

  function flatHexCorner(cx, cy, size, i) {
    const angle = (Math.PI / 180) * (60 * i);
    return [cx + size * Math.cos(angle), cy + size * Math.sin(angle)];
  }

  function hexPolygon(cx, cy, size) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const [x, y] = flatHexCorner(cx, cy, size, i);
      pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return pts.join(' ');
  }

  /** Axial flat-top → pixel (pointy math variant for flat). */
  function axialToPixel(q, r, size) {
    const x = size * ((3 / 2) * q);
    const y = size * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r);
    return { x, y };
  }

  MapUI.render = function (container, opts) {
    const {
      state,
      role,
      factionView,
      selectedArmyId,
      selectedHexKey,
      reachableKeys,
      onSelectArmy,
      onSelectHex,
    } = opts;

    const fogFaction = role === 'umpire' || role === 'player' ? null : factionView;
    const Fog = global.Campaign.Fog;
    const Game = global.Campaign.Game;
    const enemyVisible =
      fogFaction != null ? Fog.visibleEnemyArmies(state, fogFaction) : [];
    const reachSet = new Set(reachableKeys || []);

    const size = 10;
    const width = state.meta?.width || 20;
    const height = state.meta?.height || 32;
    // Bounding box for viewBox
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const positions = new Map();
    for (const hex of state.hexes) {
      const p = axialToPixel(hex.q, hex.r, size);
      positions.set(Game.hexKey(hex.q, hex.r), p);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const pad = size * 1.2;
    const vbX = minX - pad;
    const vbY = minY - pad;
    const vbW = maxX - minX + pad * 2;
    const vbH = maxY - minY + pad * 2;

    const fogNote = fogFaction
      ? `Vision FoW for Faction ${fogFaction} (radius from armies; forest −1 / hill +1).`
      : 'Full map (umpire / player overview).';

    const parts = [];
    parts.push(
      `<svg viewBox="${vbX.toFixed(1)} ${vbY.toFixed(1)} ${vbW.toFixed(1)} ${vbH.toFixed(1)}" class="campaign-svg hex-svg" role="img" aria-label="Florida hex campaign map">`
    );

    // Hex cells
    for (const hex of state.hexes) {
      const key = Game.hexKey(hex.q, hex.r);
      const p = positions.get(key);
      const isSea = hex.terrain === 'sea';
      const visible =
        fogFaction == null || isSea || Fog.isHexVisible(state, fogFaction, hex.q, hex.r);
      const owner = state.ownership[key];
      const selected = selectedHexKey === key ? 'selected' : '';
      const reachable = reachSet.has(key) ? 'reachable' : '';
      const fill = isSea
        ? TERRAIN_FILL.sea
        : visible
          ? TERRAIN_FILL[hex.terrain] || TERRAIN_FILL.clear
          : '#152028';
      const classes = [
        'hex-cell',
        `terrain-${hex.terrain}`,
        owner ? `owner-${owner}` : 'owner-none',
        selected,
        reachable,
        visible ? '' : 'fogged',
        isSea ? 'sea' : 'land',
      ]
        .filter(Boolean)
        .join(' ');

      parts.push(
        `<polygon points="${hexPolygon(p.x, p.y, size * 0.95)}" class="${classes}" fill="${fill}" data-hex="${key}" data-q="${hex.q}" data-r="${hex.r}" style="cursor:${isSea ? 'default' : 'pointer'}">` +
          `<title>${isSea ? 'Sea' : visible ? `${hex.terrain}${hex.landmark ? ' — ' + hex.landmark : ''} (${hex.q},${hex.r})` : 'Unknown'}</title>` +
          `</polygon>`
      );
    }

    // River / bridge edge marks
    for (const e of state.edges || []) {
      if (!e.river) continue;
      const pa = positions.get(Game.hexKey(e.a.q, e.a.r));
      const pb = positions.get(Game.hexKey(e.b.q, e.b.r));
      if (!pa || !pb) continue;
      const mx = (pa.x + pb.x) / 2;
      const my = (pa.y + pb.y) / 2;
      // Short perpendicular tick along shared edge midpoint
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const len = Math.hypot(dx, dy) || 1;
      const px = (-dy / len) * size * 0.35;
      const py = (dx / len) * size * 0.35;
      const cls = e.bridge ? 'bridge-mark' : 'river-mark';
      parts.push(
        `<line x1="${(mx - px).toFixed(2)}" y1="${(my - py).toFixed(2)}" x2="${(mx + px).toFixed(2)}" y2="${(my + py).toFixed(2)}" class="${cls}" />`
      );
      if (e.bridge) {
        parts.push(
          `<circle cx="${mx.toFixed(2)}" cy="${my.toFixed(2)}" r="1.6" class="bridge-dot" />`
        );
      }
    }

    // Landmark labels (only if visible)
    for (const lm of state.landmarks || []) {
      const visible =
        fogFaction == null || Fog.isHexVisible(state, fogFaction, lm.q, lm.r);
      if (!visible) continue;
      const p = positions.get(Game.hexKey(lm.q, lm.r));
      if (!p) continue;
      parts.push(
        `<text x="${p.x.toFixed(2)}" y="${(p.y - size * 0.55).toFixed(2)}" text-anchor="middle" class="landmark-label">${lm.name}</text>`
      );
    }

    // Army tokens
    const stacks = new Map();
    state.armies
      .filter((a) => !a.destroyed)
      .forEach((army) => {
        const isOwn = fogFaction == null || army.faction === fogFaction;
        const enemyInfo = enemyVisible.find((e) => e.army.id === army.id);
        if (!isOwn && !enemyInfo) return;
        const key = Game.hexKey(army.q, army.r);
        const list = stacks.get(key) || [];
        list.push({ army, isOwn, enemyInfo });
        stacks.set(key, list);
      });

    for (const [key, list] of stacks) {
      const p = positions.get(key);
      if (!p) continue;
      list.forEach((entry, idx) => {
        const { army, isOwn, enemyInfo } = entry;
        const offset = (idx - (list.length - 1) / 2) * 4.2;
        const title = isOwn
          ? `${army.name} (${army.type}, str ${army.strength})`
          : enemyInfo?.sizeBand
            ? `Enemy ${enemyInfo.sizeBand} force`
            : 'Enemy force';
        const sel = selectedArmyId === army.id ? 'selected' : '';
        parts.push(`
          <g class="army-token faction-${army.faction} ${sel}"
             data-army-id="${army.id}" data-hex="${key}" data-q="${army.q}" data-r="${army.r}" style="cursor:pointer">
            <title>${title}</title>
            <rect x="${(p.x + offset - 2.4).toFixed(2)}" y="${(p.y - 1.6).toFixed(2)}"
                  width="4.8" height="3.2" rx="0.6" />
          </g>`);
      });
    }

    parts.push('</svg>');

    container.innerHTML = `
      <h2>Florida Theater <span class="muted small">Hex Map v0.2</span></h2>
      <p class="muted small">${fogNote}</p>
      ${parts.join('')}
      <div class="legend">
        <span class="swatch a"></span> Faction A
        <span class="swatch b"></span> Faction B
        <span class="swatch reach"></span> Reachable
        <span class="swatch forest"></span> Forest
        <span class="swatch hill"></span> Hill
        <span class="swatch swamp"></span> Swamp/Rough
        <span class="swatch river"></span> River / bridge
      </div>
    `;

    container.querySelectorAll('.hex-cell.land').forEach((el) => {
      el.addEventListener('click', () => {
        const q = Number(el.getAttribute('data-q'));
        const r = Number(el.getAttribute('data-r'));
        onSelectHex(q, r);
      });
    });
    container.querySelectorAll('.army-token').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectArmy(el.getAttribute('data-army-id'));
        onSelectHex(Number(el.getAttribute('data-q')), Number(el.getAttribute('data-r')));
      });
    });
  };

  global.Campaign = global.Campaign || {};
  global.Campaign.MapUI = MapUI;
})(typeof window !== 'undefined' ? window : globalThis);
