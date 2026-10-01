/* Signal & Noise — generative security pieces (vanilla JS, no dependencies)
   Each piece: new Piece(canvas, params) -> reset(seed), step(), draw(), readouts(), phase()
*/
(function (G) {
  'use strict';

  // ---------- shared utilities ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeNoise(rand) {
    const p = new Uint8Array(512), perm = [];
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const grad = (h, x, y) => { switch (h & 7) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } };
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (a, b, t) => a + (b - a) * t;
    function n2(x, y) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x), v = fade(y), a = p[X] + Y, b = p[X + 1] + Y;
      return lerp(lerp(grad(p[a], x, y), grad(p[b], x - 1, y), u), lerp(grad(p[a + 1], x, y - 1), grad(p[b + 1], x - 1, y - 1), u), v);
    }
    return function (x, y, z) { // cheap 3D via two offset 2D samples
      const zi = Math.floor(z), zf = z - zi, f = zf * zf * (3 - 2 * zf);
      const a = n2(x + zi * 17.13, y + zi * 31.7), b = n2(x + (zi + 1) * 17.13, y + (zi + 1) * 31.7);
      return a + (b - a) * f;
    };
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function lerpColor(stops, t) {
    t = clamp(t, 0, 1) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(t)), f = t - i, a = stops[i], b = stops[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  function label(ctx, x, y, text, color, align) {
    ctx.save();
    ctx.font = '600 ' + Math.round(ctx.canvas.width / 48) + 'px "DejaVu Sans Mono", ui-monospace, monospace';
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(5,8,14,.75)';
    const w = ctx.measureText(text).width + 12, h = ctx.canvas.width / 34;
    let bx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x - 6;
    const W = ctx.canvas.width, shift = bx < 4 ? 4 - bx : bx + w > W - 4 ? (W - 4) - (bx + w) : 0; bx += shift; x += shift;
    y = clamp(y, h, ctx.canvas.height - h);
    ctx.fillRect(bx, y - h / 2, w, h);
    ctx.fillStyle = color; ctx.fillText(text, x, y + 1);
    ctx.restore();
  }

  // =====================================================================
  // 01 · HOLDINGS — Voronoi segmentation, breach blast radius
  // =====================================================================
  class Holdings {
    static meta = {
      id: 'holdings', no: '01', title: 'Holdings', concept: 'Network segmentation & blast radius',
      blurb: 'Every border is a decision. The breach only travels where a rule said yes.',
      tags: ['Voronoi', 'Lloyd relaxation', 'Graph BFS'],
      params: {
        cells: { label: 'Segments', min: 12, max: 60, step: 1, value: 34 },
        relax: { label: 'Lloyd passes', min: 0, max: 8, step: 1, value: 4 },
        crossRules: { label: 'Cross-zone rules %', min: 0, max: 60, step: 1, value: 12 },
        flatness: { label: 'Intra-zone trust %', min: 0, max: 100, step: 1, value: 45 }
      }
    };
    constructor(canvas, params) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.p = params; }
    reset(seed) {
      const W = this.c.width, H = this.c.height, P = this.p, R = mulberry32(seed);
      this.W = W; this.H = H; this.t = 0;
      const lw = W >> 2, lh = H >> 2; // low-res lattice for relaxation
      let sites = [];
      for (let i = 0; i < P.cells; i++) sites.push([R() * W, R() * H]);
      for (let pass = 0; pass < P.relax; pass++) {
        const acc = sites.map(() => [0, 0, 0]);
        for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
          const px = x * 4 + 2, py = y * 4 + 2; let best = 0, bd = 1e18;
          for (let i = 0; i < sites.length; i++) { const dx = sites[i][0] - px, dy = sites[i][1] - py, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
          acc[best][0] += px; acc[best][1] += py; acc[best][2]++;
        }
        sites = sites.map((s, i) => acc[i][2] ? [acc[i][0] / acc[i][2], acc[i][1] / acc[i][2]] : s);
      }
      this.sites = sites;
      // full-res ownership + distance-to-site
      const own = new Int16Array(W * H), dist = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let best = 0, bd = 1e18, sd = 1e18;
        for (let i = 0; i < sites.length; i++) { const dx = sites[i][0] - x, dy = sites[i][1] - y, d = dx * dx + dy * dy; if (d < bd) { sd = bd; bd = d; best = i; } else if (d < sd) sd = d; }
        own[y * W + x] = best; dist[y * W + x] = Math.sqrt(sd) - Math.sqrt(bd); // distance to border (approx)
      }
      this.own = own; this.edgeD = dist;
      // zones: 4 trust zones via nearest zone anchor
      const zoneNames = ['USERS', 'SERVERS', 'SCREENED', 'OT'];
      const anchors = [[W * .2, H * .25], [W * .8, H * .3], [W * .25, H * .8], [W * .78, H * .78]].map(a => [a[0] + (R() - .5) * W * .2, a[1] + (R() - .5) * H * .2]);
      this.zone = sites.map(s => { let b = 0, bd = 1e18; anchors.forEach((a, i) => { const d = (a[0] - s[0]) ** 2 + (a[1] - s[1]) ** 2; if (d < bd) { bd = d; b = i; } }); return b; });
      this.zoneNames = zoneNames;
      // adjacency
      const adj = sites.map(() => new Set());
      for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
        const a = own[y * W + x], b = own[y * W + x + 1], c = own[(y + 1) * W + x];
        if (a !== b) { adj[a].add(b); adj[b].add(a); } if (a !== c) { adj[a].add(c); adj[c].add(a); }
      }
      // rules: which adjacencies are permitted
      this.allowed = new Set(); this.ruleEdges = [];
      const key = (a, b) => a < b ? a + ':' + b : b + ':' + a;
      adj.forEach((set, a) => set.forEach(b => {
        if (b <= a) return;
        const same = this.zone[a] === this.zone[b];
        const ok = same ? R() * 100 < P.flatness : R() * 100 < P.crossRules;
        if (ok) { this.allowed.add(key(a, b)); if (!same) this.ruleEdges.push([a, b]); }
      }));
      this.adj = adj; this.key = key;
      // patient zero: a USERS cell
      const users = sites.map((_, i) => i).filter(i => this.zone[i] === 0);
      users.sort((a, b) => ((sites[a][0] - W / 2) ** 2 + (sites[a][1] - H / 2) ** 2) - ((sites[b][0] - W / 2) ** 2 + (sites[b][1] - H / 2) ** 2));
      this.entry = users.length ? users[Math.min(users.length - 1, (R() * 3) | 0)] : 0;
      this.infectedAt = new Float32Array(sites.length).fill(-1); this.infectedAt[this.entry] = 0;
      this.frontier = [this.entry];
      // reachable count (for readout)
      const seen = new Set([this.entry]), q = [this.entry];
      while (q.length) { const a = q.shift(); adj[a].forEach(b => { if (!seen.has(b) && this.allowed.has(key(a, b))) { seen.add(b); q.push(b); } }); }
      this.reachable = seen.size;
      this.img = this.ctx.createImageData(W, H);
    }
    step() {
      this.t++;
      if (this.t % (this.spreadEvery || 26) === 0 && this.frontier.length) {
        const next = [];
        this.frontier.forEach(a => this.adj[a].forEach(b => {
          if (this.infectedAt[b] < 0 && this.allowed.has(this.key(a, b))) { this.infectedAt[b] = this.t; next.push(b); }
        }));
        this.frontier = next;
      }
    }
    infectedCount() { let n = 0; for (const v of this.infectedAt) if (v >= 0) n++; return n; }
    draw() {
      const { W, H, own, edgeD, ctx } = this, d = this.img.data;
      const zc = [[40, 120, 255], [0, 210, 200], [255, 190, 60], [170, 110, 255]];
      const pulse = .5 + .5 * Math.sin(this.t * .12);
      for (let i = 0; i < W * H; i++) {
        const c = own[i], z = zc[this.zone[c]], e = edgeD[i];
        const inf = this.infectedAt[c];
        let r, g, b;
        const shade = clamp(e / 60, 0, 1);
        if (inf >= 0) {
          const age = clamp((this.t - inf) / 40, 0, 1);
          const hot = (1 - shade) * age;
          const rim = Math.pow(1 - shade, 3);
          r = 28 + 90 * age + 150 * rim * age; g = 8 + 18 * age + 90 * rim * age * (.7 + .3 * pulse); b = 22 + 30 * age + 40 * rim * age;
          if (age < 1) { r = r * age + (z[0] * .12) * (1 - age); g = g * age + z[1] * .12 * (1 - age); b = b * age + z[2] * .12 * (1 - age); }
        } else {
          r = 6 + z[0] * .10 * (1 - shade * .7); g = 9 + z[1] * .10 * (1 - shade * .7); b = 16 + z[2] * .12 * (1 - shade * .7);
        }
        if (e < 1.6) { const k = 1 - e / 1.6; r += (z[0] - r) * k * .8; g += (z[1] - g) * k * .8; b += (z[2] - b) * k * .8; }
        // stipple grain
        const n = ((i * 2654435761) >>> 0) % 997 / 997; if (n > .985) { r += 40; g += 40; b += 50; }
        d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
      }
      ctx.putImageData(this.img, 0, 0);
      // firewall rule connectors
      ctx.save(); ctx.setLineDash([6, 6]); ctx.lineWidth = Math.max(1.5, W / 500);
      this.ruleEdges.forEach(([a, b]) => {
        const A = this.sites[a], B = this.sites[b];
        const lit = this.infectedAt[a] >= 0 && this.infectedAt[b] >= 0;
        ctx.strokeStyle = lit ? 'rgba(255,90,90,.95)' : 'rgba(255,201,60,.75)';
        ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
      });
      ctx.restore();
      // site nodes
      this.sites.forEach((s, i) => {
        ctx.beginPath(); ctx.arc(s[0], s[1], W / 220 + (i === this.entry ? W / 120 : 0), 0, 6.283);
        ctx.fillStyle = this.infectedAt[i] >= 0 ? '#ff4d6d' : 'rgba(220,235,255,.7)'; ctx.fill();
      });
      const e = this.sites[this.entry];
      ctx.beginPath(); ctx.arc(e[0], e[1], W / 40 + pulse * W / 120, 0, 6.283); ctx.strokeStyle = 'rgba(255,77,109,.8)'; ctx.lineWidth = 2; ctx.stroke();
      label(ctx, e[0], e[1] - W / 22, 'PATIENT ZERO', '#ff8fa3', 'center');
    }
    readouts() {
      return [['segments', this.sites.length], ['fw rules', this.ruleEdges.length], ['compromised', this.infectedCount() + ' / ' + this.sites.length], ['blast radius', Math.round(100 * this.infectedCount() / this.sites.length) + '%']];
    }
    phase() { return this.frontier.length ? 'BREACH SPREADING' : 'CONTAINED BY POLICY'; }
  }

  // =====================================================================
  // 02 · SLIME PATH — Physarum agents as lateral movement
  // =====================================================================
  class SlimePath {
    static meta = {
      id: 'slime-path', no: '02', title: 'Slime Path', concept: 'Lateral movement & attack paths',
      blurb: 'No map, no plan. Ten thousand small guesses still find the shortest road to the domain controller.',
      tags: ['Physarum', 'Agent-based', 'Trail diffusion'],
      params: {
        agents: { label: 'Agents', min: 2000, max: 30000, step: 500, value: 14000 },
        sensorAngle: { label: 'Sensor angle°', min: 10, max: 70, step: 1, value: 32 },
        sensorDist: { label: 'Sensor distance', min: 3, max: 30, step: 1, value: 11 },
        tiers: { label: 'Hardened tiers', min: 0, max: 6, step: 1, value: 2 }
      }
    };
    constructor(canvas, params) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.p = params; }
    reset(seed) {
      const P = this.p, R = mulberry32(seed); this.R = R; this.t = 0;
      const S = this.S = 360; this.trail = new Float32Array(S * S); this.tmp = new Float32Array(S * S); this.block = new Uint8Array(S * S);
      this.entry = [S * (.12 + R() * .12), S * (.7 + R() * .18)];
      const names = ['DC01', 'SQL-PROD', 'FILESRV', 'BACKUP'];
      this.targets = names.map((n, i) => ({ n, x: S * (.45 + R() * .45), y: S * (.08 + i * .22 + R() * .08) }));
      this.tierZones = [];
      for (let i = 0; i < P.tiers; i++) {
        const a = this.targets[i % 4], f = .35 + R() * .3;
        this.tierZones.push({ x: this.entry[0] + (a.x - this.entry[0]) * f + (R() - .5) * 40, y: this.entry[1] + (a.y - this.entry[1]) * f + (R() - .5) * 40, r: 16 + R() * 18 });
      }
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) this.tierZones.forEach(z => { if ((x - z.x) ** 2 + (y - z.y) ** 2 < z.r * z.r) this.block[y * S + x] = 1; });
      const N = P.agents | 0; this.ax = new Float32Array(N); this.ay = new Float32Array(N); this.ah = new Float32Array(N);
      for (let i = 0; i < N; i++) this.spawn(i, true);
      this.img = this.ctx.createImageData(this.c.width, this.c.height);
    }
    spawn(i, initial) {
      const R = this.R, S = this.S;
      if (R() < .25) { const r = R() * 8, a = R() * 6.283; this.ax[i] = this.entry[0] + Math.cos(a) * r; this.ay[i] = this.entry[1] + Math.sin(a) * r; }
      else { let x, y; do { x = 2 + R() * (S - 4); y = 2 + R() * (S - 4); } while (this.block[(y | 0) * S + (x | 0)]); this.ax[i] = x; this.ay[i] = y; }
      this.ah[i] = R() * 6.283;
    }
    sense(x, y) { const S = this.S; x = x | 0; y = y | 0; if (x < 0 || y < 0 || x >= S || y >= S) return -1; return this.trail[y * S + x]; }
    step() {
      const S = this.S, P = this.p, R = this.R, sa = P.sensorAngle * Math.PI / 180, sd = P.sensorDist, ta = sa * .9, sp = 1.1;
      const tr = this.trail, N = this.ax.length;
      for (let k = 0; k < 2; k++) {
        // targets emit scent
        [...this.targets, { x: this.entry[0], y: this.entry[1] }].forEach(t => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = (t.x + dx) | 0, y = (t.y + dy) | 0; if (x >= 0 && y >= 0 && x < S && y < S) tr[y * S + x] += 6; } });
        for (let i = 0; i < N; i++) {
          let x = this.ax[i], y = this.ay[i], h = this.ah[i];
          const f = this.sense(x + Math.cos(h) * sd, y + Math.sin(h) * sd), l = this.sense(x + Math.cos(h - sa) * sd, y + Math.sin(h - sa) * sd), r = this.sense(x + Math.cos(h + sa) * sd, y + Math.sin(h + sa) * sd);
          if (f > l && f > r) { } else if (f < l && f < r) h += (R() < .5 ? -1 : 1) * ta; else if (l > r) h -= ta; else if (r > l) h += ta;
          x += Math.cos(h) * sp; y += Math.sin(h) * sp;
          if (x < 1 || y < 1 || x >= S - 1 || y >= S - 1) { h += Math.PI * (.6 + R() * .8); x = clamp(x, 1, S - 2); y = clamp(y, 1, S - 2); }
          const ix = y | 0, idx = ix * S + (x | 0);
          if (this.block[idx]) { h += Math.PI; x = this.ax[i]; y = this.ay[i]; }
          else tr[idx] += 1;
          this.ax[i] = x; this.ay[i] = y; this.ah[i] = h;
          if (R() < .001) this.spawn(i, false);
        }
        // diffuse + decay
        const t2 = this.tmp;
        for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
          const i = y * S + x;
          t2[i] = this.block[i] ? 0 : (tr[i] * 4 + tr[i - 1] + tr[i + 1] + tr[i - S] + tr[i + S]) / 8 * .9;
        }
        this.trail = t2; this.tmp = tr; this.t++;
      }
      this.trail.copyWithin(0, 0);
    }
    draw() {
      const W = this.c.width, H = this.c.height, S = this.S, tr = this.trail, d = this.img.data, ctx = this.ctx;
      const stops = [[4, 6, 12], [10, 40, 60], [0, 150, 160], [120, 255, 210], [255, 255, 240]];
      const sx = S / W;
      for (let y = 0; y < H; y++) {
        const fy = y * sx, y0 = fy | 0, y1 = Math.min(S - 1, y0 + 1), wy = fy - y0;
        for (let x = 0; x < W; x++) {
          const fx = x * sx, x0 = fx | 0, x1 = Math.min(S - 1, x0 + 1), wx = fx - x0;
          const v = (tr[y0 * S + x0] * (1 - wx) + tr[y0 * S + x1] * wx) * (1 - wy) + (tr[y1 * S + x0] * (1 - wx) + tr[y1 * S + x1] * wx) * wy;
          const blocked = this.block[y0 * S + x0];
          const c = lerpColor(stops, Math.log1p(v) / Math.log1p(40)), o = (y * W + x) * 4;
          if (blocked) { const hatch = ((x + y) % 10 < 2) ? 38 : 14; d[o] = hatch * .5; d[o + 1] = hatch * .7; d[o + 2] = hatch * 1.4; }
          else { d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; }
          d[o + 3] = 255;
        }
      }
      ctx.putImageData(this.img, 0, 0);
      const k = W / S;
      this.tierZones.forEach(z => { ctx.beginPath(); ctx.arc(z.x * k, z.y * k, z.r * k, 0, 6.283); ctx.strokeStyle = 'rgba(120,150,255,.8)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); });
      if (this.tierZones.length) label(ctx, this.tierZones[0].x * k, (this.tierZones[0].y - this.tierZones[0].r) * k - W / 50, 'TIER-0 HARDENED', '#9fb4ff', 'center');
      this.targets.forEach(t => {
        ctx.beginPath(); ctx.arc(t.x * k, t.y * k, W / 70, 0, 6.283); ctx.strokeStyle = '#ffc93c'; ctx.lineWidth = 2; ctx.stroke();
        label(ctx, t.x * k + W / 50, t.y * k, t.n, '#ffd76a');
      });
      ctx.beginPath(); ctx.arc(this.entry[0] * k, this.entry[1] * k, W / 55, 0, 6.283); ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 2.5; ctx.stroke();
      label(ctx, this.entry[0] * k, this.entry[1] * k + W / 28, 'PHISHED WKSTN', '#ff8fa3', 'center');
    }
    readouts() {
      let reached = 0; this.targets.forEach(t => { if (this.trail[(t.y | 0) * this.S + (t.x | 0)] > 12) reached++; });
      return [['agents', this.ax.length.toLocaleString()], ['sense', this.p.sensorAngle + '° @ ' + this.p.sensorDist], ['hardened', this.tierZones.length], ['steps', this.t]];
    }
    phase() { return this.t < 120 ? 'RECON / DISCOVERY' : this.t < 400 ? 'PATHS FORMING' : 'ATTACK PATHS MAPPED'; }
  }

  // =====================================================================
  // 03 · BASELINE — curl-noise flow, anomaly detection
  // =====================================================================
  class Baseline {
    static meta = {
      id: 'baseline', no: '03', title: 'Baseline', concept: 'Behavioral baselines & anomaly detection',
      blurb: 'Learn the current well enough and the one thing swimming against it lights up on its own.',
      tags: ['Curl noise', 'Divergence-free flow', 'Deviation scoring'],
      params: {
        particles: { label: 'Normal flows', min: 500, max: 8000, step: 100, value: 4200 },
        scale: { label: 'Field scale', min: 1, max: 8, step: .1, value: 2.6 },
        anomalies: { label: 'Anomalies', min: 0, max: 12, step: 1, value: 5 },
        threshold: { label: 'Alert threshold', min: .2, max: 1.6, step: .05, value: .75 }
      }
    };
    constructor(canvas, params) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.p = params; }
    reset(seed) {
      const R = mulberry32(seed); this.R = R; this.noise = makeNoise(R); this.t = 0; this.alerts = 0;
      const W = this.c.width, H = this.c.height, P = this.p;
      this.parts = []; for (let i = 0; i < P.particles; i++) this.parts.push(this.newP(false));
      this.anoms = []; for (let i = 0; i < P.anomalies; i++) this.anoms.push(this.newP(true));
      const ctx = this.ctx; ctx.fillStyle = '#05080e'; ctx.fillRect(0, 0, W, H);
    }
    newP(anom) {
      const W = this.c.width, H = this.c.height, R = this.R;
      const p = { x: R() * W, y: R() * H, px: 0, py: 0, life: 80 + R() * 220, anom, score: 0, flagged: false, trail: [] };
      if (anom) { const a = R() * 6.283; p.dx = Math.cos(a); p.dy = Math.sin(a); p.life = 500; }
      p.px = p.x; p.py = p.y; return p;
    }
    field(x, y) {
      const s = this.p.scale / this.c.width, e = .5, z = this.t * .0025, n = this.noise;
      const a = (n((x) * s, (y + e) * s, z) - n(x * s, (y - e) * s, z)) / (2 * e);
      const b = (n((x + e) * s, y * s, z) - n((x - e) * s, y * s, z)) / (2 * e);
      const vx = a, vy = -b, m = Math.hypot(vx, vy) || 1e-6; return [vx / m, vy / m, m];
    }
    step() {
      this.t++;
      const W = this.c.width, H = this.c.height, sp = W / 420;
      for (const p of this.parts) {
        const f = this.field(p.x, p.y); p.px = p.x; p.py = p.y; p.x += f[0] * sp * 1.6; p.y += f[1] * sp * 1.6; p.v = f[2]; p.life--;
        if (p.life < 0 || p.x < 0 || p.y < 0 || p.x > W || p.y > H) Object.assign(p, this.newP(false));
      }
      for (const p of this.anoms) {
        const f = this.field(p.x, p.y); p.px = p.x; p.py = p.y; p.x += p.dx * sp * 1.1; p.y += p.dy * sp * 1.1; p.life--;
        const dev = 1 - (f[0] * p.dx + f[1] * p.dy); // 0 = with the flow, 2 = against it
        p.score = p.score * .97 + dev * .03;
        if (!p.flagged && p.score > this.p.threshold && this.t > 40) { p.flagged = true; this.alerts++; }
        p.trail.push([p.x, p.y]); if (p.trail.length > 120) p.trail.shift();
        if (p.life < 0 || p.x < -10 || p.y < -10 || p.x > W + 10 || p.y > H + 10) Object.assign(p, this.newP(true));
      }
    }
    draw() {
      const ctx = this.ctx, W = this.c.width, H = this.c.height;
      ctx.fillStyle = 'rgba(5,8,14,0.075)'; ctx.fillRect(0, 0, W, H);
      ctx.lineWidth = Math.max(1, W / 700);
      for (const p of this.parts) {
        const t = clamp(p.v * 2.2, 0, 1), c = lerpColor([[30, 70, 160], [0, 170, 220], [150, 240, 255]], t);
        ctx.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0.55)`;
        ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      for (const p of this.anoms) {
        if (p.trail.length < 2) continue;
        ctx.strokeStyle = p.flagged ? 'rgba(255,77,109,.95)' : 'rgba(255,200,120,.55)'; ctx.lineWidth = Math.max(1.5, W / 400);
        ctx.beginPath(); ctx.moveTo(p.trail[0][0], p.trail[0][1]); p.trail.forEach(q => ctx.lineTo(q[0], q[1])); ctx.stroke();
        if (p.flagged) {
          const r = W / 45 + Math.sin(this.t * .2) * W / 200;
          ctx.save(); ctx.fillStyle = 'rgba(5,8,14,.6)'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
          ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
          label(ctx, p.x + r + 4, p.y, 'ANOMALY ' + p.score.toFixed(2), '#ff8fa3');
        }
      }
    }
    readouts() { return [['flows', this.parts.length.toLocaleString()], ['field scale', this.p.scale], ['threshold', this.p.threshold], ['alerts', this.alerts]]; }
    phase() { return this.t < 40 ? 'LEARNING BASELINE' : this.alerts ? 'DEVIATION FLAGGED' : 'MONITORING'; }
  }

  // =====================================================================
  // 04 · CONTAINMENT — Gray-Scott reaction-diffusion, IR lifecycle
  // =====================================================================
  class Containment {
    static meta = {
      id: 'containment', no: '04', title: 'Containment', concept: 'Incident response lifecycle',
      blurb: 'It copies itself because it can. The response is a line drawn faster than the next copy.',
      tags: ['Gray-Scott', 'Reaction-diffusion', 'Phase change'],
      params: {
        feed: { label: 'Feed rate', min: .02, max: .06, step: .001, value: .030 },
        kill: { label: 'Kill rate', min: .05, max: .07, step: .0005, value: .057 },
        detectAt: { label: 'Detect at step', min: 400, max: 6000, step: 50, value: 1400 },
        margin: { label: 'Boundary margin', min: 2, max: 30, step: 1, value: 8 }
      }
    };
    constructor(canvas, params) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.p = params; }
    reset(seed) {
      const R = mulberry32(seed), N = this.N = 220; this.t = 0; this.wallR = 0; this.erad = 0;
      this.U = new Float32Array(N * N).fill(1); this.V = new Float32Array(N * N); this.U2 = new Float32Array(N * N); this.V2 = new Float32Array(N * N);
      this.wall = new Uint8Array(N * N); this.inside = new Uint8Array(N * N);
      this.o = [N * (.42 + R() * .16), N * (.42 + R() * .16)];
      for (let k = 0; k < 5; k++) {
        const cx = this.o[0] + (R() - .5) * 10, cy = this.o[1] + (R() - .5) * 10;
        for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const i = ((cy + y) | 0) * N + ((cx + x) | 0); this.V[i] = .5 + R() * .25; this.U[i] = .5; }
      }
      this.img = this.ctx.createImageData(this.c.width, this.c.height);
    }
    closeBoundary() {
      const N = this.N; let r = 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (this.V[y * N + x] > .1) r = Math.max(r, Math.hypot(x - this.o[0], y - this.o[1]));
      r += this.p.margin; this.wallR = r;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const d = Math.hypot(x - this.o[0], y - this.o[1]);
        if (d > r && d < r + 2.2) this.wall[y * N + x] = 1; if (d <= r) this.inside[y * N + x] = 1;
      }
    }
    step() {
      const N = this.N, P = this.p, Du = .21, Dv = .105;
      for (let it = 0; it < 12; it++) {
        this.t++;
        if (this.t === P.detectAt) this.closeBoundary();
        if (this.wallR && this.t > P.detectAt + 900) this.erad = Math.min(1, (this.t - P.detectAt - 900) / 1200);
        const U = this.U, V = this.V, U2 = this.U2, V2 = this.V2;
        for (let y = 0; y < N; y++) {
          const ym = (y - 1 + N) % N, yp = (y + 1) % N;
          for (let x = 0; x < N; x++) {
            const i = y * N + x;
            if (this.wall[i]) { U2[i] = 1; V2[i] = 0; continue; }
            const xm = (x - 1 + N) % N, xp = (x + 1) % N;
            const lu = U[y * N + xm] + U[y * N + xp] + U[ym * N + x] + U[yp * N + x] - 4 * U[i];
            const lv = V[y * N + xm] + V[y * N + xp] + V[ym * N + x] + V[yp * N + x] - 4 * V[i];
            const k = P.kill + (this.inside[i] ? this.erad * .035 : 0);
            const uvv = U[i] * V[i] * V[i];
            U2[i] = U[i] + Du * lu - uvv + P.feed * (1 - U[i]);
            V2[i] = V[i] + Dv * lv + uvv - (k + P.feed) * V[i];
          }
        }
        this.U = U2; this.V = V2; this.U2 = U; this.V2 = V;
      }
    }
    draw() {
      const W = this.c.width, H = this.c.height, N = this.N, V = this.V, d = this.img.data, ctx = this.ctx;
      const stops = this.erad > 0 ? [[5, 8, 14], [40, 30, 70], [120, 80, 200], [200, 180, 255]] : [[5, 8, 14], [70, 10, 40], [230, 40, 90], [255, 170, 90], [255, 245, 220]];
      const s = N / W;
      for (let y = 0; y < H; y++) {
        const fy = y * s, y0 = fy | 0, y1 = Math.min(N - 1, y0 + 1), wy = fy - y0;
        for (let x = 0; x < W; x++) {
          const fx = x * s, x0 = fx | 0, x1 = Math.min(N - 1, x0 + 1), wx = fx - x0;
          const v = (V[y0 * N + x0] * (1 - wx) + V[y0 * N + x1] * wx) * (1 - wy) + (V[y1 * N + x0] * (1 - wx) + V[y1 * N + x1] * wx) * wy;
          const c = lerpColor(stops, clamp(v * 3, 0, 1)), o = (y * W + x) * 4;
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
      }
      ctx.putImageData(this.img, 0, 0);
      const k = W / N;
      if (this.wallR) {
        ctx.save(); ctx.strokeStyle = '#00d0ff'; ctx.lineWidth = Math.max(2, W / 260); ctx.setLineDash([10, 6]);
        ctx.beginPath(); ctx.arc(this.o[0] * k, this.o[1] * k, (this.wallR + 1) * k, 0, 6.283); ctx.stroke(); ctx.restore();
        label(ctx, this.o[0] * k, (this.o[1] - this.wallR) * k - W / 28, 'ISOLATION BOUNDARY', '#7fe6ff', 'center');
      } else {
        label(ctx, this.o[0] * k, this.o[1] * k, 'PATIENT ZERO', '#ff8fa3', 'center');
      }
    }
    coverage() { let n = 0; for (const v of this.V) if (v > .15) n++; return n / this.V.length; }
    readouts() { return [['feed / kill', this.p.feed.toFixed(3) + ' / ' + this.p.kill.toFixed(4)], ['step', this.t], ['infected', (100 * this.coverage()).toFixed(1) + '%'], ['phase', this.phase().split(' ')[0]]]; }
    phase() {
      const P = this.p;
      if (this.t < P.detectAt) return 'SPREAD — undetected';
      if (this.t < P.detectAt + 900) return 'CONTAIN — host isolated';
      if (this.coverage() > .012) return 'ERADICATE — cleaning';
      return 'RECOVER — restored';
    }
  }


  // =====================================================================
  // 05 · PACKET WALK — one packet vs one trade order, hop by hop
  // =====================================================================
  class PacketWalk {
    static meta = {
      id: 'packet-walk', no: '05', title: 'Packet Walk', concept: 'How a packet leaves your network (and how a trade order reaches the exchange)',
      blurb: 'Two journeys, same rules: every hop checks who you are, rewrites what it must, and can say no.',
      tags: ['OSI L2/L3', 'NAT', 'Order routing'],
      params: {
        hopTime: { label: 'Hop time', min: 20, max: 90, step: 1, value: 46 },
        jitter: { label: 'Latency jitter', min: 0, max: 1, step: .05, value: .35 },
        denyChance: { label: 'Deny chance %', min: 0, max: 100, step: 1, value: 0 },
        sparks: { label: 'Link traffic', min: 0, max: 400, step: 10, value: 160 }
      }
    };
    constructor(canvas, params) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.p = params; }
    reset(seed) {
      const R = mulberry32(seed); this.R = R; this.t = 0;
      this.net = [
        { n: 'PC', s: '10.0.10.25', mac: 'AA:01' }, { n: 'SWITCH', s: 'VLAN 10', mac: 'L2 only' }, { n: 'ROUTER', s: 'gw 10.0.10.1', mac: 'BB:02' },
        { n: 'FIREWALL', s: 'NAT + ACL', mac: 'CC:03' }, { n: 'ISP', s: 'internet', mac: 'DD:04' }, { n: 'WEB', s: '198.51.100.20', mac: 'EE:05' }];
      this.ord = [
        { n: 'PLATFORM', s: 'BUY 1 MNQ' }, { n: 'BROKER API', s: 'auth + token' }, { n: 'RISK CHECK', s: 'loss limit' },
        { n: 'EXCH GW', s: 'session' }, { n: 'MATCHING', s: 'order book' }, { n: 'FILL', s: 'confirmed' }];
      this.denyNet = R() * 100 < this.p.denyChance; this.denyOrd = R() * 100 < this.p.denyChance;
      const P = this.p; this.dur = []; let acc = 0; this.start = [];
      for (let i = 0; i < 5; i++) { const d = P.hopTime * (1 + (R() - .5) * 2 * P.jitter); this.start.push(acc); this.dur.push(d); acc += d; }
      this.total = acc; this.lat = this.dur.map(d => (d / 10).toFixed(1));
      this.sparks = []; for (let i = 0; i < P.sparks; i++) this.sparks.push({ lane: R() < .5 ? 0 : 1, u: R() * 5, v: .3 + R() * .9 });
    }
    xs(i) { return this.c.width * (.09 + i * .164); }
    step() { this.t++; for (const s of this.sparks) { s.u += .012 * s.v; if (s.u > 5) s.u = 0; } }
    pos() { // returns hop index + fraction, respecting deny
      const t = this.t % (this.total + 140);
      let hop = 5, f = 0;
      for (let i = 0; i < 5; i++) if (t < this.start[i] + this.dur[i]) { hop = i; f = (t - this.start[i]) / this.dur[i]; break; }
      return { hop, f, t };
    }
    draw() {
      const ctx = this.ctx, W = this.c.width, H = this.c.height, R = this.R;
      ctx.fillStyle = '#05080e'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(80,110,160,.10)'; ctx.lineWidth = 1;
      for (let g = 0; g < W; g += W / 30) { ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(W, g); ctx.stroke(); }
      const lanes = [{ y: H * .30, nodes: this.net, col: '#00d0ff', name: 'NETWORK PACKET', deny: this.denyNet, dHop: 3 }, { y: H * .74, nodes: this.ord, col: '#ffc93c', name: 'TRADE ORDER', deny: this.denyOrd, dHop: 2 }];
      // internal / external divider
      const dx = (this.xs(3) + this.xs(4)) / 2;
      ctx.save(); ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,77,109,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(dx, H * .06); ctx.lineTo(dx, H * .96); ctx.stroke(); ctx.restore();
      label(ctx, dx - 10, H * .07, 'INTERNAL / YOUR SIDE', '#9fb0c6', 'right'); label(ctx, dx + 10, H * .07, 'EXTERNAL / THEIR SIDE', '#ff8fa3', 'left');
      const { hop, f, t } = this.pos();
      lanes.forEach((L, li) => {
        ctx.fillStyle = L.col; ctx.font = '700 ' + (W / 40) + 'px "DejaVu Sans Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText(L.name, W * .03, L.y - H * .13);
        // links
        for (let i = 0; i < 5; i++) { ctx.strokeStyle = 'rgba(160,190,230,.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(this.xs(i), L.y); ctx.lineTo(this.xs(i + 1), L.y); ctx.stroke(); }
        // background sparks
        for (const s of this.sparks) if (s.lane === li) {
          const i = Math.floor(s.u), x = this.xs(i) + (this.xs(i + 1) - this.xs(i)) * (s.u - i);
          ctx.fillStyle = li ? 'rgba(255,201,60,.35)' : 'rgba(0,208,255,.35)'; ctx.fillRect(x, L.y - 1 + Math.sin(s.u * 40) * 3, 2, 2);
        }
        // nodes
        L.nodes.forEach((nd, i) => {
          const x = this.xs(i), w = W * .135, h = H * .085, done = (hop > i) || (hop === i && f > 0) || i === 0;
          const blocked = L.deny && i === L.dHop && hop >= L.dHop;
          ctx.fillStyle = blocked ? 'rgba(80,10,25,.9)' : 'rgba(12,20,36,.95)';
          ctx.strokeStyle = blocked ? '#ff4d6d' : (hop >= i ? L.col : 'rgba(120,150,190,.5)'); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.roundRect(x - w / 2, L.y - h / 2, w, h, 8); ctx.fill(); ctx.stroke();
          ctx.textAlign = 'center'; ctx.fillStyle = '#e8eef8'; ctx.font = '700 ' + (W / 62) + 'px "DejaVu Sans", sans-serif'; ctx.fillText(nd.n, x, L.y - h * .08);
          ctx.fillStyle = '#8a9bb2'; ctx.font = (W / 75) + 'px "DejaVu Sans Mono", monospace'; ctx.fillText(nd.s, x, L.y + h * .28);
        });
        // the traveler
        const stopHop = L.deny ? L.dHop : 5;
        let ph = Math.min(hop, stopHop), pf = hop >= stopHop ? 0 : f;
        const x = this.xs(ph) + (ph < 5 ? (this.xs(ph + 1) - this.xs(ph)) * pf : 0);
        const glow = ctx.createRadialGradient(x, L.y, 0, x, L.y, W / 30); glow.addColorStop(0, L.col); glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, L.y, W / 30, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, L.y, W / 160, 0, 6.283); ctx.fill();
        // info card
        const cardY = li === 0 ? L.y + H * .075 : L.y + H * .075;
        let lines;
        if (li === 0) {
          const nat = ph >= 4 || (ph === 3 && pf > .5);
          const macs = ['AA:01 → BB:02', 'AA:01 → BB:02', 'BB:02 → CC:03', 'CC:03 → DD:04', 'DD:04 → EE:05', 'DD:04 → EE:05'];
          lines = ['src IP  ' + (nat ? '203.0.113.5  (NAT)' : '10.0.10.25'), 'dst IP  198.51.100.20:443', 'MAC     ' + macs[ph] + '  (new each hop)', 'TTL     ' + (64 - Math.max(0, ph - 1))];
          if (L.deny && hop >= stopHop) lines.push('ACL     DENY  → dropped at firewall');
          else if (hop >= 5) lines.push('state   ESTABLISHED  ✓');
        } else {
          lines = ['order   BUY 1 MNQ @ MKT', 'acct    authenticated (API token)', 'risk    ' + (ph >= 2 ? (L.deny ? 'daily loss limit HIT' : 'within limits ✓') : 'pending'), 'route   ' + (ph >= 3 ? 'exchange session' : 'broker')];
          if (L.deny && hop >= stopHop) lines.push('status  REJECTED by risk  ✕');
          else if (hop >= 5) lines.push('status  FILLED ✓');
        }
        const cw = W * .40, ch = (lines.length + .6) * W / 46, cx = clamp(x - cw / 2, W * .02, W * .98 - cw);
        ctx.fillStyle = 'rgba(3,6,12,.92)'; ctx.strokeStyle = L.col; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.roundRect(cx, cardY, cw, ch, 6); ctx.fill(); ctx.stroke();
        ctx.textAlign = 'left'; ctx.font = (W / 70) + 'px "DejaVu Sans Mono", monospace';
        lines.forEach((ln, k) => { ctx.fillStyle = /DENY|REJECT|HIT/.test(ln) ? '#ff4d6d' : /✓/.test(ln) ? '#3ddc84' : '#cfe3ff'; ctx.fillText(ln, cx + 10, cardY + (k + 1) * W / 46); });
      });
    }
    readouts() {
      const { hop } = this.pos();
      return [['hop', Math.min(hop, 5) + ' / 5'], ['latency', this.lat.reduce((a, b) => a + +b, 0).toFixed(1) + ' ms'], ['net verdict', this.denyNet ? 'DENY' : 'ALLOW'], ['order', this.denyOrd ? 'REJECTED' : 'ROUTED']];
    }
    phase() { const { hop } = this.pos(); return ['LEAVING THE HOST', 'SWITCHING (L2)', 'ROUTING (L3)', 'FIREWALL + NAT', 'ACROSS THE INTERNET', 'DELIVERED'][Math.min(hop, 5)]; }
  }

  G.SN = { pieces: [Holdings, SlimePath, Baseline, Containment, PacketWalk], mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);
