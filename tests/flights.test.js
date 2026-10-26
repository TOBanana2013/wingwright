// Flight tests: the shared autopilot must take off, fly and land every plane on every kind of map.
// Run: node --test tests/*.test.js      (exits with an error if any flight fails)
const test = require('node:test'), assert = require('node:assert');
const P = require('../src/physics.js'), REAL = require('../src/real.js'), A = require('./autopilot.js');

const flyable = Object.keys(REAL).filter(k => !REAL[k].hidden);
const describe = f => f.result ? `${f.result.kind}: ${f.result.why}` : `no result after ${Math.round(f.t)} s`;

for (const mode of ['mission', 'challenge', 'free']) {
  test(`${mode}: every plane takes off and lands`, () => {
    const fails = [];
    for (const k of flyable) {
      if (REAL[k].freeOnly && mode !== 'free') continue;   // free-fly-only planes can't be picked for other modes
      for (const seed of [3, 7, 11]) {
        const s = P.specs(REAL[k]), W = P.makeWorld(s, seed, mode), f = A.fly(s, W, { seed });
        if (!A.won(f, W)) fails.push(`${k} seed ${seed} -> ${describe(f)}`);
      }
    }
    assert.deepStrictEqual(fails, []);
  });
}

test('classic situations are all survivable', () => {
  const SIT = { normal: 'atr72', ocean: 'c172', himalaya: 'a320', storm: 'b747', carrier: 'f35c' }, fails = [];
  for (const seed of [3, 7, 11, 19, 23]) for (const [id, k] of Object.entries(SIT)) {
    const s = P.specs(REAL[k]), W = P.makeSituationWorld(s, id, seed), f = A.fly(s, W, { seed, start: W.start, maxT: 1500 });
    if (!A.won(f, W)) fails.push(`${id} (${k}) seed ${seed} -> ${describe(f)}`);
  }
  assert.deepStrictEqual(fails, []);
});

test('random situations: every type on every map', () => {
  const planes = ['c172', 'spit', 'a380', 'dhc6', 'b787'], fails = [];
  let i = 0;
  for (const type of P.NEW_TYPES) for (const map of P.NEW_MAPS) for (const k of planes) {
    const seed = 5 + (i++ % 3) * 4, s = P.specs(REAL[k]), W = P.makeRandomSituation(s, type, map, seed);
    const f = A.fly(s, W, { seed, start: W.start, maxT: 2400 });
    if (!(f.result && f.result.kind === 'win')) fails.push(`${type}/${map}/${k} seed ${seed} -> ${describe(f)}`);
  }
  assert.deepStrictEqual(fails, []);
});

test('build-your-own designs in every size class fly', () => {
  const D = {   // the starting designs from the hangar (PRESETS in template.html)
    ultra: { length: 5.5, height: 1.0, width: 0.8, span: 9, chord: 1.2, incidence: 3, power: 45, fuel: 30, material: 'carbon', shape: 'rounded', tail: 'medium' },
    trainer: { length: 8.5, height: 1.3, width: 1.1, span: 10, chord: 1.5, incidence: 3, power: 120, fuel: 100, material: 'alu', shape: 'rounded', tail: 'medium' },
    bush: { length: 12, height: 1.8, width: 1.6, span: 16, chord: 2, incidence: 3, power: 500, fuel: 300, material: 'alu', shape: 'boxy', tail: 'large' },
    airliner: { length: 45, height: 5, width: 5, span: 50, chord: 6, incidence: 3, power: 6000, fuel: 8000, material: 'alu', shape: 'rounded', tail: 'large' },
    lifter: { length: 75, height: 8, width: 8, span: 85, chord: 10, incidence: 3, power: 15000, fuel: 25000, material: 'alu', shape: 'boxy', tail: 'large' },
    whale: { length: 150, height: 16, width: 16, span: 200, chord: 20, incidence: 3, power: 60000, fuel: 100000, material: 'carbon', shape: 'rounded', tail: 'large' },
    mega: { length: 250, height: 25, width: 25, span: 330, chord: 32, incidence: 3, power: 180000, fuel: 300000, material: 'carbon', shape: 'boxy', tail: 'large' }
  }, fails = [];
  for (const mode of ['mission', 'challenge', 'free']) for (const [k, d] of Object.entries(D)) for (const seed of [3, 7]) {
    const s = P.specs(d), W = P.makeWorld(s, seed, mode), f = A.fly(s, W, { seed });
    if (!A.won(f, W)) fails.push(`${mode} ${k} seed ${seed} -> ${describe(f)}`);
  }
  assert.deepStrictEqual(fails, []);
});

test('guard mode: Air Force One crosses every ocean route and lands', () => {
  const s = P.specs(REAL.b121b), fails = [];
  for (const id of Object.keys(P.GUARD_ROUTES)) {
    const W = P.makeGuardWorld(s, id, 3), f = A.fly(s, W, { seed: 3, skip: true, maxT: 200000 });
    if (!A.won(f, W)) fails.push(`${id} -> ${describe(f)}`);
    else if (f.fuel < s.fuel * 0.2) fails.push(`${id} -> landed with only ${Math.round(100 * f.fuel / s.fuel)}% fuel`);
  }
  assert.deepStrictEqual(fails, []);
});
