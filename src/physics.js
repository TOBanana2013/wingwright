// ===== Flight physics core =====
const G = 9.81, RHO0 = 1.225, OSWALD = 0.8, ETA = 0.8, RWY_W = 30;
const MATERIALS = {
  wood:   { name: 'Spruce & fabric', wing: 13,  skin: 6.5, n: 4.2 },
  alu:    { name: 'Aluminium',       wing: 10,  skin: 5.2, n: 5.5 },
  carbon: { name: 'Carbon fibre',    wing: 6.5, skin: 3.6, n: 7.5 }
};
const SHAPES = {
  boxy:    { name: 'Boxy',    cd: 0.50, mass: 0 },
  rounded: { name: 'Rounded', cd: 0.30, mass: 15 },
  sleek:   { name: 'Sleek',   cd: 0.18, mass: 35 }
};
const TAILS = {
  small:  { name: 'Small',  mass: 12, cd: 0.002, rate: 30, k: 0.12, gust: 1.0,  frac: 0.24 },
  medium: { name: 'Medium', mass: 25, cd: 0.004, rate: 20, k: 0.6,  gust: 0.35, frac: 0.32 },
  large:  { name: 'Large',  mass: 42, cd: 0.007, rate: 14, k: 1.2,  gust: 0.12, frac: 0.40 }
};
const gearH = p => Math.max(0.5, p.length * 0.045);

function specs(p) {
  const tl = TAILS[p.tail];
  let s;
  if (p.real) {
    const S = p.S, AR = p.span * p.span / S;
    s = { S, AR, mass: p.mass, dry: p.mass - p.fuel, cd0: p.cd0, nlim: p.nlim, clmax: p.clmax, flapCl: p.flapCl,
      jet: p.engine === 'jet', supersonic: !!p.supersonic, abMult: p.abMult || 0, transCd: p.transCd || 0, waveCd: p.waveCd || 0, thrust0: p.thrust || 0, power: p.power || 0, vref: p.vref || 18,
      front: p.width * p.height * 0.8, burn: p.fuel / (0.65 * 1200) };
  } else {
    const mat = MATERIALS[p.material], sh = SHAPES[p.shape];
    const S = p.span * p.chord, AR = p.span / p.chord;
    const front = p.width * p.height * 0.8, wet = 2 * (p.width + p.height) * p.length * 0.85;
    const dry = S * mat.wing + wet * mat.skin + sh.mass + tl.mass + 35 + 0.85 * p.power + 80;
    s = { S, AR, mass: dry + p.fuel, dry, front, cd0: (sh.cd * front + 0.004 * wet) / S + tl.cd + 0.006,
      nlim: mat.n * Math.pow(Math.min(1, 9 / AR), 0.7), clmax: 1.45, flapCl: 0.6,
      jet: false, power: p.power, vref: 18, burn: p.power * 0.001 };
  }
  s.inc = p.incidence; s.fuel = p.fuel; s.brakeCd = p.brakeCd || 0; s.real = !!p.real; s.span = p.span;
  const heavy = s.mass > 15000;
  s.maxBank = p.maxBank || (heavy ? 30 : 45); s.rollRate = p.rollRate || (heavy ? 15 : 35);
  s.a = 2 * Math.PI * s.AR / (s.AR + 2);
  const arm = Math.max(0.6, Math.min(4, p.length / 8.5));
  s.pitch = { rate: p.pitchRate || tl.rate / Math.sqrt(arm), k: p.pitchK || tl.k * Math.min(arm, 2), gust: p.gust !== undefined ? p.gust : tl.gust / arm };
  s.aero = !!p.aero;
  const W = s.mass * G;
  s.vStall = Math.sqrt(2 * W / (RHO0 * s.S * s.clmax));
  s.vStallF = Math.sqrt(2 * W / (RHO0 * s.S * (s.clmax + s.flapCl)));
  s.vLift = s.vStallF * 1.15;
  // take-off roll, flaps down, full power
  const clG = coeffs(s, p.incidence, 1);
  let v = 0, x = 0, t = 0;
  while (v < s.vLift && t < 180) {
    const q = 0.5 * RHO0 * v * v, L = q * s.S * clG.cl, D = q * s.S * clG.cd;
    const F = thrust(s, v, 1, RHO0) - D - 0.03 * Math.max(0, W - L);
    if (F <= 0 && v > 1) { t = 999; break; }
    v += F / s.mass * 0.05; x += v * 0.05; t += 0.05;
  }
  s.roll = t >= 180 ? Infinity : x;
  s.vMax = 0;
  for (let v2 = 10; v2 <= (s.supersonic ? 800 : 320); v2 += 0.5) {
    const q = 0.5 * RHO0 * v2 * v2, cl = W / (q * s.S);
    if (cl > s.clmax) continue;
    const D = q * s.S * (s.cd0 + cl * cl / (Math.PI * OSWALD * s.AR) + mach(v2, s));
    if (thrust(s, v2, 1, RHO0) >= D) s.vMax = v2;
  }
  s.endurance = p.fuel / (0.65 * s.burn);
  { const pp = pathParams(s); s.ceiling = p.ceiling || Math.max(500, Math.min(1200, Math.round(pp.cruise * 2.5 / 100) * 100)); }
  s.tw = thrust(s, 0, 1, RHO0) / W;
  s.range = s.endurance * Math.max(s.vStall * 1.4, s.vMax * 0.6);
  const vTd = s.vStallF * 1.25;
  s.landRoll = vTd * vTd / (2 * 0.43 * G) + vTd * 4;
  s.homeLen = p.real ? Math.min(4500, Math.max(600, Math.ceil((s.roll * 1.35 + 200) / 100) * 100)) : 600;
  s.rwyLen = Math.max(800, Math.ceil((s.landRoll * 2.4 + 300) / 100) * 100);
  return s;
}

// landing speed goes up where the air is thin (high airfields)
function approachSpeed(s, h) { return s.vStallF * 1.3 * Math.sqrt(RHO0 / (RHO0 * Math.exp(-Math.max(0, h) / 8500))); }
function mach(v, s) {
  if (s && s.supersonic) {   // drag spike through the sound barrier, then steady wave drag once supersonic
    const M = v / 340, up = Math.max(0, Math.min(1, (M - 0.9) / 0.25));
    return s.transCd * Math.exp(-Math.pow((M - 1.02) / 0.12, 2)) + s.waveCd * up * up * (3 - 2 * up);
  }
  return v > 200 ? 0.1 * Math.pow((v - 200) / 40, 2) : 0;
}
function thrust(s, v, throttle, rho) {
  if (s.supersonic) return s.thrust0 * throttle * Math.pow(rho / RHO0, 0.75) * (1 + 0.5 * Math.min(v / 340, 2.2));
  if (s.jet) return s.thrust0 * throttle * Math.pow(rho / RHO0, 0.75) * Math.max(0.3, 1 - v / 600);
  return ETA * s.power * 1000 * throttle * (rho / RHO0) / Math.max(v, s.vref);
}

function coeffs(s, alphaDeg, flaps) {
  const clmax = s.clmax + flaps * s.flapCl, cl0 = flaps * s.flapCl * 0.7, clmin = -0.9;
  const aStall = (clmax - cl0) / s.a * 180 / Math.PI;
  let cl = cl0 + s.a * alphaDeg * Math.PI / 180, stalled = false, extra = flaps > 0 ? 0.035 * Math.pow(flaps, 1.5) : 0.004 * -flaps;
  if (cl > clmax) {
    const over = alphaDeg - aStall;
    cl = clmax * (1 - 0.45 * Math.min(1, over / 6)); extra += 0.02 * over; stalled = true;
  } else if (cl < clmin) {
    const over = Math.abs(alphaDeg) - Math.abs((clmin - cl0) / s.a * 180 / Math.PI);
    cl = clmin * (1 - 0.45 * Math.min(1, over / 6)); extra += 0.02 * Math.max(0, over); stalled = true;
  }
  return { cl, cd: s.cd0 + cl * cl / (Math.PI * OSWALD * s.AR) + extra, stalled };
}


// ===== 2D world: positions are metres East (e) and North (n); headings in radians, 0 = north, + = clockwise =====
const DEG = Math.PI / 180;
const wrapDeg = a => { a = ((a + 180) % 360 + 360) % 360 - 180; return a; };
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const rwNum = h => String(((Math.round(((h / DEG) % 360 + 360) % 360 / 10) + 35) % 36) + 1).padStart(2, '0');
function rwDir(r) { return [Math.sin(r.hdg), Math.cos(r.hdg)]; }
function rwPt(r, a, c) { const s = Math.sin(r.hdg), co = Math.cos(r.hdg); return [r.e + s * a + co * c, r.n + co * a - s * c]; }
function rwLocal(r, e, n) { const s = Math.sin(r.hdg), co = Math.cos(r.hdg), de = e - r.e, dn = n - r.n; return [de * s + dn * co, de * co - dn * s]; }

function makeMissionWorld(s, seed) {
  let r = seed || (Math.random() * 1e9) | 0;
  const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  const home = s.homeLen, rl = s.rwyLen;
  const pp = pathParams(s), wid = s.span > 40 ? 60 : s.span > 20 ? 45 : 30;
  const start = Math.max(3500, home + 2500, Math.min(home, s.roll) + pp.cruise / Math.tan(pp.climb) + finalLen(s) + 4000);
  const reach = start + Math.max(3000, Math.min(15000, s.range * 0.3 - start));
  const dist = start + rnd() * (reach - start);
  const side = rnd() < 0.5 ? -1 : 1, bear = side * (20 + rnd() * 50) * DEG;
  const thdg = bear + (rnd() - 0.5) * 100 * DEG;
  const names = ['Kestrel Field', 'Marsh End', 'Hollow Down', 'Ridgeway', 'Saltings', 'Fenwick', 'Old Quarry', 'Brackenmoor'];
  const tlen = Math.round(rl * (1 + rnd() * 0.3));
  const tgt = { e: Math.sin(bear) * dist - Math.sin(thdg) * tlen / 2, n: Math.cos(bear) * dist - Math.cos(thdg) * tlen / 2, hdg: thdg, len: tlen, wid,
    kind: 'target', name: names[Math.floor(rnd() * names.length)] };
  const runways = [{ e: 0, n: 0, hdg: 0, len: home, wid: Math.max(30, wid), kind: 'home', name: 'Home field' }, tgt];
  const Ff = finalLen(s);
  let tries = 0, k = 0;
  while (runways.length < 6 && tries++ < 400) {
    const t = 0.25 + rnd() * 0.95, off = (k % 2 ? 1 : -1) * (700 + rnd() * 3500);
    const ce = Math.sin(bear) * dist * t + Math.cos(bear) * off, cn = Math.cos(bear) * dist * t - Math.sin(bear) * off;
    const len = Math.round(rl * (0.7 + rnd() * 0.5)), hdg = rnd() * 2 * Math.PI;
    const cand = { e: ce - Math.sin(hdg) * len / 2, n: ce === ce ? cn - Math.cos(hdg) * len / 2 : 0, hdg, len, wid, kind: 'fake', name: 'Closed strip' };
    const far = runways.every(w => Math.hypot(w.e - ce, w.n - cn) > Math.max(1800, rl * 1.4));
    const [a, c] = rwLocal(tgt, ce, cn);
    const inFinal = a < 300 && a > -(Ff + 2500) && Math.abs(c) < 900;
    if (far && !inFinal) { runways.push(cand); k++; }
  }
  for (const w of runways) { w.num = rwNum(w.hdg); w.elev = 0; }
  return { runways, target: tgt, home: runways[0], mode: 'mission' };
}
// ---------- Situation maps ----------
function seaWorld(runways, target, landAt, extra) {
  const water = (e, n) => !landAt(e, n);
  const raw = (e, n) => { for (const w of runways) if (w.kind === 'carrier') { const [a, c] = rwLocal(w, e, n); if (a > -20 && a < w.len + 15 && Math.abs(c) < w.wid / 2 + 12) return w.elev; } return 0; };
  return Object.assign({ runways, target, home: runways[0], water, raw, seaBase: true }, extra || {});
}
function makeSituationWorld(s, id, seed) {
  let r = seed || (Math.random() * 1e9) | 0;
  const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  const wid = s.span > 40 ? 60 : s.span > 20 ? 45 : 30, Ff = finalLen(s), pp = pathParams(s);
  let w;
  if (id === 'normal') {
    w = makeMissionWorld(s, seed); w.runways = w.runways.filter(x => x.kind !== 'fake');
    w.target.name = 'Lowmoor Regional';
  } else if (id === 'ocean') {
    const home = { e: 0, n: 0, hdg: 0, len: s.homeLen, wid: 30, kind: 'home', name: 'Gull Island', elev: 0 };
    const boat = { e: 900, n: 9000, hdg: 0, len: 500, wid: 120, kind: 'boat', name: 'rescue boat', elev: 0, num: '--' };
    w = seaWorld([home, boat], boat, (e, n) => Math.hypot(e, n - s.homeLen / 2) < 900, { start: { e: 0, n: 3200, h: Math.min(900, s.ceiling - 60), psi: 0, v: 50, engineOut: 4 } });
  } else if (id === 'himalaya') {
    w = makeMountainWorld(s, seed, { elev: 2300, ceilExtra: 600, peakMin: 350, peakRange: 1000, peaks: 95, lenMul: 1.7, names: ['Tiger Ridge (Paro-style valley)', 'Snow Leopard Field', 'Lhotse Valley Strip'] });
    const p0 = [Math.sin(Math.atan2(w.faf[0], w.faf[1])) * 0, 0];
    const L = Math.hypot(w.faf[0], w.faf[1]), ux = w.faf[0] / L, uy = w.faf[1] / L;
    w.start = { e: ux * L * 0.35, n: uy * L * 0.35, h: w.cruiseC, psi: Math.atan2(ux, uy), v: Math.max(s.vStall * 1.5, 110) };
  } else if (id === 'storm') {
    const thdg = rnd() * 2 * Math.PI, tlen = Math.round(s.rwyLen * 1.3);
    const home = { e: -40000, n: -40000, hdg: 0, len: s.homeLen, wid: 45, kind: 'home', name: 'Mainland', elev: 0 };
    const tgt = { e: 0, n: 0, hdg: thdg, len: tlen, wid, kind: 'target', name: 'Storm Island', elev: 0 };
    const tc = rwPt(tgt, tlen / 2, 0), st = rwPt(tgt, -14000, 0);
    w = seaWorld([home, tgt], tgt, (e, n) => Math.hypot(e - tc[0], n - tc[1]) < tlen / 2 + 1600 + 500 * Math.sin(Math.atan2(e - tc[0], n - tc[1]) * 3) || Math.hypot(e - home.e, n - home.n) < 2000,
      { turb: 2.6, fog: 0.55, rain: true, start: { e: st[0], n: st[1], h: Math.min(780, s.ceiling - 80), psi: thdg, v: Math.max(s.vStall * 1.45, 95) } });
  } else if (id === 'carrier') {
    const hdg = rnd() * 2 * Math.PI, cv = { e: 0, n: 0, hdg, len: 250, wid: 30, kind: 'carrier', name: 'the aircraft carrier', elev: 18, arrest: true };
    const st = rwPt(cv, -9000, 0);
    w = seaWorld([cv], cv, () => false, { start: { e: st[0], n: st[1], h: 18 + 9000 * Math.tan(pp.gs) + 40, psi: hdg, v: s.vStallF * 1.35 } });
  }
  for (const x of w.runways) { x.num = x.num || rwNum(x.hdg); if (x.elev === undefined) x.elev = 0; }
  w.mode = 'situation'; w.situation = id;
  return w;
}
// ---------- Random situations: a type, a map and a plane ----------
const NEW_TYPES = ['fuel', 'short', 'wind', 'power', 'medical'], NEW_MAPS = ['desert', 'arctic', 'night'];
function makeRandomSituation(s, type, map, seed) {
  let r = (seed || 1) ^ 0x5bd1e995;
  const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  const NM = { desert: ['Red Mesa Strip', 'Canyon Point', 'Dust Devil Field'], arctic: ['Polar Station Kilo', 'Icefjord', 'Snowcap Field'], night: ['Metro City International', 'Harbour Lights', 'Skyline Field'] }[map];
  let w;
  if (map === 'desert') { w = makeMountainWorld(s, seed, { elev: Math.round(120 + rnd() * 140), peakMin: 90, peakRange: 380, peaks: 60, names: NM }); }
  else { w = makeMissionWorld(s, seed); w.runways = w.runways.filter(x => x.kind !== 'fake'); w.target.name = NM[Math.floor(rnd() * NM.length)]; }
  w.theme = map; w.mode = 'situation'; w.situation = 'random'; w.sitType = type; w.map = map;
  const tg = w.target, pp = pathParams(s), Ff = finalLen(s);
  const route = Math.hypot(tg.e, tg.n) + Ff, cruiseV = Math.max(s.vStall * 1.35, Math.min(s.vMax * 0.6, s.vStall * 1.6));
  const tEst = route / cruiseV + 150;
  const ceilA = s.ceiling + (w && w.ceilAdd || 0);
  const fromFinal = d => { const p = rwPt(tg, -d, 0); return { e: p[0], n: p[1], h: Math.min((tg.elev || 0) + d * Math.tan(pp.gs) + 15, (tg.elev || 0) + s.ceiling - 80), psi: tg.hdg, v: approachSpeed(s, tg.elev || 0) * 1.12, thr: 0.45, flaps: 1 }; };
  if (type === 'fuel') w.leak = s.fuel / (tEst * 1.45);
  else if (type === 'short') { tg.len = Math.max(300, Math.round(s.landRoll * 1.45 + 60)); tg.name += ' (short strip)'; w.start = fromFinal(Math.min(Ff * 1.2, Ff + 1500)); }
  else if (type === 'wind') { const wv = Math.min(15, 0.32 * approachSpeed(s, tg.elev || 0)), side = rnd() < 0.5 ? 1 : -1, a = tg.hdg + side * Math.PI / 2; w.wind = [Math.sin(a) * wv, Math.cos(a) * wv]; w.windFrom = side; w.start = fromFinal(Math.min(Ff * 1.2, Ff + 1500)); }
  else if (type === 'power') { w.target = w.home; w.home.name = 'your home airfield'; w.powerLoss = { agl: 150, mul: 0.55 }; }
  else if (type === 'medical') w.timeLimit = Math.round(tEst * 1.45 / 10) * 10;
  for (const x of w.runways) x.num = rwNum(x.hdg);
  return w;
}
function makeWorld(s, seed, mode) { return mode === 'free' ? makeFreeWorld(s, seed) : mode === 'challenge' ? makeMountainWorld(s, seed) : makeMissionWorld(s, seed); }
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - ax - dx * t, py - ay - dy * t); }
function groundAt(world, e, n) { return world.raw ? world.raw(e, n) : 0; }
// somewhere it is safe to touch the ground: a runway, the flat plateau around one, or low farmland
function safeGround(world, e, n, gnd) { return gnd <= 20 || world.runways.some(w => { const [a, c] = rwLocal(w, e, n); return a > -400 && a < w.len + 400 && Math.abs(c) < w.wid / 2 + 340; }); }

// Free fly: open airfields all around, land anywhere
function makeFreeWorld(s, seed) {
  let r = seed || (Math.random() * 1e9) | 0;
  const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  const rl = s.rwyLen, wid = s.span > 40 ? 60 : s.span > 20 ? 45 : 30, scale = Math.max(1, rl / 1000);
  const names = ['Kestrel Field', 'Marsh End', 'Hollow Down', 'Ridgeway', 'Saltings', 'Fenwick', 'Old Quarry', 'Brackenmoor', 'Wethercombe', 'Lark Rise', 'Mill Green', 'Copper Beech'];
  const runways = [{ e: 0, n: 0, hdg: 0, len: s.homeLen, wid: Math.max(30, wid), kind: 'home', name: 'Home field' }];
  let tries = 0;
  while (runways.length < 11 && tries++ < 600) {
    const a = rnd() * 2 * Math.PI, d = (4000 + rnd() * 20000) * scale, ce = Math.sin(a) * d, cn = Math.cos(a) * d;
    if (!runways.every(w => Math.hypot(w.e - ce, w.n - cn) > Math.max(3500, rl * 2.5))) continue;
    const len = Math.round(rl * (1 + rnd() * 0.4)), hdg = rnd() * 2 * Math.PI;
    runways.push({ e: ce - Math.sin(hdg) * len / 2, n: cn - Math.cos(hdg) * len / 2, hdg, len, wid, kind: 'field', name: names[(runways.length - 1) % names.length] });
  }
  for (const w of runways) { w.num = rwNum(w.hdg); w.elev = 0; }
  return { runways, target: runways[1], home: runways[0], mode: 'free', free: true };
}

// Challenge: the target sits on a plateau in the mountains, reached through a valley
function makeMountainWorld(s, seed, opt) {
  opt = opt || {};
  let r = seed || (Math.random() * 1e9) | 0;
  const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  const pp = pathParams(s), rl = s.rwyLen, wid = s.span > 40 ? 60 : s.span > 20 ? 45 : 30, Ff = finalLen(s);
  const Hr = opt.elev || Math.round(300 + rnd() * 200), cruiseC = pp.cruise + Hr, ceil = s.ceiling + Hr + (opt.ceilExtra || 0);
  const lift = Math.min(s.homeLen, s.roll);
  const start = Math.max(s.homeLen + 3000, lift + cruiseC / Math.tan(pp.climb) + Ff + 7000);
  const dist = start + 2000 + rnd() * 6000;
  const bear = (rnd() < 0.5 ? -1 : 1) * (15 + rnd() * 45) * DEG, thdg = bear + (rnd() - 0.5) * 80 * DEG;
  const tlen = Math.round(rl * (1.15 + rnd() * 0.3) * (opt.lenMul || 1));
  const names = opt.names || ['Eagle Col', 'High Tarn', 'Stonehead Pass', 'Glen Corrie', 'Raven Crag', 'Cloudmoor', 'Hawk Ridge'];
  const tgt = { e: Math.sin(bear) * dist - Math.sin(thdg) * tlen / 2, n: Math.cos(bear) * dist - Math.cos(thdg) * tlen / 2, hdg: thdg, len: tlen, wid,
    kind: 'target', name: names[Math.floor(rnd() * names.length)], elev: Hr };
  const home = { e: 0, n: 0, hdg: 0, len: s.homeLen, wid: Math.max(30, wid), kind: 'home', name: 'Home field', elev: 0 };
  const faf = rwPt(tgt, -Ff, 0), tc = rwPt(tgt, tlen / 2, 0), legA = [Math.sin(bear) * lift * 0.5, Math.cos(bear) * lift * 0.5];
  const base = (e, n) => Hr * 0.8 * (1 - smooth(4000, 15000, Math.hypot(e - tc[0], n - tc[1]))) * smooth(2500, 6000, Math.hypot(e, n));
  const peaks = [];
  let tries = 0;
  while (peaks.length < (opt.peaks || 70) && tries++ < 3000) {
    const a = rnd() * 2 * Math.PI, d = 1200 + Math.sqrt(rnd()) * 11000, pe = tc[0] + Math.sin(a) * d, pn = tc[1] + Math.cos(a) * d;
    if (segDist(pe, pn, 0, 0, faf[0], faf[1]) < 1400) continue;
    const [a0, c0] = rwLocal(tgt, pe, pn);
    if (a0 > -(Ff + 2500) && a0 < tlen + 4500 && Math.abs(c0) < 1150) continue;
    if (Math.hypot(pe, pn) < 4000) continue;
    const top = Hr + (opt.peakMin || 150) + rnd() * Math.min(opt.peakRange || 520, ceil - Hr - (opt.peakMin || 150) - 60);
    peaks.push({ e: pe, n: pn, amp: Math.max(0, top - base(pe, pn)), r2: Math.pow(500 + rnd() * 800, 2) });
  }
  const gsT = Math.tan(pp.gs), clT = Math.tan(pp.climb);
  const raw = (e, n) => {
    let H = base(e, n);
    for (const p of peaks) { const d2 = (e - p.e) ** 2 + (n - p.n) ** 2; if (d2 < p.r2 * 9) H += p.amp * Math.exp(-d2 / p.r2); }
    H = Math.min(H, ceil - 60);
    // keep the route from home to the start of the final approach clear
    const dl = segDist(e, n, legA[0], legA[1], faf[0], faf[1]);
    if (dl < 1600) H = lerp(Math.min(H, cruiseC - 150), H, smooth(900, 1600, dl));
    const [a0, c] = rwLocal(tgt, e, n), along = -a0, ac = Math.abs(c);
    // valley along the final approach, and a clear climb-out past the far end
    if (along > -50 && along < Ff + 2500 && ac < 1300) H = lerp(Math.min(H, Hr + Math.max(0, along) * gsT - 60), H, smooth(650, 1300, ac));
    if (a0 > tlen && a0 < tlen + 4500 && ac < 1300) H = lerp(Math.min(H, Hr + (a0 - tlen) * clT * 0.7), H, smooth(650, 1300, ac));
    // flat plateau for the runway
    const out = Math.max(-a0 - 400, a0 - tlen - 400, ac - wid / 2 - 350, 0);
    if (out < 500) H = lerp(Hr, H, smooth(0, 500, out));
    return Math.max(0, H);
  };
  const cache = new Map();
  const terrain = (e, n) => { const k = e + ',' + n; let v = cache.get(k); if (v === undefined) { v = raw(e, n); if (cache.size > 300000) cache.clear(); cache.set(k, v); } return v; };
  for (const w of [home, tgt]) w.num = rwNum(w.hdg);
  return { runways: [home, tgt], target: tgt, home, mode: 'challenge', terrain, raw, elev: Hr, ceilAdd: Hr + (opt.ceilExtra || 0), peaks, faf, cruiseC };
}
function runwayAt(world, e, n) {
  return world.runways.find(w => { if (w.kind === 'boat') return false; const [a, c] = rwLocal(w, e, n); return a >= -5 && a <= w.len + 5 && Math.abs(c) <= w.wid / 2 + 4; }) || null;
}
function finalLen(s) { const pp = pathParams(s); return Math.max(6000, Math.min(14000, 1.3 * pp.cruise / Math.tan(pp.gs))); }

function newFlight(s, world) {
  return { x: 0, e: 0, n: 0, psi: 0, phi: 0, h: 0, vx: 0, vy: 0, theta: 0, throttle: 0, flaps: 1, flapSet: 1, brake: 0, fuel: s.fuel, ground: true, world,
    flew: false, t: 0, maxH: 0, maxV: 0, maxN: 1, gust: 0, stalled: false, n_: 1, nLoad: 1, alpha: 0, touchVy: 0, result: null };
}

function stepFlight(f, s, input, dt) {
  if (f.result) return;
  const mass = s.dry + f.fuel, pc = s.pitch;
  const v = Math.hypot(f.vx, f.vy);
  const gamma = v > 1 ? Math.atan2(f.vy, f.vx) / DEG : 0;
  const auth = Math.min(1, Math.max(0.15, v / 35)) * Math.pow(Math.min(1, 90 / Math.max(v, 1)), 0.6);
  const roll = input.roll || 0;
  const ceil = s.ceiling + (f.world.ceilAdd || 0);
  if (f.h > ceil - 40 && input.pitch > 0) input = { ...input, pitch: 0 };   // max height: nose-up is ignored

  if (f.ground) {
    if (input.pitch) f.theta += input.pitch * pc.rate * auth * dt;
    else f.theta -= Math.sign(f.theta) * Math.min(Math.abs(f.theta), 8 * dt);
    f.theta = Math.max(0, Math.min(13, f.theta));
    f.phi = 0;
    if (f.vx > 0.5) f.psi = wrap(f.psi + roll * Math.max(3, Math.min(25, 25 * 15 / f.vx)) * DEG * dt);
  } else {
    const turb = f.world.turb || 1;
    f.gust += (-f.gust * 1.5 + (Math.random() - 0.5) * pc.gust * 90 * turb) * dt;
    if (turb > 1) f.vy += (Math.random() - 0.5) * (turb - 1) * 9 * dt;
    // stunt planes: "nose up" is relative to the pilot, so upside down it pushes the nose towards the ground
    if (s.aero) {
      // stunt plane: the stick asks for a wing angle, from a hard push to just short of the stall, so loops stay clean
      const rho0 = RHO0 * Math.exp(-Math.max(0, f.h) / 8500), qq = 0.5 * rho0 * Math.max(v, 15) ** 2;
      const aStall = s.clmax / s.a / DEG, aTrim = Math.max(0, Math.min(0.6 * aStall, mass * G / (qq * s.S) / s.a / DEG));
      const aCmd = Math.max(-0.75 * aStall, Math.min(0.88 * aStall, aTrim + (input.pitch || 0) * 0.9 * aStall));
      const sg = Math.cos(f.phi * DEG) >= 0 ? 1 : -1, target = gamma + sg * (aCmd - s.inc);
      f.theta += wrapDeg(target - f.theta) * Math.min(1, 7 * dt) + f.gust * dt * 0.3;
    } else f.theta += (input.pitch || 0) * pc.rate * auth * dt
      + wrapDeg(gamma - f.theta) * pc.k * (input.pitch ? 0.25 : 1) * auth * dt + f.gust * dt;
    if (roll) { f.phi += roll * s.rollRate * dt; if (s.aero) f.rollAcc = (f.rollAcc || 0) + roll * s.rollRate * dt; }
    else if (!s.aero || Math.abs(f.phi) < 40) f.phi -= Math.sign(f.phi) * Math.min(Math.abs(f.phi), s.rollRate * 0.6 * dt);
    if (s.aero) f.phi = wrapDeg(f.phi); else f.phi = Math.max(-s.maxBank, Math.min(s.maxBank, f.phi));
    if (f.h > ceil - 40 && f.theta > Math.max(0, gamma) + 2) f.theta -= 10 * dt;   // max height: ease the nose down
    if (!s.aero) f.theta = Math.max(-60, Math.min(60, f.theta));
  }

  const sgn = Math.cos(f.phi * DEG) >= 0 ? 1 : -1;   // upside down, the wing meets the air from the other side
  const alpha = sgn * wrapDeg(f.theta - gamma) + s.inc;
  const rho = RHO0 * Math.exp(-Math.max(0, f.h) / 8500);
  const q = 0.5 * rho * v * v;
  const c = coeffs(s, alpha, f.flaps);
  const L = q * s.S * c.cl * (f.brake && f.ground ? 0.4 : 1), D = q * s.S * (c.cd + mach(v, s) + f.brake * (s.brakeCd || 0.06));
  const Lv = L * Math.cos(f.phi * DEG), Lh = L * Math.sin(f.phi * DEG);
  const ceilFade = Math.max(0.5, Math.min(1, (ceil - f.h) / 80));
  const ab = f.ab && s.abMult ? s.abMult : 1;
  if (f.world.powerLoss && f.flew && !f.powerMul && f.agl > f.world.powerLoss.agl) f.powerMul = f.world.powerLoss.mul;
  let T = f.fuel > 0 && !f.engineOut ? thrust(s, v, f.throttle, rho) * ceilFade * ab * (f.powerMul || 1) : 0;
  if (f.reverse && f.ground && f.fuel > 0) T = -0.55 * thrust(s, Math.max(v, 1), Math.max(f.throttle, 0.6), rho);   // reverse thrust: engines push backwards
  const ux = v > 0.5 ? f.vx / v : 1, uy = v > 0.5 ? f.vy / v : 0;
  const th = f.theta * DEG;
  let Fx = T * Math.cos(th) - D * ux - Lv * uy;
  let Fy = T * Math.sin(th) - D * uy + Lv * ux - mass * G;

  if (f.ground) {
    if (Fy <= 0) {
      const N = -Fy; Fy = 0;
      const onR = runwayAt(f.world, f.e, f.n);
      let mu = onR ? 0.03 : 0.12;
      if (onR && onR.arrest && f.flew) mu += 2.6;   // arrestor wire
      if ((f.throttle === 0 || f.brake || f.reverse) && f.flew) mu += 0.4;
      if (f.vx > 0) Fx -= Math.min(mu * N, f.vx * mass / dt + Fx);
    } else f.ground = false;
  }

  f.vx += Fx / mass * dt; f.vy += Fy / mass * dt;
  if (f.ground) { f.vy = 0; if (f.vx < 0) f.vx = 0; }
  if (!f.ground && f.vx > 5) f.psi = wrap(f.psi + Lh / (mass * f.vx) * dt);
  // past the vertical in a loop: describe the same attitude facing the other way (heading +180, pitch mirrored, rolled over)
  if (s.aero && !f.ground && f.vx < -1) {
    f.psi = wrap(f.psi + Math.PI); f.theta = wrapDeg(180 - f.theta); f.phi = wrapDeg(f.phi + 180); f.vx = -f.vx;
    f.halfLoops = (f.halfLoops || 0) + 1; f.lastHalf = f.t;
  }
  f.x += f.vx * dt; f.h += f.vy * dt;
  f.e += f.vx * Math.sin(f.psi) * dt; f.n += f.vx * Math.cos(f.psi) * dt;
  if (f.world.wind && !f.ground) { f.e += f.world.wind[0] * dt; f.n += f.world.wind[1] * dt; }
  if (f.world.leak && f.fuel > 0) f.fuel = Math.max(0, f.fuel - f.world.leak * dt);
  f.atCeil = f.h > ceil - 40;
  if (f.h > ceil) { f.h = ceil; if (f.vy > 0) f.vy = 0; }
  const gnd = groundAt(f.world, f.e, f.n); f.gnd = gnd; f.agl = f.h - gnd;
  if (f.ground && f.world.water && f.world.water(f.e, f.n) && !runwayAt(f.world, f.e, f.n)) { f.result = { kind: 'crash', why: 'You rolled off the end into the water. Next time land nearer the start and use the brakes.' }; return; }
  if (f.ground) { f.h = gnd; f.agl = 0; if (!safeGround(f.world, f.e, f.n, gnd)) { f.result = { kind: 'crash', why: 'Rolled off the runway and down the mountainside.' }; return; } }
  if (f.fuel > 0) f.fuel = Math.max(0, f.fuel - Math.max(f.throttle, f.reverse && f.ground ? 0.6 : 0) * s.burn * (ab > 1 ? 3 : 1) * dt);
  f.t += dt; f.alpha = alpha; f.stalled = c.stalled && !f.ground;
  f.nLoad = L / (mass * G);
  if (!f.ground && f.agl > 2) f.flew = true;
  if (!f.ground) f.maxN = Math.max(f.maxN, f.nLoad);
  f.maxH = Math.max(f.maxH, f.h); f.maxV = Math.max(f.maxV, v);

  if (!f.ground && f.nLoad > s.nlim) { f.result = { kind: 'crash', why: `The wings snapped at ${f.nLoad.toFixed(1)} g. This wing is rated to ${s.nlim.toFixed(1)} g.` }; return; }

  if (f.h <= gnd && !f.ground) {
    f.h = gnd; f.touchVy = -f.vy;
    if (f.world.water && f.world.water(f.e, f.n) && !runwayAt(f.world, f.e, f.n)) {
      const gentle = f.touchVy < 2.5 && Math.abs(f.phi) < 12 && v < s.vStall * 1.6 && f.theta > -3;
      const near = f.world.target.kind === 'boat' && Math.hypot(f.e - f.world.target.e, f.n - f.world.target.n) < 1500;
      f.result = gentle ? { kind: 'ditched', why: `Smooth water landing at ${Math.round(v * 3.6)} km/h, sinking ${f.touchVy.toFixed(1)} m/s. ${near ? 'Right next to the rescue boat, everyone is safe!' : 'You climb out and a rescue boat picks you up.'}` }
        : { kind: 'crash', why: `Hit the water too hard (${Math.round(v * 3.6)} km/h, sinking ${f.touchVy.toFixed(1)} m/s${Math.abs(f.phi) > 12 ? ', wings not level' : ''}). Glide in slowly, nose slightly up, wings level.` };
      return;
    }
    if (!safeGround(f.world, f.e, f.n, gnd)) { f.result = { kind: 'crash', why: `You flew into the mountainside at ${Math.round(gnd)} m. Watch the terrain warning and the height map.` }; return; }
    const deck = runwayAt(f.world, f.e, f.n), sinkMax = deck && deck.arrest ? 7.5 : 4;
    if (f.vy < -sinkMax) { f.result = { kind: 'crash', why: `Hit the ${deck && deck.arrest ? 'deck' : 'ground'} at ${(-f.vy).toFixed(1)} m/s descent. The landing gear survives up to ${sinkMax} m/s.` }; return; }
    if (f.theta < -4) { f.result = { kind: 'crash', why: 'Touched down nose-first. Raise the nose a little just before landing.' }; return; }
    if (Math.abs(f.phi) > 12) { f.result = { kind: 'crash', why: `A wingtip hit the ground (banked ${Math.abs(f.phi).toFixed(0)}°). Level the wings before touching down.` }; return; }
    if (f.world.wind) { const W = f.world.wind, ge = f.vx * Math.sin(f.psi) + W[0], gn = f.vx * Math.cos(f.psi) + W[1]; f.psi = Math.atan2(ge, gn); f.vx = Math.hypot(ge, gn); }   // kick out the crab: point the nose down the runway
    f.ground = true; f.vy = 0; f.phi = 0; if (f.theta < 0) f.theta = 0;
  }
  if (f.ground) {
    const sp = Math.hypot(f.vx, f.vy);
    if (f.flew && sp < 1 && f.world.free) {
      const w = runwayAt(f.world, f.e, f.n);
      f.landings = (f.landings || 0) + 1; f.lastLand = { name: w ? w.name + ' (runway ' + w.num + ')' : 'a field', t: f.t, sink: f.touchVy }; f.flew = false;
    }
    else if (f.flew && sp < 1) {
      const w = runwayAt(f.world, f.e, f.n), tg = f.world.target;
      const km = (Math.hypot(f.e - tg.e, f.n - tg.n) / 1000).toFixed(2) + ' km from';
      if (w && w.kind === 'carrier' && w === tg) f.result = { kind: 'win', why: `Trap! You caught the arrestor wire and stopped on the carrier deck. Touchdown sink rate ${f.touchVy.toFixed(1)} m/s.` };
      else if (w && w === tg && f.world.mode === 'situation' && f.world.situation === 'himalaya') f.result = { kind: 'win', why: `You landed in the Himalayas at ${tg.name}, ${tg.elev} m up! Touchdown sink rate ${f.touchVy.toFixed(1)} m/s.` };
      else if (w && w === tg && f.world.timeLimit && f.t > f.world.timeLimit) f.result = { kind: 'landed', why: `You landed at ${tg.name}, but ${Math.round(f.t - f.world.timeLimit)} s too late. Fly faster and take the shortest route.` };
      else if (w && (w.kind === 'target' || w === tg)) f.result = { kind: 'win', why: f.world.mode === 'challenge' ? `You landed in the mountains! Runway ${tg.num} at ${tg.name}, ${tg.elev} m up. Touchdown sink rate ${f.touchVy.toFixed(1)} m/s.` : `You stopped on runway ${tg.num} at ${tg.name}. Touchdown sink rate ${f.touchVy.toFixed(1)} m/s.` };
      else if (w && w.kind === 'fake') f.result = { kind: 'decoy', why: `That was a closed decoy strip, ${km} the real target.` };
      else if (w) f.result = { kind: 'landed', why: 'Safe landing back at the home field. The target is still out there.' };
      else f.result = { kind: 'landed', why: `Safe landing in a field, ${km} the target runway.` };
    }
    else if (!f.flew && !f.world.free && f.x > 60 && !runwayAt(f.world, f.e, f.n)) f.result = { kind: 'fail', why: 'Ran off the runway without lifting off.' };
    else if (!f.flew && !f.landings && sp < 0.5 && f.t > 20 && f.throttle > 0.9) f.result = { kind: 'fail', why: 'Not enough thrust to get rolling.' };
  }
}

function pathParams(s) {
  const gsDeg = s.vStallF > 45 ? 3 : 4, climbDeg = Math.max(3, Math.min(10, (s.tw - 0.1) * 30));
  return { gsDeg, gs: gsDeg * DEG, climbDeg, climb: climbDeg * DEG, cruise: Math.max(200, Math.min(450, Math.round(s.vStallF * 6 / 50) * 50)) };
}
// Guidance: where to steer (heading) and what climb angle to fly
function guide(f, s) {
  const tg = f.world.target, home = f.world.home;
  const v = Math.hypot(f.vx, f.vy);
  const { gsDeg, gs, climbDeg, climb, cruise } = pathParams(s);
  const Ff = finalLen(s), aimOff = Math.min(300, tg.len * 0.15);
  const [a0, cross] = rwLocal(tg, f.e, f.n), along = -a0;  // along > 0 before the threshold
  const faf = rwPt(tg, -Ff, 0);
  const captured = along > -tg.len && along < Ff * 1.3 && Math.abs(cross) < Math.max(tg.wid * 2, along * 0.5);
  const look = Math.max(300, 12 * v);
  let dtg, aimE, aimN;
  if (captured) {
    dtg = Math.max(0, along + aimOff);
    const ac = Math.max(-tg.len, along - Math.max(500, v * 10));
    [aimE, aimN] = rwPt(tg, -ac, 0);
  } else {
    const dF = Math.hypot(faf[0] - f.e, faf[1] - f.n);
    dtg = dF + Ff + aimOff; [aimE, aimN] = faf;
  }
  let wantHdg = Math.atan2(aimE - f.e, aimN - f.n);
  if (f.world.wind && v > 10) {   // crab into the wind so the ground track still points at the aim
    const W = f.world.wind, wp = W[0] * Math.cos(wantHdg) - W[1] * Math.sin(wantHdg);
    wantHdg = wrap(wantHdg + Math.asin(Math.max(-0.8, Math.min(0.8, -wp / v))));
  }
  const turn = f.ground ? 0 : wrap(wantHdg - f.psi) / DEG;
  const Hr = tg.elev || 0, cr = cruise + Hr, agl = f.agl === undefined ? f.h : f.agl;
  const lift = Math.min(home.len * 0.8, Math.max(40, s.roll));
  const alt = (odo, d) => Math.min(cr, Math.max(0, odo - lift) * Math.tan(climb), Hr + Math.max(0, d) * Math.tan(gs));
  const todDist = (Math.max(cr, f.h) - Hr) / Math.tan(gs), tocOdo = lift + cr / Math.tan(climb);
  const gamma = v > 1 ? Math.atan2(f.vy, f.vx) / DEG : 0;
  const lk = Math.min(look, Math.max(120, dtg * 0.5));
  let want = Math.atan2(alt(f.x + lk, dtg - lk) - f.h, lk) / DEG, phase;
  if (f.ground) { phase = f.flew ? 'rollout' : 'takeoff'; want = !f.flew && v > s.vLift ? Math.min(climbDeg, 8) : 0; }
  else if (captured && !tg.arrest && agl < Math.max(12, -f.vy * 3.5) && along < 900) { phase = 'flare'; want = s.aero ? -1.5 : s.vStallF < 40 ? -Math.max(1.2, Math.min(gsDeg * 0.8, agl * 0.45)) : -0.8; }
  else if (f.flew && along < 0 && !captured) { phase = 'goaround'; }
  else if (dtg < todDist) phase = 'approach';
  else if (f.x < tocOdo && f.h < cr - 20) phase = 'climb';
  else phase = 'cruise';
  if (phase === 'cruise' && Math.abs(f.h - cr) < 15) want = 0;
  want = Math.max(-8, Math.min(climbDeg, want));
  return { want, gamma, phase, turn, wantHdg, dtg, todDist, tocOdo, lift, alt, cruise: cr, Hr, gsDeg, climbDeg, captured, along, cross, faf, Ff };
}
if (typeof module !== 'undefined') module.exports = { makeRandomSituation, NEW_TYPES, NEW_MAPS, approachSpeed, makeSituationWorld, mach, thrust, coeffs, specs, newFlight, stepFlight, makeWorld, runwayAt, guide, rwPt, rwLocal, wrap, DEG, groundAt, safeGround };
