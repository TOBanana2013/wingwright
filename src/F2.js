// ---------- FIGHT: battle types (modern jets, bomber run, WW2 dogfight) ----------
const WW2 = { uk: { name: 'Britain', plane: 'spit', side: 'allies' }, usa: { name: 'USA', plane: 'p51', side: 'allies' }, ussr: { name: 'Soviet Union', plane: 'yak3', side: 'allies' },
  ger: { name: 'Germany', plane: 'fw190', side: 'axis' }, jpn: { name: 'Japan', plane: 'zero', side: 'axis' } };
const SHORT = { fw190: 'Fw 190', zero: 'Zero', spit: 'Spitfire', p51: 'Mustang', yak3: 'Yak-3', redhawk: 'Red Hawk', f35: 'F-35', f22: 'F-22' };
const BOMBERS = {
  b17: { label: 'B-17 Flying Fortress', bombs: 12, stick: 2, blast: 40, hp: 400, era: 'ww2', red: ['fw190'], alt: 2500, guns: { range: 900, dps: 22, n: 3 },
    text: '1943 over Europe. Thirteen machine guns: your gunners fire by themselves. Mustangs escort you; Fw 190s defend the factory.' },
  b29: { label: 'B-29 Superfortress', bombs: 20, stick: 2, blast: 40, hp: 350, era: 'ww2', red: ['zero'], alt: 3000, guns: { range: 1000, dps: 24, n: 2 },
    text: '1945 over the Pacific. Faster and higher than the B-17, with remote-controlled gun turrets. Zeros come up to meet you.' },
  sbd: { label: 'SBD Dauntless', bombs: 4, stick: 1, blast: 25, hp: 150, era: 'ww2', red: ['zero'], alt: 3000, ships: true, guns: { range: 600, dps: 14, n: 1, tail: true },
    text: 'Dive bomber, 1942. Find the enemy fleet, then dive steeply with the airbrake (B) out and drop right on the ship. Pull up after!' },
  b52: { label: 'B-52H Stratofortress', bombs: 36, stick: 3, blast: 45, hp: 300, era: 'jet', alt: 3000, guns: { range: 1200, dps: 18, n: 1, tail: true },
    text: 'Eight engines and the biggest bomb load. A tail gun covers your back; F-22s and F-35s escort you. Flares on G.' },
  b1b: { label: 'B-1B Lancer', bombs: 24, stick: 2, blast: 40, hp: 250, era: 'jet', alt: 2500, guided: true,
    text: 'Fast swing-wing bomber with afterburners (X). GPS bombs steer a little towards the target. No guns: use speed and flares (G).' },
  b2: { label: 'B-2 Spirit', bombs: 16, stick: 1, blast: 40, hp: 250, era: 'jet', alt: 3500, guided: true, stealth: true,
    text: 'Stealth bomber: radar hardly sees you, so fighters only notice you up close and the flak is wild. You fly alone.' }
};
const ERA_NOTE = 'Bombs fall forward as well as down: watch the bomb sight (bottom left) and drop when the target is inside the circle.';
let fightKind = 'jets', bomberKey = 'b17', ww2Key = 'uk';
function fightPlane() { return fightKind === 'bomber' ? bomberKey : fightKind === 'ww2' ? WW2[ww2Key].plane : fightJet; }
function fightPanelHTML() {
  const opt = (name, id, val, cur, label) => `<input type="radio" name="${name}" id="${id}" value="${val}" ${cur === val ? 'checked' : ''}><label class="o" for="${id}">${label}</label>`;
  let h = `<div class="seg"><span class="label">Battle type</span><div class="opts">${opt('fk', 'fk-jets', 'jets', fightKind, 'Modern jets')}${opt('fk', 'fk-bomber', 'bomber', fightKind, 'Bomber run')}${opt('fk', 'fk-ww2', 'ww2', fightKind, 'WW2 dogfight')}</div></div>`;
  if (fightKind === 'jets') h += `<div class="seg"><span class="label">Your jet</span><div class="opts two">${opt('fj', 'fj-f35', 'f35', fightJet, 'F-35A Lightning II')}${opt('fj', 'fj-f22', 'f22', fightJet, 'F-22A Raptor')}</div></div>`;
  else if (fightKind === 'bomber') h += `<div class="seg"><span class="label">Your bomber</span><div class="opts">${Object.keys(BOMBERS).map(k => opt('bk', 'bk-' + k, k, bomberKey, BOMBERS[k].label)).join('')}</div><span class="hint">${BOMBERS[bomberKey].text}</span></div>`;
  else h += `<div class="seg"><span class="label">Your country</span><div class="opts">${Object.keys(WW2).map(k => opt('wc', 'wc-' + k, k, ww2Key, `${WW2[k].name}: ${SHORT[WW2[k].plane]}`)).join('')}</div><span class="hint">${WW2[ww2Key].side === 'allies' ? 'You fly for the Allies against German Fw 190s and Japanese Zeros.' : 'You fly for the Axis against British Spitfires, American Mustangs and Soviet Yak-3s.'} Guns only, no missiles: get close and hold Space.</span></div>`;
  h += `<div class="seg"><span class="label">${fightKind === 'bomber' ? 'Enemy fighters' : 'Battle'}</span><div class="opts">${[1, 2, 8].map(n => opt('fs', 'fs-' + n, n, fightSize, fightKind === 'bomber' ? ['Few (2)', 'Some (4)', 'Many (8)'][[1, 2, 8].indexOf(n)] : `${n} v ${n}`)).join('')}</div>`;
  h += `<span class="hint">${fightKind === 'jets' ? 'Enemy “Red Hawk” jets are made up for the game. Keys: Space gun · F missile · T next target · G flares.' : fightKind === 'bomber' ? 'Destroy every target. Space drops bombs. ' + ERA_NOTE : 'Hit planes trail smoke and the pilot bails out with a parachute. Keys: Space guns · T next target.'}</span></div>`;
  return h;
}
function bindFightPanel(p) {
  const on = (n, fn) => p.querySelectorAll(`input[name=${n}]`).forEach(i => i.addEventListener('change', () => { fn(i.value); usePlane(fightPlane()); buildModePanel(); }));
  on('fk', v => fightKind = v); on('fj', v => fightJet = v); on('bk', v => bomberKey = v); on('wc', v => ww2Key = v); on('fs', v => fightSize = +v);
}
function bomberWorld() {
  const B = BOMBERS[bomberKey];
  if (B.ships) { const home = { e: 0, n: 0, hdg: 0, len: spec.homeLen, wid: 30, kind: 'home', name: 'Island airfield', elev: 0, num: '36' }; return seaWorld([home], home, (e, n) => Math.hypot(e, n - home.len / 2) < home.len / 2 + 700); }
  return makeWorld(spec, worldSeed, 'free');
}
// ground and sea targets
function boxF(F, x0, x1, y0, y1, z0, z1, c) { const P = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  for (const q of [[4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) F(q.map(i => P[i]), c); }
function cylF(F, r, z0, z1, c, n = 12) { const ring = z => Array.from({ length: n }, (_, i) => [r * Math.cos(2 * Math.PI * i / n), r * Math.sin(2 * Math.PI * i / n), z]);
  const A = ring(z0), B = ring(z1); for (let i = 0; i < n; i++) F([A[i], A[(i + 1) % n], B[(i + 1) % n], B[i]], c); F(B, c.map(v => v * 1.08)); }
function hullF(F, L, W, z1, c, deck) { const pl = [[-L / 2, -W / 2], [L / 2 - L * 0.16, -W / 2], [L / 2, 0], [L / 2 - L * 0.16, W / 2], [-L / 2, W / 2]];
  for (let i = 0; i < pl.length; i++) { const a = pl[i], b = pl[(i + 1) % pl.length]; F([[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], z1], [a[0], a[1], z1]], c); }
  F(pl.map(q => [q[0], q[1], z1]), deck); }
function targetFaces(t) {
  const fc = [], F = (p, c) => fc.push({ p, c });
  if (t.type === 'factory') { boxF(F, -35, 35, -20, 20, 0, 16, [150, 138, 120]); for (let i = 0; i < 4; i++) F([[-35 + i * 17.5, -20, 16], [-35 + i * 17.5, 20, 16], [-26 + i * 17.5, 20, 22], [-26 + i * 17.5, -20, 22]], [120, 124, 128]); boxF(F, 22, 27, -14, -9, 0, 38, [130, 80, 62]); }
  else if (t.type === 'hangar') { boxF(F, -25, 25, -15, 15, 0, 9, [112, 124, 106]); for (const s of [-1, 1]) F([[-25, s * 15, 9], [25, s * 15, 9], [25, 0, 16], [-25, 0, 16]], [96, 108, 92]); for (const x of [-25, 25]) F([[x, -15, 9], [x, 15, 9], [x, 0, 16]], [104, 116, 98]); }
  else if (t.type === 'tank') { cylF(F, 13, 0, 13, [206, 208, 200]); }
  else if (t.type === 'radar') { boxF(F, -8, 8, -8, 8, 0, 5, [140, 140, 136]); boxF(F, -2.5, 2.5, -2.5, 2.5, 5, 20, [170, 172, 170]); F(Array.from({ length: 12 }, (_, i) => { const a = 2 * Math.PI * i / 12; return [3 + Math.sin(a) * 1.5, Math.cos(a) * 8, 26 + Math.sin(a) * 6]; }), [228, 230, 232]); }
  else if (t.type === 'carrier') { hullF(F, t.len, t.wid, 14, [104, 112, 120], [86, 90, 88]); boxF(F, -20, 18, t.wid / 2 - 9, t.wid / 2 - 2, 14, 32, [110, 118, 126]); F([[t.len / 2 - 60, -1, 14.1], [-t.len / 2 + 10, -1, 14.1], [-t.len / 2 + 10, 1, 14.1], [t.len / 2 - 60, 1, 14.1]], [220, 220, 210]); }
  else { hullF(F, t.len, t.wid, 7, [100, 108, 116], [120, 124, 126]); boxF(F, 0, 24, -3.5, 3.5, 7, 15, [118, 126, 134]); boxF(F, -12, -5, -2, 2, 7, 18, [70, 72, 76]); boxF(F, 30, 38, -2, 2, 7, 10, [90, 94, 98]); }
  return fc;
}
function makeTargets(B) {
  const T = [];
  if (B.ships) {
    const c = [2500, 14000], hdg = Math.PI / 2;
    T.push({ type: 'carrier', name: 'Enemy carrier', e: c[0], n: c[1], psi: hdg, len: 240, wid: 30, hp: 200, sp: 7 });
    T.push({ type: 'destroyer', name: 'Enemy destroyer', e: c[0] + 700, n: c[1] + 500, psi: hdg, len: 110, wid: 12, hp: 100, sp: 7 });
  } else {
    let zc = [0, B.era === 'jet' ? 24000 : 16000];
    for (let k = 0; k < 12 && world.runways.some(r => Math.hypot(r.e - zc[0], r.n - zc[1]) < 2500); k++) zc = [zc[0] + 3000, zc[1]];
    const types = [['factory', 'Factory', 200, 36], ['hangar', 'Hangar', 100, 26], ['tank', 'Fuel tank', 100, 14], ['tank', 'Fuel tank', 100, 14], ['radar', 'Radar', 100, 12]];
    for (const [type, name, hp, r] of types) {
      let p, k = 0; do { const a = Math.random() * 2 * Math.PI, d = 120 + Math.random() * 520; p = [zc[0] + Math.sin(a) * d, zc[1] + Math.cos(a) * d]; } while (k++ < 50 && T.some(t => Math.hypot(t.e - p[0], t.n - p[1]) < 190));
      T.push({ type, name, e: p[0], n: p[1], psi: Math.random() * Math.PI, r, hp, sp: 0 });
    }
  }
  for (const t of T) { t.alive = true; t.hp0 = t.hp; t.sink = 0; t.faces = targetFaces(t); t.dead = t.faces.map(f => ({ p: f.p, c: f.c.map(v => v * 0.32) })); }
  return T;
}
function zoneOf(T) { return [T.reduce((s, t) => s + t.e, 0) / T.length, T.reduce((s, t) => s + t.n, 0) / T.length]; }
function hitsTarget(t, p, blast) {
  if (t.len) { const dx = p[0] - t.e, dy = p[1] - t.n, a = dx * Math.sin(t.psi) + dy * Math.cos(t.psi), c = dx * Math.cos(t.psi) - dy * Math.sin(t.psi); return Math.abs(a) < t.len / 2 + 6 && Math.abs(c) < t.wid / 2 + 6; }
  return Math.hypot(p[0] - t.e, p[1] - t.n) < blast + t.r;
}
function impactOf(p, v) { const g0 = groundAt(world, p[0], p[1]), hh = Math.max(0, p[2] - g0), tt = (v[2] + Math.sqrt(v[2] * v[2] + 2 * G * hh)) / G; return [p[0] + v[0] * tt, p[1] + v[1] * tt, tt]; }
