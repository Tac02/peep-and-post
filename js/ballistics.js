/* Peep & Post — point-mass G1 trajectory model. */
window.PP = window.PP || {};
(function () {
  const G1M = [0,.05,.1,.15,.2,.25,.3,.35,.4,.45,.5,.55,.6,.7,.725,.75,.775,.8,.825,.85,.875,.9,.925,.95,.975,1,1.025,1.05,1.075,1.1,1.125,1.15,1.2,1.25,1.3,1.35,1.4,1.45,1.5,1.55,1.6,1.65,1.7,1.75,1.8,1.85,1.9,1.95,2,2.05,2.1,2.15,2.2,2.25,2.3,2.35,2.4,2.45,2.5,2.6,2.7,2.8,2.9,3];
  const G1C = [.2629,.2558,.2487,.2413,.2344,.2278,.2214,.2155,.2104,.2061,.2032,.202,.2034,.2165,.223,.2313,.2417,.2546,.2706,.2901,.3136,.3415,.3734,.4084,.4448,.4805,.5136,.5427,.5677,.5883,.6053,.6191,.6393,.6518,.6589,.6621,.6625,.6607,.6573,.6528,.6474,.6413,.6347,.628,.621,.6141,.6072,.6003,.5934,.5867,.5804,.5743,.5685,.563,.5577,.5527,.5481,.5438,.5397,.5325,.5264,.5211,.5168,.5133];
  function g1(m) { if (m <= 0) return G1C[0]; if (m >= 3) return G1C[G1C.length - 1]; let i = 1; while (G1M[i] < m) i++; const f = (m - G1M[i - 1]) / (G1M[i] - G1M[i - 1]); return G1C[i - 1] + f * (G1C[i] - G1C[i - 1]); }
  const MOA = 3437.7468, YD = 0.9144, MAXYD = 2600;
  const num = v => (v === null || v === undefined || v === '' || isNaN(+v)) ? null : +v;
  const cache = new Map();
  /* Trajectory fired level from the bore line. Returns per-yard drop (m), time (s) and speed (m/s). */
  function traj(am, atm) {
    const key = [am.bc, am.mv, atm.T, atm.P].join('|');
    if (cache.has(key)) return cache.get(key);
    const bc = Math.max(0.05, num(am.bc) || 0.4) * 703.07, v0 = Math.max(300, num(am.mv) || 2400) * 0.3048;
    const T = num(atm.T) ?? 15, P = num(atm.P) ?? 1013;
    const rho = (P * 100) / (287.05 * (T + 273.15)), c = 331.3 * Math.sqrt(1 + T / 273.15);
    const N = MAXYD + 1, y = new Float64Array(N), t = new Float64Array(N), v = new Float64Array(N);
    let X = 0, Y = 0, VX = v0, VY = 0, TT = 0, next = 1; const dt = 0.0005; v[0] = v0;
    const acc = (vx, vy) => { const s = Math.hypot(vx, vy), k = rho * g1(s / c) * Math.PI / (8 * bc); return [-k * s * vx, -k * s * vy - 9.80665]; };
    while (next < N && TT < 20) {
      const a1 = acc(VX, VY), mx = VX + a1[0] * dt / 2, my = VY + a1[1] * dt / 2, a2 = acc(mx, my);
      const nX = X + mx * dt, nY = Y + my * dt, nVX = VX + a2[0] * dt, nVY = VY + a2[1] * dt;
      while (next < N && nX >= next * YD) { const f = (next * YD - X) / (nX - X); y[next] = Y + f * (nY - Y); t[next] = TT + f * dt; v[next] = Math.hypot(VX + f * (nVX - VX), VY + f * (nVY - VY)); next++; }
      X = nX; Y = nY; VX = nVX; VY = nVY; TT += dt; if (VX < 30) break;
    }
    const out = { y, t, v, v0, c, reach: next - 1 };
    if (cache.size > 40) cache.clear();
    cache.set(key, out);
    return out;
  }
  function lerpArr(a, R) { const i = Math.floor(R), f = R - i; return i + 1 < a.length ? a[i] + f * (a[i + 1] - a[i]) : a[i]; }
  /* Elevation (MOA, bore relative to line of sight) needed to hit at R yards, for sight height h inches. */
  function angleAt(tr, R, hIn) { if (!(R >= 1) || R > tr.reach) return NaN; const h = (hIn ?? 1) * 0.0254; return (h - lerpArr(tr.y, R)) / (R * YD) * MOA; }
  const ipm = R => R * 36 / MOA; // inches per MOA at R yards
  Object.assign(PP, { traj, lerpArr, angleAt, ipm, MOA, YD, num });
})();
