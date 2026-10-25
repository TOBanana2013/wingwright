function bindHold(id, key) {
  const b = $(id);
  const on = e => { e.preventDefault(); keys[key] = 1; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (x) {} };
  const off = () => { keys[key] = 0; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
}
bindHold('b-up', 'up'); bindHold('b-down', 'down'); bindHold('b-left', 'left'); bindHold('b-right', 'right');
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
window.addEventListener('keydown', e => {
  if (!flight) return;
  if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = 1; e.preventDefault(); }
  else if (e.code === 'KeyE') { pilotThrottle(+$('thr').value + 10); e.preventDefault(); }
  else if (e.code === 'KeyQ') { pilotThrottle(+$('thr').value - 10); e.preventDefault(); }
  else if (e.code === 'KeyV') toggleView();
  else if (e.code === 'Digit1' || e.code === 'Numpad1') setFlaps(1);
  else if (e.code === 'Digit2' || e.code === 'Numpad2') setFlaps(2);
  else if (e.code === 'Digit3' || e.code === 'Numpad3') setFlaps(3);
  else if (e.code === 'KeyM') { mapWide = !mapWide; }
  else if (e.code === 'KeyB') toggleBrake();
  else if (e.code === 'KeyR') startFlight(false);
});
window.addEventListener('keyup', e => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = 0; });

