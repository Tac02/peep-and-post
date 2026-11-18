/* Peep & Post — built-in data: rifles, rear sights, reference loads, factory ammunition, targets.
   All figures are starting values; every one can be changed per rifle in the app. */
window.PP = window.PP || {};

/* Loads a sight scale is laid out for. A sight's marks are modelled as the elevation this load needs at that range. */
PP.REF = {
  mk7: { name: 'Mk VII ball, 174 gr, 2440 fps', weight: 174, bc: 0.41, mv: 2440 },
  mk7no5: { name: 'Mk VII ball from the No5 carbine, about 2350 fps (estimate)', weight: 174, bc: 0.41, mv: 2350 },
  mk6: { name: 'Mk VI / Mk II ball, 215 gr round nose, about 2060 fps', weight: 215, bc: 0.30, mv: 2060 }
};

/* Rear sights.
   kind: 'clicks' = micrometer screw (mark + or − clicks); 'steps' = slide that stops at set intervals;
         'fixed' = a few apertures only; 'custom' = user-entered graduations. */
PP.rng = (a, b, s) => { const o = []; for (let x = a; x <= b; x += s) o.push(x); return o; };
PP.SIGHTS = {
  no4_mk1: {
    name: 'Mk1 (Singer type): micrometer screw, 200–1300 yd',
    kind: 'clicks', marks: PP.rng(200, 1300, 100), clickTop: 1000, clickCount: 56, clicksBelow: 4, battle: 300,
    hint: 'Wound up and down by the knurled screw in clicks of roughly 1 MOA. Count the clicks between the 200 and 1000 marks on your own sight (typically about 56) so the tool knows your click value.'
  },
  no4_mk2: {
    name: 'Mk2: two-aperture flip, 300 & 600 yd', kind: 'fixed', grads: [300, 600], battle: null,
    hint: 'Wartime flip sight with 300 and 600 yd apertures only. Armourers zeroed these on the 300 aperture with the bayonet fixed (MPI 6 in high at 100 yd), so impact can shift with the bayonet on or off.'
  },
  no4_mk3: {
    name: 'Mk3: pressed leaf, sprung slide, 200–1300 yd', kind: 'steps', min: 200, max: 1300, step: 100, battle: 300,
    hint: 'Pressed-steel leaf with a sprung slide that locks in notches; no clicks. Set how often the slide stops on yours.'
  },
  no4_mk4: {
    name: 'Mk4: pressed leaf, curved slide catch, 200–1300 yd', kind: 'steps', min: 200, max: 1300, step: 100, battle: 300,
    hint: 'As the Mk3 but with the improved, curved slide catch and larger aperture; no clicks. Set how often the slide stops on yours.'
  },
  no5_mk1: {
    name: 'No5 Mk1: micrometer screw, 200–800 yd', kind: 'clicks', marks: PP.rng(200, 800, 100), clickTop: 800, clickMOA: 0.66, clicksBelow: 4, battle: 300,
    hint: 'Looks like the No4 Mk1 sight but graduated only to 800 yd, with marks laid out for the carbine’s shorter barrel. Clicks are about 0.66 MOA on the No5. Count the clicks between your 200 and 800 marks.'
  },
  no5_mk2: {
    name: 'No5 Mk2: pressed flip-up ladder, 200–800 yd', kind: 'steps', min: 200, max: 800, step: 100, battle: 300,
    hint: 'Pressed sheet-metal ladder graduated to 800 yd. Most were replaced by the Mk1 sight after the war. Set how often the slide stops on yours.'
  },
  smle_mk3: {
    name: 'No1 Mk III leaf with windgauge, 200–2000 yd', kind: 'steps', min: 200, max: 2000, step: 25, battle: null, open: true, windage: true,
    hint: 'Open U-notch tangent leaf on the barrel, graduated from 200 to 2000 yd. The slide sets the range and the fine-adjustment worm sets it to 25 yd. The Mk III also has a windgauge; the long-range volley sights are not modelled.'
  },
  smle_mk3s: {
    name: 'No1 Mk III* leaf, 200–2000 yd (no windgauge)', kind: 'steps', min: 200, max: 2000, step: 25, battle: null, open: true,
    hint: 'As the Mk III leaf, set to 25 yd, but the windgauge was deleted from 1916 to speed production; some earlier sights were pinned. Zero laterally by moving the foresight.'
  },
  p14: {
    name: 'P14 battle aperture (300 yd) + ladder 200–1650 yd', kind: 'steps', min: 200, max: 1650, step: 50, battle: 300,
    hint: 'Receiver aperture. Leaf down gives the battle aperture set for 300 yd with Mk VII; leaf up gives the ladder aperture from 200 to 1650 yd. The slide stops are assumed every 50 yd; check yours. Volley sights are not modelled.'
  },
  long_lee: {
    name: 'Long Lee / Lee-Metford leaf, to 1800 yd', kind: 'steps', min: 300, max: 1800, step: 50, battle: null, open: true, lowConfidence: true,
    hint: 'Long-barrel rifles sighted for the 215 gr round-nose ball. Graduations vary between marks and conversions (many were re-sighted for Mk VII), so check and edit the settings and the reference load to match your rifle. Less well documented than the others.'
  },
  custom: {
    name: 'Other / custom graduations', kind: 'custom', battle: 300,
    hint: 'List the settings you can use, e.g. 200-1300/50 (200 to 1300 in 50s) or 300,600.'
  }
};

/* Rifles. radius and blades from the REME zeroing précis where available. */
PP.RIFLES = [
  { id: 'no1mk3', name: 'SMLE No1 Mk III', calibre: '.303 British', sights: ['smle_mk3'], radius: 19.5, height: 1.0,
    blades: '−.060 to +.030 in, .015 steps (2.77 in at 100 yd per size)', bladeStep: 0.015, ref: 'mk7' },
  { id: 'no1mk3s', name: 'SMLE No1 Mk III*', calibre: '.303 British', sights: ['smle_mk3s', 'smle_mk3'], radius: 19.5, height: 1.0,
    blades: '−.060 to +.030 in, .015 steps (2.77 in at 100 yd per size)', bladeStep: 0.015, ref: 'mk7' },
  { id: 'no4mk1', name: 'No4 Mk1 / Mk1*', calibre: '.303 British', sights: ['no4_mk1', 'no4_mk2', 'no4_mk3', 'no4_mk4'], radius: 28.74, height: 1.0,
    blades: '−.030 to +.075 in issue sizes (more exist), .015 steps (1.87 in at 100 yd per size)', bladeStep: 0.015, ref: 'mk7' },
  { id: 'no4mk2', name: 'No4 Mk2', calibre: '.303 British', sights: ['no4_mk1', 'no4_mk3', 'no4_mk4'], radius: 28.74, height: 1.0,
    blades: '−.030 to +.075 in issue sizes (more exist), .015 steps', bladeStep: 0.015, ref: 'mk7' },
  { id: 'no5mk1', name: 'No5 Mk1 (jungle carbine)', calibre: '.303 British', sights: ['no5_mk1', 'no5_mk2'], radius: 23.25, height: 1.0,
    blades: '−.030 to +.075 in, .015 steps (2.33 in at 100 yd per size)', bladeStep: 0.015, ref: 'mk7no5' },
  { id: 'p14', name: 'P14 / No3 Mk1', calibre: '.303 British', sights: ['p14'], radius: 31.8, height: 1.0,
    blades: '−.015 to +.135 in, .015 steps (1.70 in at 100 yd per size)', bladeStep: 0.015, ref: 'mk7' },
  { id: 'mle', name: 'Long Lee (MLE / CLLE) or Lee-Metford', calibre: '.303 British', sights: ['long_lee', 'custom'], radius: 25, height: 1.0,
    blades: 'check your rifle', bladeStep: 0.015, ref: 'mk6', lowConfidence: true },
  { id: 'other303', name: 'Other .303 rifle', calibre: '.303 British', sights: ['custom'], radius: 26, height: 1.0,
    blades: 'enter your own', bladeStep: 0.015, ref: 'mk7' }
];

/* Factory ammunition (makers' published figures unless noted). */
PP.AMMO = [
  { id: 'mk7', name: 'Mk VII-type service ball, 174 gr FMJ', calibre: '.303 British', weight: 174, bc: 0.41, mv: 2440,
    note: 'Nominal figures for the service round the sight scales were laid out for. The BC is an estimate; surplus lots vary.' },
  { id: 'ppu174', name: 'PPU 174 gr FMJBT (PP303F)', calibre: '.303 British', weight: 174, bc: 0.478, mv: 2400,
    note: 'PPU published: 2400 fps, G1 0.478. Some retailers list 2460 fps. Box velocity comes from a test barrel, so a chronograph figure from your rifle is better.' },
  { id: 'ppu180', name: 'PPU 180 gr SPBT (PP303S2)', calibre: '.303 British', weight: 180, bc: 0.512, mv: 2460, note: 'PPU published: 2460 fps, G1 0.512.' },
  { id: 'ppu150', name: 'PPU 150 gr SPBT (PP303S1)', calibre: '.303 British', weight: 150, bc: 0.385, mv: 2690, note: 'PPU published: 2690 fps, G1 0.385.' },
  { id: 'sb180fmj', name: 'S&B 180 gr FMJ (SB303A)', calibre: '.303 British', weight: 180, bc: 0.506, mv: 2477,
    note: 'S&B published: 2477 fps (from a 23.5 in test barrel), G1 0.506.' },
  { id: 'sb180sp', name: 'S&B 180 gr SP (SB303C)', calibre: '.303 British', weight: 180, bc: 0.30, mv: 2438,
    note: 'S&B published 2438 fps. Retailers often list BC 0.505, but S&B’s own drop table for this load matches about G1 0.30, so that is used here.' }
];

/* Targets. Dimensions in mm (NRA Handbook 2026, Appendix V; Fig 11 height from MoD JSP 403). */
PP.RB_FACES = { // NRA TR round bull rings, mm: aiming mark, V, bull, inner, magpie, outer
  200: { am: 406, v: 53.4, bull: 89, inner: 178, magpie: 267, outer: 406 },
  300: { am: 560, v: 78, bull: 130, inner: 260, magpie: 390, outer: 560 },
  400: { am: 813, v: 122, bull: 203, inner: 406, magpie: 610, outer: 813 },
  500: { am: 990, v: 150, bull: 250, inner: 660, magpie: 990, outer: 1320 },
  600: { am: 990, v: 192, bull: 320, inner: 660, magpie: 990, outer: 1320 },
  1000: { am: 1120, v: 351, bull: 585, inner: 1120, magpie: 1830, outer: 2440 }
};
PP.RB = {
  nra: { name: 'NRA TR Round Bull', am: { 200: 406, 300: 560, 400: 813, 500: 990, 600: 990, 900: 1120, 1000: 1120 } },
  hbsa: { name: 'NRA/HBSA Historic', am: { 200: 12 * 25.4, 300: 18 * 25.4, 500: 36 * 25.4, 600: 36 * 25.4 } }
};
PP.FIGS = { // h = height, c = scoring circle centre below top, w = width (approx. where not published), bull/inner diameters
  f11: { name: 'Figure 11', h: 1140, w: 520, c: 506, bull: 240, inner: 300, full: true },
  f12: { name: 'Figure 12', h: 570, w: 520, c: 300, bull: 240, full: false },
  f12c: { name: 'Figure 12C', h: 400, w: 330, c: 200, bull: 150, full: false }
};
PP.ZRYD = 71.5833 / 3; // Bisley Zero Range, 71 ft 7 in, in yards
