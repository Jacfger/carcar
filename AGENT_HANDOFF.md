# Agent Handoff — PID Car Simulator

## What this project is

A browser-based educational simulator where users write and tune a PID algorithm (in a Monaco code editor) to control a line-tracking car. The car follows a black line on a white track, with realistic physical imperfections. Built with **Vite + TypeScript**, no framework.

---

## Tech stack

| Concern | Tool |
|---|---|
| Build | Vite 6 + TypeScript 5 |
| Physics / collision | Matter.js 0.19 (collision geometry only — no Engine.update) |
| Code editor | Monaco Editor 0.52 (lazy-loaded) |
| Rendering | Canvas 2D API |
| Package manager | npm (node via nvm, use `fish -c "nvm use v22.15.0 && ..."`) |

Dev server: `npm run dev` → `http://localhost:5173`
Type-check: `npx tsc --noEmit`

---

## File map

```
index.html                  — layout, all DOM, CSS-in-<style>
src/
  constants.ts              — SINGLE SOURCE OF TRUTH for all geometry + physics constants
  main.ts                   — entry: wires everything, simulation loop, event handlers
  simulation/
    Car.ts                  — CarState, createCar, resetCar, stepCarModel, applyResolvedMotion
    Motor.ts                — PWM → target omega → actual omega (first-order lag)
    Battery.ts              — voltage sag under load + slow capacity drain
    BallCaster.ts           — smooth noise lateral perturbation (yaw noise)
    Sensors.ts              — readSensors (pixel sampling), weightedCentroid helper
    Physics.ts              — PhysicsWorld: Matter.js walls + kinematic collision resolver
  track/
    Track.ts                — Track interface type
    TrackRenderer.ts        — renders track to offscreen canvas (display + sensor sampling)
    presets/oval.ts
    presets/figure8.ts
    presets/chicane.ts      — Catmull-Rom spline through waypoints
  render/
    CarShape.ts             — draws car from CAR_GEOMETRY constants
    Renderer.ts             — blits track + all cars + telemetry each frame
    Telemetry.ts            — ring-buffer sparkline charts (error / PWM / voltage)
  editor/
    Sandbox.ts              — sandboxed new Function() runner with timeout guard
    defaultCode.ts          — starter PID template shown in Monaco
```

---

## Architecture: simulation loop (main.ts)

Each physics tick (120 Hz fixed timestep):

```
1. callUserCode(sensors, dt, {voltage, speed, time})
      → {left: pwm, right: pwm}   (user's pid_control function)

2. Scale PWM by max-speed slider factor (5–100%)

3. stepCarModel(car, scaledLeft, scaledRight, dt, opts)
      — clamps PWM to [-255, 255]
      — steps Battery (voltage sag)
      — steps Motor L and R (deadband → efficiency → voltage scaling → first-order lag)
      — differential drive: v = (vL+vR)/2, omega = (vR-vL)/wheelbase
      — adds ball caster yaw noise
      — integrates heading: car.heading += omega * dt
      → returns {vx, vy, omega} desired world velocity (px/s)

4. physics.resolve(body, vx, vy, omega, otherBodies, dt)
      — moves Matter.js body to desired position
      — Query.collides against walls + other car bodies
      — MTV push-out + velocity projection (up to 3 passes)
      — car-to-car: nudges the other body by half the penetration depth
      → returns {vx, vy, omega, collided} (resolved, may differ on collision)

5. applyResolvedMotion(car, resolvedVx, resolvedVy, resolvedOmega, dt, trackRenderer)
      — reads car.x, car.y from body.position (set by physics)
      — reads car.heading from body.angle
      — samples sensors via pixel lookup on offscreen canvas
```

Render (60 fps, separate RAF loop): blits offscreen track canvas → draws all cars → draws telemetry sparklines.

---

## Key coordinate system facts (critical for any geometry work)

- Canvas: **X right, Y down**. Angles measured **clockwise** from +X.
- `car.heading` = velocity direction angle. At `heading=0`, car moves **right** (`vx=v, vy=0`).
- **The renderer and sensor transform both apply `heading + π/2`** (not `heading`) so the car's visual front (local −Y) aligns with the velocity direction. This was a bug that was fixed — do not remove this offset.
  - `CarShape.ts`: `ctx.rotate(car.heading + Math.PI / 2)`
  - `Sensors.ts`: `cosH = -sin(heading)`, `sinH = cos(heading)`
- Sensor local coords: lx spans `[-sensor_spread/2, +sensor_spread/2]`, ly = `sensor_y = -38`.
  - After the +π/2 transform, local **+X** maps to the car's **left** side.
  - `weightedCentroid` returns negative when line is on the **right** side, positive when on the **left**.
  - The default PID uses `left = base + correction, right = base - correction`, which is correct with this convention.
- `omega = (vR - vL) / wheelbase`. Positive omega → heading increases → **clockwise** (right turn) in canvas.

---

## Physics model details

### Motor (`Motor.ts`)
```
pwm  → clamp [-255,255]
     → duty = pwm/255
     → deadband removal: |duty| < deadband → 0, else remap to [-1,1]
     → omega_target = effective * omega_max * efficiency * (voltage / V_nominal)
     → omega += (omega_target - omega) * (1 - exp(-dt / tau))   ← first-order lag
     → wheel_speed = omega * WHEEL_RADIUS_M   (m/s)
```
Each motor has randomised `efficiency` (0.93–1.07), `deadband` (0.05–0.18), `tau` (0.04–0.10s) set at spawn. Variance is toggled by the "Motor variance" checkbox.

### Battery (`Battery.ts`)
- Voltage sags under load: `V = V_full * charge - current * R_internal`
- Slow drain: `charge -= capacity_drain * dt` (when drain toggle is on)
- Floors at `V_min = 5.5V`

### Collision (`Physics.ts`)
- Matter.js used ONLY for geometry (`Query.collides`) — no `Engine.update`.
- Car body: rectangle `BODY_W × BODY_H` (≈ 72 × 72px — nearly square).
- Normal direction made robust: dot-check against `(car_pos - obstacle_pos)` to ensure normal always points away from obstacle.
- Up to 3 resolution passes per tick to handle corners.
- On collision: `omega *= 0.5` (angular damping), slight restitution (1.1×) on linear component.

---

## Multi-car

- Up to 4 cars (`MAX_CARS = 4`). Each has its own `CarState` + `Matter.Body`.
- All cars run the **same** compiled PID code (per-car editors are a planned feature).
- Motor variance seeds are independent per car per spawn.
- Start positions are slightly offset: `sin(index * 1.2) * 20` lateral, `-index * 30` longitudinal.
- Telemetry tracks car[0] only.

---

## User sandbox (`Sandbox.ts`)

- Code compiled via `new Function(...)` — no DOM/fetch access.
- Hard 8ms timeout per call; runaway functions are disabled.
- Helpers injected into scope: `clamp(v, lo, hi)`, `weightedCentroid(sensors)`.
- User function signature: `function pid_control(sensors, dt, car) → {left, right}`
  - `sensors`: `number[7]`, 0.0 = white, 1.0 = black line
  - `dt`: seconds since last tick (≈ 1/120)
  - `car`: `{voltage, speed, time}`

---

## Known issues / watch-outs

- **Heading double-update on collision**: `stepCarModel` integrates `car.heading += omega*dt`, then `Physics.resolve` also sets `body.angle = body.angle + omega*dt`. `applyResolvedMotion` then overwrites `car.heading = body.angle`. When collision damps `omega`, the body angle has already been set with the original omega before damping — there is a one-tick heading inconsistency after collisions. Not visually noticeable but worth fixing if collision steering becomes important.
- **All cars share one PID**: planned feature (per-car editors) not yet built.
- **Track sensor vs display resolution**: the offscreen canvas is in physical pixels (devicePixelRatio scaled), but sensor sampling passes CSS-pixel car coordinates. Works correctly because `TrackRenderer.sampleAt` uses the full-res canvas — just be aware of this if refactoring either.

---

## Remaining planned features (see PLAN.md for full detail)

| Feature | Complexity | Key files |
|---|---|---|
| **Live recompile on Ctrl+S** | Low | `Sandbox.ts`, `main.ts` |
| **Per-car PID editors** (tab bar, per-car Monaco code) | High | `Sandbox.ts`, `main.ts`, `index.html` |
| **Collision debug overlay** (body outlines, contact normals) | Medium | new `DebugOverlay.ts`, `Physics.ts`, `Renderer.ts` |
| **Simulation speed multiplier** (1×/2×/4× tick rate) | Low | `main.ts`, `index.html` |

---

## Constants to know (`constants.ts`)

```ts
CAR_GEOMETRY.chassis_w  = 52      // chassis px
CAR_GEOMETRY.chassis_h  = 72
CAR_GEOMETRY.wheel_w    = 10
CAR_GEOMETRY.wheel_h    = 26
CAR_GEOMETRY.axle_y     = 12      // local Y of drive axle
CAR_GEOMETRY.caster_y   = 32      // local Y of ball caster
CAR_GEOMETRY.sensor_y   = -38     // local Y of sensor bar (front)
CAR_GEOMETRY.sensor_count = 7
CAR_GEOMETRY.sensor_spread = 56   // total sensor bar width

WHEEL_OFFSET_X          = 31      // derived: chassis_w/2 + wheel_w/2
WHEEL_BASE_M            = 0.092   // physics wheel base (metres)
WHEEL_RADIUS_M          = 0.033
SIM_SCALE               = 1600    // pixels per metre
PHYSICS_HZ              = 120     // fixed timestep rate
```
