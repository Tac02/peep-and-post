/* Peep & Post — app: rifle profiles, firings, calibration, settings tables, saving. */
(function () {
  'use strict';
  const { traj, lerpArr, angleAt, ipm, MOA, YD, num } = PP;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const clone = o => JSON.parse(JSON.stringify(o));
  const KEY = 'peep-and-post-v2', OLDKEY = 'no4-sight-book-local';

  /* ---------------- state ---------------- */
  const DEFAULTS = {
    v: 2, active: 'home', panel: 'setup',
    atm: { T: 15, P: 1013 },
    lolli: { f11h: 1140, f11c: 506, f12h: 570, f12c: 300, f12ch: 400, f12cc: 200, rb: 'nra' },
    ammo: [], rifles: [], savedAt: null
  };
  const model = id => PP.RIFLES.find(m => m.id === id) || PP.RIFLES[PP.RIFLES.length - 1];
  const sightDef = R => PP.SIGHTS[R && R.sight] || PP.SIGHTS.custom;
  function defaultClickCount(sightId, refLoad, h) {
    const sd = PP.SIGHTS[sightId]; if (!sd || sd.kind !== 'clicks') return 56;
    if (sd.clickCount) return sd.clickCount;
    const tr = traj(refLoad, { T: 15, P: 1013.25 });
    return Math.max(10, Math.round((angleAt(tr, sd.clickTop, h) - angleAt(tr, 200, h)) / (sd.clickMOA || 1)));
  }
  function newRifle(modelId, sightId, name, ammoId) {
    const M = model(modelId), sid = M.sights.includes(sightId) ? sightId : M.sights[0], sd = PP.SIGHTS[sid];
    const ref = clone(PP.REF[M.ref] || PP.REF.mk7); delete ref.name;
    return {
      id: uid(), name: name || M.name, model: M.id, sight: sid,
      clickCount: defaultClickCount(sid, ref, M.height), clicksBelow: sd.clicksBelow ?? 4, notchStep: sd.step || 100, grads: '200-1300/100',
      battle: sd.battle != null, battleRange: sd.battle || 300,
      sightHeight: M.height, sightRadius: M.radius, blade: null, bladeStep: M.bladeStep, zeroRange: 300, notes: '',
      ammoId: ammoId || 'p:mk7', ref, fit: { slope: 'auto' }, table: { from: 100, to: 1000, step: 100 },
      trj: { a: 'current', b: '', set: '300', clk: 0, max: 1000 }, firings: []
    };
  }
  function mergeDefaults(o) {
    const s = clone(DEFAULTS);
    if (o && typeof o === 'object') for (const k in o) { if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) Object.assign(s[k], o[k]); else s[k] = o[k]; }
    if (!Array.isArray(s.rifles)) s.rifles = []; if (!Array.isArray(s.ammo)) s.ammo = [];
    s.rifles = s.rifles.map(R => { const base = newRifle(R.model, R.sight, R.name, R.ammoId); const out = Object.assign(base, R); ['ref', 'fit', 'table', 'trj'].forEach(k => out[k] = Object.assign(base[k] || {}, R[k] || {})); out.firings = (R.firings || []).map(f => Object.assign({ id: uid(), inc: true, unit: 'in', aim: 'poi', tgt: 'f11' }, f)); return out; });
    return s;
  }
  /* Older single-rifle No4 Sight Book data -> one rifle profile (+ a custom load if needed). */
  function fromV1(o) {
    const map = { mk1: 'no4_mk1', mk2: 'no4_mk2', mk3: 'no4_mk3', mk4: 'no4_mk4', custom: 'custom' };
    const r1 = o.rifle || {}, a1 = o.ammo || {}, out = { custom: null };
    const preset = PP.AMMO.find(p => p.name === a1.name && +p.bc === +a1.bc && +p.mv === +a1.mv && +p.weight === +a1.weight)
      || PP.AMMO.find(p => +p.bc === +a1.bc && +p.mv === +a1.mv && +p.weight === +a1.weight);
    let ammoId = preset ? 'p:' + preset.id : null;
    if (!preset && a1.mv) { out.custom = { id: uid(), name: a1.name || 'Imported load', calibre: '.303 British', weight: a1.weight, bc: a1.bc, mv: a1.mv, chrono: !!a1.chrono, notes: 'Imported from the No4 Sight Book' }; ammoId = 'c:' + out.custom.id; }
    const R = newRifle('no4mk1', map[r1.sightType] || 'no4_mk1', r1.name || 'No4', ammoId || 'p:mk7');
    ['clickCount', 'clicksBelow', 'notchStep', 'grads', 'battle', 'battleRange', 'sightHeight', 'sightRadius', 'blade', 'bladeStep', 'zeroRange', 'notes'].forEach(k => { if (r1[k] !== undefined) R[k] = r1[k]; });
    if (o.ref) Object.assign(R.ref, o.ref); if (o.fit) Object.assign(R.fit, o.fit); if (o.table) Object.assign(R.table, o.table);
    if (o.trj) { Object.assign(R.trj, o.trj); ['a', 'b'].forEach(k => { const v = R.trj[k]; if (v && v !== 'current' && !/^[pc]:/.test(v)) R.trj[k] = 'p:' + v; }); }
    R.firings = (o.firings || []).map(f => Object.assign({ id: uid(), inc: true, unit: 'in', aim: 'poi', tgt: 'f11' }, f));
    out.rifle = R; out.lolli = o.lolli; out.atm = o.atm;
    return out;
  }

  let S;
  function load() {
    let raw = null; try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { }
    if (raw && raw.v === 2) return mergeDefaults(raw);
    const s = mergeDefaults(null);
    try { const old = JSON.parse(localStorage.getItem(OLDKEY) || 'null'); if (old && old.rifle) { const m = fromV1(old); s.rifles.push(m.rifle); if (m.custom) s.ammo.push(m.custom); if (m.lolli) Object.assign(s.lolli, m.lolli); if (m.atm) Object.assign(s.atm, m.atm); s.active = m.rifle.id; } } catch (e) { }
    if (s.lolli && +s.lolli.f12h === 546) s.lolli.f12h = 570;
    return s;
  }
  S = load(); PP.state = S;
  const cur = () => S.rifles.find(r => r.id === S.active) || null;

  let saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try { S.savedAt = new Date().toISOString(); localStorage.setItem(KEY, JSON.stringify(S)); status(); }
      catch (e) { $('status').textContent = 'Couldn’t save on this device. Download a backup.'; }
    }, 400);
  }
  function status() { $('status').textContent = S.savedAt ? 'Saved on this device ' + new Date(S.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Saves on this device'; }
  function changed(opts) { save(); if (!opts || !opts.noRecompute) recompute(); }

  /* ---------------- ammunition ---------------- */
  function getAmmo(id) {
    if (id && id.startsWith('c:')) { const a = S.ammo.find(x => x.id === id.slice(2)); if (a) return Object.assign({ custom: true, note: a.notes || '' }, a); }
    const p = PP.AMMO.find(x => 'p:' + x.id === id) || PP.AMMO[0]; return Object.assign({ custom: false }, p);
  }
  function ammoOptions(withCurrent, withNone) {
    let h = '';
    if (withNone) h += '<option value="">None</option>';
    if (withCurrent) h += '<option value="current">This rifle’s load</option>';
    if (S.ammo.length) h += '<optgroup label="Your loads">' + S.ammo.map(a => '<option value="c:' + a.id + '">' + esc(a.name || 'Unnamed load') + '</option>').join('') + '</optgroup>';
    h += '<optgroup label="Factory loads">' + PP.AMMO.map(a => '<option value="p:' + a.id + '">' + esc(a.name) + '</option>').join('') + '</optgroup>';
    return h;
  }
  function fillAmmoSelects() {
    document.querySelectorAll('.ammoSelect').forEach(sel => { const v = sel.dataset.k ? getP(sel.dataset.k) : sel.value; sel.innerHTML = ammoOptions(!!sel.dataset.current, !!sel.dataset.none); sel.value = v ?? ''; if (sel.value !== (v ?? '') && !sel.dataset.k) sel.value = 'p:mk7'; });
  }

  /* ---------------- sight helpers ---------------- */
  function parseGrads(s) { const out = []; String(s || '').split(/[,;\s]+/).forEach(tok => { if (!tok) return; const m = tok.match(/^(\d+)-(\d+)(?:\/(\d+))?$/); if (m) { let a = +m[1], b = +m[2], st = +(m[3] || 100); if (st <= 0) st = 100; for (let x = a; x <= b + 1e-9 && out.length < 500; x += st) out.push(x); } else if (isFinite(+tok) && tok !== '') out.push(+tok); }); return [...new Set(out)].filter(x => x >= 100 && x <= 2500).sort((a, b) => a - b); }
  function gradsOf(R) { const sd = sightDef(R); if (sd.kind === 'fixed') return sd.grads.slice(); if (sd.kind === 'steps') return PP.rng(sd.min, sd.max, Math.max(25, num(R.notchStep) || sd.step)); if (sd.kind === 'custom') return parseGrads(R.grads); return []; }
  const isClicks = R => sightDef(R).kind === 'clicks';
  const hasBattle = R => sightDef(R).battle != null && !!R.battle;
  function parseSetting(v) { const t = String(v ?? '').trim().toUpperCase().replace(/\s+/g, '').replace('−', '-'); if (!t) return null; if (t === 'B' || t === 'BATTLE') return { battle: true }; const m = t.match(/^(\d+(?:\.\d+)?)(?:([+-])(\d+(?:\.\d+)?)(?:C|CL|CLICKS?)?)?$/); if (!m) return null; return { mark: +m[1], clicks: m[2] ? (m[2] === '-' ? -1 : 1) * +m[3] : 0 }; }
  const unitIn = (u, R) => u === 'moa' ? 1 : u === 'zr' ? ipm(PP.ZRYD) : ipm(R);
  const unitLbl = u => u === 'moa' ? 'MOA' : u === 'zr' ? 'in (card)' : 'in';
  function lolliTargets() {
    const L = S.lolli, mm = v => (num(v) ?? 0) / 25.4;
    const fig = (key, name, h, c) => ({ key, name, hold: mm(h) - mm(c), holdAt() { const x = mm(h) - mm(c); return x > 0 ? x : null; } });
    const rb = PP.RB[L.rb] || PP.RB.nra;
    return [fig('f11', 'Figure 11', L.f11h, L.f11c), fig('f12', 'Figure 12', L.f12h, L.f12c), fig('f12c', 'Figure 12C', L.f12ch, L.f12cc),
      { key: 'rb', name: rb.name, holdAt(R) { const am = rb.am[R]; return am ? am / 25.4 / 2 : null; }, rb: true }];
  }

  /* ---------------- computation ---------------- */
  function compute(R) {
    const h = num(R.sightHeight) ?? 1, sd = sightDef(R), T = sd.kind;
    const ammo = getAmmo(R.ammoId);
    const ref = traj(R.ref, { T: 15, P: 1013.25 }), usr = traj(ammo, S.atm);
    const nomArr = new Float64Array(2501); for (let s = 1; s <= 2500; s++) nomArr[s] = angleAt(ref, s, h);
    const nomAt = s => (s >= 1 && s <= 2500) ? lerpArr(nomArr, s) : NaN;
    const need = Rr => angleAt(usr, Rr, h);
    const invNom = t => { if (!(t >= nomArr[100])) { const sl = (nomArr[150] - nomArr[100]) / 50; const x = 100 + (t - nomArr[100]) / sl; return (isFinite(x) && x >= 50) ? x : -1; } if (t > nomArr[2500] || isNaN(nomArr[2500])) return Infinity; let lo = 100, hi = 2500; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (nomArr[m] < t) lo = m; else hi = m; } return lo + (t - nomArr[lo]) / (nomArr[hi] - nomArr[lo]); };
    const top = sd.clickTop || 1000;
    const U = T === 'clicks' ? (nomAt(top) - nomAt(200)) / Math.max(10, num(R.clickCount) || 56) : 0;
    const holds = lolliTargets(), skipped = {}, pts = [], bpts = [];
    R.firings.forEach(f => {
      const Rr = num(f.range), dy = num(f.dy); if (!f.inc || !Rr || dy === null) return;
      let nd = need(Rr); if (isNaN(nd)) return;
      let holdM = 0; if (f.aim === 'lolli') { const t = holds.find(x => x.key === (f.tgt || 'f11')); const hh = t && t.holdAt(Rr); if (!hh) { skipped[f.id] = 'No ' + (t ? t.name : 'target') + ' face for ' + Rr + ' yd'; return; } holdM = hh / ipm(Rr); }
      const need0 = nd; nd = need0 + holdM;
      const uf = unitIn(f.unit, Rr), dyM = dy / uf, w = Math.max(0.1, num(f.shots) || 1), act = nd + dyM, ps = parseSetting(f.setting); if (!ps) return;
      if (ps.battle) { bpts.push({ f, R: Rr, w, need: nd, need0, holdM, act, dyM, uf }); return; }
      const clk = T === 'clicks' ? ps.clicks + (num(f.clk) || 0) : 0;
      const x0 = nomAt(ps.mark); if (isNaN(x0)) return; const x = x0 + clk * U;
      pts.push({ f, R: Rr, w, need: nd, need0, holdM, act, x, s: ps.mark, dyM, uf });
    });
    let a = 0, b = 1, mode = 'none', note = '';
    const used = [...new Set(pts.map(p => p.s))], span = used.length ? Math.max(...used) - Math.min(...used) : 0;
    if (pts.length) {
      if (R.fit.slope !== 'fixed' && used.length >= 2 && span >= 200) {
        let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0; pts.forEach(p => { sw += p.w; sx += p.w * p.x; sy += p.w * p.act; sxx += p.w * p.x * p.x; sxy += p.w * p.x * p.act; });
        const d = sw * sxx - sx * sx, bb = d ? (sw * sxy - sx * sy) / d : 1;
        if (bb > 0.6 && bb < 1.6) { b = bb; a = (sy - b * sx) / sw; mode = 'scale'; }
        else note = 'The scale fit came out implausible (' + bb.toFixed(2) + '), so only an offset was fitted. Check for typos or a bad group.';
      }
      if (mode !== 'scale') { let sw = 0, s = 0; pts.forEach(p => { sw += p.w; s += p.w * (p.act - p.x); }); a = s / sw; b = 1; mode = 'offset'; }
    }
    const bR = num(R.battleRange) || 300; let battleAngle, battleFrom;
    if (bpts.length) { let sw = 0, s = 0; bpts.forEach(p => { sw += p.w; s += p.w * p.act; }); battleAngle = s / sw; battleFrom = 'measured'; if (!pts.length) { a = battleAngle - nomAt(bR); b = 1; mode = 'battle'; } }
    else { battleAngle = a + b * nomAt(bR); battleFrom = 'assumed'; }
    let rw = 0, rs = 0;
    pts.forEach(p => { const pm = a + b * p.x - p.need, rm = p.dyM - pm; p.pred = pm * p.uf; p.res = rm * p.uf; rw += p.w; rs += p.w * rm * rm; });
    bpts.forEach(p => { const pm = battleAngle - p.need, rm = p.dyM - pm; p.pred = pm * p.uf; p.res = rm * p.uf; if (bpts.length > 1 || pts.length) { rw += p.w; rs += p.w * rm * rm; } });
    const rms = rw ? Math.sqrt(rs / rw) : null;
    // setting chooser
    const grads = gradsOf(R), marks = sd.marks || [], below = Math.max(0, num(R.clicksBelow) ?? 4), c200 = nomAt(200), maxClicks = U ? Math.round((nomAt(marks[marks.length - 1] || top) - c200) / U) : 0;
    const choose = (want, nd, Rr) => {
      let best = null;
      if (T === 'clicks') {
        const xs = (want - a) / b;
        marks.forEach(m => { let n = Math.round((xs - nomAt(m)) / U); let tot = Math.round((nomAt(m) - c200) / U) + n; if (tot < -below) { n += (-below - tot); tot = -below; } if (tot > maxClicks) { n -= (tot - maxClicks); tot = maxClicks; } const x = nomAt(m) + n * U, err = Math.abs(xs - x); if (!best || Math.abs(n) < Math.abs(best.n) || (Math.abs(n) === Math.abs(best.n) && err < best.err)) best = { err, n, m, tot, poi: (a + b * x - nd) * ipm(Rr), off: (a + b * x - want) * ipm(Rr) }; });
        if (best) best.label = best.m + (best.n ? (best.n > 0 ? ' +' : ' −') + Math.abs(best.n) + (Math.abs(best.n) === 1 ? ' click' : ' clicks') : '');
      } else grads.forEach(g => { const x = a + b * nomAt(g), off = (x - want) * ipm(Rr); if (!best || Math.abs(off) < Math.abs(best.off)) best = { g, poi: (x - nd) * ipm(Rr), off, label: String(g) }; });
      return best;
    };
    let from = Math.max(50, num(R.table.from) || 100), to = Math.min(2500, num(R.table.to) || 1000), step = Math.max(10, num(R.table.step) || 100); if (to < from) to = from;
    const rows = [];
    for (let Rr = from; Rr <= to + 1e-9 && rows.length < 200; Rr += step) {
      const nd = need(Rr); if (isNaN(nd)) continue;
      const exact = invNom((nd - a) / b), best = choose(nd, nd, Rr);
      const tof = lerpArr(usr.t, Rr), vel = lerpArr(usr.v, Rr), drift = 4.4704 * (tof - Rr * YD / usr.v0) / 0.0254;
      const lolli = holds.map(t => { const hh = t.holdAt(Rr); if (hh === null) return null; const c = choose(nd + hh / ipm(Rr), nd, Rr); return c ? { hold: hh, c } : null; });
      rows.push({ R: Rr, need: nd, exact, best, lolli, battle: hasBattle(R) ? (battleAngle - nd) * ipm(Rr) : null, drift, vel: vel / 0.3048, tof, trans: vel < usr.c * 1.12 });
    }
    const Z = num(R.zeroRange) || 300; let fs = null;
    if (pts.length || bpts.length) { const nz = need(Z), useB = !pts.length, giv = useB ? battleAngle : a + b * nomAt(Z); if (!isNaN(nz) && !isNaN(giv)) { const E = giv - nz, rad = num(R.sightRadius) || 28, dh = E / MOA * rad, stp = num(R.bladeStep) || 0.015; fs = { Z, E, poi: E * ipm(Z), dh, steps: Math.round(dh / stp), st: stp, useB }; } }
    const implied = pts.map(p => ({ R: p.R, s: invNom(p.x + (p.need0 - (p.act - p.holdM)) / b) })).filter(p => isFinite(p.s) && p.s > 0);
    const grp = R.firings.filter(f => f.inc && num(f.group) && num(f.range)).map(f => num(f.group) / unitIn(f.unit, num(f.range)));
    return { R, ammo, skipped, nomAt, U, a, b, mode, note, pts, bpts, battleAngle, battleFrom, bR, rms, rows, holds, fs, implied, usr, h, grpMOA: grp.length ? grp.reduce((x, y) => x + y, 0) / grp.length : null, nGrp: grp.length, maxR: Math.max(0, ...pts.map(p => p.R), ...bpts.map(p => p.R)) };
  }

  /* ---------------- formatting ---------------- */
  const sgn = (n, d = 1) => n === null || n === undefined || isNaN(n) ? '–' : (n >= 0.05 || n <= -0.05 ? (n > 0 ? '+' : '−') : '') + Math.abs(n).toFixed(d);
  const hiLo = n => n >= 0.05 ? 'high' : n <= -0.05 ? 'low' : '';
  const lab = t => esc(t).replace(/ (clicks?)$/, '<span class="clw"> $1</span>');
  const fmtExact = x => x === -1 ? 'below 100' : x === Infinity ? 'off scale' : String(Math.round(x / 5) * 5);

  /* ---------------- binding ---------------- */
  function getP(p) { const ks = p.split('.'); let o = S; if (ks[0] === 'R') { o = cur(); ks.shift(); } for (const k of ks) { if (o == null) return undefined; o = o[k]; } return o; }
  function setP(p, v) { const ks = p.split('.'); let o = S; if (ks[0] === 'R') { o = cur(); ks.shift(); } if (!o) return; for (let i = 0; i < ks.length - 1; i++) { if (typeof o[ks[i]] !== 'object' || !o[ks[i]]) o[ks[i]] = {}; o = o[ks[i]]; } o[ks[ks.length - 1]] = v; }
  function fill() {
    fillAmmoSelects();
    const R = cur();
    if (R) {
      $('modelSel').innerHTML = PP.RIFLES.map(m => '<option value="' + m.id + '">' + esc(m.name) + '</option>').join('');
      $('sightSel').innerHTML = model(R.model).sights.map(id => '<option value="' + id + '">' + esc(PP.SIGHTS[id].name) + '</option>').join('');
    }
    document.querySelectorAll('[data-k]').forEach(el => { if (el.dataset.k.startsWith('R.') && !R) return; const v = getP(el.dataset.k); if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? ''; });
    if (R) syncSight();
  }
  function syncSight() {
    const R = cur(); if (!R) return; const sd = sightDef(R), M = model(R.model);
    const show = (cls, on) => document.querySelectorAll('.' + cls).forEach(e => e.style.display = on ? '' : 'none');
    show('opt-clicks', sd.kind === 'clicks'); show('opt-steps', sd.kind === 'steps'); show('opt-custom', sd.kind === 'custom'); show('opt-battle', sd.battle != null);
    $('lblClickCount').firstChild.textContent = 'Clicks from 200 to ' + (sd.clickTop || 1000) + ' mark';
    $('sightHint').textContent = sd.hint;
    $('rifleHint').innerHTML = 'Foresight blades: ' + esc(M.blades) + '. Sight radius default ' + M.radius + ' in' + (M.id === 'other303' ? '' : ' (REME zeroing précis)') + '. Sight height is approximate; measure yours. It matters most for short-range and Zero Range firings.' + (M.lowConfidence || sd.lowConfidence ? ' <span class="pill warnpill">Check these figures against your rifle</span>' : '');
    const A = getAmmo(R.ammoId);
    $('ammoInfo').innerHTML = '<div>Bullet</div><div>' + esc(A.weight) + ' gr</div><div>BC (G1)</div><div>' + esc(A.bc) + '</div><div>Muzzle velocity</div><div>' + esc(A.mv) + ' fps' + (A.chrono ? ' (chronographed)' : '') + '</div>';
    $('ammoNote').textContent = A.note || '';
    const rp = $('refPreset'); rp.innerHTML = '<option value="">Custom…</option>' + Object.entries(PP.REF).map(([k, v]) => '<option value="' + k + '">' + esc(v.name) + '</option>').join('');
    const m = Object.entries(PP.REF).find(([k, v]) => +v.bc === +R.ref.bc && +v.mv === +R.ref.mv && +v.weight === +R.ref.weight); rp.value = m ? m[0] : '';
  }
  document.addEventListener('input', onBound); document.addEventListener('change', onBound);
  function onBound(e) {
    const el = e.target; if (!el.dataset || !el.dataset.k) return;
    if (el.tagName === 'SELECT' && e.type === 'input') return;
    if (el.type === 'checkbox' && e.type === 'input') return;
    if (el.tagName !== 'SELECT' && el.type !== 'checkbox' && e.type === 'change') return;
    const v = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? num(el.value) : el.value);
    const k = el.dataset.k, R = cur(); setP(k, v);
    if (k === 'R.model' && R) { const M = model(v); if (!M.sights.includes(R.sight)) R.sight = M.sights[0]; R.sightRadius = M.radius; R.bladeStep = M.bladeStep; const ref = clone(PP.REF[M.ref] || PP.REF.mk7); delete ref.name; R.ref = ref; onSightChange(R); fill(); }
    else if (k === 'R.sight' && R) { onSightChange(R); fill(); }
    else if (k === 'R.ammoId' || k.startsWith('R.ref')) syncSight();
    if (k === 'R.name') renderTabs();
    changed();
  }
  function onSightChange(R) { const sd = sightDef(R); R.notchStep = sd.step || R.notchStep || 100; R.battle = sd.battle != null; R.battleRange = sd.battle || 300; if (sd.kind === 'clicks') { R.clickCount = defaultClickCount(R.sight, R.ref, num(R.sightHeight) ?? 1); R.clicksBelow = sd.clicksBelow ?? 4; } }
  $('refPreset').addEventListener('change', e => { const R = cur(), p = PP.REF[e.target.value]; if (!R || !p) return; R.ref = { weight: p.weight, bc: p.bc, mv: p.mv }; fill(); changed(); });

  /* ---------------- views & tabs ---------------- */
  function renderTabs() {
    const t = $('tabs');
    t.innerHTML = '<button class="tab' + (S.active === 'home' ? ' on' : '') + '" data-tab="home">Home</button>' + S.rifles.map(R => '<button class="tab' + (S.active === R.id ? ' on' : '') + '" data-tab="' + R.id + '">' + esc(R.name || 'Rifle') + '</button>').join('') + '<button class="tab add" data-tab="add">+ Rifle</button>';
  }
  $('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; const id = b.dataset.tab; if (id === 'add') { show('home'); $('addRifle').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; } show(id); });
  function show(id) {
    if (id !== 'home' && !S.rifles.some(r => r.id === id)) id = 'home';
    S.active = id; save();
    $('home').hidden = id !== 'home'; $('rifle').hidden = id === 'home';
    renderTabs();
    if (id === 'home') { renderHome(); fill(); }
    else { fill(); renderFirings(); showPanel(S.panel || 'setup'); recompute(); }
    window.scrollTo(0, 0);
  }
  function showPanel(p) { S.panel = p; document.querySelectorAll('#subtabs .subtab').forEach(b => b.classList.toggle('on', b.dataset.p === p)); document.querySelectorAll('#rifle .panel').forEach(el => el.hidden = el.dataset.panel !== p); if (p === 'trj' || p === 'settings') recompute(); save(); }
  $('subtabs').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) showPanel(b.dataset.p); });

  /* ---------------- home ---------------- */
  function renderHome() {
    const c = $('rifleCards');
    c.innerHTML = S.rifles.length ? S.rifles.map(R => { const M = model(R.model), A = getAmmo(R.ammoId), last = R.firings.map(f => f.date).filter(Boolean).sort().pop();
      return '<button class="rcard" data-open="' + R.id + '"><h3>' + esc(R.name) + '</h3><div class="meta">' + esc(M.name) + '<br>' + esc(PP.SIGHTS[R.sight] ? PP.SIGHTS[R.sight].name : '') + '<br>' + esc(A.name) + '<br><span class="pill">' + R.firings.length + ' firing' + (R.firings.length === 1 ? '' : 's') + '</span>' + (last ? '<span class="pill">last ' + esc(last) + '</span>' : '') + '</div></button>'; }).join('')
      : '<div class="empty">No rifles yet. Add your first one below.</div>';
    // add-rifle form
    const nm = $('newModel'); if (!nm.options.length) nm.innerHTML = PP.RIFLES.map(m => '<option value="' + m.id + '">' + esc(m.name) + '</option>').join('');
    syncNew();
    // custom ammo table
    const tb = $('customAmmo').querySelector('tbody');
    tb.innerHTML = S.ammo.length ? S.ammo.map((a, i) => '<tr>' +
      '<td><input data-a="' + i + '" data-f="name" value="' + esc(a.name) + '" placeholder="e.g. 174 gr FMJ over 40 gr…" style="min-width:170px"></td>' +
      '<td><input data-a="' + i + '" data-f="calibre" value="' + esc(a.calibre) + '" style="width:110px"></td>' +
      '<td><input data-a="' + i + '" data-f="weight" type="number" step="1" value="' + esc(a.weight) + '" style="width:70px"></td>' +
      '<td><input data-a="' + i + '" data-f="bc" type="number" step="0.005" value="' + esc(a.bc) + '" style="width:76px"></td>' +
      '<td><input data-a="' + i + '" data-f="mv" type="number" step="5" value="' + esc(a.mv) + '" style="width:80px"></td>' +
      '<td style="text-align:center"><input data-a="' + i + '" data-f="chrono" type="checkbox"' + (a.chrono ? ' checked' : '') + '></td>' +
      '<td><input data-a="' + i + '" data-f="notes" value="' + esc(a.notes) + '" style="min-width:150px"></td>' +
      '<td><button class="x" data-adel="' + i + '" title="Delete this load">×</button></td></tr>').join('') : '<tr><td colspan="8" class="hint">No custom loads yet.</td></tr>';
    $('presetAmmo').querySelector('tbody').innerHTML = PP.AMMO.map(a => '<tr><td>' + esc(a.name) + '</td><td class="num">' + a.weight + ' gr</td><td class="num">' + a.bc + '</td><td class="num">' + a.mv + '</td><td class="hint" style="margin:0">' + esc(a.note) + '</td><td><button class="small" data-acopy="' + a.id + '">Copy to mine</button></td></tr>').join('');
  }
  function syncNew() {
    const M = model($('newModel').value), ns = $('newSight'), keep = ns.value;
    ns.innerHTML = M.sights.map(id => '<option value="' + id + '">' + esc(PP.SIGHTS[id].name) + '</option>').join(''); if (M.sights.includes(keep)) ns.value = keep;
    if (!$('newAmmo').value) $('newAmmo').value = 'p:mk7';
    $('newHint').textContent = PP.SIGHTS[ns.value].hint;
  }
  $('newModel').addEventListener('change', syncNew); $('newSight').addEventListener('change', syncNew);
  $('addRifleBtn').addEventListener('click', () => { const R = newRifle($('newModel').value, $('newSight').value, $('newName').value.trim() || model($('newModel').value).name, $('newAmmo').value || 'p:mk7'); S.rifles.push(R); $('newName').value = ''; S.panel = 'setup'; show(R.id); });
  $('rifleCards').addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) show(b.dataset.open); });
  $('addAmmoBtn').addEventListener('click', () => { const R0 = getAmmo('p:mk7'); S.ammo.push({ id: uid(), name: '', calibre: '.303 British', weight: R0.weight, bc: R0.bc, mv: R0.mv, chrono: false, notes: '' }); renderHome(); fillAmmoSelects(); save(); const ins = $('customAmmo').querySelectorAll('input[data-f="name"]'); if (ins.length) ins[ins.length - 1].focus(); });
  $('customAmmo').addEventListener('input', e => { const el = e.target, i = +el.dataset.a, k = el.dataset.f; if (isNaN(i) || !k || !S.ammo[i]) return; S.ammo[i][k] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? num(el.value) : el.value); if (k === 'name') fillAmmoSelects(); save(); });
  $('customAmmo').addEventListener('change', e => { if (e.target.type === 'checkbox') e.target.dispatchEvent(new Event('input', { bubbles: true })); });
  $('customAmmo').addEventListener('click', e => { const d = e.target.closest('[data-adel]'); if (!d) return; const i = +d.dataset.adel, a = S.ammo[i];
    const users = S.rifles.filter(R => R.ammoId === 'c:' + a.id || R.trj.a === 'c:' + a.id || R.trj.b === 'c:' + a.id);
    if (d.dataset.armed !== '1') { arm(d, users.length ? 'used by ' + users.length + ' rifle' + (users.length > 1 ? 's' : '') + ': delete?' : 'delete?'); return; }
    users.forEach(R => { if (R.ammoId === 'c:' + a.id) R.ammoId = 'p:mk7'; if (R.trj.a === 'c:' + a.id) R.trj.a = 'current'; if (R.trj.b === 'c:' + a.id) R.trj.b = ''; });
    S.ammo.splice(i, 1); renderHome(); fillAmmoSelects(); save(); });
  $('presetAmmo').addEventListener('click', e => { const b = e.target.closest('[data-acopy]'); if (!b) return; const p = PP.AMMO.find(x => x.id === b.dataset.acopy); S.ammo.push({ id: uid(), name: p.name + ' (my lot)', calibre: p.calibre, weight: p.weight, bc: p.bc, mv: p.mv, chrono: false, notes: '' }); renderHome(); fillAmmoSelects(); save(); });
  function arm(btn, text) { const o = btn.innerHTML; btn.dataset.armed = '1'; btn.textContent = text; btn.style.color = 'var(--warn)'; btn.style.fontSize = '12px'; setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.innerHTML = o; btn.style.color = ''; btn.style.fontSize = ''; } }, 3500); }
  $('delRifle').addEventListener('click', e => { const R = cur(); if (!R) return; const b = e.currentTarget; if (b.dataset.armed !== '1') { arm(b, 'Tap again to delete ' + (R.name || 'this rifle') + ' and its ' + R.firings.length + ' firings'); return; } S.rifles = S.rifles.filter(x => x !== R); b.dataset.armed = ''; b.textContent = 'Delete this rifle'; show('home'); });
  $('dupRifle').addEventListener('click', () => { const R = cur(); if (!R) return; const c = clone(R); c.id = uid(); c.name = (R.name || 'Rifle') + ' (copy)'; c.firings = c.firings.map(f => Object.assign(f, { id: uid() })); S.rifles.push(c); show(c.id); });

  /* ---------------- firings ---------------- */
  function renderFirings() {
    const R = cur(), tb = document.querySelector('#firings tbody'); if (!R) return;
    if (!R.firings.length) { tb.innerHTML = '<tr><td colspan="15" class="hint" style="padding:10px 6px">No firings yet. Add your first group.</td></tr>'; return; }
    const clicks = isClicks(R), holds = lolliTargets();
    const inp = (f, i, k, cls, type, step, extra) => '<input class="' + cls + '" type="' + type + '"' + (step ? ' step="' + step + '"' : '') + ' data-i="' + i + '" data-f="' + k + '" value="' + esc(f[k]) + '"' + (extra || '') + '>';
    const pm = (i, k) => { const t = k === 'dx' ? 'Switch between right (+) and left (−)' : k === 'dy' ? 'Switch between up (+) and down (−)' : 'Switch between clicks up (+) and down (−)'; return '<button type="button" class="pm" data-pm="' + k + '" data-i="' + i + '" title="' + t + '" aria-label="' + t + '">±</button>'; };
    const td = (c, l, h) => '<td class="' + c + '" data-label="' + l + '">' + h + '</td>';
    tb.innerHTML = R.firings.map((f, i) => '<tr>' +
      td('c-use', 'Use', '<label class="check" style="font-size:13px"><input type="checkbox" data-i="' + i + '" data-f="inc"' + (f.inc ? ' checked' : '') + '><span class="ph">Use this group</span></label>') +
      td('c-date', 'Date', inp(f, i, 'date', 'w-d', 'date')) +
      td('c-range', 'Range (yd)', inp(f, i, 'range', 'w-s', 'number', '25', ' inputmode="numeric"')) +
      td('c-set', 'Sight set', inp(f, i, 'setting', 'w-s', 'text', '', ' placeholder="300 or B" autocapitalize="characters"')) +
      td('c-clk', 'Clicks ±', clicks ? '<div class="pmw">' + inp(f, i, 'clk', 'w-s', 'number', '1', ' placeholder="0"') + pm(i, 'clk') + '</div>' : '<span class="hint">n/a</span>') +
      td('c-shots', 'Shots', inp(f, i, 'shots', 'w-s', 'number', '1', ' min="1" inputmode="numeric"')) +
      td('c-unit', 'Units', '<select data-i="' + i + '" data-f="unit">' + [['in', 'in'], ['moa', 'MOA'], ['zr', 'ZR card in']].map(o => '<option value="' + o[0] + '"' + ((f.unit || 'in') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>') +
      td('c-aim', 'Aim', '<select data-i="' + i + '" data-f="aim">' + [['poi', 'Point of impact'], ['lolli', 'Lollipop (6 o\'clock)']].map(o => '<option value="' + o[0] + '"' + ((f.aim || 'poi') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>') +
      td('c-tgt', 'Target', '<select data-i="' + i + '" data-id="' + esc(f.id) + '" data-f="tgt"' + (f.aim === 'lolli' ? '' : ' disabled') + '>' + holds.map(t => '<option value="' + t.key + '"' + ((f.tgt || 'f11') === t.key ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('') + '</select>') +
      td('c-dy', 'Up (+) / Down (−)', '<div class="pmw">' + inp(f, i, 'dy', 'w-m', 'number', '0.25', ' placeholder="+ up / − down"') + pm(i, 'dy') + '</div><div class="hint dirh" id="dyh-' + esc(f.id) + '"></div>') +
      td('c-dx', 'Right (+) / Left (−)', '<div class="pmw">' + inp(f, i, 'dx', 'w-m', 'number', '0.25', ' placeholder="+ right / − left"') + pm(i, 'dx') + '</div><div class="hint dirh" id="dxh-' + esc(f.id) + '"></div>') +
      td('c-grp', 'Group size', inp(f, i, 'group', 'w-s', 'number', '0.25', ' min="0"') + '<div class="hint" id="grp-' + esc(f.id) + '" style="margin:2px 0 0;white-space:nowrap"></div><button type="button" class="small plotbtn" data-plot="' + i + '">' + (f.plot && f.plot.pts && f.plot.pts.length ? 'Edit plot (' + f.plot.pts.length + ')' : 'Plot shots') + '</button>') +
      td('c-notes', 'Notes', inp(f, i, 'notes', '', 'text', '', ' placeholder="Light, wind, position…"')) +
      '<td class="num c-res" data-label="Model / residual" id="res-' + esc(f.id) + '">–</td>' +
      '<td class="c-del"><button class="x" data-del="' + i + '" title="Delete this firing">×</button></td></tr>').join('');
  }
  const ftable = $('firings');
  function onFiring(e) { const el = e.target, i = +el.dataset.i, k = el.dataset.f, R = cur(); if (!R || isNaN(i) || !k || !R.firings[i]) return; if ((el.tagName === 'SELECT' || el.type === 'checkbox') && e.type === 'input') return;
    R.firings[i][k] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? num(el.value) : el.value);
    if (k === 'tgt' || k === 'aim') { const t = ftable.querySelector('[data-f="tgt"][data-i="' + i + '"]'); if (t) t.disabled = R.firings[i].aim !== 'lolli'; }
    changed(); }
  ftable.addEventListener('input', onFiring);
  ftable.addEventListener('change', e => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') onFiring(e); });
  ftable.addEventListener('click', e => {
    const R = cur(); if (!R) return;
    const pb = e.target.closest('[data-pm]');
    if (pb) { const i = +pb.dataset.i, k = pb.dataset.pm, v = num(R.firings[i] && R.firings[i][k]); if (v === null || v === 0) { pb.previousElementSibling.focus(); return; } R.firings[i][k] = -v; pb.previousElementSibling.value = -v; changed(); return; }
    const pl = e.target.closest('[data-plot]'); if (pl) { openPlotFor(+pl.dataset.plot); return; }
    const d = e.target.closest('[data-del]'); if (!d) return;
    if (d.dataset.armed !== '1') { arm(d, 'delete?'); return; }
    R.firings.splice(+d.dataset.del, 1); renderFirings(); changed();
  });
  $('addBtn').addEventListener('click', () => {
    const R = cur(); if (!R) return; const last = R.firings[R.firings.length - 1];
    R.firings.push({ id: uid(), inc: true, date: last ? last.date : new Date().toISOString().slice(0, 10), range: last ? last.range : 300, setting: last ? last.setting : '300', clk: null, aim: last ? last.aim || 'poi' : 'poi', tgt: last ? last.tgt || 'f11' : 'f11', shots: last ? last.shots : 5, unit: last ? last.unit || 'in' : 'in', dy: null, dx: null, group: null, notes: '' });
    renderFirings(); changed();
    const rows = document.querySelectorAll('#firings tbody tr'), rr = rows[rows.length - 1], inp = rr && rr.querySelector('[data-f="dy"]');
    if (inp) { if (rr.scrollIntoView) rr.scrollIntoView({ block: 'center' }); inp.focus({ preventScroll: true }); }
  });
  function openPlotFor(i) {
    const R = cur(), f = R.firings[i], Rr = num(f.range) || 100;
    const face = (f.plot && f.plot.face) || (f.aim === 'lolli' && f.tgt && f.tgt !== 'rb' ? f.tgt : (f.unit === 'moa' ? 'grid' : 'rb'));
    PP.openPlot({ R: Rr, unitPer: unitIn(f.unit, Rr), unitLabel: unitLbl(f.unit), face, pts: f.plot ? f.plot.pts : [],
      onApply(pts, faceUsed, s) {
        f.plot = { face: faceUsed, pts, R: Rr };
        if (s) { const u = unitIn(f.unit, Rr), r2 = v => Math.round(v * 100) / 100; f.dy = r2(s.cy * u); f.dx = r2(s.cx * u); f.group = s.n > 1 ? r2(s.es * u) : null; f.shots = s.n; }
        renderFirings(); changed();
      } });
  }

  /* ---------------- render results ---------------- */
  let LAST = null;
  function recompute() {
    const R = cur(); if (!R) return;
    const r = compute(R); LAST = r; const T0 = sightDef(R).kind;
    r.pts.concat(r.bpts).forEach(p => { const el = $('res-' + p.f.id); if (el) el.innerHTML = sgn(p.pred) + ' / <b>' + sgn(p.res) + '</b> ' + unitLbl(p.f.unit); });
    const dir = (v, pos, neg, u) => { const n = num(v); if (n === null) return ''; if (Math.abs(n) < 0.005) return 'centre'; return Math.abs(n) + ' ' + u + ' ' + (n > 0 ? pos : neg); };
    R.firings.forEach(f => { const ul = unitLbl(f.unit), ey = $('dyh-' + f.id), ex = $('dxh-' + f.id); if (ey) ey.textContent = dir(f.dy, 'high', 'low', ul); if (ex) ex.textContent = dir(f.dx, 'right', 'left', ul); });
    R.firings.forEach(f => {
      const g = $('grp-' + f.id), gv = num(f.group), Rr = num(f.range);
      if (g) g.textContent = (gv && Rr) ? (f.unit === 'moa' ? '= ' + (gv * ipm(Rr)).toFixed(1) + ' in @ ' + Rr : '= ' + (gv / unitIn(f.unit, Rr)).toFixed(1) + ' MOA' + (f.unit === 'zr' ? ' = ' + (gv / unitIn('zr', Rr) * ipm(Rr)).toFixed(1) + ' in @ ' + Rr : '')) : '';
      if (![...r.pts, ...r.bpts].some(p => p.f === f)) { const el = $('res-' + f.id); if (el) el.textContent = r.skipped[f.id] || '–'; }
    });
    // calibration
    let h = '';
    if (r.mode === 'none') h = '<p>No test firings yet. Settings are predicted from your load’s ballistics against the sight’s reference load, with no correction for your rifle.</p>';
    else {
      const n = r.pts.length + r.bpts.length, shots = [...r.pts, ...r.bpts].reduce((s, p) => s + (num(p.f.shots) || 0), 0);
      h += '<div class="kv"><div>Groups used</div><div>' + n + (shots ? ' (' + shots + ' shots)' : '') + '</div>';
      h += '<div>Elevation offset</div><div><span class="num">' + sgn(r.a, 2) + '</span> MOA ' + (r.a >= 0 ? '(sight gives more elevation than the reference)' : '(sight gives less elevation than the reference)') + '</div>';
      h += '<div>Scale factor</div><div><span class="num">' + r.b.toFixed(3) + '</span> ' + (r.mode === 'scale' ? '(fitted)' : '(fixed at 1, needs groups at 2+ settings 200 yd apart)') + '</div>';
      if (T0 === 'clicks') h += '<div>Click value</div><div><span class="num">' + (r.U * r.b).toFixed(2) + '</span> MOA ≈ ' + (r.U * r.b * 1.047).toFixed(2) + ' in at 100 yd</div>';
      if (hasBattle(R)) h += '<div>Battle aperture</div><div>' + (r.battleFrom === 'measured' ? 'measured from your groups' : 'assumed to match the ' + r.bR + ' mark') + '</div>';
      if (r.grpMOA !== null) h += '<div>Average group</div><div><span class="num">' + r.grpMOA.toFixed(1) + '</span> MOA (' + r.nGrp + ' group' + (r.nGrp > 1 ? 's' : '') + ')</div>';
      if (r.rms !== null) h += '<div>Fit residual (RMS)</div><div><span class="num">' + r.rms.toFixed(2) + '</span> MOA' + (r.rms < 1 ? ' (good)' : r.rms < 2 ? ' (fair)' : ' (poor, check for flyers or typos)') + '</div>';
      h += '</div>';
      if (r.mode === 'battle') h += '<div class="callout">Only battle-aperture groups so far; the scale is assumed to match it at ' + r.bR + '. Shoot some groups on the ladder to calibrate it properly.</div>';
      if (r.note) h += '<div class="callout">' + esc(r.note) + '</div>';
      if (r.maxR && num(R.table.to) > r.maxR + 150) h += '<p class="hint">Your furthest test group is at ' + r.maxR + ' yd. Settings beyond that are extrapolated.</p>';
    }
    $('calib').innerHTML = h;
    let fh = '';
    if (!r.fs) fh = '<p class="hint">Add test firings to get foresight advice.</p>';
    else { const f = r.fs, curB = num(R.blade), where = f.useB ? 'with the battle aperture' : 'with the sight set to ' + f.Z;
      fh += '<p>At ' + f.Z + ' yd ' + where + ', groups should land <b class="num">' + sgn(f.poi) + ' in</b> ' + (hiLo(f.poi) || 'on') + ' (' + sgn(f.E, 2) + ' MOA).</p>';
      if (f.steps === 0) fh += '<div class="callout">Your current foresight is within half a blade size of right for ' + f.Z + ' yd. No change needed.</div>';
      else { const taller = f.steps > 0; fh += '<div class="callout">A foresight blade about <b class="num">' + Math.abs(f.dh).toFixed(3) + ' in ' + (taller ? 'taller' : 'shorter') + '</b> (≈ ' + Math.abs(f.steps) + ' size' + (Math.abs(f.steps) > 1 ? 's' : '') + ' ' + (taller ? 'up' : 'down') + ') would make the sight true at ' + f.Z + ' yd' + (curB !== null ? ': about <b class="num">' + (curB + f.steps * f.st).toFixed(3) + ' in</b>' : '') + '. A taller blade lowers the group. After changing it, shoot a confirming group and add it here.</div>'; }
      fh += '<p class="hint">Based on a sight radius of ' + (num(R.sightRadius) || 28) + ' in. The settings tables are for the blade currently fitted.</p>'; }
    $('foresight').innerHTML = fh;
    // settings table
    $('thBattle').style.display = hasBattle(R) ? '' : 'none'; $('thClicks').style.display = T0 === 'clicks' ? '' : 'none';
    document.querySelector('#settings tbody').innerHTML = r.rows.map(x => { const b = x.best; return '<tr' + (x.trans ? ' class="warnrow" title="Near the speed of sound: less certain"' : '') + '><td class="num" style="text-align:left">' + x.R + '</td><td>' + (b ? '<span class="set">' + lab(b.label) + '</span>' : '–') + '</td>' + (T0 === 'clicks' ? '<td class="num col-x">' + (b ? sgn(b.tot, 0) : '–') + '</td>' : '') + '<td class="num">' + (b ? sgn(b.poi) + ' in <span class="hint">(' + sgn(b.poi / ipm(x.R)) + ' MOA)</span>' : '–') + '</td><td class="num col-x">' + fmtExact(x.exact) + '</td>' + (hasBattle(R) ? '<td class="num">' + sgn(x.battle) + ' in</td>' : '') + '<td class="num">' + x.drift.toFixed(1) + ' in</td><td class="num col-x">' + Math.round(x.vel) + '</td><td class="num col-x">' + x.tof.toFixed(2) + '</td></tr>'; }).join('') || '<tr><td colspan="9">No ranges to show.</td></tr>';
    // lollipop
    $('lolli').querySelector('thead').innerHTML = '<tr><th>Range (yd)</th>' + r.holds.map(t => '<th>' + esc(t.name) + (t.rb ? '' : '<div class="hint" style="margin:0;font-weight:400">centre ' + t.hold.toFixed(1) + ' in above foot</div>') + '</th>').join('') + '</tr>';
    $('lolli').querySelector('tbody').innerHTML = r.rows.map(x => '<tr' + (x.trans ? ' class="warnrow"' : '') + '><td class="num" style="text-align:left">' + x.R + '</td>' + x.lolli.map((l, i) => '<td>' + (l ? '<span class="set">' + lab(l.c.label) + '</span> <span class="hint">' + sgn(l.c.off) + ' in</span>' + (r.holds[i].rb ? '<div class="hint" style="margin:0">hold-off ' + l.hold.toFixed(1) + ' in</div>' : '') : '<span class="hint">–</span>') + '</td>').join('') + '</tr>').join('');
    if (S.panel === 'settings') drawChart(r);
    if (S.panel === 'trj') { try { drawTraj(r); } catch (e) { $('trjInfo').textContent = 'Could not draw the trajectory.'; } }
  }

  function drawChart(r) {
    const rows = r.rows.filter(x => isFinite(x.exact) && x.exact > 0); if (rows.length < 2) { $('chart').innerHTML = ''; return; }
    const W = 700, H = 260, m = { l: 52, r: 14, t: 14, b: 34 }, x0 = rows[0].R, x1 = rows[rows.length - 1].R;
    const ys = rows.flatMap(x => [x.exact, x.R]).concat(r.implied.filter(p => p.R >= x0 && p.R <= x1).map(p => p.s));
    const y0 = Math.floor(Math.min(...ys) / 100) * 100, y1 = Math.ceil(Math.max(...ys) / 100) * 100 || 100;
    const X = v => m.l + (v - x0) / (x1 - x0 || 1) * (W - m.l - m.r), Y = v => H - m.b - (v - y0) / (y1 - y0 || 1) * (H - m.t - m.b);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px;display:block;margin-top:14px" role="img" aria-label="Sight setting needed by range">';
    const ystep = (y1 - y0) > 800 ? 200 : 100, xstep = (x1 - x0) > 800 ? 200 : 100;
    for (let v = y0; v <= y1; v += ystep) s += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="var(--line)"/><text x="' + (m.l - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + v + '</text>';
    for (let v = Math.ceil(x0 / xstep) * xstep; v <= x1; v += xstep) s += '<text x="' + X(v) + '" y="' + (H - m.b + 16) + '" text-anchor="middle">' + v + '</text>';
    s += '<text x="' + ((m.l + W - m.r) / 2) + '" y="' + (H - 4) + '" text-anchor="middle">Range (yd)</text><text transform="translate(12,' + ((m.t + H - m.b) / 2) + ') rotate(-90)" text-anchor="middle">Sight setting</text>';
    s += '<line x1="' + X(x0) + '" y1="' + Y(x0) + '" x2="' + X(x1) + '" y2="' + Y(x1) + '" stroke="var(--muted)" stroke-dasharray="4 4"/>';
    s += '<path d="' + rows.map((x, i) => (i ? 'L' : 'M') + X(x.R).toFixed(1) + ' ' + Y(x.exact).toFixed(1)).join(' ') + '" fill="none" stroke="var(--accent)" stroke-width="2.5"/>';
    r.implied.forEach(p => { if (p.R >= x0 && p.R <= x1) s += '<circle cx="' + X(p.R) + '" cy="' + Y(p.s) + '" r="4.5" fill="var(--accent2)" stroke="var(--card)" stroke-width="1.5"/>'; });
    s += '</svg><div class="legend"><span style="--c:var(--accent)">Setting needed (model)</span><span style="--c:var(--muted)">Setting = range</span><span style="--c:var(--accent2)">Setting each test group implies</span></div>';
    $('chart').innerHTML = s;
  }

  function drawTraj(r) {
    const R = r.R, ps = parseSetting(R.trj.set), box = $('trjPlot');
    const max = Math.round(Math.min(2000, Math.max(200, num(R.trj.max) || 1000)) / 100) * 100;
    if (!ps) { box.innerHTML = ''; $('trjInfo').textContent = 'Enter a sight setting, e.g. 300 or B for the battle aperture.'; $('trjTable').querySelector('tbody').innerHTML = ''; return; }
    let th, desc;
    if (ps.battle) { th = r.battleAngle; desc = 'battle aperture'; }
    else { const clk = isClicks(R) ? ps.clicks + (num(R.trj.clk) || 0) : 0; th = r.a + r.b * (r.nomAt(ps.mark) + clk * r.U); desc = ps.mark + (clk ? (clk > 0 ? ' +' : ' −') + Math.abs(clk) + ' click' + (Math.abs(clk) === 1 ? '' : 's') : ''); }
    if (isNaN(th)) { box.innerHTML = ''; $('trjInfo').textContent = 'That setting is outside the sight scale.'; return; }
    const h = r.h * 0.0254;
    const pick = id => id === 'current' ? Object.assign({}, getAmmo(R.ammoId), { name: getAmmo(R.ammoId).name + ' (this rifle)' }) : id ? getAmmo(id) : null;
    const ser = [R.trj.a || 'current', R.trj.b].filter((v, i, arr) => v && (i === 0 || v !== arr[0])).map(pick).filter(Boolean).map(x => { const tr = traj(x, S.atm); const yIn = Rr => Rr > tr.reach ? NaN : ((th / MOA) * Rr * YD - h + lerpArr(tr.y, Rr)) / 0.0254; return { name: x.name, tr, yIn }; });
    if (!ser.length) { box.innerHTML = ''; return; }
    ser.forEach(x => { let maxY = -1e9, maxR = 0, cross = [], prev = x.yIn(1); for (let Rr = 1; Rr <= max; Rr++) { const y = x.yIn(Rr); if (y > maxY) { maxY = y; maxR = Rr; } if (Rr > 1 && ((prev < 0 && y >= 0) || (prev >= 0 && y < 0))) cross.push(Rr); prev = y; } x.maxY = maxY; x.maxR = maxR; x.cross = cross; });
    $('trjInfo').innerHTML = 'Sight at <b>' + esc(desc) + '</b>: the bore points ' + th.toFixed(1) + ' MOA above your line of sight.' + ser.map((x, i) => '<br><span style="color:' + (i ? 'var(--accent2)' : 'var(--accent)') + ';font-weight:600">' + esc(x.name) + '</span>: crosses line of sight at ' + (x.cross.length ? x.cross.map(c => c + ' yd').join(' and ') : 'none in range') + '; highest ' + sgn(x.maxY) + ' in at ' + x.maxR + ' yd.').join('');
    const cw = box.clientWidth || 700, W = Math.round(Math.max(330, Math.min(700, cw))), H = Math.round(W < 500 ? W * 0.72 : 300), m = { l: W < 500 ? 46 : 54, r: 12, t: 16, b: 34 };
    let lo = 0, hi = 0; ser.forEach(x => { for (let Rr = 0; Rr <= max; Rr += 5) { const y = Rr ? x.yIn(Rr) : -h / 0.0254; if (isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); } } });
    const span = (hi - lo) || 10, stepY = [2, 5, 10, 20, 25, 50, 100, 200, 500].find(s => span / s <= 8) || 1000; lo = Math.floor(lo / stepY) * stepY; hi = Math.ceil(hi / stepY) * stepY; if (hi === lo) hi = lo + stepY;
    const X = v => m.l + v / max * (W - m.l - m.r), Y = v => H - m.b - (v - lo) / (hi - lo) * (H - m.t - m.b);
    let g = '<svg id="trjSvg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px;display:block;margin-top:10px;touch-action:pan-y" role="img" aria-label="Bullet trajectory relative to line of sight">';
    for (let v = lo; v <= hi + 1e-9; v += stepY) g += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="var(--line)"/><text x="' + (m.l - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + (v > 0 ? '+' : '') + v + '</text>';
    for (let v = 100; v < max; v += 100) g += '<line x1="' + X(v) + '" x2="' + X(v) + '" y1="' + m.t + '" y2="' + (H - m.b) + '" stroke="var(--line)"' + (v % 500 ? '' : ' stroke-width="1.6"') + '/>';
    const xs = (max > 1000 || W < 500) ? 200 : 100; for (let v = 0; v <= max; v += xs) g += '<text x="' + X(v) + '" y="' + (H - m.b + 16) + '" text-anchor="middle">' + v + '</text>';
    g += '<text x="' + ((m.l + W - m.r) / 2) + '" y="' + (H - 4) + '" text-anchor="middle">Range (yd)</text><text transform="translate(12,' + ((m.t + H - m.b) / 2) + ') rotate(-90)" text-anchor="middle">Inches above / below line of sight</text>';
    g += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="var(--ink)" stroke-width="1.2" stroke-dasharray="6 4"/>';
    ser.forEach((x, i) => { let d = 'M' + X(0).toFixed(1) + ' ' + Y(-h / 0.0254).toFixed(1); for (let Rr = 5; Rr <= max; Rr += 5) { const y = x.yIn(Rr); if (!isFinite(y)) break; d += ' L' + X(Rr).toFixed(1) + ' ' + Y(y).toFixed(1); }
      const c = i ? 'var(--accent2)' : 'var(--accent)'; g += '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="2.5"' + (i ? ' stroke-dasharray="8 4"' : '') + '/>'; x.cross.forEach(cr => g += '<circle cx="' + X(cr) + '" cy="' + Y(0) + '" r="4" fill="' + c + '" stroke="var(--card)" stroke-width="1.5"/>'); });
    g += '<g id="trjCur" style="display:none"><line id="trjCurL" y1="' + m.t + '" y2="' + (H - m.b) + '" stroke="var(--muted)"/><rect id="trjCurB" rx="5" fill="var(--card)" stroke="var(--line)"/><text id="trjCurT" style="font-size:12px;fill:var(--ink)"></text></g>';
    g += '<rect x="' + m.l + '" y="' + m.t + '" width="' + (W - m.l - m.r) + '" height="' + (H - m.t - m.b) + '" fill="transparent"/></svg>';
    g += '<div class="legend">' + ser.map((x, i) => '<span style="--c:' + (i ? 'var(--accent2)' : 'var(--accent)') + '">' + esc(x.name) + '</span>').join('') + '<span style="--c:var(--ink)">Line of sight</span></div>';
    box.innerHTML = g;
    const svg = $('trjSvg'), move = e => { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      let Rr = Math.round((p.x - m.l) / (W - m.l - m.r) * max / 5) * 5; Rr = Math.max(5, Math.min(max, Rr)); const cx = X(Rr);
      const lines = [Rr + ' yd'].concat(ser.map(x => { const y = x.yIn(Rr); return (ser.length > 1 ? (x.name.split(' (')[0].slice(0, 18) + ': ') : '') + (isFinite(y) ? sgn(y) + ' in' : '–'); }));
      $('trjCur').style.display = ''; $('trjCurL').setAttribute('x1', cx); $('trjCurL').setAttribute('x2', cx);
      const t = $('trjCurT'); t.innerHTML = lines.map((l, i) => '<tspan x="0" dy="' + (i ? 15 : 0) + '"' + (i ? '' : ' style="font-weight:600"') + '>' + esc(l) + '</tspan>').join('');
      const bw = Math.max(...lines.map(l => l.length)) * 6.6 + 14, bh = lines.length * 15 + 8; let bx = cx + 8; if (bx + bw > W - m.r) bx = cx - 8 - bw; const by = m.t + 4;
      const bb = $('trjCurB'); bb.setAttribute('x', bx); bb.setAttribute('y', by); bb.setAttribute('width', bw); bb.setAttribute('height', bh); t.setAttribute('transform', 'translate(' + (bx + 7) + ',' + (by + 15) + ')'); };
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move); svg.addEventListener('pointerleave', () => { $('trjCur').style.display = 'none'; });
    const st = max > 1000 ? 100 : 50, rs = []; for (let Rr = st; Rr <= max; Rr += st) rs.push(Rr);
    $('trjTable').querySelector('thead').innerHTML = '<tr><th>Range (yd)</th>' + ser.map(x => '<th class="num">' + esc(x.name.split(' (')[0]) + '</th>').join('') + '</tr>';
    $('trjTable').querySelector('tbody').innerHTML = rs.map(Rr => '<tr><td class="num" style="text-align:left">' + Rr + '</td>' + ser.map(x => { const y = x.yIn(Rr); return '<td class="num">' + (isFinite(y) ? sgn(y) + ' in' : '–') + '</td>'; }).join('') + '</tr>').join('');
  }

  /* ---------------- copy / backup ---------------- */
  async function copyText(t, btn) { try { await navigator.clipboard.writeText(t); const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => btn.textContent = o, 1500); } catch (e) { $('io').value = t; $('io').closest('details').open = true; $('io').select(); $('msg').textContent = 'Couldn’t copy automatically; the text is selected in the backup box on the Home tab.'; } }
  $('copyBtn').addEventListener('click', e => { const r = LAST, R = cur(); if (!r || !R) return; const A = getAmmo(R.ammoId);
    const lines = ['Sight settings — ' + (R.name || model(R.model).name), A.name + ': ' + A.weight + ' gr, ' + A.mv + ' fps, G1 ' + A.bc + ' | ' + S.atm.T + '°C ' + S.atm.P + ' hPa', ''];
    lines.push(['Range', 'Set', 'Impact(in)', 'Exact'].concat(hasBattle(R) ? ['Battle(in)'] : []).concat(['Drift10mph(in)']).join('\t'));
    r.rows.forEach(x => lines.push([x.R, x.best ? x.best.label.replace('−', '-') : '-', x.best ? sgn(x.best.poi).replace('−', '-') : '-', fmtExact(x.exact)].concat(hasBattle(R) ? [sgn(x.battle).replace('−', '-')] : []).concat([x.drift.toFixed(1)]).join('\t')));
    copyText(lines.join('\n'), e.target); });
  $('copyLolliBtn').addEventListener('click', e => { const r = LAST, R = cur(); if (!r || !R) return; const A = getAmmo(R.ammoId);
    const lines = ['Lollipop (6 o\'clock) settings — ' + (R.name || ''), A.name + ': ' + A.weight + ' gr, ' + A.mv + ' fps', '', ['Range'].concat(r.holds.map(t => t.name)).join('\t')];
    r.rows.forEach(x => lines.push([x.R].concat(x.lolli.map(l => l ? l.c.label.replace('−', '-') + ' (' + sgn(l.c.off).replace('−', '-') + 'in)' : '-')).join('\t'))); copyText(lines.join('\n'), e.target); });
  $('moreCols').addEventListener('click', e => { const on = document.body.classList.toggle('allcols'); e.target.textContent = on ? 'Fewer columns' : 'Show all columns'; });
  $('exportBtn').addEventListener('click', e => { $('io').value = JSON.stringify(S, null, 1); copyText($('io').value, e.target); });
  function importObj(o, btn) {
    if (o && o.v === 2 && Array.isArray(o.rifles)) {
      if (btn && btn.dataset.armed !== '1') { arm(btn, 'Replace everything here with this backup? Tap again'); return false; }
      S = mergeDefaults(o); PP.state = S; save(); show(S.active); $('msg').textContent = 'Backup loaded.'; return true;
    }
    if (o && o.rifle) { const m = fromV1(o); S.rifles.push(m.rifle); if (m.custom) S.ammo.push(m.custom); save(); show(m.rifle.id); $('msg').textContent = 'Added ' + m.rifle.name + ' from the No4 Sight Book backup.'; return true; }
    throw new Error('bad');
  }
  $('importBtn').addEventListener('click', e => { try { importObj(JSON.parse($('io').value), e.currentTarget); } catch (err) { $('msg').textContent = 'That text isn’t a sight book backup.'; } });
  $('dlBtn').addEventListener('click', () => { const b = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'peep-and-post-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); });
  $('ulFile').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { const o = JSON.parse(t); if (o && o.v === 2) { S = mergeDefaults(o); PP.state = S; save(); show(S.active); $('msg').textContent = 'Backup loaded.'; } else importObj(o); } catch (err) { $('msg').textContent = 'That file isn’t a sight book backup.'; } e.target.value = ''; }); });

  /* ---------------- start ---------------- */
  status(); show(S.active || 'home');
  try { if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js'); } catch (e) { }
  PP._test = { get S() { return S; }, compute, cur, show, fromV1 };
})();
