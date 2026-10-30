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

// Seeded random numbers (mulberry32). Math.imul keeps the maths exact in 32 bits, so the same seed always
// gives the same world. No seed (undefined/null) means a random one; seed 0 is a real seed.
function makeRng(seed) {
  let a = (seed ?? Math.floor(Math.random() * 4294967296)) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}
// a different but repeatable seed for a world built inside another world builder
const subSeed = (seed, k) => seed === undefined || seed === null ? undefined : Math.imul((seed >>> 0) ^ Math.imul(k, 0x9e3779b9), 0x5bd1e995) >>> 0;

function specs(p) {
  const tl = TAILS[p.tail];
  let s;
  if (p.fixed) {
    const S = p.S, AR = p.span * p.span / S;
    s = { S, AR, mass: p.mass, dry: p.mass - p.fuel, cd0: p.cd0, nlim: p.nlim, clmax: p.clmax, flapCl: p.flapCl,
      jet: p.engine === 'jet', supersonic: !!p.supersonic, ramMax: p.ramMax || 2.2, abMult: p.abMult || 0, transCd: p.transCd || 0, waveCd: p.waveCd || 0, thrust0: p.thrust || 0, power: p.power || 0, vThrustMin: p.vThrustMin || 29,
      front: p.width * p.height * 0.8, burn: p.fuel / (0.65 * 1200) };
  } else {
    const mat = MATERIALS[p.material], sh = SHAPES[p.shape];
    const S = p.span * p.chord, AR = p.span / p.chord;
    const front = p.width * p.height * 0.8, wet = 2 * (p.width + p.height) * p.length * 0.85;
    const dry = S * mat.wing + wet * mat.skin + sh.mass + tl.mass + 35 + 0.85 * p.power + 80;
    s = { S, AR, mass: dry + p.fuel, dry, front, cd0: (sh.cd * front + 0.004 * wet) / S + tl.cd + 0.006,
      nlim: mat.n * Math.pow(Math.min(1, 9 / AR), 0.7), clmax: 1.45, flapCl: 0.6,
      jet: false, power: p.power, vThrustMin: 29, burn: p.power * 0.001 };
  }
  s.inc = p.incidence; s.fuel = p.fuel; s.brakeCd = p.brakeCd || 0; s.fixed = !!p.fixed; s.span = p.span;
  // how far the nose can rise on the runway before the tail hits it (tail-wheel planes already sit tail-down)
  s.tailStrike = p.tailWheel ? 15 : Math.max(7, Math.min(15, Math.atan2(gearH(p) + 0.35 * p.height, 0.45 * p.length) / DEG));
  // the sink rate the landing gear survives: airliner gear is built for about 3 m/s, light planes take a little more
  s.sinkMax = p.sinkMax || (s.mass > 40000 ? 3.2 : 4);
  s.nlimNeg = -0.4 * s.nlim;
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
  // runways are sized for the plane: long enough to take off (home) and to land and stop (other fields), wide enough for the wings
  s.rwyLen = Math.min(9000, Math.max(400, Math.ceil(p.length * 4 / 100) * 100, Math.ceil((s.landRoll * 2.4 + 300) / 100) * 100));
  // home is long enough to take off, and also to land back on (power loss, free fly)
  s.homeLen = Math.min(9000, Math.max(s.rwyLen, Math.ceil((s.roll * 1.35 + 200) / 100) * 100));
  s.rwyWid = s.span > 80 ? Math.min(260, Math.round(s.span * 0.7 / 5) * 5) : s.span > 40 ? 60 : s.span > 20 ? 45 : 30;
  return s;
}

// landing speed goes up where the air is thin (high airfields)
function approachSpeed(s, h) { return s.vStallF * 1.3 * Math.sqrt(RHO0 / (RHO0 * Math.exp(-Math.max(0, h) / 8500))); }
// speed of sound: 340 m/s at sea level, falling with the temperature to about 295 m/s above 11 km
function soundSpeed(h) { return 20.05 * Math.sqrt(Math.max(216.65, 288.15 - 0.0065 * Math.max(0, h || 0))); }
function mach(v, s, h) {
  if (s && s.supersonic) {   // drag spike through the sound barrier, then steady wave drag once supersonic
    const M = v / soundSpeed(h), up = Math.max(0, Math.min(1, (M - 0.9) / 0.25));
    return s.transCd * Math.exp(-Math.pow((M - 1.02) / 0.12, 2)) + s.waveCd * up * up * (3 - 2 * up);
  }
  return v > 200 ? 0.1 * Math.pow((v - 200) / 40, 2) : 0;
}
function thrust(s, v, throttle, rho, h) {
  if (s.supersonic) return s.thrust0 * throttle * Math.pow(rho / RHO0, 0.75) * (1 + 0.5 * Math.min(v / soundSpeed(h), s.ramMax || 2.2));   // ram air: more thrust the faster you go, up to ramMax (Mach)
  if (s.jet) return s.thrust0 * throttle * Math.pow(rho / RHO0, 0.75) * Math.max(0.3, 1 - v / 600);
  // propeller: thrust = efficiency x power / speed, but a propeller can't make unlimited thrust standing still,
  // so below vThrustMin (a per-plane speed, not the aviation 'Vref') thrust stops growing
  return ETA * s.power * 1000 * throttle * (rho / RHO0) / Math.max(v, s.vThrustMin);
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
  const rnd = makeRng(seed);
  const home = s.homeLen, rl = s.rwyLen;
  const pp = pathParams(s), wid = s.rwyWid;
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
  const raw = (e, n) => { for (const w of runways) if (w.kind === 'carrier' && onStrip(w, e, n)) return w.elev; return 0; };   // the deck: same rectangle runwayAt() uses
  return Object.assign({ runways, target, home: runways[0], water, raw, seaBase: true }, extra || {});
}
function makeSituationWorld(s, id, seed) {
  const rnd = makeRng(seed);
  const wid = s.rwyWid, Ff = finalLen(s), pp = pathParams(s);
  let w;
  if (id === 'normal') {
    w = makeMissionWorld(s, subSeed(seed, 1)); w.runways = w.runways.filter(x => x.kind !== 'fake');
    w.target.name = 'Lowmoor Regional';
  } else if (id === 'ocean') {
    const home = { e: 0, n: 0, hdg: 0, len: s.homeLen, wid: 30, kind: 'home', name: 'Gull Island', elev: 0 };
    const boat = { e: 900, n: 9000, hdg: 0, len: 500, wid: 120, kind: 'boat', name: 'rescue boat', elev: 0, num: '--' };
    w = seaWorld([home, boat], boat, (e, n) => Math.hypot(e, n - s.homeLen / 2) < 900, { start: { e: 0, n: 3200, h: Math.min(900, s.ceiling - 60), psi: 0, v: 50, engineOut: 4 } });
  } else if (id === 'himalaya') {
    w = makeMountainWorld(s, subSeed(seed, 2), { elev: 2300, ceilExtra: 600, peakMin: 350, peakRange: 1000, peaks: 95, lenMul: 1.7, names: ['Tiger Ridge (Paro-style valley)', 'Snow Leopard Field', 'Lhotse Valley Strip'] });
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
  const rnd = makeRng(subSeed(seed, 3));
  const NM = { desert: ['Red Mesa Strip', 'Canyon Point', 'Dust Devil Field'], arctic: ['Polar Station Kilo', 'Icefjord', 'Snowcap Field'], night: ['Metro City International', 'Harbour Lights', 'Skyline Field'] }[map];
  let w;
  if (map === 'desert') { w = makeMountainWorld(s, subSeed(seed, 4), { elev: Math.round(120 + rnd() * 140), peakMin: 90, peakRange: 380, peaks: 60, names: NM }); }
  else { w = makeMissionWorld(s, subSeed(seed, 5)); w.runways = w.runways.filter(x => x.kind !== 'fake'); w.target.name = NM[Math.floor(rnd() * NM.length)]; }
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
// ---------- Guard mode: fly the President between real airports, across the sea ----------
// Airport positions are real (latitude/longitude); the runway is lengthened if the plane needs more.
// land: a round patch of land around the airport, centre offset [east, north] in km and radius in km, so the coast sits
// roughly where it really is. Everywhere else is sea.
const AIRPORTS = {
  andrews: { name: 'Joint Base Andrews', city: 'Washington, D.C.', lat: 38.811, lon: -76.867, hdg: 10, len: 3353, land: [-150, 0, 300] },
  stansted: { name: 'London Stansted', city: 'London', lat: 51.885, lon: 0.235, hdg: 43, len: 3049, land: [-200, 0, 260] },
  travis: { name: 'Travis Air Force Base', city: 'California', lat: 38.263, lon: -121.927, hdg: 34, len: 3353, land: [200, 50, 280] },
  hickam: { name: 'Joint Base Pearl Harbor-Hickam', city: 'Honolulu, Hawaii', lat: 21.319, lon: -157.922, hdg: 82, len: 3749, land: [0, 15, 22] },
  yokota: { name: 'Yokota Air Base', city: 'Tokyo', lat: 35.749, lon: 139.348, hdg: 358, len: 3353, land: [-100, 150, 230] }
};
const GUARD_ROUTES = {
  atlantic: { from: 'andrews', to: 'stansted', title: 'Washington to London', sea: 'the Atlantic Ocean' },
  homebound: { from: 'stansted', to: 'andrews', title: 'London to Washington', sea: 'the Atlantic Ocean' },
  hawaii: { from: 'travis', to: 'hickam', title: 'California to Hawaii', sea: 'the Pacific Ocean' },
  japan: { from: 'hickam', to: 'yokota', title: 'Hawaii to Tokyo', sea: 'the Pacific Ocean' }
};
// great-circle distance (m) and starting compass bearing (rad) between two airports
function greatCircle(a, b) {
  const R = 6371000, f1 = a.lat * DEG, f2 = b.lat * DEG, dl = (b.lon - a.lon) * DEG;
  const h = Math.sin((f2 - f1) / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  const d = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  const brg = Math.atan2(Math.sin(dl) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl));
  return { d, brg };
}
function guardCruise(s) { return Math.min(9000, s.ceiling - 1500); }
// a steady cruising speed (true airspeed) at cruise height: comfortably above the stall up there
function guardSpeed(s) { const hc = guardCruise(s); return Math.max(s.vStall * 1.6, Math.min(s.vMax * 0.75, s.vStall * 1.35 * Math.exp(hc / 17000) * 1.25)); }
function makeGuardWorld(s, routeId, seed) {
  const R0 = GUARD_ROUTES[routeId] || GUARD_ROUTES.atlantic, A = AIRPORTS[R0.from], B = AIRPORTS[R0.to];
  const gc = greatCircle(A, B), wid = Math.max(45, s.rwyWid);
  const place = (ap, ce, cn, kind) => { const hdg = ap.hdg * DEG, len = Math.max(ap.len, kind === 'home' ? s.homeLen : s.rwyLen);
    return { e: ce - Math.sin(hdg) * len / 2, n: cn - Math.cos(hdg) * len / 2, hdg, len, wid, kind, name: ap.name, city: ap.city, elev: 0, realLen: ap.len }; };
  const home = place(A, 0, 0, 'home'), tgt = place(B, Math.sin(gc.brg) * gc.d, Math.cos(gc.brg) * gc.d, 'target');
  const blobs = [[A, 0, 0], [B, Math.sin(gc.brg) * gc.d, Math.cos(gc.brg) * gc.d]].map(([ap, e, n]) => ({ e: e + ap.land[0] * 1000, n: n + ap.land[1] * 1000, r: ap.land[2] * 1000 }));
  // a wobbly coastline, so the shore is not a perfect circle
  const landAt = (e, n) => blobs.some(b => { const a = Math.atan2(e - b.e, n - b.n); return Math.hypot(e - b.e, n - b.n) < b.r * (1 + 0.08 * Math.sin(a * 5) + 0.05 * Math.sin(a * 11 + 1)); });
  const cruiseAlt = guardCruise(s), cruiseV = guardSpeed(s);
  // fuel: real long-haul jets burn slowly enough to cross an ocean; scale the burn so a full tank lands with about 40% left
  const tCruise = gc.d / cruiseV, burnMul = Math.min(1, s.fuel * 0.6 / (tCruise * 0.75 * s.burn));
  const w = seaWorld([home, tgt], tgt, landAt, { mode: 'guard', guard: routeId, route: R0, dist: gc.d, cruiseAlt, cruiseV, burnMul, from: A, to: B });
  for (const x of w.runways) x.num = rwNum(x.hdg);
  return w;
}
// Skip the long, quiet middle of the flight: jump ahead along the route to just before the descent point,
// using up the time and fuel that stretch would really take. Returns the distance skipped (m), or 0 if not now.
function cruiseSkip(f, s, g) {
  if (f.ground || !g || g.phase !== 'cruise' || g.captured) return 0;
  const v = Math.hypot(f.vx, f.vy), keep = g.todDist + 40000, dist = g.dtg - g.Ff - keep;
  if (dist < 30000 || v < s.vStall) return 0;
  const [ae, an] = g.faf, de = ae - f.e, dn = an - f.n, L = Math.hypot(de, dn), k = Math.min(1, dist / L);
  const vc = f.world.cruiseV || v, secs = dist / vc, used = 0.75 * s.burn * (f.world.burnMul || 1) * secs;
  if (used >= f.fuel) return 0;
  f.e += de * k; f.n += dn * k; f.psi = Math.atan2(de, dn); f.phi = 0; f.slip = 0;
  f.fuel -= used; f.t += secs; f.x += dist; f.skipped = (f.skipped || 0) + secs;
  return dist;
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
  const rnd = makeRng(seed);
  const rl = s.rwyLen, wid = s.rwyWid, scale = Math.max(1, rl / 1000);
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
  const rnd = makeRng(seed);
  const pp = pathParams(s), rl = s.rwyLen, wid = s.rwyWid, Ff = finalLen(s);
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
  // for drawing: heights on a 4 m grid, so nearby lookups share one calculation (the physics uses raw() directly)
  const terrain = (e, n) => { const qe = Math.round(e / 4) * 4, qn = Math.round(n / 4) * 4, k = qe * 1e6 + qn; let v = cache.get(k); if (v === undefined) { v = raw(qe, qn); if (cache.size > 300000) cache.clear(); cache.set(k, v); } return v; };
  for (const w of [home, tgt]) w.num = rwNum(w.hdg);
  return { runways: [home, tgt], target: tgt, home, mode: 'challenge', terrain, raw, elev: Hr, ceilAdd: Hr + (opt.ceilExtra || 0), peaks, faf, cruiseC };
}
function onStrip(w, e, n) { const [a, c] = rwLocal(w, e, n); return a >= -5 && a <= w.len + 5 && Math.abs(c) <= w.wid / 2 + 4; }
function runwayAt(world, e, n) {
  return world.runways.find(w => w.kind !== 'boat' && onStrip(w, e, n)) || null;
}
function finalLen(s) { const pp = pathParams(s); return Math.max(6000, Math.min(14000, 1.3 * pp.cruise / Math.tan(pp.gs))); }

function newFlight(s, world, seed) {
  const h0 = world.home || { e: 0, n: 0, hdg: 0 };   // line up at the start of the home runway
  return { x: 0, e: h0.e, n: h0.n, psi: h0.hdg, phi: 0, h: 0, vx: 0, vy: 0, theta: 0, throttle: 0, flaps: 1, flapSet: 1, brake: 0, fuel: s.fuel, ground: true, world,
    flew: false, t: 0, maxH: 0, maxV: 0, maxN: 1, gust: 0, stalled: false, n_: 1, nLoad: 1, alpha: 0, touchVy: 0, result: null,
    slip: 0, scrape: 0, rng: makeRng(subSeed(seed, 9)) };
}
// angle between a heading and a runway, ignoring which end you land from (0 = lined up)
function lineUp(psi, rw) { const d = Math.abs(wrap(psi - rw.hdg)) / DEG; return Math.min(d, 180 - d); }

// One physics step. f.vx is the speed along the nose (through the air when flying, over the ground when rolling),
// f.vy the climb rate. f.slip is how far the nose points away from where the plane moves through the air (rudder).
function stepFlight(f, s, input, dt) {
  if (f.result) return;
  const rnd = f.rng || Math.random;
  const mass = s.dry + f.fuel, pc = s.pitch, W = f.world.wind;
  // on the ground a headwind already blows over the wings, so lift and drag use airspeed, not ground speed
  const windAlong = f.ground && W ? W[0] * Math.sin(f.psi) + W[1] * Math.cos(f.psi) : 0;
  const vxA = f.vx - windAlong;
  const v = Math.hypot(vxA, f.vy);
  const gamma = v > 1 ? Math.atan2(f.vy, vxA) / DEG : 0;
  const auth = Math.min(1, Math.max(0.15, v / 35)) * Math.pow(Math.min(1, 90 / Math.max(v, 1)), 0.6);
  let roll = input.roll || 0;
  const ceil = s.ceiling + (f.world.ceilAdd || 0), hPrev = f.h;
  // close to the ground Left/Right work the rudder: they swing the nose without banking (to line up for touchdown)
  const rudder = !f.ground && !s.aero && (f.agl ?? f.h) < 15 && f.flew;

  if (f.ground) {
    if (input.pitch) f.theta += input.pitch * pc.rate * auth * dt;
    else f.theta -= Math.sign(f.theta) * Math.min(Math.abs(f.theta), 8 * dt);
    // the tail touches the runway at s.tailStrike; holding the nose up past it scrapes the tail
    if (f.theta >= s.tailStrike) {
      f.theta = s.tailStrike;
      if (input.pitch > 0 && f.vx > 15) f.scrape += dt; else f.scrape = Math.max(0, f.scrape - dt);
      if (f.scrape > 0.5) { f.result = { kind: 'crash', why: `Tail strike! You pulled the nose up too far (${s.tailStrike.toFixed(0)}°) on the runway. Ease the nose up gently at lift-off speed.` }; return; }
    } else f.scrape = Math.max(0, f.scrape - dt);
    f.tailWarn = f.theta > s.tailStrike - 2 && f.vx > 15 && !s.aero;
    f.theta = Math.max(0, f.theta);
    f.phi = 0; f.slip = 0;
    if (f.vx > 0.5) f.psi = wrap(f.psi + roll * Math.max(3, Math.min(25, 25 * 15 / f.vx)) * DEG * dt);
  } else {
    const turb = f.world.turb || 1, sq = Math.sqrt(dt);
    // gusts are random noise: their size grows with the square root of the step, so every frame rate feels the same
    f.gust += -f.gust * 1.5 * dt + (rnd() - 0.5) * pc.gust * 5.8 * turb * sq;
    if (turb > 1) f.vy += (rnd() - 0.5) * (turb - 1) * 0.58 * sq;
    if (s.aero) {
      // stunt plane: the stick asks for a wing angle, from a hard push to just short of the stall, so loops stay clean
      const rho0 = RHO0 * Math.exp(-Math.max(0, f.h) / 8500), qq = 0.5 * rho0 * Math.max(v, 15) ** 2;
      const aStall = s.clmax / s.a / DEG, aTrim = Math.max(0, Math.min(0.6 * aStall, mass * G / (qq * s.S) / s.a / DEG));
      const aCmd = Math.max(-0.75 * aStall, Math.min(0.88 * aStall, aTrim + (input.pitch || 0) * 0.9 * aStall));
      const sg = Math.cos(f.phi * DEG) >= 0 ? 1 : -1, target = gamma + sg * (aCmd - s.inc);
      f.theta += wrapDeg(target - f.theta) * Math.min(1, 7 * dt) + f.gust * dt * 0.3;
    } else f.theta += (input.pitch || 0) * pc.rate * auth * dt
      + wrapDeg(gamma - f.theta) * pc.k * (input.pitch ? 0.25 : 1) * auth * dt + f.gust * dt;
    const kick = rudder && roll;
    if (kick) { const d = Math.max(-30, Math.min(30, f.slip + roll * 20 * dt)) - f.slip; f.psi = wrap(f.psi + d * DEG); f.slip += d; roll = 0; }
    if (roll) { f.phi += roll * s.rollRate * dt; if (s.aero) f.rollAcc = (f.rollAcc || 0) + roll * s.rollRate * dt; }
    else if (!s.aero || Math.abs(f.phi) < 40) f.phi -= Math.sign(f.phi) * Math.min(Math.abs(f.phi), s.rollRate * 0.6 * dt);
    if (!kick) { const back = f.slip * Math.min(1, 1.2 * dt); f.slip -= back; f.psi = wrap(f.psi - back * DEG); }   // rudder centred: the nose swings back in line with the air
    // a real stall: the nose drops and a wing goes down
    if (f.stalled && !s.aero) { f.theta -= 5 * dt; if (!f.dropDir) f.dropDir = rnd() < 0.5 ? -1 : 1; f.phi += f.dropDir * 14 * dt; } else f.dropDir = 0;
    if (s.aero) f.phi = wrapDeg(f.phi); else f.phi = Math.max(-s.maxBank, Math.min(s.maxBank, f.phi));
    if (!s.aero) f.theta = Math.max(-60, Math.min(60, f.theta));
  }

  const sgn = Math.cos(f.phi * DEG) >= 0 ? 1 : -1;   // upside down, the wing meets the air from the other side
  const alpha = sgn * wrapDeg(f.theta - gamma) + s.inc;
  const rho = RHO0 * Math.exp(-Math.max(0, f.h) / 8500);
  const q = 0.5 * rho * v * v;
  const c = coeffs(s, alpha, f.flaps);
  // ground effect: within about one wingspan of the ground the wing makes less induced drag and a little more lift
  const hb = Math.max(0, f.ground ? 0 : (f.agl ?? f.h)) / s.span, ge = hb < 1 ? Math.pow(16 * hb, 2) / (1 + Math.pow(16 * hb, 2)) : 1;
  const cdi = c.cl * c.cl / (Math.PI * OSWALD * s.AR);
  const L = q * s.S * c.cl * (f.brake && f.ground ? 0.4 : 1) * (1 + 0.06 * Math.max(0, 1 - hb));
  const D = q * s.S * (c.cd - cdi * (1 - ge) + mach(v, s, f.h) + f.brake * (s.brakeCd || 0.06) + 0.0006 * Math.abs(f.slip));
  const Lv = L * Math.cos(f.phi * DEG), Lh = L * Math.sin(f.phi * DEG);
  // max height: the engines fade smoothly over the last 250 m as the air gets too thin (no invisible wall)
  const ceilFade = Math.max(0, Math.min(1, (ceil + 50 - f.h) / 250));
  const ab = f.ab && s.abMult ? s.abMult : 1;
  if (f.world.powerLoss && f.flew && !f.powerMul && f.agl > f.world.powerLoss.agl) f.powerMul = f.world.powerLoss.mul;
  let T = f.fuel > 0 && !f.engineOut ? thrust(s, v, f.throttle, rho, f.h) * ceilFade * ab * (f.powerMul || 1) : 0;
  if (f.reverse && f.ground && f.fuel > 0) T = -0.55 * thrust(s, Math.max(v, 1), Math.max(f.throttle, 0.6), rho);   // reverse thrust: engines push backwards
  const ux = v > 0.5 ? vxA / v : 1, uy = v > 0.5 ? f.vy / v : 0;
  const th = f.theta * DEG;
  let Fx = T * Math.cos(th) - D * ux - Lv * uy;
  let Fy = T * Math.sin(th) - D * uy + Lv * ux - mass * G;

  const wasGround = f.ground;
  if (f.ground) {
    if (Fy <= 0) {
      const N = -Fy; Fy = 0;
      const onR = runwayAt(f.world, f.e, f.n);
      let mu = onR ? 0.03 : 0.12;
      if (onR && onR.arrest && f.flew) mu += 2.6;   // arrestor wire
      if (f.brake || f.reverse || (f.throttle === 0 && f.flew)) mu += 0.4;   // brakes work any time; after landing, idle throttle brakes too
      if (f.vx > 0) Fx -= Math.min(mu * N, f.vx * mass / dt + Fx);
    } else f.ground = false;
  }

  f.vx += Fx / mass * dt; f.vy += Fy / mass * dt;
  if (f.ground) { f.vy = 0; if (f.vx < 0) f.vx = 0; }
  if (wasGround && !f.ground) {
    // lift-off: from now on f.vx is airspeed. With wind, the air moves past at an angle, so the nose is slightly off the air path
    if (W) { const ge0 = f.vx * Math.sin(f.psi) - W[0], gn0 = f.vx * Math.cos(f.psi) - W[1]; f.vx = Math.hypot(ge0, gn0); f.slip = Math.max(-20, Math.min(20, wrap(f.psi - Math.atan2(ge0, gn0)) / DEG)); }
  }
  if (!f.ground && f.vx > 5) f.psi = wrap(f.psi + Lh / (mass * f.vx) * dt);
  // past the vertical in a loop: describe the same attitude facing the other way (heading +180, pitch mirrored, rolled over)
  if (s.aero && !f.ground && f.vx < -1) {
    f.psi = wrap(f.psi + Math.PI); f.theta = wrapDeg(180 - f.theta); f.phi = wrapDeg(f.phi + 180); f.vx = -f.vx;
    f.halfLoops = (f.halfLoops || 0) + 1; f.lastHalf = f.t;
  }
  const chi = f.psi - f.slip * DEG;   // the direction the plane actually moves through the air
  f.x += f.vx * dt; f.h += f.vy * dt;
  if (f.ground) { f.e += f.vx * Math.sin(f.psi) * dt; f.n += f.vx * Math.cos(f.psi) * dt; }
  else { f.e += f.vx * Math.sin(chi) * dt; f.n += f.vx * Math.cos(chi) * dt; if (W) { f.e += W[0] * dt; f.n += W[1] * dt; } }
  if (f.world.leak && f.fuel > 0) f.fuel = Math.max(0, f.fuel - f.world.leak * dt);
  f.atCeil = f.h > ceil - 60;
  if (f.h > ceil + 150) { f.h = ceil + 150; if (f.vy > 0) f.vy = 0; }   // safety net only; the engines have faded long before this
  const gnd = groundAt(f.world, f.e, f.n); f.gnd = gnd; f.agl = f.h - gnd;
  if (f.ground && f.world.water && f.world.water(f.e, f.n) && !runwayAt(f.world, f.e, f.n)) { f.result = { kind: 'crash', why: 'You rolled off the end into the water. Next time land nearer the start and use the brakes.' }; return; }
  if (f.ground) { f.h = gnd; f.agl = 0; if (!safeGround(f.world, f.e, f.n, gnd)) { f.result = { kind: 'crash', why: 'Rolled off the runway and down the mountainside.' }; return; } }
  if (f.fuel > 0) f.fuel = Math.max(0, f.fuel - Math.max(f.throttle, f.reverse && f.ground ? 0.6 : 0) * s.burn * (ab > 1 ? 3 : 1) * (f.world.burnMul || 1) * dt);
  f.t += dt; f.alpha = alpha; f.stalled = c.stalled && !f.ground;
  f.nLoad = L / (mass * G);
  if (!f.ground && f.agl > 2) f.flew = true;
  if (!f.ground) f.maxN = Math.max(f.maxN, f.nLoad);
  f.maxH = Math.max(f.maxH, f.h); f.maxV = Math.max(f.maxV, v);

  if (!f.ground && f.nLoad > s.nlim) { f.result = { kind: 'crash', why: `The wings snapped at ${f.nLoad.toFixed(1)} g. This wing is rated to ${s.nlim.toFixed(1)} g.` }; return; }
  if (!f.ground && f.nLoad < s.nlimNeg) { f.result = { kind: 'crash', why: `The wings snapped pushing over at ${f.nLoad.toFixed(1)} g. Wings are weaker pushed down than pulled up (this one takes ${s.nlimNeg.toFixed(1)} g).` }; return; }

  // flying into the side of the carrier is not a deck landing
  const here = runwayAt(f.world, f.e, f.n);
  if (!f.ground && here && here.kind === 'carrier' && hPrev < here.elev - 1) { f.result = { kind: 'crash', why: 'You flew into the side of the aircraft carrier. Stay on the green line: it brings you over the back of the deck, not into the hull.' }; return; }

  if (f.h <= gnd && !f.ground) {
    f.h = gnd; f.touchVy = -f.vy;
    if (f.world.water && f.world.water(f.e, f.n) && !here) {
      const gentle = f.touchVy < 2.5 && Math.abs(f.phi) < 12 && v < s.vStall * 1.6 && f.theta > -3;
      const near = f.world.target.kind === 'boat' && Math.hypot(f.e - f.world.target.e, f.n - f.world.target.n) < 1500;
      f.result = gentle ? { kind: 'ditched', why: `Smooth water landing at ${Math.round(v * 3.6)} km/h, sinking ${f.touchVy.toFixed(1)} m/s. ${near ? 'Right next to the rescue boat, everyone is safe!' : 'You climb out and a rescue boat picks you up.'}` }
        : { kind: 'crash', why: `Hit the water too hard (${Math.round(v * 3.6)} km/h, sinking ${f.touchVy.toFixed(1)} m/s${Math.abs(f.phi) > 12 ? ', wings not level' : ''}). Glide in slowly, nose slightly up, wings level.` };
      return;
    }
    if (!safeGround(f.world, f.e, f.n, gnd)) { f.result = { kind: 'crash', why: `You flew into the mountainside at ${Math.round(gnd)} m. Watch the terrain warning and the height map.` }; return; }
    const sinkMax = here && here.arrest ? 7.5 : s.sinkMax;
    if (f.vy < -sinkMax) { f.result = { kind: 'crash', why: `Hit the ${here && here.arrest ? 'deck' : 'ground'} at ${(-f.vy).toFixed(1)} m/s descent. This plane's landing gear survives up to ${sinkMax} m/s.` }; return; }
    if (f.theta < -4) { f.result = { kind: 'crash', why: 'Touched down nose-first. Raise the nose a little just before landing.' }; return; }
    if (Math.abs(f.phi) > 12) { f.result = { kind: 'crash', why: `A wingtip hit the ground (banked ${Math.abs(f.phi).toFixed(0)}°). Level the wings before touching down.` }; return; }
    // the wheels only roll the way the nose points: any sideways movement over the ground has to be scrubbed off
    const ge1 = f.vx * Math.sin(chi) + (W ? W[0] : 0), gn1 = f.vx * Math.cos(chi) + (W ? W[1] : 0);
    const along = ge1 * Math.sin(f.psi) + gn1 * Math.cos(f.psi), side = ge1 * Math.cos(f.psi) - gn1 * Math.sin(f.psi);
    f.touchSide = side;
    if (Math.abs(side) > 6) { f.result = { kind: 'crash', why: `Touched down sliding sideways at ${Math.round(Math.abs(side) * 3.6)} km/h and the plane spun off the runway. In a crosswind, use Left/Right just before touchdown to point the nose straight down the runway.` }; return; }
    f.ground = true; f.vy = 0; f.phi = 0; f.slip = 0; f.vx = Math.max(0, along); if (f.theta < 0) f.theta = 0;
    // remember where the wheels first touched: that is what counts for the landing
    f.td = { rw: here, ang: here ? lineUp(f.psi, here) : 90, t: f.t };
  }
  if (f.ground) {
    const sp = Math.hypot(f.vx, f.vy);
    if (f.flew && sp < 1 && f.world.free) {
      const w = runwayAt(f.world, f.e, f.n), td = f.td && f.td.rw;
      const onRw = w && td === w && f.td.ang < 20;
      f.landings = (f.landings || 0) + 1; f.lastLand = { name: onRw ? w.name + ' (runway ' + w.num + ')' : 'a field', rw: onRw ? w : null, t: f.t, sink: f.touchVy }; f.flew = false;
    }
    else if (f.flew && sp < 1) {
      const w = runwayAt(f.world, f.e, f.n), tg = f.world.target, td = f.td || { rw: null, ang: 90 };
      const km = (Math.hypot(f.e - tg.e, f.n - tg.n) / 1000).toFixed(2) + ' km from';
      const onTarget = w === tg && td.rw === tg && td.ang < 20;
      if (w === tg && td.rw !== tg) f.result = { kind: 'landed', why: `You touched down ${td.rw ? 'on ' + td.rw.name : 'off the runway'} and rolled onto ${tg.name}. A landing only counts when the wheels touch the runway itself.` };
      else if (w === tg && td.ang >= 20) f.result = { kind: 'landed', why: `You touched down across the runway (${Math.round(td.ang)}° off). Line up with the centre line before landing.` };
      else if (onTarget && w.kind === 'carrier') f.result = { kind: 'win', why: `Trap! You caught the arrestor wire and stopped on the carrier deck. Touchdown sink rate ${f.touchVy.toFixed(1)} m/s.` };
      else if (onTarget && f.world.mode === 'situation' && f.world.situation === 'himalaya') f.result = { kind: 'win', why: `You landed in the Himalayas at ${tg.name}, ${tg.elev} m up! Touchdown sink rate ${f.touchVy.toFixed(1)} m/s.` };
      else if (onTarget && f.world.mode === 'guard') f.result = { kind: 'win', why: `Air Force One is down safely at ${tg.name} (${tg.city}). Touchdown sink rate ${f.touchVy.toFixed(1)} m/s.` };
      else if (onTarget && f.world.timeLimit && f.t > f.world.timeLimit) f.result = { kind: 'landed', why: `You landed at ${tg.name}, but ${Math.round(f.t - f.world.timeLimit)} s too late. Fly faster and take the shortest route.` };
      else if (onTarget) f.result = { kind: 'win', why: f.world.mode === 'challenge' ? `You landed in the mountains! Runway ${tg.num} at ${tg.name}, ${tg.elev} m up. Touchdown sink rate ${f.touchVy.toFixed(1)} m/s.` : `You stopped on runway ${tg.num} at ${tg.name}. Touchdown sink rate ${f.touchVy.toFixed(1)} m/s.` };
      else if (td.rw && td.rw.kind === 'fake') f.result = { kind: 'decoy', why: `That was a closed decoy strip, ${km} the real target.` };
      else if (w) f.result = { kind: 'landed', why: 'Safe landing back at the home field. The target is still out there.' };
      else f.result = { kind: 'landed', why: `Safe landing in a field, ${km} the target runway.` };
    }
    else if (!f.flew && !f.world.free && f.x > 60 && !runwayAt(f.world, f.e, f.n)) f.result = { kind: 'fail', why: 'Ran off the runway without lifting off.' };
    else if (!f.flew && !f.landings && sp < 0.5 && f.t > 20 && f.throttle > 0.9 && !f.brake) f.result = { kind: 'fail', why: 'Not enough thrust to get rolling.' };
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
  const Hr = tg.elev || 0, cr = (f.world.cruiseAlt || cruise) + Hr, agl = f.agl === undefined ? f.h : f.agl;
  const lift = Math.min(home.len * 0.8, Math.max(40, s.roll));
  const alt = (odo, d) => Math.min(cr, Math.max(0, odo - lift) * Math.tan(climb), Hr + Math.max(0, d) * Math.tan(gs));
  const todDist = (Math.max(cr, f.h) - Hr) / Math.tan(gs), tocOdo = lift + cr / Math.tan(climb);
  const gamma = v > 1 ? Math.atan2(f.vy, f.vx) / DEG : 0;
  const lk = Math.min(look, Math.max(120, dtg * 0.5));
  let want = Math.atan2(alt(f.x + lk, dtg - lk) - f.h, lk) / DEG, phase;
  if (f.ground) { phase = f.flew ? 'rollout' : 'takeoff'; want = !f.flew && v > s.vLift ? Math.min(climbDeg, 8) : 0; }
  else if (captured && !tg.arrest && agl < Math.max(12, -f.vy * 3.5) && along < 900) { phase = 'flare'; want = s.aero ? -1.5 : s.vStallF < 40 ? -Math.max(1.2, Math.min(gsDeg * 0.8, agl * 0.45)) : -0.8; }
  else if (f.flew && along < 0 && !captured && Math.hypot(f.e - tg.e, f.n - tg.n) < 40000) { phase = 'goaround'; }   // past the runway (not on a long trip that just starts out behind it)
  else if (dtg < todDist) phase = 'approach';
  else if (f.x < tocOdo && f.h < cr - 20) phase = 'climb';
  else phase = 'cruise';
  if (phase === 'cruise' && Math.abs(f.h - cr) < 15) want = 0;
  if (captured && phase === 'approach') want = Math.max(want, -gsDeg * 1.6);   // never dive steeply at the runway: too fast a sink rate can't be flared
  want = Math.max(-8, Math.min(climbDeg, want));
  return { want, gamma, phase, turn, wantHdg, dtg, todDist, tocOdo, lift, alt, cruise: cr, Hr, gsDeg, climbDeg, captured, along, cross, faf, Ff };
}
if (typeof module !== 'undefined') module.exports = { AIRPORTS, GUARD_ROUTES, greatCircle, makeGuardWorld, cruiseSkip, guardSpeed, soundSpeed, makeRng, subSeed, lineUp, pathParams, finalLen, makeRandomSituation, NEW_TYPES, NEW_MAPS, approachSpeed, makeSituationWorld, mach, thrust, coeffs, specs, newFlight, stepFlight, makeWorld, runwayAt, guide, rwPt, rwLocal, wrap, DEG, groundAt, safeGround };
