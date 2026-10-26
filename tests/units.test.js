// Small checks of the physics rules. Run: node --test tests/*.test.js
const test = require('node:test'), assert = require('node:assert');
const P = require('../src/physics.js'), REAL = require('../src/real.js');
const STEP = 1 / 120;

test('lift has no sudden jump at the stall', () => {
  const s = P.specs(REAL.c172);
  for (const flaps of [0, 1]) {
    let prev = P.coeffs(s, -10, flaps).cl;
    for (let a = -10; a <= 30; a += 0.05) { const cl = P.coeffs(s, a, flaps).cl; assert.ok(Math.abs(cl - prev) < 0.05, `jump of ${(cl - prev).toFixed(3)} at ${a.toFixed(2)}°`); prev = cl; }
  }
});

test('every plane has sensible numbers', () => {
  for (const [k, p] of Object.entries(REAL)) {
    const s = P.specs(p), kmh = v => v * 3.6;
    assert.ok(kmh(s.vStall) > 40 && kmh(s.vStall) < 400, `${k} stall speed ${kmh(s.vStall)}`);
    assert.ok(s.vStallF < s.vStall, `${k} flaps should lower the stall speed`);
    assert.ok(Number.isFinite(s.roll) && s.roll < s.homeLen, `${k} take-off roll ${s.roll} must fit the ${s.homeLen} m home runway`);
    assert.ok(s.landRoll < s.rwyLen, `${k} landing roll must fit the runway`);
    assert.ok(s.vMax > s.vStall, `${k} must be able to fly level`);
    assert.ok(s.tailStrike >= 7 && s.tailStrike <= 15, `${k} tail-strike angle`);
  }
});

test('the same seed always builds the same world, and seed 0 is a real seed', () => {
  const s = P.specs(REAL.a320), strip = w => JSON.stringify(w, (key, v) => typeof v === 'function' ? undefined : v);
  for (const seed of [0, 1, 123456789]) {
    for (const mode of ['mission', 'challenge', 'free']) assert.strictEqual(strip(P.makeWorld(s, seed, mode)), strip(P.makeWorld(s, seed, mode)), `${mode} ${seed}`);
    for (const id of ['normal', 'ocean', 'himalaya', 'storm', 'carrier']) assert.strictEqual(strip(P.makeSituationWorld(s, id, seed)), strip(P.makeSituationWorld(s, id, seed)), `${id} ${seed}`);
    assert.strictEqual(strip(P.makeRandomSituation(s, 'wind', 'desert', seed)), strip(P.makeRandomSituation(s, 'wind', 'desert', seed)));
  }
  assert.notStrictEqual(strip(P.makeWorld(s, 1, 'mission')), strip(P.makeWorld(s, 2, 'mission')));
  const r = P.makeRng(5), a = Array.from({ length: 1000 }, r);
  assert.ok(a.every(x => x >= 0 && x < 1) && new Set(a).size === 1000, 'random numbers stay in [0, 1) and do not repeat');
});

// a plane in the air just above the target runway's touchdown zone, lined up
function overRunway(key, opts = {}) {
  const s = P.specs(REAL[key]), W = P.makeWorld(s, 3, 'mission'), tg = W.target, f = P.newFlight(s, W, 1);
  const [e, n] = P.rwPt(tg, opts.along ?? 200, opts.cross ?? 0);
  Object.assign(f, { e, n, h: 0.3, psi: tg.hdg + (opts.yaw || 0) * P.DEG, vx: s.vStallF * 1.2, vy: opts.vy ?? -1, theta: opts.theta ?? 3, phi: opts.phi || 0, ground: false, flew: true, x: 1e5, flaps: 1, throttle: 0, brake: 1 });
  for (let i = 0; i < 120 * 120 && !f.result; i++) P.stepFlight(f, s, { pitch: 0, roll: 0 }, STEP);
  return f;
}
test('touchdown rules', () => {
  assert.strictEqual(overRunway('c172').result.kind, 'win');
  assert.strictEqual(overRunway('c172', { vy: -6 }).result.kind, 'crash', 'too hard');
  assert.strictEqual(overRunway('a320', { vy: -3.6 }).result.kind, 'crash', 'airliner gear is built for about 3 m/s');
  assert.strictEqual(overRunway('c172', { phi: 20 }).result.kind, 'crash', 'wingtip');
  assert.strictEqual(overRunway('c172', { theta: -6 }).result.kind, 'crash', 'nose first');
  assert.strictEqual(overRunway('c172', { yaw: 60 }).result.kind, 'landed', 'across the runway does not count');
  assert.strictEqual(overRunway('c172', { cross: 80 }).result.kind, 'landed', 'touching down beside the runway does not count');
});

test('flying into the side of the carrier is a crash, not a landing', () => {
  const s = P.specs(REAL.f35c), W = P.makeSituationWorld(s, 'carrier', 4), cv = W.target, f = P.newFlight(s, W, 1);
  const [e, n] = P.rwPt(cv, -40, 0);
  Object.assign(f, { e, n, h: 8, psi: cv.hdg, vx: 70, vy: 0, theta: 2, ground: false, flew: true, x: 1e5, flaps: 1, throttle: 0.5 });
  for (let i = 0; i < 600 && !f.result; i++) P.stepFlight(f, s, { pitch: 0, roll: 0 }, STEP);
  assert.strictEqual(f.result && f.result.kind, 'crash');
  assert.match(f.result.why, /side of the aircraft carrier/);
});

test('brakes hold the plane before the first take-off', () => {
  const s = P.specs(REAL.c172), W = P.makeWorld(s, 3, 'mission'), f = P.newFlight(s, W, 1);
  f.throttle = 1; for (let i = 0; i < 120 * 4; i++) P.stepFlight(f, s, { pitch: 0, roll: 0 }, STEP);
  const v = f.vx; f.throttle = 0; f.brake = 1;
  for (let i = 0; i < 120 * 8; i++) P.stepFlight(f, s, { pitch: 0, roll: 0 }, STEP);
  assert.ok(v > 10 && f.vx < 0.5, `rolling at ${v.toFixed(1)} m/s, then braked to ${f.vx.toFixed(2)} m/s`);
});

test('turbulence feels the same at any step size', () => {
  const s = P.specs(REAL.c172), W = P.makeWorld(s, 3, 'free');
  const spread = dt => { const f = P.newFlight(s, W, 7); Object.assign(f, { h: 500, vx: 55, ground: false, flew: true, x: 1e5, flaps: 0, throttle: 0.6 }); let sum = 0, n = 0;
    for (let t = 0; t < 60; t += dt) { P.stepFlight(f, s, { pitch: 0, roll: 0 }, dt); sum += f.gust * f.gust; n++; } return Math.sqrt(sum / n); };
  const a = spread(1 / 30), b = spread(1 / 240);
  assert.ok(a / b > 0.6 && a / b < 1.6, `gust size ${a.toFixed(3)} at 30 steps/s vs ${b.toFixed(3)} at 240 steps/s`);
});
