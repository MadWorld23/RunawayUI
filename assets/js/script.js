/* ══════════════════════════════════════════════════════════════
   FARBEN & NAMEN
   ══════════════════════════════════════════════════════════════ */

const COLORS = {
  green:      { bg:'#34d399', text:'#06291c' },
  greenLight: { bg:'#a3e635', text:'#1a2905' },
  blue:       { bg:'#60a5fa', text:'#07203f' },
  red:        { bg:'#fb7185', text:'#3d0713' },
  orange:     { bg:'#fbbf24', text:'#3a2503' },
  purple:     { bg:'#c084fc', text:'#2c0a4d' }
};

// Palette je nach Anzahl der Buttons
const PALETTES = {
  1: ['green'],
  2: ['green', 'greenLight'],          // beide grün, zwei Nuancen
  3: ['blue', 'green', 'red'],
  4: ['blue', 'green', 'red', 'orange'],
  5: ['blue', 'green', 'red', 'orange', 'purple']
};

const NAMES = [
  'Nein', 'Nö', 'Nee du', 'Nope', 'Nix da', 'Lieber nicht',
  'Auf keinen Fall', 'Niemals!', 'Bloß nicht', 'Ohne mich',
  'Nicht heute', 'Später vielleicht', 'Frag mich morgen',
  'Da musst du früher aufstehen', 'Netter Versuch', 'Träum weiter',
  'Hab schon was vor', 'Ich muss weg', 'Bin beschäftigt',
  'Leider nein', 'Absolut nicht', 'Hmm … nein', 'Nicht wirklich',
  'Keine Lust', 'Sorry, hab Termin', 'Ich bin dann mal weg',
  'Musst du Mama fragen', 'Vielleicht später™', 'Ganz sicher nicht'
];

const CAUGHT_LABELS = ['😱 Erwischt!', '🎉 Endlich!', '😤 Na gut …', '🫠 Okay, okay'];

/* ══════════════════════════════════════════════════════════════
   RUNAWAY UI — Minimalbibliothek
   ══════════════════════════════════════════════════════════════ */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
const rand  = (a, b) => a + Math.random() * (b - a);

class RunawayUI {
  /**
   * @param {HTMLElement} el        Element, das ausweichen soll
   * @param {Object}      cfg
   * @param {string}      cfg.strategy  flee | shrink | teleport | hide
   * @param {number}      cfg.speed     1–10
   * @param {Array}       cfg.siblings  weitere Elemente (Abstandsregel)
   * @param {Function}    cfg.onEvent   Callback für Statistik
   */
  constructor(el, cfg = {}) {
    this.el = el;
    this.container = el.parentElement;
    this.cfg = {
      strategy: 'flee',
      speed: 5,
      padding: 10,
      siblings: [],
      onEvent: () => {},
      ...cfg
    };

    this.lastFlee = 0;
    this.distances = [];
    this.hideTimer = null;
    this._onMove = this._onMove.bind(this);
  }

  start() {
    this.container.addEventListener('pointermove', this._onMove);
    return this;
  }

  destroy() {
    this.container.removeEventListener('pointermove', this._onMove);
    clearTimeout(this.hideTimer);
  }

  /* ── Geometrie-Helfer ─────────────────────────────────────── */

  _box() {
    const c = this.container.getBoundingClientRect();
    const r = this.el.getBoundingClientRect();
    return { w: r.width, h: r.height, cw: c.width, ch: c.height, cl: c.left, ct: c.top };
  }

  /** Position relativ zum Container */
  _pos() {
    return { x: this.el.offsetLeft, y: this.el.offsetTop };
  }

  /** Abstand Cursor ↔ nächster Punkt des Buttons */
  _edgeDistance(cursor) {
    const p = this._pos(), b = this._box();
    const nx = clamp(cursor.x, p.x, p.x + b.w);
    const ny = clamp(cursor.y, p.y, p.y + b.h);
    return Math.hypot(cursor.x - nx, cursor.y - ny);
  }

  /* ── Ereignis ─────────────────────────────────────────────── */

  _onMove(e) {
    const b = this._box();
    const cursor = { x: e.clientX - b.cl, y: e.clientY - b.ct };

    const threshold = 62 + this.cfg.speed * 2;
    if (this._edgeDistance(cursor) > threshold) return;

    const cooldown = 340 - this.cfg.speed * 22;
    const now = performance.now();
    if (now - this.lastFlee < cooldown) return;
    this.lastFlee = now;

    this.flee(cursor);
  }

  /* ── Kern: beste Ausweichposition finden ──────────────────── */

  /**
   * Statt stumpf "weg vom Cursor" zu gehen, werden 16 Kandidaten
   * rund um die aktuelle Position bewertet und der beste gewählt.
   * Bewertung: weit weg vom Cursor + weit weg von den Kollegen
   * + nicht in die Wand gedrängt.
   */
  _bestSpot(cursor, jump) {
    const b = this._box();
    const p = this._pos();
    const pad = this.cfg.padding;

    const cx = p.x + b.w / 2;
    const cy = p.y + b.h / 2;
    const minCX = pad + b.w / 2;
    const maxCX = b.cw - pad - b.w / 2;
    const minCY = pad + b.h / 2;
    const maxCY = b.ch - pad - b.h / 2;

    const mates = this.cfg.siblings.map(s => ({
      x: s.offsetLeft + s.offsetWidth / 2,
      y: s.offsetTop + s.offsetHeight / 2
    }));

    let best = { x: p.x, y: p.y };
    let bestScore = -Infinity;

    const STEPS = 16;
    for (let i = 0; i < STEPS; i++) {
      const ang = (i / STEPS) * Math.PI * 2;
      const tx = clamp(cx + Math.cos(ang) * jump, minCX, maxCX);
      const ty = clamp(cy + Math.sin(ang) * jump, minCY, maxCY);

      const dCursor = Math.hypot(tx - cursor.x, ty - cursor.y);

      let dMate = Infinity;
      for (const m of mates) dMate = Math.min(dMate, Math.hypot(tx - m.x, ty - m.y));
      if (!isFinite(dMate)) dMate = 240;

      // Abstand zur nächsten Wand (belohnt freie Fläche, bestraft Ecken)
      const dWall = Math.min(
        tx - minCX, maxCX - tx,
        ty - minCY, maxCY - ty
      );

      const score =
        dCursor * 1.0 +
        Math.min(dMate, 230) * 1.35 +
        Math.min(dWall, 160) * 0.65 +
        Math.random() * 45;

      if (score > bestScore) {
        bestScore = score;
        best = { x: tx - b.w / 2, y: ty - b.h / 2 };
      }
    }
    return best;
  }

  /* ── Strategien ───────────────────────────────────────────── */

  flee(cursor) {
    const b = this._box();
    const p = this._pos();
    const jump = 110 + this.cfg.speed * 20;
    const target = this._bestSpot(cursor, jump);
    const dist = Math.hypot(target.x - p.x, target.y - p.y);

    this.distances.push(dist);
    this.cfg.onEvent({ type: 'escape', distance: dist });

    switch (this.cfg.strategy) {

      case 'flee': {
        const dur = clamp(0.44 - this.cfg.speed * 0.028, 0.12, 0.44);
        this.el.style.transitionDuration = `${dur}s, ${dur}s, .18s, .2s`;
        this.el.style.left = target.x + 'px';
        this.el.style.top  = target.y + 'px';
        break;
      }

      case 'teleport': {
        this.el.style.transitionDuration = '0s, 0s, .18s, .2s';
        this.el.style.left = target.x + 'px';
        this.el.style.top  = target.y + 'px';
        break;
      }

      case 'shrink': {
        this.el.classList.add('shrunk');
        setTimeout(() => this.el.classList.remove('shrunk'), 480);
        const dur = clamp(0.46 - this.cfg.speed * 0.026, 0.14, 0.46);
        this.el.style.transitionDuration = `${dur}s, ${dur}s, .18s, .2s`;
        this.el.style.left = target.x + 'px';
        this.el.style.top  = target.y + 'px';
        break;
      }

      case 'hide': {
        clearTimeout(this.hideTimer);
        this.el.classList.add('hidden');

        // verschwindet kurz – und kommt garantiert wieder
        const pause = clamp(1000 - this.cfg.speed * 60, 380, 950);
        this.hideTimer = setTimeout(() => {
          const b2 = this._box();
          const far = this._bestSpot(
            { x: this._pos().x + b2.w / 2, y: this._pos().y + b2.h / 2 },
            Math.max(b2.cw, b2.ch) * 0.7
          );
          this.el.style.transitionDuration = '0s, 0s, .18s, .2s';
          this.el.style.left = far.x + 'px';
          this.el.style.top  = far.y + 'px';

          requestAnimationFrame(() => {
            this.el.classList.remove('hidden');
            this.el.style.transitionDuration = '.3s, .3s, .18s, .2s';
          });
        }, pause);
        break;
      }
    }
  }

  caught(label) {
    this.cfg.onEvent({ type: 'caught' });
    const original = this.el.dataset.name;
    this.el.textContent = label;
    this.el.classList.add('caught');
    setTimeout(() => {
      this.el.textContent = original;
      this.el.classList.remove('caught');
    }, 850);
  }

  stats() {
    const avg = this.distances.length
      ? Math.round(this.distances.reduce((a, b) => a + b, 0) / this.distances.length)
      : 0;
    return { escapes: this.distances.length, avg };
  }
}

/* ══════════════════════════════════════════════════════════════
   PLAYGROUND
   ══════════════════════════════════════════════════════════════ */

const playground    = document.getElementById('playground');
const strategySelect= document.getElementById('strategySelect');
const speedRange    = document.getElementById('speedRange');
const countRange    = document.getElementById('countRange');
const spawnBtn      = document.getElementById('spawnBtn');
const resetBtn      = document.getElementById('resetBtn');
const feedback      = document.getElementById('feedback');

let buttons = [];
let instances = [];
let totals = { escapes: 0, caught: 0, distSum: 0, distCount: 0 };

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Verteilt Startpositionen möglichst ohne Überlappung */
function startPosition(i, count, bw, bh, cw, ch) {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cellW = cw / cols;
  const cellH = ch / rows;
  const col = i % cols;
  const row = Math.floor(i / cols);

  const x = clamp(
    col * cellW + rand(0.15, 0.85) * Math.max(0, cellW - bw),
    10, cw - bw - 10
  );
  const y = clamp(
    row * cellH + rand(0.15, 0.85) * Math.max(0, cellH - bh),
    10, ch - bh - 10
  );
  return { x, y };
}

function spawnButtons() {
  destroyAll();

  const count    = parseInt(countRange.value, 10);
  const strategy = strategySelect.value;
  const speed    = parseInt(speedRange.value, 10);
  const palette  = PALETTES[count] || PALETTES[5];
  const names    = shuffle(NAMES).slice(0, count);

  const cw = playground.clientWidth;
  const ch = playground.clientHeight;

  // Erst alle Elemente erzeugen, dann messen, dann positionieren
  buttons = names.map((name, i) => {
    const btn = document.createElement('button');
    btn.className = 'runaway-btn';
    btn.type = 'button';
    btn.textContent = name;
    btn.dataset.name = name;

    const color = COLORS[palette[i]];
    btn.style.background = color.bg;
    btn.style.color = color.text;

    btn.addEventListener('pointerdown', () => {
      const inst = instances[i];
      if (inst) inst.caught(CAUGHT_LABELS[Math.floor(Math.random() * CAUGHT_LABELS.length)]);
    });

    playground.appendChild(btn);
    return btn;
  });

  // Positionieren
  buttons.forEach((btn, i) => {
    const pos = startPosition(i, count, btn.offsetWidth, btn.offsetHeight, cw, ch);
    btn.style.left = pos.x + 'px';
    btn.style.top  = pos.y + 'px';
  });

  // Instanzen verdrahten (siblings für die Abstandsregel)
  instances = buttons.map((btn, i) => new RunawayUI(btn, {
    strategy,
    speed,
    siblings: buttons.filter(b => b !== btn),
    onEvent: ev => {
      if (ev.type === 'escape') {
        totals.escapes++;
        totals.distSum += ev.distance;
        totals.distCount++;
      } else if (ev.type === 'caught') {
        totals.caught++;
      }
      renderStats();
    }
  }).start());

  renderStats();
  feedback.textContent = `${count} Button${count > 1 ? 's' : ''} aktiv · Strategie: ${strategySelect.options[strategySelect.selectedIndex].text}`;
}

function destroyAll() {
  instances.forEach(i => i.destroy());
  instances = [];
  buttons.forEach(b => b.remove());
  buttons = [];
}

function renderStats() {
  document.getElementById('escapeCount').textContent = totals.escapes;
  document.getElementById('clickCount').textContent  = totals.caught;
  document.getElementById('avgDistance').textContent = totals.distCount
    ? Math.round(totals.distSum / totals.distCount)
    : 0;
}

/* ── Events ──────────────────────────────────────────────────── */

strategySelect.addEventListener('change', spawnButtons);

speedRange.addEventListener('input', () => {
  document.getElementById('speedValue').textContent = speedRange.value;
  instances.forEach(i => { i.cfg.speed = parseInt(speedRange.value, 10); });
});

countRange.addEventListener('input', () => {
  document.getElementById('countValue').textContent = countRange.value;
});

spawnBtn.addEventListener('click', spawnButtons);

resetBtn.addEventListener('click', () => {
  destroyAll();
  totals = { escapes: 0, caught: 0, distSum: 0, distCount: 0 };
  renderStats();
  feedback.textContent = 'Zurückgesetzt. Bereit für die nächste Runde.';
});

window.addEventListener('resize', () => {
  const cw = playground.clientWidth, ch = playground.clientHeight;
  buttons.forEach(btn => {
    btn.style.left = clamp(btn.offsetLeft, 10, Math.max(10, cw - btn.offsetWidth - 10)) + 'px';
    btn.style.top  = clamp(btn.offsetTop,  10, Math.max(10, ch - btn.offsetHeight - 10)) + 'px';
  });
});

spawnButtons();