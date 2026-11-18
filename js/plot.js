/* Peep & Post — shot plotting on target pictures.
   Shots are stored in MOA relative to the middle of the scoring circles (x right, y up). */
window.PP = window.PP || {};
(function () {
  const $ = id => document.getElementById(id);
  const MM = 25.4;
  // Charging-man outline in unit coords (u across 0–1, v down 0–1). Approximate, for orientation only.
  const MAN = [[.43,.015],[.57,.015],[.62,.05],[.62,.1],[.58,.15],[.55,.165],[.78,.2],[.9,.27],[.93,.48],[.82,.5],[.78,.56],[.82,.98],[.6,.98],[.5,.72],[.4,.98],[.18,.98],[.22,.56],[.18,.5],[.07,.48],[.1,.27],[.22,.2],[.45,.165],[.42,.15],[.38,.1],[.38,.05]];

  let st = null; // {R, unit, unitPer, face, pts, zoom, onApply}

  function nearestFace(R) { const keys = Object.keys(PP.RB_FACES).map(Number); return keys.reduce((a, b) => Math.abs(b - R) < Math.abs(a - R) ? b : a, keys[0]); }
  function faceList(R) {
    const k = nearestFace(R);
    return [['rb', 'NRA TR round bull (' + (k === 1000 ? 'long range' : k + ' yd') + ' face)'], ['f11', 'Figure 11'], ['f12', 'Figure 12'], ['f12c', 'Figure 12C'], ['grid', 'Plain grid (1 MOA squares)']];
  }
  function figDims(key) { // allow the user's own target sizes from the Home tab
    const F = Object.assign({}, PP.FIGS[key]); const L = (PP.state && PP.state.lolli) || {};
    if (key === 'f11') { F.h = +L.f11h || F.h; F.c = +L.f11c || F.c; }
    if (key === 'f12') { F.h = +L.f12h || F.h; F.c = +L.f12c || F.c; }
    if (key === 'f12c') { F.h = +L.f12ch || F.h; F.c = +L.f12cc || F.c; }
    return F;
  }
  /* Returns SVG markup for the face and its half-extent, all in MOA at range R. */
  function drawFace(face, R) {
    const k = 1 / PP.ipm(R) / MM; // mm -> MOA
    let g = '', ext = 12;
    if (face === 'rb') {
      const F = PP.RB_FACES[nearestFace(R)], am = F.am * k / 2;
      const rings = [F.outer, F.magpie, F.inner, F.bull, F.v];
      g += '<circle r="' + (F.outer * k / 2) + '" fill="#fbf7ea" stroke="#222" stroke-width="' + (F.outer * k / 400) + '"/>';
      g += '<circle r="' + am + '" fill="#1d1d1b"/>';
      rings.forEach(d => { const rr = d * k / 2; g += '<circle r="' + rr + '" fill="none" stroke="' + (rr < am - 1e-6 ? '#e9e4d4' : '#222') + '" stroke-width="' + (F.outer * k / 500) + '"/>'; });
      ext = F.outer * k / 2 * 1.06;
    } else if (face === 'grid') {
      ext = 12;
    } else {
      const F = figDims(face), W = F.w * k, H = F.h * k, top = F.c * k, bot = -(F.h - F.c) * k;
      const Hfull = (F.full ? F.h : F.h * 2) * k;
      const pts = MAN.map(([u, v]) => ((u - 0.5) * W).toFixed(3) + ',' + (-(top - v * Hfull)).toFixed(3)).join(' ');
      g += '<clipPath id="figclip"><rect x="' + (-W / 2) + '" y="' + (-top) + '" width="' + W + '" height="' + (top - bot) + '"/></clipPath>';
      g += '<rect x="' + (-W / 2) + '" y="' + (-top) + '" width="' + W + '" height="' + (top - bot) + '" fill="#d8c69a" stroke="#8a7a52" stroke-width="' + (W / 300) + '"/>';
      g += '<polygon clip-path="url(#figclip)" points="' + pts + '" fill="#1d1d1b"/>';
      if (F.inner) g += '<circle r="' + (F.inner * k / 2) + '" fill="none" stroke="#3b6fc4" stroke-width="' + (W / 160) + '"/>';
      g += '<circle r="' + (F.bull * k / 2) + '" fill="none" stroke="#3b6fc4" stroke-width="' + (W / 160) + '"/>';
      ext = Math.max(W / 2, top, -bot) * 1.06;
    }
    return { g, ext };
  }
  function grid(ext) {
    let g = ''; const step = ext > 60 ? 10 : ext > 25 ? 5 : 1, w = ext / 400;
    for (let v = -Math.ceil(ext / step) * step; v <= ext; v += step) {
      const major = Math.round(v) % (step * 5) === 0;
      g += '<line x1="' + v + '" y1="' + (-ext) + '" x2="' + v + '" y2="' + ext + '" stroke="var(--line)" stroke-width="' + (major ? w * 2 : w) + '"/>';
      g += '<line y1="' + v + '" x1="' + (-ext) + '" y2="' + v + '" x2="' + ext + '" stroke="var(--line)" stroke-width="' + (major ? w * 2 : w) + '"/>';
    }
    return g;
  }
  function stats(pts) {
    if (!pts.length) return null;
    const n = pts.length, cx = pts.reduce((s, p) => s + p[0], 0) / n, cy = pts.reduce((s, p) => s + p[1], 0) / n;
    let es = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) es = Math.max(es, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
    const mr = pts.reduce((s, p) => s + Math.hypot(p[0] - cx, p[1] - cy), 0) / n;
    return { n, cx, cy, es, mr };
  }
  PP.groupStats = stats;

  function render() {
    const svg = $('plotSvg'), f = drawFace(st.face, st.R);
    let ext = f.ext; st.pts.forEach(p => { ext = Math.max(ext, Math.abs(p[0]) * 1.1, Math.abs(p[1]) * 1.1); });
    if (st.face === 'grid') ext = Math.max(12, ext);
    const s = stats(st.pts), half = ext / st.zoom;
    const cx = st.zoom > 1 && s ? s.cx : 0, cy = st.zoom > 1 && s ? -s.cy : 0;
    svg.setAttribute('viewBox', (cx - half) + ' ' + (cy - half) + ' ' + (2 * half) + ' ' + (2 * half));
    const holeR = Math.max(0.311 / PP.ipm(st.R) / 2, half * 0.018);
    st.holeR = holeR;
    let g = grid(Math.max(ext, half) * 1.2) + f.g;
    g += '<line x1="' + (-half * 0.04) + '" x2="' + (half * 0.04) + '" y1="0" y2="0" stroke="#c9a227" stroke-width="' + (half / 250) + '"/><line y1="' + (-half * 0.04) + '" y2="' + (half * 0.04) + '" x1="0" x2="0" stroke="#c9a227" stroke-width="' + (half / 250) + '"/>';
    st.pts.forEach((p, i) => {
      g += '<circle cx="' + p[0] + '" cy="' + (-p[1]) + '" r="' + holeR + '" fill="#d0452b" stroke="#fff" stroke-width="' + (holeR * 0.25) + '"/>';
      g += '<text x="' + (p[0] + holeR * 1.3) + '" y="' + (-p[1] - holeR * 1.1) + '" style="font-size:' + (holeR * 2.2) + 'px;fill:#d0452b;font-family:IBM Plex Sans,sans-serif">' + (i + 1) + '</text>';
    });
    if (s && s.n > 1) { const c = holeR * 1.8; g += '<g stroke="#2d7d46" stroke-width="' + (holeR * 0.35) + '"><line x1="' + (s.cx - c) + '" x2="' + (s.cx + c) + '" y1="' + (-s.cy) + '" y2="' + (-s.cy) + '"/><line x1="' + s.cx + '" x2="' + s.cx + '" y1="' + (-s.cy - c) + '" y2="' + (-s.cy + c) + '"/></g>'; }
    svg.innerHTML = g;
    const u = st.unitPer, lbl = st.unitLabel, fmt = (v, d = 1) => (v >= 0.05 ? '+' : v <= -0.05 ? '−' : '') + Math.abs(v).toFixed(d);
    $('plotStats').innerHTML = s ? '<div>Shots <b>' + s.n + '</b></div><div>Up/down <b>' + fmt(s.cy * u, 2) + '</b> ' + lbl + ' <span class="hint">' + (Math.abs(s.cy * u) < 0.005 ? '' : s.cy > 0 ? 'high' : 'low') + '</span></div><div>Right/left <b>' + fmt(s.cx * u, 2) + '</b> ' + lbl + ' <span class="hint">' + (Math.abs(s.cx * u) < 0.005 ? '' : s.cx > 0 ? 'right' : 'left') + '</span></div><div>Group <b>' + (s.es * u).toFixed(2) + '</b> ' + lbl + ' <span class="hint">(' + s.es.toFixed(1) + ' MOA)</span></div>' : '<div class="hint">No shots marked yet.</div>';
  }
  function toMOA(e) { const svg = $('plotSvg'), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse()); return [p.x, -p.y]; }
  function onTap(e) {
    e.preventDefault(); const [x, y] = toMOA(e);
    st.pts.push([+x.toFixed(3), +y.toFixed(3)]);
    render();
  }
  function close() { $('plotModal').hidden = true; document.body.style.overflow = ''; st = null; }
  let wired = false;
  function wire() {
    if (wired) return; wired = true;
    $('plotSvg').addEventListener('pointerdown', e => { if (st) onTap(e); });
    $('plotUndo').addEventListener('click', () => { if (st) { st.pts.pop(); render(); } });
    $('plotClear').addEventListener('click', () => { if (st) { st.pts = []; render(); } });
    $('plotZoomIn').addEventListener('click', () => { if (st) { st.zoom = Math.min(16, st.zoom * 2); render(); } });
    $('plotZoomOut').addEventListener('click', () => { if (st) { st.zoom = Math.max(1, st.zoom / 2); render(); } });
    $('plotFace').addEventListener('change', e => { if (st) { st.face = e.target.value; st.zoom = 1; render(); } });
    $('plotCancel').addEventListener('click', close);
    $('plotApply').addEventListener('click', () => { if (!st) return; const cb = st.onApply, pts = st.pts.slice(), face = st.face; close(); cb(pts, face, stats(pts)); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && st) close(); });
  }
  /* opts: {R, unitPer, unitLabel, face, pts, onApply(pts, face, stats)} */
  PP.openPlot = function (opts) {
    wire();
    st = { R: opts.R, unitPer: opts.unitPer, unitLabel: opts.unitLabel, face: opts.face || 'rb', pts: (opts.pts || []).map(p => p.slice()), zoom: 1, onApply: opts.onApply };
    $('plotFace').innerHTML = faceList(st.R).map(([v, l]) => '<option value="' + v + '">' + l + '</option>').join('');
    $('plotFace').value = st.face; $('plotRange').value = st.R;
    $('plotModal').hidden = false; document.body.style.overflow = 'hidden';
    render();
  };
})();
