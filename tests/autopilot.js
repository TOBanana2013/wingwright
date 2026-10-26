// Shared test autopilot: flies a plane through take-off, cruise, approach, flare and landing using only the
// same inputs a player has (pitch, roll, throttle, flaps, brake). Every flight test uses this one copy.
const P = require('../src/physics.js');
const STEP = 1 / 120;   // the same fixed physics step the game uses

function control(f, s) {
  const g = P.guide(f, s), v = Math.hypot(f.vx, f.vy);
  let pitch = 0, roll = 0;
  if (f.ground && !f.flew) {
    f.throttle = 1; f.brake = 0;
    // rotate to a safe attitude at lift-off speed, never as far as the tail-strike angle
    if (v > s.vLift) { const want = Math.min(s.tailStrike - 2.5, 10); pitch = Math.max(-1, Math.min(1, (want - f.theta) / 2)); }
  } else if (f.ground) {
    // rolling out: brake, and steer with the nosewheel back to the centre line
    f.throttle = 0; f.brake = 1; f.reverse = 1;
    const rw = (f.td && f.td.rw) || f.world.target, [, cross] = P.rwLocal(rw, f.e, f.n);
    let hdg = rw.hdg; if (Math.abs(P.wrap(f.psi - hdg)) > Math.PI / 2) hdg += Math.PI;
    const dir = Math.abs(P.wrap(f.psi - rw.hdg)) > Math.PI / 2 ? -1 : 1;
    const want = P.wrap(hdg - dir * Math.max(-0.2, Math.min(0.2, cross * 0.01)));
    roll = Math.max(-1, Math.min(1, P.wrap(want - f.psi) / P.DEG / 2));
  } else {
    const app = g.phase === 'approach' || g.phase === 'flare', glide = f.engineOut || (f.fuel <= 0 && !!f.world.leak);
    if (!app && f.agl > 100) f.flaps = 0;
    if ((app && g.captured) || glide) f.flaps = 1;
    const vT = app || glide ? P.approachSpeed(s, f.h) : Math.max(s.vStall * 1.35, Math.min(s.vMax * 0.6, s.vStall * 1.6)) * (f.world.timeLimit ? 1.25 : 1);
    f.throttle = Math.max(0, Math.min(1, 0.4 + (vT - v) * 0.08));
    f.brake = app && v > vT + 8 ? 1 : 0; f.reverse = 0;
    let want = g.want;
    if (f.engineOut) want = Math.max(-12, Math.min(2, (f.agl < 8 ? -1 : -6) + (v - vT) * 0.6));   // engine out: hold gliding speed
    pitch = Math.max(-1, Math.min(1, (want - g.gamma) * 0.35));
    if (!f.ground && f.agl > 20 && v < (f.flaps > 0 ? s.vStallF : s.vStall) * 1.08 * Math.exp(f.h / 17000)) pitch = Math.min(pitch, -0.4);   // too slow: lower the nose before it stalls
    if (!f.ground && f.agl < 15 && f.flew) {
      // rudder: point the nose along the path over the ground so the wheels touch down straight
      const W = f.world.wind || [0, 0], chi = f.psi - (f.slip || 0) * P.DEG;
      const track = Math.atan2(f.vx * Math.sin(chi) + W[0], f.vx * Math.cos(chi) + W[1]);
      roll = Math.max(-1, Math.min(1, P.wrap(track - f.psi) / P.DEG / 3));
    } else {
      const lim = g.phase === 'flare' ? 5 : f.agl < 40 ? 22 : Math.min(30, s.maxBank);
      const bc = Math.max(-lim, Math.min(lim, g.turn * 1.5)); roll = Math.max(-1, Math.min(1, (bc - f.phi) / 8));
    }
  }
  return { pitch, roll };
}

// Fly until the flight ends (or, in free fly, until the first full-stop landing). Returns the flight.
function fly(s, world, { seed = 1, maxT = 1800, start } = {}) {
  const f = P.newFlight(s, world, seed);
  if (start) {
    Object.assign(f, { e: start.e, n: start.n, h: start.h, psi: start.psi, vx: start.v, vy: 0, theta: 2, phi: 0, ground: false, flew: true, x: 1e5, flaps: start.flaps ? 1 : 0 });
    f.throttle = start.thr || 0.6; if (start.engineOut) f.engineOutAt = start.engineOut;
  }
  while (!f.result && f.t < maxT && !(world.free && f.landings)) {
    if (f.engineOutAt && f.t > f.engineOutAt) f.engineOut = true;
    P.stepFlight(f, s, control(f, s), STEP);
  }
  return f;
}
const won = (f, world) => world.free ? !!f.landings : !!f.result && ['win', 'ditched'].includes(f.result.kind);

module.exports = { control, fly, won, STEP };
