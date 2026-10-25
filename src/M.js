// ---------- 3D plane models ----------
const LIVERY = {
  c172: { body: '#f3f3ef', belly: '#e9e9e4', stripe: '#1f4e9c', tail: '#f3f3ef', tailStripe: '#1f4e9c', wing: '#f3f3ef', engine: '#f3f3ef', spinner: '#1f4e9c' },
  spit: { body: '#5f6a45', belly: '#a8b2b5', stripe: '#cfc9a6', tail: '#5f6a45', tailStripe: '#cfc9a6', wing: '#5f6a45', wingAlt: '#7a6a4a', spinner: '#cfc9a6' },
  atr72: { body: '#f5f6f8', belly: '#e6e8eb', stripe: '#2a6fb5', tail: '#2a6fb5', wing: '#d9dde2', engine: '#f5f6f8', spinner: '#2a6fb5' },
  a320: { body: '#f5f6f8', belly: '#e3e6ea', stripe: '#1d3f8f', tail: '#1d3f8f', wing: '#cfd4da', engine: '#1d3f8f' },
  b747: { body: '#f5f6f8', belly: '#dfe3e7', stripe: '#c8102e', tail: '#c8102e', wing: '#cfd4da', engine: '#e9ecef' },
  a380: { body: '#f5f6f8', belly: '#e3e6ea', stripe: '#20366e', tail: '#20366e', wing: '#cfd4da', engine: '#20366e' },
  b52: { body: '#8a9096', belly: '#6f757b', stripe: '#767c82', tail: '#8a9096', wing: '#8a9096', engine: '#70767c' },
  f35: { body: '#5d646d', belly: '#555b63', stripe: '#565c64', tail: '#5d646d', wing: '#5d646d', engine: '#3a3f45' },
  concorde: { body: '#fbfbfb', belly: '#eef0f2', stripe: '#1b3a7a', tail: '#fbfbfb', tailStripe: '#c8102e', wing: '#f1f2f4', engine: '#e5e7ea' },
  extra: { body: '#f7f3ea', belly: '#f7f3ea', stripe: '#d7262b', tail: '#d7262b', tailStripe: '#f2c230', wing: '#d7262b', wingAlt: '#f7f3ea', spinner: '#f2c230' }
};
const MATCOL = { wood: '#c99a5b', alu: '#b8c3cc', carbon: '#3e464e' };
function livery() {
  if (mode === 'real' && LIVERY[realKey]) return LIVERY[realKey];
  const b = MATCOL[plane.material] || '#b8c3cc';
  return { body: b, belly: b, stripe: '#e2560e', tail: b, tailStripe: '#e2560e', wing: b, engine: b, spinner: '#e2560e' };
}
const rgbOf = hx => [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)];
const PROF = {
  boxy: [0.55, 0.78, 0.92, 1, 1, 1, 0.8, 0.55, 0.32],
  rounded: [0.06, 0.5, 0.8, 0.97, 1, 1, 0.75, 0.42, 0.24],
  sleek: [0.02, 0.3, 0.6, 0.88, 1, 0.97, 0.72, 0.42, 0.24]
};
const US = [0, 0.04, 0.09, 0.18, 0.35, 0.6, 0.8, 0.94, 1];
function buildModel(p, gearDown) {
  const lv = livery(), C = k => rgbOf(lv[k] || lv.body), faces = [];
  const F = (pts, col, o) => faces.push(Object.assign({ p: pts, c: col }, o || {}));
  const L = p.length, W = p.width, H = p.height, g = gearH(p), b = p.span;
  const prof = PROF[p.shape] || PROF.rounded;
  const zc = u => u > 0.62 ? (u - 0.62) / 0.38 * H * 0.3 : 0, vs = u => u > 0.62 ? 1 - (u - 0.62) / 0.38 * 0.35 : 1;
  const rAt = u => { let i = 0; while (i < US.length - 2 && u > US[i + 1]) i++; const t = (u - US[i]) / (US[i + 1] - US[i]); return prof[i] + (prof[i + 1] - prof[i]) * t; };
  const topAt = u => zc(u) + H / 2 * rAt(u) * vs(u);
  // fuselage: lofted rings
  const N = 12, rings = US.map(u => { const r = prof[US.indexOf(u)]; return Array.from({ length: N }, (_, k) => { const a = 2 * Math.PI * k / N; return [L / 2 - u * L, W / 2 * r * Math.cos(a), zc(u) + H / 2 * r * vs(u) * Math.sin(a)]; }); });
  for (let i = 0; i < US.length - 1; i++) for (let k = 0; k < N; k++) {
    const am = 2 * Math.PI * (k + 0.5) / N, sm = Math.sin(am), um = (US[i] + US[i + 1]) / 2;
    const stripe = um > 0.06 && um < 0.9 && Math.abs(sm - 0.26) < 0.05;
    F([rings[i][k], rings[i][(k + 1) % N], rings[i + 1][(k + 1) % N], rings[i + 1][k]], stripe ? C('stripe') : sm < -0.6 ? C('belly') : C('body'));
  }
  for (let k = 0; k < N; k++) F([[L / 2 + 0.02, 0, zc(0)], rings[0][(k + 1) % N], rings[0][k]], C('body'));
  // wing
  const sw = Math.tan((p.sweep || 0) * DEG), taper = p.taper || (p.real ? (p.sweep ? 0.3 : p.ellipse ? 0.45 : 0.6) : 0.7);
  const area = p.real ? p.S : b * p.chord, cr = 2 * area / (b * (1 + taper)), ct = cr * taper, hb = b / 2;
  const xr = L / 2 - (p.wingY || (p.real && p.sweep ? 0.33 : 0.25)) * L;
  const zw = p.wing === 'high' ? H * 0.42 : p.wing === 'mid' ? 0 : -H * 0.3, dih = Math.tan((p.wing === 'high' ? 1 : p.wing === 'mid' ? -1 : 5) * DEG);
  const yr = W * 0.42, t = Math.max(0.05, cr * 0.05);
  const wingPt = (s, f, chordFrac, up) => { const y = yr + (hb - yr) * f, c = cr + (ct - cr) * f, xle = xr - (y - yr) * sw * (p.real ? 1 : 0) - (p.real ? 0 : f * 0.15 * cr);
    return [xle - c * chordFrac, s * y, zw + (y - yr) * dih + up * t * (1 - 0.6 * f)]; };
  const segs = 3;
  for (const s of [-1, 1]) for (let i = 0; i < segs; i++) {
    const f0 = i / segs, f1 = (i + 1) / segs, col = lv.wingAlt && i % 2 ? rgbOf(lv.wingAlt) : C('wing');
    F([wingPt(s, f0, 0, 1), wingPt(s, f1, 0, 1), wingPt(s, f1, 1, 1), wingPt(s, f0, 1, 1)], col);
    F([wingPt(s, f0, 0, -1), wingPt(s, f1, 0, -1), wingPt(s, f1, 1, -1), wingPt(s, f0, 1, -1)], col.map(v => v * 0.92));
    F([wingPt(s, f0, 0, 1), wingPt(s, f1, 0, 1), wingPt(s, f1, 0, -1), wingPt(s, f0, 0, -1)], col.map(v => v * 0.85));
  }
  const xLE = y => xr - (Math.abs(y) - yr) * sw * (p.real ? 1 : 0), zW = y => zw + (Math.abs(y) - yr) * dih, cAt = y => cr + (ct - cr) * Math.max(0, (Math.abs(y) - yr) / (hb - yr));
  // tailplane
  const frac = p.real ? (p.aero ? 0.4 : 0.34) : TAILS[p.tail].frac, tspan = frac * b, tc = p.real ? Math.max(cr * 0.42, L * 0.07) : 0.55 + frac;
  const xt = -L / 2 + 0.25, fh = finH();
  const fc = Math.max(tc * 1.3, L * 0.12), zf = topAt(0.9) - 0.05;
  if (!p.noHT) {
    const zt = p.ttail ? zf + fh * 0.95 : zc(0.92), tsw = p.real ? sw * 0.9 : 0;
    for (const s of [-1, 1]) {
      const pts = [[xt + tc, s * W * 0.15, zt], [xt + tc - tspan / 2 * tsw, s * tspan / 2, zt], [xt + tc - tspan / 2 * tsw - tc * 0.55, s * tspan / 2, zt], [xt, s * W * 0.15, zt]];
      F(pts, C('tail').map(v => v * 0.97)); F(pts.map(q => [q[0], q[1], q[2] - 0.06]), C('tail').map(v => v * 0.85));
    }
  }
  // fin(s)
  const finAt = (y0, cant) => {
    const rootLE = xt + fc, rootTE = xt - 0.05, tipLE = rootLE - fh * Math.tan(40 * DEG), tipTE = Math.min(tipLE - fc * 0.35, rootTE - fh * Math.tan(12 * DEG));
    const P = (x, h) => [x, y0 + h * cant, zf + h];
    const pts = [P(rootLE, 0), P(tipLE, fh), P(tipTE, fh), P(rootTE, 0)];
    for (const d of [-0.04, 0.04]) F(pts.map(q => [q[0], q[1] + d, q[2]]), C('tail'), { fin: true });
    if (lv.tailStripe) { const a = 0.45, bnd = 0.7, mix = (u, A, B) => A + (B - A) * u;
      const band = [P(mix(a, rootLE, tipLE), fh * a), P(mix(bnd, rootLE, tipLE), fh * bnd), P(mix(bnd, rootTE, tipTE), fh * bnd), P(mix(a, rootTE, tipTE), fh * a)];
      for (const d of [-0.07, 0.07]) F(band.map(q => [q[0], q[1] + d, q[2]]), C('tailStripe')); }
  };
  if (p.twinFin) { finAt(-W * 0.32, -0.35); finAt(W * 0.32, 0.35); } else finAt(0, 0);
  // engines
  const cyl = (cx, cy, cz, len, r, col, front, aftCol) => {
    const n = 8, ring = (x, k) => Array.from({ length: n }, (_, i) => { const a = 2 * Math.PI * i / n; return [x, cy + r * k * Math.cos(a), cz + r * k * Math.sin(a)]; });
    const A = ring(cx + len / 2, 0.85), B = ring(cx + len * 0.2, 1), Cc = ring(cx - len / 2, 0.75);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; F([A[i], A[j], B[j], B[i]], col); F([B[i], B[j], Cc[j], Cc[i]], col.map(v => v * 0.95)); }
    F(A, front || [26, 29, 33]); F(Cc, aftCol || [40, 40, 44]);
  };
  for (const e of enginePos()) for (const s of [-1, 1]) {
    const y = s * Math.max(yr + 0.5, e.y * hb), xl = xLE(y), zl = zW(y);
    const cx = e.aft ? xl - cAt(y) * 0.6 : e.prop ? xl + e.l * 0.1 : xl + e.l * 0.28;
    const cz = e.aft ? zl - e.w * 0.55 : p.wing === 'high' ? zl - e.w * 0.45 : zl - e.w * 0.8;
    cyl(cx, y, cz, e.l, e.w / 2, C('engine'));
    if (e.prop) F(Array.from({ length: 16 }, (_, i) => { const a = 2 * Math.PI * i / 16; return [cx + e.l / 2 + 0.15, y + e.prop * Math.cos(a), cz + e.prop * Math.sin(a)]; }), [30, 35, 40], { alpha: 0.22, prop: true });
  }
  if (p.real && p.engine === 'jet' && p.jets === 1) F(Array.from({ length: 10 }, (_, i) => { const a = 2 * Math.PI * i / 10; return [-L / 2 - 0.02, W * 0.28 * Math.cos(a), zc(1) + W * 0.28 * Math.sin(a)]; }), [30, 30, 34]);
  if (noseProp()) {
    const sx = L / 2, sr = Math.min(W, H) * 0.22;
    for (let i = 0; i < 6; i++) { const a0 = 2 * Math.PI * i / 6, a1 = 2 * Math.PI * (i + 1) / 6;
      F([[sx + sr * 1.6, 0, zc(0)], [sx, sr * Math.cos(a0), zc(0) + sr * Math.sin(a0)], [sx, sr * Math.cos(a1), zc(0) + sr * Math.sin(a1)]], C('spinner')); }
    const pr = propR();
    F(Array.from({ length: 18 }, (_, i) => { const a = 2 * Math.PI * i / 18; return [sx + 0.15, pr * Math.cos(a), zc(0) + pr * Math.sin(a)]; }), [30, 35, 40], { alpha: 0.2, prop: true });
    F([[sx + 0.12, -0.08, zc(0) - pr], [sx + 0.12, 0.08, zc(0) - pr], [sx + 0.12, 0.08, zc(0) + pr], [sx + 0.12, -0.08, zc(0) + pr]], [28, 30, 34], { blade: true });
  }
  // canopy / windows
  const glass = [38, 64, 92];
  if (L < 20) {
    const u0 = p.aero ? 0.34 : 0.2, u1 = p.aero ? 0.52 : 0.4, ts = [0, 0.25, 0.5, 0.75, 1], n = 7;
    const cring = ts.map(tt => { const u = u0 + (u1 - u0) * tt, s = Math.pow(Math.sin(Math.PI * tt), 0.6), z0 = topAt(u) - H * 0.06;
      return Array.from({ length: n }, (_, i) => { const a = Math.PI * i / (n - 1); return [L / 2 - u * L, W * 0.36 * s * Math.cos(a), z0 + H * 0.3 * s * Math.sin(a)]; }); });
    for (let i = 0; i < ts.length - 1; i++) for (let k = 0; k < n - 1; k++) F([cring[i][k], cring[i][k + 1], cring[i + 1][k + 1], cring[i + 1][k]], glass, { glass: true });
  } else {
    for (const s of [-1, 1]) {
      const z = H * 0.14, z2 = z + H * 0.07, y = s * (W / 2 * 0.99 + 0.02);
      F([[L / 2 - 0.13 * L, y, z], [L / 2 - 0.8 * L, y, z], [L / 2 - 0.8 * L, y, z2], [L / 2 - 0.13 * L, y, z2]], glass, { glass: true });
      if (p.hump) F([[L / 2 - 0.07 * L, s * (W * 0.3), H * 0.62], [L / 2 - 0.27 * L, s * (W * 0.3), H * 0.62], [L / 2 - 0.27 * L, s * (W * 0.3), H * 0.68], [L / 2 - 0.07 * L, s * (W * 0.3), H * 0.68]], glass, { glass: true });
      F([[L / 2 - 0.03 * L, s * W * 0.05, topAt(0.04) * 0.75], [L / 2 - 0.065 * L, s * W * 0.3, topAt(0.08) * 0.85], [L / 2 - 0.065 * L, s * W * 0.3, topAt(0.08) * 0.62], [L / 2 - 0.03 * L, s * W * 0.05, topAt(0.04) * 0.45]], glass, { glass: true });
    }
    if (p.hump) { // upper deck hump
      const hx0 = L / 2 - 0.05 * L, hx1 = L / 2 - 0.32 * L;
      for (const s of [-1, 1]) F([[hx0, s * W * 0.32, H * 0.45], [hx1, s * W * 0.34, H * 0.45], [hx1, s * W * 0.2, H * 0.72], [hx0, s * W * 0.18, H * 0.7]], C('body'));
      F([[hx0, -W * 0.18, H * 0.7], [hx1, -W * 0.2, H * 0.72], [hx1, W * 0.2, H * 0.72], [hx0, W * 0.18, H * 0.7]], C('body'));
    }
  }
  // landing gear
  if (gearDown) {
    const rw = Math.max(0.22, g * 0.32), dark = [32, 34, 38], zb = -H / 2 - g + rw;
    const wheel = (x, y) => F(Array.from({ length: 8 }, (_, i) => { const a = 2 * Math.PI * i / 8; return [x + rw * Math.cos(a), y, zb + rw * Math.sin(a)]; }), dark);
    const strut = (x, y, ztop) => F([[x + 0.06, y, ztop], [x - 0.06, y, ztop], [x - 0.06, y, zb], [x + 0.06, y, zb]], [120, 124, 130]);
    const my = p.wing === 'high' && L < 20 ? W * 0.95 : Math.max(W * 0.55, Math.min(hb * 0.18, 6)), mx = xr - cr * 0.35;
    for (const s of [-1, 1]) { strut(mx, s * my, p.wing === 'low' ? zW(s * my) : -H * 0.35); wheel(mx, s * my); if (L > 30) wheel(mx - rw * 2.4, s * my); }
    if (p.tailWheel) { const x = -L / 2 + L * 0.1; strut(x, 0, zc(0.9) - H * 0.25); F(Array.from({ length: 8 }, (_, i) => { const a = 2 * Math.PI * i / 8; return [x + rw * 0.5 * Math.cos(a), 0, zc(0.9) - H * 0.25 - g * 0.3 + rw * 0.5 * Math.sin(a)]; }), dark); }
    else { const x = L / 2 - L * 0.12; strut(x, 0, -H * 0.35); wheel(x, 0); }
  }
  return faces;
}
let modelCache = { key: '', faces: null };
function modelFor(gearDown) {
  const key = JSON.stringify(plane) + (mode === 'real' ? realKey : 'c') + gearDown;
  if (modelCache.key !== key) modelCache = { key, faces: buildModel(plane, gearDown) };
  return modelCache.faces;
}
// attitude: x forward, y right, z up in the plane -> world (east, north, up)
function attitudeXf(o, psi, theta, phi) {
  const sp = Math.sin(psi), cp = Math.cos(psi), st = Math.sin(theta), ct = Math.cos(theta), sf = Math.sin(phi), cf = Math.cos(phi);
  const fw = [sp * ct, cp * ct, st], r0 = [cp, -sp, 0], u0 = [-sp * st, -cp * st, ct];
  const rt = [r0[0] * cf - u0[0] * sf, r0[1] * cf - u0[1] * sf, r0[2] * cf - u0[2] * sf];
  const up = [u0[0] * cf + r0[0] * sf, u0[1] * cf + r0[1] * sf, u0[2] * cf + r0[2] * sf];
  return q => [o[0] + fw[0] * q[0] + rt[0] * q[1] + up[0] * q[2], o[1] + fw[1] * q[0] + rt[1] * q[1] + up[1] * q[2], o[2] + fw[2] * q[0] + rt[2] * q[1] + up[2] * q[2]];
}
const SUN = (() => { const v = [-0.45, -0.35, 0.82], m = Math.hypot(...v); return v.map(x => x / m); })();
function drawModel(ctx, faces, xf, cam, opts) {
  opts = opts || {};
  const list = [];
  for (const fc of faces) {
    if (fc.prop && opts.propStill) continue;
    if (fc.blade && !opts.propStill) continue;
    const wp = fc.p.map(xf), cp = wp.map(q => cam.toCam(q[0], q[1], q[2]));
    if (cp.some(q => q[2] < 0.3)) continue;
    let z = 0; for (const q of cp) z += q[2]; z /= cp.length;
    const a = wp[0], b = wp[1], c = wp[2];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const m = Math.hypot(...n) || 1; n = n.map(x => x / m);
    const toEye = [cam.eye[0] - a[0], cam.eye[1] - a[1], cam.eye[2] - a[2]];
    if (n[0] * toEye[0] + n[1] * toEye[1] + n[2] * toEye[2] < 0) n = n.map(x => -x);
    const d = Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]);
    let sh = 0.5 + 0.58 * d;
    if (fc.glass) { const em = Math.hypot(...toEye) || 1, hv = [SUN[0] + toEye[0] / em, SUN[1] + toEye[1] / em, SUN[2] + toEye[2] / em], hm = Math.hypot(...hv) || 1; sh += 1.6 * Math.pow(Math.max(0, (n[0] * hv[0] + n[1] * hv[1] + n[2] * hv[2]) / hm), 24); }
    const col = fc.c.map(x => Math.round(Math.min(255, x * sh)));
    list.push([z, cp, col, fc.alpha || 1]);
  }
  list.sort((p1, p2) => p2[0] - p1[0]);
  ctx.lineJoin = 'round';
  for (const [, cp, col, al] of list) {
    ctx.beginPath(); cp.forEach((q, i) => { const s = cam.scr(q); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }); ctx.closePath();
    const c = `rgba(${col[0]},${col[1]},${col[2]},${al})`; ctx.fillStyle = c; ctx.fill();
    if (al === 1) { ctx.strokeStyle = c; ctx.lineWidth = 0.6; ctx.stroke(); }
  }
}

// ---------- cameras and the world ----------
function makeCamera(eye, yaw, pitch, cx, cy, F) {
  const sp = Math.sin(yaw), cp = Math.cos(yaw), cP = Math.cos(pitch), sP = Math.sin(pitch);
  const toCam = (E, N, U) => { const dE = E - eye[0], dN = N - eye[1], d = dE * sp + dN * cp, r = dE * cp - dN * sp, u = U - eye[2]; return [r, -d * sP + u * cP, d * cP + u * sP]; };
  const scr = q => [cx + F * q[0] / q[2], cy - F * q[1] / q[2]];
  const proj = (E, N, U) => { const q = toCam(E, N, U); return q[2] < 1 ? null : [...scr(q), q[2]]; };
  const poly = (ctx, pts, col) => {
    let c = pts.map(p => toCam(p[0], p[1], p[2] || 0)), out = [];
    for (let i = 0; i < c.length; i++) {
      const A = c[i], B = c[(i + 1) % c.length], ia = A[2] >= 1, ib = B[2] >= 1;
      if (ia) out.push(A);
      if (ia !== ib) { const t = (1 - A[2]) / (B[2] - A[2]); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, 1]); }
    }
    if (out.length < 3) return false;
    ctx.fillStyle = col; ctx.beginPath(); out.forEach((q, i) => { const s = scr(q); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }); ctx.closePath(); ctx.fill(); return true;
  };
  return { eye, camH: eye[2], proj, poly, toCam, scr, fwd: [sp, cp], pitch };
}
function makeCam(f, w, h, cx, cy, F) {
  return makeCamera([f.e, f.n, f.h + gearH(plane) + plane.height * 0.85], f.psi, f.theta * DEG, cx, cy, F);
}

function drawWorld(ctx, cam, o) {
  const { w, h, cx, cy, F } = o, ce = cam.eye[0], cn = cam.eye[1], camH = cam.eye[2], p = cam.pitch;
  const R = Math.hypot(w, h) * 1.5, cP = Math.cos(p);
  const horizon = cy + F * Math.tan(Math.max(-1.5, Math.min(1.5, p)));
  ctx.save();
  if (o.roll) { ctx.translate(cx, cy); ctx.rotate(-o.roll * DEG); ctx.translate(-cx, -cy); }
  const t = Math.min(1, camH / 6000);
  const sg = ctx.createLinearGradient(0, horizon - h * 1.2, 0, horizon);
  sg.addColorStop(0, `rgb(${Math.round(60 - 40 * t)},${Math.round(125 - 70 * t)},${Math.round(205 - 60 * t)})`);
  sg.addColorStop(1, '#d6e9f4');
  ctx.fillStyle = sg; ctx.fillRect(cx - R, cy - R * 2, R * 2, R * 4);
  if (cP > 0.02) {
    ctx.fillStyle = '#9db99a'; ctx.fillRect(cx - R, horizon, R * 2, R * 3);
    const at = { e: ce, n: cn };
    if (world.terrain) drawTerrain3D(ctx, cam, at); else {
      const C = 200, Rg = Math.min(4500, 1800 + camH * 6), steep = Math.abs(p) > 0.8;
      const ci = Math.floor(ce / C), cj = Math.floor(cn / C), nC = Math.ceil(Rg / C), patches = [];
      for (let i = ci - nC; i <= ci + nC; i++) for (let j = cj - nC; j <= cj + nC; j++) {
        const r = hash(i * 31 + 7, j * 17 + 3); if (r < 0.4) continue;
        const pe = (i + 0.5) * C, pn = (j + 0.5) * C, de = pe - ce, dn = pn - cn, dist = Math.hypot(de, dn);
        if (dist > Rg || (!steep && de * cam.fwd[0] + dn * cam.fwd[1] < -C)) continue;
        patches.push([dist, i, j, r]);
      }
      patches.sort((a, b) => b[0] - a[0]);
      for (const [dist, i, j, r] of patches) {
        const fade = Math.min(1, dist / Rg), base = r > 0.75 ? [84, 140, 74] : r > 0.55 ? [118, 160, 86] : [140, 150, 90], hz = [157, 185, 154];
        cam.poly(ctx, [[i * C, j * C], [(i + 1) * C, j * C], [(i + 1) * C, (j + 1) * C], [i * C, (j + 1) * C]], `rgb(${base.map((c, k) => Math.round(c + (hz[k] - c) * fade)).join(',')})`);
      }
    }
    const hg = ctx.createLinearGradient(0, horizon - 2, 0, horizon + 30);
    hg.addColorStop(0, 'rgba(214,233,244,0.95)'); hg.addColorStop(1, 'rgba(214,233,244,0)');
    ctx.fillStyle = hg; ctx.fillRect(cx - R, horizon - 2, R * 2, 32);
    world.runways.map(r => [Math.hypot(r.e - ce, r.n - cn), r]).filter(a => a[0] < 16000).sort((a, b) => b[0] - a[0]).forEach(([, r]) => drawRunway3D(ctx, r, cam));
  }
  // clouds
  const CC = 700;
  for (let i = Math.floor(ce / CC) - 12; i <= Math.floor(ce / CC) + 12; i++) for (let j = Math.floor(cn / CC) - 12; j <= Math.floor(cn / CC) + 12; j++) {
    if (hash(i * 13 + 1, j * 7 + 2) > 0.28) continue;
    const pe = (i + hash(i, j + 50)) * CC, pn = (j + hash(i + 50, j)) * CC, ch = 300 + hash(i + 9, j + 9) * 2200;
    const c = cam.proj(pe, pn, ch); if (!c) continue;
    const r = 160 * (0.6 + hash(i + 3, j + 3)) * F / c[2]; if (r < 3 || r > w * 3) continue;
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, 0.3 + r / 40)})`;
    ctx.beginPath(); ctx.ellipse(c[0], c[1], r, r * 0.35, 0, 0, Math.PI * 2); ctx.ellipse(c[0] + r * .5, c[1] - r * .16, r * .6, r * .3, 0, 0, Math.PI * 2); ctx.ellipse(c[0] - r * .5, c[1] - r * .05, r * .5, r * .25, 0, 0, Math.PI * 2); ctx.fill();
  }
  // trees
  if (cP > 0.02 && camH - (flight.gnd || 0) < 2500) {
    const TC = 55, nT = Math.ceil(1600 / TC), ti = Math.floor(ce / TC), tj = Math.floor(cn / TC), trees = [];
    for (let i = ti - nT; i <= ti + nT; i++) for (let j = tj - nT; j <= tj + nT; j++) {
      if (hash(i * 3 + 11, j * 5 + 13) > 0.3) continue;
      const te = (i + hash(i, j)) * TC, tn = (j + hash(j, i)) * TC;
      const q = cam.toCam(te, tn, 0); if (q[2] < 2 || q[2] > 1600) continue;
      if (nearRunway(te, tn, 35)) continue;
      const tz = world.terrain ? world.terrain(Math.round(te), Math.round(tn)) : 0;
      if (world.terrain && tz > (world.elev || 0) + 90) continue;
      const q2 = cam.toCam(te, tn, tz); if (q2[2] < 2) continue;
      trees.push([q2[2], te, tn, 8 + hash(i + 1, j + 1) * 8, tz]);
    }
    trees.sort((a, b) => b[0] - a[0]);
    for (const [d, te, tn, th, tz] of trees) {
      const b = cam.proj(te, tn, tz), tp = cam.proj(te, tn, tz + th); if (!b || !tp) continue;
      const hh = Math.hypot(b[0] - tp[0], b[1] - tp[1]); if (hh < 1.2) continue;
      const fade = Math.min(1, d / 1600);
      ctx.fillStyle = `rgba(60,48,34,${1 - fade * 0.6})`; ctx.fillRect(b[0] - hh * 0.04, b[1] - hh * 0.35, hh * 0.08, hh * 0.35);
      ctx.fillStyle = `rgb(${Math.round(40 + fade * 100)},${Math.round(92 + fade * 80)},${Math.round(52 + fade * 100)})`;
      ctx.beginPath(); ctx.ellipse(b[0], b[1] - hh * 0.62, hh * 0.28, hh * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (o.after) o.after();
  ctx.restore();
}

function renderCockpit() {
  const { ctx, w, h } = view, f = flight;
  const v = Math.hypot(f.vx, f.vy);
  shake = f.ground && v > 2 ? (Math.random() - 0.5) * Math.min(3, v / 12) : 0;
  const dashH = Math.min(h * 0.24, 130);
  const F = h * 0.95, cx = w / 2, cy = (h - dashH) * 0.52 + shake;
  const cam = makeCam(f, w, h, cx, cy, F);
  drawWorld(ctx, cam, { w, h, cx, cy, F, roll: f.phi });
  const lv = livery(), fill = lv.body;
  ctx.fillStyle = '#1d2329';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, 14); ctx.quadraticCurveTo(w / 2, 34, 0, 14); ctx.fill();
  ctx.lineWidth = Math.max(8, w * 0.012); ctx.strokeStyle = '#1d2329';
  ctx.beginPath(); ctx.moveTo(w * 0.12, h - dashH); ctx.lineTo(w * 0.24, 16); ctx.moveTo(w * 0.88, h - dashH); ctx.lineTo(w * 0.76, 16); ctx.stroke();
  if (!noseProp()) {
    ctx.fillStyle = '#1d2329'; ctx.beginPath(); ctx.moveTo(0, h - dashH - 14); ctx.quadraticCurveTo(cx, h - dashH - 40, w, h - dashH - 14); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  } else {
    const cowlW = Math.min(w * 0.5, w * 0.16 * plane.width + 60);
    ctx.fillStyle = fill; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - cowlW, h - dashH + 2);
    ctx.quadraticCurveTo(cx, h - dashH - (plane.shape === 'sleek' ? 34 : plane.shape === 'rounded' ? 26 : 14), cx + cowlW, h - dashH + 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = lv.stripe; ctx.fillRect(cx - cowlW * 0.08, h - dashH - (plane.shape === 'sleek' ? 16 : 12), cowlW * 0.16, 14);
    const pr = Math.min(w * 0.4, 120 + propR() * 90);
    if (f.throttle > 0 && f.fuel > 0) { ctx.fillStyle = `rgba(20,25,30,${0.03 + 0.05 * f.throttle})`; ctx.beginPath(); ctx.ellipse(cx, h - dashH - 30, pr, pr * 0.92, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.strokeStyle = '#1d2329'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(cx - pr, h - dashH - 30); ctx.lineTo(cx + pr, h - dashH - 30); ctx.stroke(); }
  }
  drawDash(ctx, w, h, dashH, f, v);
  if (f.result && f.result.kind === 'crash') { ctx.fillStyle = 'rgba(194,47,47,.35)'; ctx.fillRect(0, 0, w, h); }
}

// ---------- Chase camera ----------
let chaseYaw = 0, smoke = [], smokeT = 0;
function renderChase(dt) {
  const { ctx, w, h } = view, f = flight;
  const L = plane.length, b = plane.span, H = plane.height, g = gearH(plane);
  const O = [f.e, f.n, f.h + g + H / 2];
  chaseYaw += wrap(f.psi - chaseYaw) * Math.min(1, (dt || 0.016) * 2.2);
  const D = Math.max(11, Math.min(170, L * 1.7 + b * 0.45)), el = 11 * DEG;
  const eye = [O[0] - Math.sin(chaseYaw) * D * Math.cos(el), O[1] - Math.cos(chaseYaw) * D * Math.cos(el), O[2] + D * Math.sin(el)];
  eye[2] = Math.max(eye[2], groundAt(world, eye[0], eye[1]) + 2.5);
  const pitch = Math.atan2(O[2] - eye[2], Math.hypot(O[0] - eye[0], O[1] - eye[1]));
  const F = h * 1.05, cx = w / 2, cy = h * 0.55;
  const cam = makeCamera(eye, chaseYaw, pitch, cx, cy, F);
  const xf = attitudeXf(O, f.psi, f.theta * DEG, f.phi * DEG);
  const faces = modelFor(plane.fixedGear || !plane.real || (f.agl || 0) < 60 || f.ground);
  drawWorld(ctx, cam, { w, h, cx, cy, F, after: () => {
    // shadow on the ground
    const ag = f.agl || 0;
    if (ag < 400) {
      const gz = f.gnd || 0, al = 0.3 * (1 - ag / 400);
      ctx.fillStyle = `rgba(20,30,20,${al})`; ctx.beginPath();
      for (const fc of faces) { if (fc.alpha || fc.glass) continue; const pts = fc.p.map(xf).map(q => cam.proj(q[0], q[1], gz + 0.15)); if (pts.some(q => !q)) continue; pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); }
      ctx.fill('nonzero');
    }
    // smoke trail (stunt plane)
    if (smoke.length > 1) {
      ctx.lineCap = 'round';
      for (let i = 1; i < smoke.length; i++) {
        const a = cam.proj(...smoke[i - 1].p), c = cam.proj(...smoke[i].p); if (!a || !c) continue;
        const age = (f.t - smoke[i].t) / 12; if (age > 1) continue;
        ctx.strokeStyle = `rgba(255,255,255,${0.75 * (1 - age)})`; ctx.lineWidth = Math.max(1, Math.min(40, (1.2 + age * 6) * F / c[2]));
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
      }
    }
    drawModel(ctx, faces, xf, cam, { propStill: !(f.throttle > 0 && f.fuel > 0) });
    // afterburner flame
    if (f.ab && f.fuel > 0) {
      const flick = 0.85 + Math.random() * 0.3, outs = plane.pods && plane.pods.length ? plane.pods.map(e => [-L * 0.32, e.y * b / 2, -H * 0.55]).flatMap(q => [q, [q[0], -q[1], q[2]]]) : [[-L / 2, 0, H * 0.08]];
      for (const q of outs) {
        const base = cam.proj(...xf(q)), tip = cam.proj(...xf([q[0] - W2() * 3.2 * flick, q[1], q[2]])); if (!base || !tip) continue;
        const r = Math.max(2, plane.width * 0.25 * F / base[2]);
        const gr = ctx.createLinearGradient(base[0], base[1], tip[0], tip[1]); gr.addColorStop(0, 'rgba(255,240,200,.95)'); gr.addColorStop(0.3, 'rgba(255,150,40,.85)'); gr.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = gr; const ang = Math.atan2(tip[1] - base[1], tip[0] - base[0]) + Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(base[0] + Math.cos(ang) * r, base[1] + Math.sin(ang) * r); ctx.lineTo(tip[0], tip[1]); ctx.lineTo(base[0] - Math.cos(ang) * r, base[1] - Math.sin(ang) * r); ctx.closePath(); ctx.fill();
      }
    }
  } });
  if (f.result && f.result.kind === 'crash') { ctx.fillStyle = 'rgba(194,47,47,.35)'; ctx.fillRect(0, 0, w, h); }
}
const W2 = () => Math.max(1.2, plane.width);

// ---------- Hangar turntable ----------
let turn = { yaw: 0.7, el: 0.32, drag: null, raf: 0, last: 0, ctx: null };
function drawTurntable(now) {
  const c = $('turntable'); if (!c || $('hangar').hidden) { turn.raf = 0; return; }
  const dt = Math.min(0.05, ((now || 0) - turn.last) / 1000); turn.last = now || 0;
  if (!turn.drag && !matchMedia('(prefers-reduced-motion: reduce)').matches) turn.yaw += dt * 0.35;
  const s = sizeCanvas(c), { ctx, w, h } = s;
  const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, css('--panel')); bg.addColorStop(1, css('--bg'));
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const L = plane.length, b = plane.span, H = plane.height, g = gearH(plane), size = Math.max(L, b);
  const D = size * 1.35, eye = [Math.sin(turn.yaw) * D * Math.cos(turn.el), Math.cos(turn.yaw) * D * Math.cos(turn.el), D * Math.sin(turn.el)];
  const F = Math.min(w, h * 1.7) * 0.82, cam = makeCamera(eye, Math.atan2(-eye[0], -eye[1]), -turn.el + 0.03, w / 2, h * 0.52, F);
  // floor: soft spotlight and grid
  const fz = -(H / 2 + g), ctr = cam.proj(0, 0, fz);
  if (ctr) { const rr = F * size * 0.55 / ctr[2], gr = ctx.createRadialGradient(ctr[0], ctr[1], 0, ctr[0], ctr[1], rr * 1.2);
    gr.addColorStop(0, 'rgba(120,130,140,.28)'); gr.addColorStop(1, 'rgba(120,130,140,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(ctr[0], ctr[1], rr * 1.2, rr * 0.45, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = css('--grid'); ctx.lineWidth = 1; const step = Math.pow(10, Math.floor(Math.log10(size / 2)));
  for (let k = -6; k <= 6; k++) for (const ax of [0, 1]) {
    const a = ax ? [k * step, -6 * step, fz] : [-6 * step, k * step, fz], bb = ax ? [k * step, 6 * step, fz] : [6 * step, k * step, fz];
    const p1 = cam.proj(...a), p2 = cam.proj(...bb); if (!p1 || !p2) continue; ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
  }
  const faces = modelFor(true), xf = q => [q[1], q[0], q[2]];
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath();
  for (const fc of faces) { if (fc.alpha) continue; const pts = fc.p.map(q => cam.proj(q[1], q[0], fz)); if (pts.some(q => !q)) continue; pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); }
  ctx.fill('nonzero');
  drawModel(ctx, faces, xf, cam, { propStill: false });
  ctx.fillStyle = css('--muted'); ctx.font = '11px ' + css('--f-mono'); ctx.textAlign = 'left'; ctx.fillText((plane.real ? plane.name : 'YOUR DESIGN').toUpperCase(), 12, 20);
  ctx.textAlign = 'right'; ctx.fillText('DRAG TO SPIN', w - 12, 20);
  turn.raf = requestAnimationFrame(drawTurntable);
}
function startTurntable() { if (!turn.raf) { turn.last = performance.now(); turn.raf = requestAnimationFrame(drawTurntable); } }
(() => {
  const c = $('turntable'); if (!c) return;
  c.addEventListener('pointerdown', e => { turn.drag = { x: e.clientX, y: e.clientY, yaw: turn.yaw, el: turn.el }; try { c.setPointerCapture(e.pointerId); } catch (x) {} });
  c.addEventListener('pointermove', e => { if (!turn.drag) return; turn.yaw = turn.drag.yaw - (e.clientX - turn.drag.x) * 0.01; turn.el = Math.max(0.05, Math.min(1.2, turn.drag.el + (e.clientY - turn.drag.y) * 0.006)); });
  const end = () => { turn.drag = null; }; c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
})();

