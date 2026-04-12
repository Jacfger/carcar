# PID Car Simulator — Feature Roadmap

> Track designer is explicitly out of scope.

---

## Feature 1: Live Recompile on Save

**Goal:** Recompile and hot-swap user PID code without stopping the simulation.
The car keeps running; the new code takes effect on the next tick after save.

### Behaviour
- Trigger: `Ctrl+S` inside the Monaco editor (standard save keybind)
- If compilation succeeds: swap in silently, clear any error banner
- If compilation fails: show error banner, keep running the **old** compiled function
- No full stop/restart required

### Implementation
1. **Monaco keybinding** — register `Ctrl+S` via `editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, handler)`
2. **Sandbox hot-swap** — add a `tryCompileUserCode(code)` that compiles into a *staging* slot; only promote to active if successful
3. **Error recovery** — on failed hot-swap, `_activeFn` remains the previous good function; staging is discarded

```
Monaco editor
  └─ Ctrl+S → compileToStaging(code)
                 ├─ success → promote staging → active; clear error banner
                 └─ failure → discard staging; show error banner
                              (active function unchanged, sim continues)
```

### Files touched
- `src/editor/Sandbox.ts` — add staging slot + `tryCompile` / `promoteStaging`
- `src/main.ts` — register Monaco keybinding, call `tryCompile`

### Edge cases
- User saves while paused: compile succeeds silently; new code runs on next Run
- Save mid-tick: swap happens between ticks (accumulator loop checks before each tick)

---

## Feature 2: Per-Car PID Editors

**Goal:** Each car gets its own independent PID code so users can race different
algorithms against each other (e.g. P-only vs full PID).

### Behaviour
- A tab bar appears above the Monaco editor labelled **Car 1**, **Car 2**, etc.
- Switching tabs loads that car's code into the editor
- Each car compiles and runs its own sandboxed function independently
- Adding a car via "+ Car" initialises its code to the default template
- Removing the last car is not allowed (car 0 is always present)

### UI sketch
```
[ Car 1 ● ] [ Car 2 ] [ Car 3 ]        ← tab bar, ● = active tab
┌────────────────────────────────────┐
│  Monaco editor (car 1's code)      │
└────────────────────────────────────┘
```
Active car tab is highlighted with that car's colour (blue, red, green, amber).

### Implementation
1. **Tab bar** — rendered as `<div class="editor-tabs">` with one `<button>` per car, injected above `#editor-mount` in the DOM
2. **Per-car sandbox state** — `Sandbox.ts` currently holds a single `_compiledFn`. Replace with `Map<number, CompiledSlot>` keyed by car index
3. **Code storage** — `Map<number, string>` in `main.ts` stores each car's source; persists across tab switches
4. **Compile on tab switch** — on leaving a tab, compile + save source; on entering, load source into Monaco
5. **Simulation loop** — `callUserCode(carIndex, sensors, dt, state)` looks up the right compiled function

### Files touched
- `src/editor/Sandbox.ts` — replace single slot with per-car Map
- `src/main.ts` — tab bar creation/destruction, per-car source map, updated loop call
- `index.html` — add `.editor-tabs` container above editor mount
- `index.html` / CSS — tab styling, active colour matches car colour

### Edge cases
- Car removed while its tab is active → switch to car 0's tab
- Car 0 tab close button hidden (cannot remove primary car)
- Compile error on one car doesn't stop others

---

## Feature 3: Collision Debug Overlay

**Goal:** Visualise the physics collision bodies and contact normals on the canvas
so users can understand why a car bounced the way it did.

### Behaviour
- Toggle: **"Debug physics"** checkbox in the telemetry panel
- When enabled, each frame draws on top of the track canvas:
  - **Car body rectangle** — thin coloured outline matching car colour, showing the actual collision box (slightly wider than chassis due to wheels)
  - **Wall bodies** — dim grey outlines at canvas edges
  - **Contact normals** — short arrow drawn from the contact point in the MTV direction, bright red, shown for 10 frames after a collision then fading out
  - **Velocity vector** — short green arrow from car centre showing direction and magnitude of current velocity

### Implementation
1. **Overlay toggle** — new checkbox `#tog-debug` in `telemetry-toggles`; `Renderer.drawFrame` receives `debugEnabled` flag
2. **Debug draw function** — `src/render/DebugOverlay.ts`
   - `drawCarBody(ctx, car)` — rotate and stroke the BODY_W × BODY_H rectangle
   - `drawVelocityVector(ctx, car)` — arrow from (car.x, car.y) scaled to ~50px max
   - `drawContactNormal(ctx, contact)` — arrow at contact point, fades over 10 frames
3. **Contact history** — `PhysicsWorld.resolve()` currently returns `collided: boolean`. Extend return type to include `contacts: ContactEvent[]` where each has `{ point: Vector, normal: Vector }`. Store last N contacts with a frame countdown in `main.ts` and pass to overlay
4. **Wall outline** — draw the 4 wall body bounds using `Matter.Body.bounds`

```ts
interface ContactEvent {
  x: number; y: number      // contact point in world space
  nx: number; ny: number    // outward normal
  ttl: number               // frames remaining to display
}
```

### Files touched
- `src/render/DebugOverlay.ts` — new file
- `src/simulation/Physics.ts` — extend `resolve()` return to include contacts
- `src/render/Renderer.ts` — call `drawDebugOverlay` when flag set
- `src/main.ts` — contact history ring buffer, pass to renderer
- `index.html` — add debug toggle checkbox

---

## Feature 4: Simulation Speed Multiplier

**Goal:** Run the simulation at 2× or 4× wall-clock speed so users can tune
faster without watching the car creep around the track in real time.

### Behaviour
- A speed selector in the header: **1×  2×  4×**
- At 2×: the fixed-timestep accumulator drains twice as fast per real frame
- At 4×: four times as fast
- Telemetry and render still happen at real 60 fps (only physics ticks scale)
- Monaco editor and UI remain responsive

### Why not just change DT?
Changing DT alters the physics (motor lag time constants, battery drain rates are all DT-dependent). Instead, **run more physics ticks per render frame** — the simulation stays physically identical, just faster.

### Implementation
1. **Speed selector** — `<select id="speed-select">` in header with options `1|2|4`
2. **Tick multiplier** — `const speedMult = parseInt(speedSelect.value)`. In the render loop:
   ```ts
   // existing
   accumulator += elapsed
   // becomes
   accumulator += elapsed * speedMult
   ```
   No other changes needed — the physics and motor models are unaffected because DT is constant.
3. **Telemetry decimation** — at 4× speed, telemetry push rate needs adjustment. Change the `% 4` decimation to `% Math.max(1, 4 / speedMult)` so graphs don't fill up instantly at high speed.
4. **Frame budget guard** — the existing `Math.min(elapsed, 0.1)` cap already prevents spiral-of-death. At 4× this means max ~48 ticks per real frame, which is well within budget.

### Files touched
- `index.html` — add `<select id="speed-select">` to header
- `src/main.ts` — read multiplier, scale accumulator, adjust telemetry decimation

### Edge cases
- Switching speed while paused: takes effect on next Run
- Very slow machines at 4×: the frame budget cap keeps them from locking up
- Collision resolution at high speed: no change needed (DT is constant)

---

## Implementation Order (suggested)

```
Feature 4 (Speed)       ← smallest change, highest tuning value
Feature 1 (Live reload) ← quality-of-life, independent of other features
Feature 3 (Debug)       ← useful for understanding collision behaviour
Feature 2 (Per-car PID) ← most complex, builds on the above
```
