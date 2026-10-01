/* DARPA Lineage — three interactive modules in a CRT-phosphor style.
   Each module: new M(canvas) -> reset(seed), step(), draw(), click(x,y), readouts(), phase()
   01 LO          packet switching on an isometric mesh (ARPANET, 1969)
   02 BATTLESPACE radar-sweep network discovery (Plan X, 2012)
   03 MACHINE SPEED coverage-guided fuzzing + auto-patching (Cyber Grand Challenge 2016 / AIxCC 2025) */
(function (G) {
  'use strict';
  const rng = a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const PH = '#39ff88', PH2 = '#1d8f50', AMB = '#ffb63d', RED = '#ff4d4d', CY = '#5ee7ff', BG = '#020805';
  const mono = (px, w) => `${w || 600} ${px}px "DejaVu Sans Mono", ui-monospace, Menlo, monospace`;
  function crt(ctx, W, H, t) { // scanlines + vignette
    ctx.save(); ctx.globalAlpha = .10; ctx.fillStyle = '#000';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    ctx.globalAlpha = 1; const g = ctx.createRadialGradient(W / 2, H / 2, W * .35, W / 2, H / 2, W * .75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  function tag(ctx, x, y, text, col, size, align) {
    ctx.save(); ctx.font = mono(size); ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + size * .8, h = size * 1.5;
    const bx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x - size * .4;
    ctx.fillStyle = 'rgba(2,8,5,.85)'; ctx.fillRect(bx, y - h / 2, w, h); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(bx + .5, y - h / 2 + .5, w - 1, h - 1);
    ctx.fillStyle = col; ctx.fillText(text, x, y + 1); ctx.restore();
  }

  // ======================================================================
  // 01 · LO — packet switching on an isometric mesh
  // ======================================================================
  class LO {
    static meta = { id: 'lo', no: '01', title: 'LO', year: '1969 · ARPANET',
      concept: 'Packet switching: chop a message into numbered pieces, let each find its own way, rebuild it at the end.',
      howto: 'Click a node to knock it offline. Packets route around it.' };
    constructor(c) { this.c = c; this.ctx = c.getContext('2d'); }
    reset(seed, msg) {
      const R = this.R = rng(seed); this.t = 0; this.msg = (msg || 'LOGIN').toUpperCase().slice(0, 8);
      const names = ['UCLA', 'UCSB', 'RAND', 'SDC', 'UTAH', 'CASE', 'CMU', 'LINC', 'MIT', 'BBN', 'HARV', 'SRI'];
      // 4x3 lattice on the floor, with height variation
      this.nodes = names.map((n, i) => ({ n, gx: i % 4, gy: Math.floor(i / 4), z: R() * .6, dead: false, pulse: 0 }));
      // source/dest at far corners
      this.src = 0; this.dst = 11;
      const E = new Set(), add = (a, b) => E.add(a < b ? a + '-' + b : b + '-' + a);
      this.nodes.forEach((a, i) => { if (a.gx < 3) add(i, i + 1); if (a.gy < 2) add(i, i + 4); });
      for (let k = 0; k < 4; k++) { const a = (R() * 8) | 0; add(a, a + 5 > 11 ? a + 3 : a + 5); }
      this.edges = [...E].map(s => s.split('-').map(Number));
      this.adj = this.nodes.map(() => []); this.edges.forEach(([a, b]) => { this.adj[a].push(b); this.adj[b].push(a); });
      this.packets = []; this.buffer = []; this.sent = 0; this.delivered = 0; this.reroutes = 0; this.done = false; this.killed = 0;
      this.autoKill = true;
    }
    path(from) { // Dijkstra with jittered weights (each packet may choose a different route)
      const n = this.nodes.length, d = Array(n).fill(1e9), p = Array(n).fill(-1), seen = Array(n).fill(false); d[from] = 0;
      for (let k = 0; k < n; k++) { let u = -1; for (let i = 0; i < n; i++) if (!seen[i] && (u < 0 || d[i] < d[u])) u = i; if (u < 0 || d[u] >= 1e9) break; seen[u] = true;
        for (const v of this.adj[u]) { if (this.nodes[v].dead) continue; const w = 1 + this.R() * 1.6; if (d[u] + w < d[v]) { d[v] = d[u] + w; p[v] = u; } } }
      if (d[this.dst] >= 1e9) return null; const out = []; for (let v = this.dst; v >= 0; v = p[v]) out.unshift(v); return out;
    }
    iso(gx, gy, z) { const W = this.c.width, s = W / 6.6; return [W * .5 + (gx - gy) * s * .866 - s * .45, W * .25 + (gx + gy) * s * .5 - z * s * .6]; }
    step() {
      this.t++;
      if (this.sent < this.msg.length && this.t % 14 === 0) {
        const route = this.path(this.src); if (route) { this.packets.push({ seq: this.sent + 1, ch: this.msg[this.sent], route, i: 0, f: 0, sp: .035 + this.R() * .03 }); this.sent++; }
      }
      if (this.autoKill && this.t === 60) { // knock out the busiest relay mid-flight
        const cnt = {}; this.packets.forEach(p => p.route.slice(1, -1).forEach(v => cnt[v] = (cnt[v] || 0) + 1));
        const v = +Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; if (!isNaN(v)) this.kill(v);
      }
      for (const p of this.packets) {
        if (p.arrived) continue;
        p.f += p.sp;
        if (p.f >= 1) { p.f = 0; p.i++; const here = p.route[p.i]; this.nodes[here].pulse = 1;
          if (here === this.dst) { p.arrived = true; this.buffer.push(p); this.delivered++; continue; }
          const next = p.route[p.i + 1]; if (this.nodes[next].dead) { const r = this.path(here); if (r) { p.route = p.route.slice(0, p.i).concat(r); this.reroutes++; } }
        }
      }
      this.nodes.forEach(n => n.pulse *= .9);
      if (this.delivered === this.msg.length) this.done = true;
    }
    kill(i) { if (i === this.src || i === this.dst) return; const n = this.nodes[i]; n.dead = !n.dead; if (n.dead) this.killed++;
      for (const p of this.packets) { if (p.arrived) continue; const rest = p.route.slice(p.i + 1); if (rest.includes(i)) { const here = p.route[p.i]; const r = this.path(here); if (r) { p.route = p.route.slice(0, p.i).concat(r); this.reroutes++; } } } }
    click(x, y) { let best = -1, bd = 1e9; this.nodes.forEach((n, i) => { const [sx, sy] = this.iso(n.gx, n.gy, n.z); const d = (sx - x) ** 2 + (sy - y) ** 2; if (d < bd) { bd = d; best = i; } });
      if (bd < (this.c.width / 14) ** 2) this.kill(best); }
    draw() {
      const ctx = this.ctx, W = this.c.width, H = this.c.height, k = W / 1000;
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      // iso floor grid
      ctx.strokeStyle = 'rgba(57,255,136,.08)'; ctx.lineWidth = 1;
      for (let g = -1; g <= 5; g += .5) { let a = this.iso(g, -1, 0), b = this.iso(g, 4, 0); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); a = this.iso(-1, g, 0); b = this.iso(5, g, 0); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); }
      // edges
      for (const [a, b] of this.edges) { const A = this.nodes[a], B = this.nodes[b], pa = this.iso(A.gx, A.gy, A.z), pb = this.iso(B.gx, B.gy, B.z);
        const dead = A.dead || B.dead; ctx.strokeStyle = dead ? 'rgba(255,77,77,.25)' : 'rgba(57,255,136,.45)'; ctx.lineWidth = 2 * k; ctx.setLineDash(dead ? [6 * k, 6 * k] : []);
        ctx.beginPath(); ctx.moveTo(...pa); ctx.lineTo(...pb); ctx.stroke(); }
      ctx.setLineDash([]);
      // nodes as iso cubes
      const s = W / 6.6 * .15;
      this.nodes.forEach((n, i) => { const [x, y] = this.iso(n.gx, n.gy, n.z); const col = n.dead ? RED : (i === this.src || i === this.dst) ? AMB : PH;
        // pillar to floor
        const [fx, fy] = this.iso(n.gx, n.gy, 0); ctx.strokeStyle = 'rgba(57,255,136,.15)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(fx, fy); ctx.stroke();
        const top = [[x, y - s], [x + s * .9, y - s * .5], [x, y], [x - s * .9, y - s * .5]];
        const fl = n.dead && (this.t % 20 < 10);
        ctx.fillStyle = fl ? 'rgba(255,77,77,.5)' : col === PH ? 'rgba(57,255,136,.28)' : col === AMB ? 'rgba(255,182,61,.35)' : 'rgba(255,77,77,.2)';
        ctx.beginPath(); top.forEach((p, j) => j ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.moveTo(x - s * .9, y - s * .5); ctx.lineTo(x, y); ctx.lineTo(x, y + s * .8); ctx.lineTo(x - s * .9, y + s * .3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.moveTo(x + s * .9, y - s * .5); ctx.lineTo(x, y); ctx.lineTo(x, y + s * .8); ctx.lineTo(x + s * .9, y + s * .3); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.5 * k + n.pulse * 3 * k; ctx.shadowColor = col; ctx.shadowBlur = 10 * k + n.pulse * 20 * k;
        ctx.beginPath(); top.forEach((p, j) => j ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - s * .9, y - s * .5); ctx.lineTo(x - s * .9, y + s * .3); ctx.lineTo(x, y + s * .8); ctx.lineTo(x + s * .9, y + s * .3); ctx.lineTo(x + s * .9, y - s * .5); ctx.moveTo(x, y); ctx.lineTo(x, y + s * .8); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.font = mono(20 * k, 700); ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(n.n, x, y - s * 1.35);
        if (n.dead) { ctx.font = mono(15 * k, 700); ctx.fillText('OFFLINE', x, y + s * 1.6); }
      });
      // packets
      for (const p of this.packets) { if (p.arrived) continue;
        const A = this.nodes[p.route[p.i]], B = this.nodes[p.route[Math.min(p.i + 1, p.route.length - 1)]];
        const pa = this.iso(A.gx, A.gy, A.z), pb = this.iso(B.gx, B.gy, B.z); const x = pa[0] + (pb[0] - pa[0]) * p.f, y = pa[1] + (pb[1] - pa[1]) * p.f - s * .3;
        ctx.fillStyle = CY; ctx.shadowColor = CY; ctx.shadowBlur = 16 * k; ctx.fillRect(x - 15 * k, y - 15 * k, 30 * k, 30 * k); ctx.shadowBlur = 0;
        ctx.fillStyle = BG; ctx.font = mono(19 * k, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.ch, x, y + 1); ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = CY; ctx.font = mono(13 * k, 700); ctx.fillText('#' + p.seq, x, y - 22 * k);
      }
      // reassembly buffer
      const bx = 60 * k, by = H - 120 * k, cw = 70 * k;
      ctx.font = mono(17 * k, 700); ctx.fillStyle = PH; ctx.textAlign = 'left'; ctx.fillText('ARRIVAL ORDER', bx, by - 16 * k);
      this.buffer.forEach((p, i) => { ctx.strokeStyle = CY; ctx.lineWidth = 2 * k; ctx.strokeRect(bx + i * cw, by, cw - 10 * k, 46 * k); ctx.fillStyle = CY; ctx.font = mono(24 * k, 800); ctx.textAlign = 'center'; ctx.fillText(p.ch, bx + i * cw + (cw - 10 * k) / 2, by + 32 * k); ctx.font = mono(12 * k); ctx.fillText('#' + p.seq, bx + i * cw + (cw - 10 * k) / 2, by + 62 * k); });
      ctx.textAlign = 'left'; ctx.font = mono(17 * k, 700); ctx.fillStyle = AMB; ctx.fillText('REASSEMBLED BY SEQ #', bx + 560 * k, by - 16 * k);
      const sorted = [...this.buffer].sort((a, b) => a.seq - b.seq); let word = ''; for (let i = 0; i < this.msg.length; i++) { const p = sorted.find(q => q.seq === i + 1); word += p ? p.ch : '_'; }
      ctx.font = mono(46 * k, 800); ctx.fillStyle = this.done ? AMB : 'rgba(255,182,61,.55)'; ctx.shadowColor = AMB; ctx.shadowBlur = this.done ? 18 * k : 0; ctx.fillText(word.split('').join(' '), bx + 560 * k, by + 38 * k); ctx.shadowBlur = 0;
      crt(ctx, W, H, this.t);
    }
    readouts() { return [['sent', this.sent + ' / ' + this.msg.length], ['delivered', this.delivered], ['reroutes', this.reroutes], ['nodes down', this.nodes.filter(n => n.dead).length]]; }
    phase() { return this.done ? 'MESSAGE REBUILT' : this.reroutes ? 'ROUTING AROUND DAMAGE' : 'PACKETS IN FLIGHT'; }
  }

  // ======================================================================
  // 02 · BATTLESPACE — radar-sweep discovery of a network
  // ======================================================================
  const SERVICES = [[22, 'ssh'], [80, 'http'], [443, 'https'], [445, 'smb', 1], [3389, 'rdp', 1], [23, 'telnet', 2], [53, 'dns'], [3306, 'mysql', 1], [161, 'snmp', 1], [8080, 'http-alt']];
  class Battlespace {
    static meta = { id: 'battlespace', no: '02', title: 'BATTLESPACE', year: '2012 · PLAN X',
      concept: 'Map before you fight: every sweep reveals more. Hosts, then open ports, then what’s risky.',
      howto: 'Click any host to see what the scan found on it.' };
    constructor(c) { this.c = c; this.ctx = c.getContext('2d'); }
    reset(seed) {
      const R = this.R = rng(seed); this.t = 0; this.sweep = -Math.PI / 2; this.passes = 0; this.sel = null;
      const subnets = [{ name: '10.0.10.0/24', label: 'USERS', a: -2.3 }, { name: '10.0.20.0/24', label: 'SERVERS', a: -.5 }, { name: '10.0.30.0/24', label: 'IOT / OT', a: 1.4 }, { name: '10.0.99.0/24', label: 'MGMT', a: 2.85 }];
      this.subnets = subnets.map((s, i) => ({ ...s, r: .27, x: Math.cos(s.a) * .27, y: Math.sin(s.a) * .27 }));
      this.hosts = [];
      this.subnets.forEach((s, si) => { const n = [9, 7, 8, 4][si];
        for (let i = 0; i < n; i++) { const a = s.a + (R() - .5) * 1.1, r = .3 + R() * .16;
          const ports = SERVICES.filter((sv) => R() < (si === 1 ? .32 : si === 2 ? .22 : .16)); if (!ports.length) ports.push(SERVICES[(R() * 3) | 0]);
          if (si === 2 && R() < .5) ports.push(SERVICES[5]);
          const risk = ports.reduce((m, p) => Math.max(m, p[2] || 0), 0);
          this.hosts.push({ ip: s.name.replace('0/24', String(10 + i * 7 + ((R() * 6) | 0))), sub: si, x: Math.cos(a) * r, y: Math.sin(a) * r, ang: Math.atan2(Math.sin(a) * r, Math.cos(a) * r), ports, risk, seen: 0, flash: 0 });
        } });
    }
    step() {
      this.t++; const prev = this.sweep; this.sweep += .028;
      const norm = a => (a + Math.PI * 4) % (Math.PI * 2);
      for (const h of this.hosts) { const a0 = norm(prev), a1 = norm(this.sweep), ha = norm(h.ang);
        const crossed = a0 <= a1 ? (ha > a0 && ha <= a1) : (ha > a0 || ha <= a1); if (crossed && h.seen < 3) { h.seen++; h.flash = 1; } h.flash *= .94; }
      if (this.sweep > Math.PI * 1.5 + this.passes * Math.PI * 2) this.passes++;
    }
    click(x, y) { const W = this.c.width, cx = W / 2, cy = this.c.height * .47, R = W * .44; let best = null, bd = 1e9;
      for (const h of this.hosts) { if (!h.seen) continue; const d = (cx + h.x * R / .5 - x) ** 2 + (cy + h.y * R / .5 - y) ** 2; if (d < bd) { bd = d; best = h; } }
      this.sel = bd < (W / 20) ** 2 ? best : null; }
    draw() {
      const ctx = this.ctx, W = this.c.width, H = this.c.height, k = W / 1000, cx = W / 2, cy = H * .47, R = W * .44, P = (h) => [cx + h.x * R / .5, cy + h.y * R / .5];
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      // range rings + crosshair
      ctx.strokeStyle = 'rgba(57,255,136,.14)'; ctx.lineWidth = 1;
      for (let r = 1; r <= 4; r++) { ctx.beginPath(); ctx.arc(cx, cy, R * r / 4, 0, 6.283); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      // sweep wedge
      const g = ctx.createConicGradient ? ctx.createConicGradient(this.sweep - .9, cx, cy) : null;
      if (g) { g.addColorStop(0, 'rgba(57,255,136,0)'); g.addColorStop(.14, 'rgba(57,255,136,.22)'); g.addColorStop(.1432, 'rgba(57,255,136,0)'); g.addColorStop(1, 'rgba(57,255,136,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, 0, 6.283); ctx.fill(); }
      ctx.strokeStyle = PH; ctx.lineWidth = 2 * k; ctx.shadowColor = PH; ctx.shadowBlur = 12 * k; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(this.sweep) * R, cy + Math.sin(this.sweep) * R); ctx.stroke(); ctx.shadowBlur = 0;
      // subnet labels + links (only once a host in it is seen)
      this.subnets.forEach((s, si) => { const hs = this.hosts.filter(h => h.sub === si && h.seen); if (!hs.length) return;
        const gx = cx + s.x * R / .5, gy = cy + s.y * R / .5;
        hs.forEach(h => { const [x, y] = P(h); ctx.strokeStyle = 'rgba(57,255,136,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(x, y); ctx.stroke(); });
        ctx.strokeStyle = 'rgba(57,255,136,.4)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(gx, gy); ctx.stroke();
        ctx.fillStyle = PH; ctx.fillRect(gx - 5 * k, gy - 5 * k, 10 * k, 10 * k);
        tag(ctx, gx, gy - 28 * k, s.label + '  ' + s.name, PH, 15 * k, 'center'); });
      ctx.fillStyle = AMB; ctx.beginPath(); ctx.arc(cx, cy, 8 * k, 0, 6.283); ctx.fill(); tag(ctx, cx, cy + 26 * k, 'SCANNER', AMB, 13 * k, 'center');
      // hosts
      for (const h of this.hosts) { if (!h.seen) continue; const [x, y] = P(h);
        const col = h.seen >= 3 ? (h.risk === 2 ? RED : h.risk === 1 ? AMB : PH) : PH;
        ctx.shadowColor = col; ctx.shadowBlur = (8 + h.flash * 25) * k; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, (6 + h.flash * 6) * k, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
        if (h.seen >= 2) { // port ticks around host
          h.ports.forEach((p, i) => { const a = -Math.PI / 2 + i * 6.283 / h.ports.length; ctx.strokeStyle = p[2] === 2 ? RED : p[2] ? AMB : PH; ctx.lineWidth = 3 * k;
            ctx.beginPath(); ctx.arc(x, y, 15 * k, a - .35, a + .35); ctx.stroke(); }); }
        if (h.seen >= 3 && h.risk) { ctx.font = mono(12 * k, 700); ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(h.ports.filter(p => p[2]).map(p => p[1]).join(','), x, y + 30 * k); }
        if (this.sel === h) { ctx.strokeStyle = CY; ctx.lineWidth = 2 * k; ctx.strokeRect(x - 22 * k, y - 22 * k, 44 * k, 44 * k); }
      }
      // legend
      ctx.textAlign = 'left'; ctx.font = mono(16 * k, 700);
      [['PASS 1  host is alive (ping)', 1], ['PASS 2  open ports (ticks)', 2], ['PASS 3  services + risk', 3]].forEach(([t, n], i) => { ctx.fillStyle = this.passes + 1 >= n ? PH : 'rgba(57,255,136,.3)'; ctx.fillText((this.passes + 1 >= n ? '■ ' : '□ ') + t, 36 * k, H - 112 * k + i * 26 * k); });
      ctx.fillStyle = AMB; ctx.fillText('● risky  (smb, rdp, mysql, snmp)', W - 420 * k, H - 112 * k); ctx.fillStyle = RED; ctx.fillText('● critical  (telnet, plaintext)', W - 420 * k, H - 86 * k);
      if (this.sel) { const h = this.sel, lines = [h.ip, ...h.ports.map(p => (p[2] === 2 ? '!! ' : p[2] ? ' ! ' : '   ') + String(p[0]).padEnd(5) + p[1])];
        const bw = 250 * k, bh = (lines.length + .8) * 22 * k, bx = W - bw - 30 * k, by = 30 * k; ctx.fillStyle = 'rgba(2,8,5,.92)'; ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = CY; ctx.strokeRect(bx, by, bw, bh);
        ctx.font = mono(16 * k, 700); lines.forEach((l, i) => { ctx.fillStyle = i ? (l.startsWith('!!') ? RED : l.startsWith(' !') ? AMB : PH) : CY; ctx.fillText(l, bx + 12 * k, by + 26 * k + i * 22 * k); }); }
      crt(ctx, W, H, this.t);
    }
    readouts() { const s = this.hosts.filter(h => h.seen), p = this.hosts.filter(h => h.seen >= 2).reduce((a, h) => a + h.ports.length, 0);
      return [['hosts found', s.length + ' / ' + this.hosts.length], ['open ports', p], ['risky hosts', this.hosts.filter(h => h.seen >= 3 && h.risk).length], ['sweeps', this.passes]]; }
    phase() { return ['DISCOVERING HOSTS', 'ENUMERATING PORTS', 'IDENTIFYING RISK', 'MAP COMPLETE'][Math.min(3, this.passes)]; }
  }

  // ======================================================================
  // 03 · MACHINE SPEED — coverage-guided fuzzing + auto-patch
  // ======================================================================
  class MachineSpeed {
    static meta = { id: 'machine-speed', no: '03', title: 'MACHINE SPEED', year: '2016 CGC → 2025 AIxCC',
      concept: 'A fuzzer throws millions of mutated inputs at a program, keeps the ones that reach new code, and finds the crash. Then the machine writes the patch.',
      howto: 'Click any block to plant a bug and watch the system find and patch it.' };
    constructor(c) { this.c = c; this.ctx = c.getContext('2d'); }
    reset(seed) {
      const R = this.R = rng(seed); this.t = 0; this.cols = 22; this.rows = 16;
      this.cells = []; for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) this.cells.push({ x, y, wall: R() < .16, cov: 0, bug: false, state: 0, hit: 0 });
      this.entry = this.idx(0, (this.rows / 2) | 0); this.cells[this.entry].wall = false; this.cells[this.entry].cov = 1;
      for (let i = 0; i < 4; i++) { let c; do { c = this.cells[(R() * this.cells.length) | 0]; } while (c.wall || c.x < 6); c.bug = true; }
      this.frontier = [this.entry]; this.execs = 0; this.corpus = 1; this.crashes = 0; this.patched = 0; this.events = []; this.shots = [];
    }
    idx(x, y) { return y * this.cols + x; }
    plant(i) { const c = this.cells[i]; if (!c || c.wall || c.state) return; c.bug = true; }
    click(x, y) { const g = this.geom(); const cx = Math.floor((x - g.ox) / g.cw), cy = Math.floor((y - g.oy) / g.ch); if (cx >= 0 && cy >= 0 && cx < this.cols && cy < this.rows) this.plant(this.idx(cx, cy)); }
    geom() { const W = this.c.width, cw = W * .86 / this.cols; return { cw, ch: cw * .82, ox: W * .07, oy: this.c.height * .17 }; }
    step() {
      this.t++; const R = this.R;
      // each tick: a batch of mutated inputs; coverage-guided expansion from the frontier
      for (let b = 0; b < 6; b++) {
        this.execs += 1700 + ((R() * 900) | 0);
        const src = this.frontier[(R() * this.frontier.length) | 0]; const s = this.cells[src];
        const dirs = [[1, 0], [0, 1], [0, -1], [-1, 0], [1, 1], [1, -1]]; const d = dirs[(R() * dirs.length) | 0];
        const nx = s.x + d[0], ny = s.y + d[1]; if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
        const ni = this.idx(nx, ny), n = this.cells[ni]; if (n.wall) continue;
        this.shots.push({ from: src, to: ni, life: 1 });
        if (!n.cov) { n.cov = 1; n.hit = 1; this.frontier.push(ni); this.corpus++; // new coverage -> keep input
          if (n.bug && !n.state) { n.state = 1; n.t0 = this.t; this.crashes++; this.events.push({ t: this.t, txt: `CRASH  block ${nx},${ny}  input #${this.corpus}` }); } }
      }
      for (const c of this.cells) { c.hit *= .9; if (c.state === 1 && this.t - c.t0 > 40) { c.state = 2; this.patched++; this.events.push({ t: this.t, txt: `PATCH  block ${c.x},${c.y}  verified` }); } }
      // bugs that get planted inside already-covered code are found on the next pass
      for (const c of this.cells) if (c.bug && c.cov && !c.state && this.R() < .05) { c.state = 1; c.t0 = this.t; this.crashes++; this.events.push({ t: this.t, txt: `CRASH  block ${c.x},${c.y}  regression` }); }
      this.shots.forEach(s => s.life -= .12); this.shots = this.shots.filter(s => s.life > 0);
      if (this.events.length > 7) this.events.shift();
    }
    draw() {
      const ctx = this.ctx, W = this.c.width, H = this.c.height, k = W / 1000, g = this.geom();
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      ctx.font = mono(17 * k, 700); ctx.fillStyle = PH; ctx.textAlign = 'left'; ctx.fillText('TARGET PROGRAM  —  each block = a chunk of code', g.ox, g.oy - 22 * k);
      for (const c of this.cells) { const x = g.ox + c.x * g.cw, y = g.oy + c.y * g.ch;
        if (c.wall) { ctx.fillStyle = 'rgba(57,255,136,.04)'; ctx.fillRect(x + 2, y + 2, g.cw - 4, g.ch - 4); continue; }
        let fill = 'rgba(57,255,136,.07)', stroke = 'rgba(57,255,136,.18)';
        if (c.cov) { fill = `rgba(57,255,136,${.22 + c.hit * .6})`; stroke = PH; }
        if (c.state === 1) { const f = (this.t % 8 < 4); fill = f ? 'rgba(255,77,77,.85)' : 'rgba(255,77,77,.4)'; stroke = RED; }
        if (c.state === 2) { fill = 'rgba(94,231,255,.45)'; stroke = CY; }
        ctx.fillStyle = fill; ctx.fillRect(x + 2, y + 2, g.cw - 4, g.ch - 4); ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.strokeRect(x + 2.5, y + 2.5, g.cw - 5, g.ch - 5);
        if (c.state === 2) { ctx.fillStyle = BG; ctx.font = mono(g.cw * .5, 800); ctx.textAlign = 'center'; ctx.fillText('✓', x + g.cw / 2, y + g.ch * .7); }
        if (c.state === 1) { ctx.fillStyle = '#fff'; ctx.font = mono(g.cw * .5, 800); ctx.textAlign = 'center'; ctx.fillText('!', x + g.cw / 2, y + g.ch * .7); }
      }
      // input shots
      for (const s of this.shots) { const a = this.cells[s.from], b = this.cells[s.to]; ctx.strokeStyle = `rgba(255,255,255,${s.life * .7})`; ctx.lineWidth = 1.5 * k;
        ctx.beginPath(); ctx.moveTo(g.ox + (a.x + .5) * g.cw, g.oy + (a.y + .5) * g.ch); ctx.lineTo(g.ox + (b.x + .5) * g.cw, g.oy + (b.y + .5) * g.ch); ctx.stroke(); }
      const e = this.cells[this.entry]; tag(ctx, g.ox - 4 * k, g.oy + (e.y + .5) * g.ch, 'INPUT ▶', AMB, 14 * k, 'right');
      // event log
      const ly = g.oy + this.rows * g.ch + 40 * k; ctx.textAlign = 'left'; ctx.font = mono(17 * k, 700); ctx.fillStyle = PH; ctx.fillText('EVENT LOG', g.ox, ly);
      this.events.slice(-5).forEach((ev, i) => { ctx.fillStyle = ev.txt.startsWith('CRASH') ? RED : CY; ctx.font = mono(16 * k, 600); ctx.fillText(`t+${String(ev.t).padStart(4, '0')}  ${ev.txt}`, g.ox, ly + 28 * k + i * 24 * k); });
      crt(ctx, W, H, this.t);
    }
    coverage() { const open = this.cells.filter(c => !c.wall); return open.filter(c => c.cov).length / open.length; }
    readouts() { return [['execs', this.execs.toLocaleString()], ['coverage', (100 * this.coverage()).toFixed(0) + '%'], ['crashes', this.crashes], ['patched', this.patched]]; }
    phase() { return this.cells.some(c => c.state === 1) ? 'CRASH → GENERATING PATCH' : this.patched ? 'PATCHED — STILL FUZZING' : 'EXPLORING CODE'; }
  }

  G.DARPA = { modules: [LO, Battlespace, MachineSpeed], colors: { PH, PH2, AMB, RED, CY, BG } };
})(typeof window !== 'undefined' ? window : globalThis);
