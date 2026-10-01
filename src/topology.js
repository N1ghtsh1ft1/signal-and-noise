/* Shared reference network for the "control placement" series.
   Logical space is 1000x1000; draw(ctx, size, opts) scales it. */
(function (G) {
  'use strict';
  const Z = { // zones
    edge: { x: 300, y: 20, w: 400, h: 330, label: 'EDGE / PERIMETER', c: '#ff4d6d' },
    dmz: { x: 640, y: 215, w: 345, h: 230, label: 'SCREENED SUBNET (DMZ)', c: '#ffc93c' },
    users: { x: 15, y: 545, w: 450, h: 225, label: 'USER VLAN 10', c: '#3ddc84' },
    servers: { x: 535, y: 545, w: 450, h: 225, label: 'SERVER VLAN 20', c: '#00d0ff' },
    mgmt: { x: 15, y: 800, w: 970, h: 185, label: 'MGMT VLAN 99 (out-of-band)', c: '#b18cff' }
  };
  const N = {
    inet: { x: 500, y: 70, t: 'INTERNET', s: 'untrusted', k: 'cloud' },
    vpn: { x: 200, y: 180, t: 'VPN', s: 'remote access', k: 'box', ctl: 'vpn', ty: 'P' },
    edge: { x: 500, y: 180, t: 'EDGE ROUTER', s: 'ACL · anti-spoof', k: 'router', ctl: 'acl', ty: 'P' },
    fw: { x: 500, y: 300, t: 'NGFW + IPS', s: 'stateful · inline', k: 'fw', ctl: 'fw', ty: 'PD' },
    waf: { x: 735, y: 300, t: 'WAF / LB', s: 'reverse proxy', k: 'box', ctl: 'waf', ty: 'P' },
    web: { x: 905, y: 300, t: 'WEB', s: 'public site', k: 'server' },
    core: { x: 500, y: 440, t: 'CORE SWITCH', s: 'L3 · VLANs', k: 'switch' },
    ids: { x: 290, y: 440, t: 'IDS SENSOR', s: 'SPAN copy', k: 'box', ctl: 'ids', ty: 'D' },
    proxy: { x: 710, y: 440, t: 'FWD PROXY', s: 'URL filter', k: 'box', ctl: 'proxy', ty: 'P' },
    acc: { x: 240, y: 600, t: 'ACCESS SW', s: '802.1X · port-sec', k: 'switch', ctl: 'nac', ty: 'PC' },
    pc1: { x: 95, y: 710, t: 'PC', s: '10.10.10.21', k: 'pc' },
    pc2: { x: 240, y: 710, t: 'PC', s: '10.10.10.22', k: 'pc' },
    pc3: { x: 385, y: 710, t: 'LAPTOP', s: '10.10.10.23', k: 'pc' },
    dist: { x: 760, y: 600, t: 'SERVER SW', s: 'ACL per VLAN', k: 'switch' },
    db: { x: 640, y: 710, t: 'DATABASE', s: '10.10.20.10', k: 'server' },
    file: { x: 880, y: 710, t: 'FILE SRV', s: '10.10.20.11', k: 'server' },
    msw: { x: 500, y: 850, t: 'MGMT SW', s: 'VLAN 99', k: 'switch' },
    jump: { x: 110, y: 920, t: 'JUMP BOX', s: 'only admin path', k: 'pc', ctl: 'jump', ty: 'P' },
    aaa: { x: 300, y: 920, t: 'AAA', s: 'TACACS+/RADIUS', k: 'server', ctl: 'aaa', ty: 'PD' },
    siem: { x: 700, y: 920, t: 'SYSLOG / SIEM', s: 'logs + alerts', k: 'server', ctl: 'siem', ty: 'DC' },
    ntp: { x: 890, y: 920, t: 'NTP', s: 'time sync', k: 'server' }
  };
  const L = [ // links
    ['inet', 'edge'], ['inet', 'vpn'], ['vpn', 'fw'], ['edge', 'fw'], ['fw', 'waf'], ['waf', 'web'], ['fw', 'core'],
    ['core', 'proxy'], ['core', 'acc'], ['core', 'dist'], ['acc', 'pc1'], ['acc', 'pc2'], ['acc', 'pc3'],
    ['dist', 'db'], ['dist', 'file'], ['core', 'msw'], ['msw', 'jump'], ['msw', 'aaa'], ['msw', 'siem'], ['msw', 'ntp']
  ];
  const SPAN = ['core', 'ids'];

  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

  function draw(ctx, W, H, o) {
    o = o || {};
    const v = o.view || { x: 0, y: 0, w: 1000, h: 1000 }, k = Math.min(W / v.w, H / v.h);
    const show = o.show || null, hi = o.highlight || [], dim = o.dim || 0.18;
    const vis = id => !show || show.includes(id);
    const zvis = id => !o.zones || o.zones.includes(id);
    ctx.save(); ctx.fillStyle = o.bg || '#05080e'; ctx.fillRect(0, 0, W, H);
    ctx.translate((W - v.w * k) / 2, (H - v.h * k) / 2); ctx.scale(k, k); ctx.translate(-v.x, -v.y);
    // grid
    ctx.strokeStyle = 'rgba(80,110,160,.08)'; ctx.lineWidth = 1;
    for (let g = 0; g <= 1000; g += 40) { ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, 1000); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(1000, g); ctx.stroke(); }
    // zones
    for (const id in Z) {
      const z = Z[id], a = zvis(id) ? 1 : dim;
      ctx.globalAlpha = a; ctx.setLineDash([8, 6]); ctx.strokeStyle = z.c; ctx.lineWidth = 2;
      ctx.fillStyle = z.c + '10'; rr(ctx, z.x, z.y, z.w, z.h, 14); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = z.c; ctx.font = '700 15px "DejaVu Sans Mono", monospace'; ctx.textAlign = 'left'; ctx.fillText(z.label, z.x + 12, z.y + 22);
    }
    ctx.globalAlpha = 1;
    // links
    for (const [a, b] of L) {
      const A = N[a], B = N[b], on = vis(a) && vis(b);
      ctx.globalAlpha = on ? 1 : dim; ctx.strokeStyle = 'rgba(160,190,230,.45)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
    }
    { const A = N[SPAN[0]], B = N[SPAN[1]]; ctx.globalAlpha = vis('ids') ? 1 : dim; ctx.setLineDash([6, 6]); ctx.strokeStyle = '#ff9a5a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#ff9a5a'; ctx.font = '700 13px "DejaVu Sans Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('SPAN / TAP (copy)', (A.x + B.x) / 2, A.y - 34); }
    ctx.globalAlpha = 1;
    // extra overlays (packets etc.) drawn by caller under nodes
    if (o.under) o.under(ctx);
    // nodes
    for (const id in N) {
      const n = N[id], on = vis(id), h = hi.includes(id);
      ctx.globalAlpha = on ? 1 : dim;
      const w = 128, hh = 54;
      if (h) { ctx.shadowColor = o.hiColor || '#00d0ff'; ctx.shadowBlur = 28; }
      ctx.fillStyle = h ? '#0d1a2e' : '#0a101c'; ctx.strokeStyle = h ? (o.hiColor || '#00d0ff') : 'rgba(140,170,210,.6)'; ctx.lineWidth = h ? 3.5 : 2;
      if (n.k === 'cloud') { ctx.beginPath(); ctx.ellipse(n.x, n.y, 95, 40, 0, 0, 6.283); ctx.fill(); ctx.stroke(); }
      else { rr(ctx, n.x - w / 2, n.y - hh / 2, w, hh, 9); ctx.fill(); ctx.stroke(); }
      ctx.shadowBlur = 0;
      ctx.textAlign = 'center'; ctx.fillStyle = '#eef3fb'; ctx.font = '700 15px "DejaVu Sans", sans-serif'; ctx.fillText(n.t, n.x, n.y - 2);
      ctx.fillStyle = '#8a9bb2'; ctx.font = '12.5px "DejaVu Sans Mono", monospace'; ctx.fillText(n.s, n.x, n.y + 16);
      if (o.types && n.ty && on) {
        const C = { P: '#3ddc84', D: '#ff9a5a', C: '#b18cff' }; let bx = n.x + w / 2 - 4;
        [...n.ty].reverse().forEach(t => { ctx.fillStyle = C[t]; ctx.beginPath(); ctx.arc(bx, n.y - hh / 2, 13, 0, 6.283); ctx.fill();
          ctx.strokeStyle = '#05080e'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.fillStyle = '#05080e'; ctx.font = '800 14px "DejaVu Sans", sans-serif'; ctx.fillText(t, bx, n.y - hh / 2 + 5); bx -= 24; });
      }
      if (o.badges && o.badges[id]) { const b = o.badges[id]; ctx.font = '700 15px "DejaVu Sans Mono", monospace'; const bw = ctx.measureText(b.t).width + 16;
        ctx.fillStyle = b.c; rr(ctx, n.x - bw / 2, n.y + hh / 2 + 6, bw, 26, 5); ctx.fill(); ctx.fillStyle = '#05080e'; ctx.fillText(b.t, n.x, n.y + hh / 2 + 24); }
    }
    ctx.globalAlpha = 1;
    if (o.over) o.over(ctx);
    ctx.restore();
  }
  G.TOPO = { Z, N, L, SPAN, draw };
})(typeof window !== 'undefined' ? window : globalThis);
