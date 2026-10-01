/* builds the design-tool frame (sidebar + canvas) used by card and short renders */
const ACCENTS = { 'holdings': '#ff6b8a', 'slime-path': '#3ee0c0', 'baseline': '#00d0ff', 'containment': '#ff9a5a', 'packet-walk': '#ffc93c' };
function buildFrame(host, id, seed, w, h, canvasSize, sideOverride) {
  const C = SN.pieces.find(P => P.meta.id === id), m = C.meta, p = {};
  for (const k in m.params) p[k] = m.params[k].value;
  document.documentElement.style.setProperty('--accent', ACCENTS[id]);
  const side = sideOverride || (w - canvasSize - 3);
  host.innerHTML = `<div class="frame" style="width:${w}px;height:${h}px;--side:${side}px">
   <div class="side"><h4>${m.no} · ${m.title.toUpperCase()}</h4><div class="concept">${m.concept}</div><div class="blurb">${m.blurb}</div>
   <div class="params">${Object.entries(m.params).map(([k, d]) => `<div class="param"><div class="kv"><span>${d.label}</span><span>${p[k]}</span></div><div class="bar"><i style="width:${100 * (p[k] - d.min) / (d.max - d.min)}%"></i></div></div>`).join('')}</div>
   <div class="ro"></div>
   <div class="tags">${m.tags.map(t => `<span>${t}</span>`).join('')}</div>
   <div class="btns"><span>SEED</span><span class="f">REGEN</span><span>PNG</span></div></div>
   <div class="stage"><canvas width="${canvasSize}" height="${canvasSize}"></canvas><div class="phase"></div><div class="seed">seed ${String(seed).padStart(4, '0')}</div></div></div>`;
  const cv = host.querySelector('canvas'), piece = new C(cv, p); piece.reset(seed);
  const ro = host.querySelector('.ro'), ph = host.querySelector('.phase');
  return { C, piece, p, refresh() { ro.innerHTML = piece.readouts().map(([a, b]) => `<div class="kv"><span>${a}</span><span>${b}</span></div>`).join(''); ph.textContent = piece.phase(); } };
}
