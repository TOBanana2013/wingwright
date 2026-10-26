# Wingwright

A build-a-plane flight simulator that runs in the browser. Design your own plane or fly real aircraft, from a Cessna 172 to an A380, a Spitfire, an F-22 and a B-2.

**Play:** open `index.html` in any modern browser. Everything is in that one file.

## Game modes
- **Mission:** find the real target runway among decoys and land on it.
- **Challenge:** land on a plateau high in the mountains.
- **Free fly:** land anywhere; every plane is available here.
- **Situation:** five classic emergencies, plus random fuel-leak, short-runway, crosswind, power-loss and medical flights over desert, arctic and night-city maps.
- **Fight:** modern jets (F-35 / F-22), bomber runs (B-17, B-29, SBD Dauntless, B-52, B-1B, B-2) and WW2 dogfights (Spitfire, P-51, Yak-3, Fw 190, Zero).
- **Stunt team:** a scored aerobatic display in the Extra 330SC.

## Code layout
- `src/physics.js`: flight physics, world builders and the guidance used by the autopilots and tips. Plain JavaScript that also runs in Node, so it can be tested without a browser.
- `src/real.js`: data for the fixed aircraft (real ones plus two made up for the game), with the units and conventions explained at the top.
- `src/template.html`: the page itself: styles, hangar, cockpit and HUD, the 3D renderer, sound, and the fight, stunt and situation modes. It holds two placeholders, `/*PHYSICS*/` and `/*REAL*/`.
- `build.py`: pastes `physics.js` and `real.js` into the template and writes `index.html`. It never changes anything in `src/`. Run `python3 build.py` after every edit.
- `index.html`: the built game, committed so the site can serve it. Don't edit it by hand.
- `tests/`: `node --test tests/*.test.js` runs them all and fails if anything breaks.
  - `autopilot.js`: one shared autopilot that flies using only the player's controls.
  - `flights.test.js`: every plane on every map, the situations, and the build-your-own size classes.
  - `units.test.js`: smaller checks of the rules (stall, seeds, touchdown, carrier, brakes, turbulence).
  - GitHub runs the same tests on every push (`.github/workflows/test.yml`).

## How the game loop works
Physics runs in fixed steps of 1/120 s (`STEP` in `template.html`), whatever the screen's frame rate: each frame adds the time that passed to a bank and runs as many steps as fit, then draws once. Random things in the physics (gusts, which wing drops in a stall) come from a seeded generator (`makeRng` in `physics.js`), so the same world seed and the same inputs give the same flight.
