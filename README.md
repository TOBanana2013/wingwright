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
- `src/physics.js`: flight physics, worlds and guidance (also runs in Node for tests)
- `src/real.js`: real aircraft data
- `src/template.html`: page, UI, 3D renderer, fight and stunt systems
- `build.py`: builds `index.html` from the files in `src/` (`python3 build.py`)
- `tests/`: headless Node autopilot tests (`node tests/t8.js free`)
