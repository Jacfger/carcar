# AB Quadrature Encoder — Design Spec

**Date:** 2026-04-13  
**Status:** Approved

## Problem

The car's `pid_control` function currently has no reliable per-wheel speed feedback. The single `car.speed` value is approximate and does not distinguish left from right. Without per-wheel feedback, the user cannot write a speed-control inner loop, so the car's actual speed varies with battery sag, motor variance, and load — even when PWM commands are constant.

## Goal

Emulate a real AB (quadrature) encoder on each drive wheel, expose raw tick counts to user code, and provide a 3D visualization in the telemetry panel so users can see the encoder operating in real time.

---

## Section 1 — Encoder Model (`src/simulation/Encoder.ts`)

### Data structures

```ts
interface EncoderParams {
  cpr:         number   // pulses per encoder shaft revolution
  gearRatio:   number   // encoder shaft turns per wheel turn
  wheelRadius: number   // metres — mirrors WHEEL_RADIUS_M but overridable
  noiseRate:   number   // probability [0,1] of dropping a tick per edge (0 = clean)
}

interface EncoderState {
  params:   EncoderParams
  angle:    number    // accumulated encoder shaft angle (radians)
  channelA: boolean   // live A channel state
  channelB: boolean   // live B channel state
  ticks:    number    // accumulated signed tick count (resets on car reset only)
}
```

### `stepEncoder(state, motor, dt)` — called once per simulation tick

1. `dAngle = motor.omega × gearRatio × dt` — advance encoder shaft angle
2. Derive channel states:
   - `channelA = sin(angle × CPR) > 0`
   - `channelB = sin(angle × CPR − π/2) > 0`  ← 90° offset = quadrature
3. Edge detection: map `(prevA, prevB, newA, newB)` through a 16-entry lookup table → `tickDelta ∈ {−1, 0, +1}`. This implements full ×4 quadrature counting and is direction-aware (reversal at low speed causes tick oscillation, as on real hardware).
4. Noise (only when variance mode is enabled): skip the tick with probability `noiseRate`.
5. `state.ticks += tickDelta`

### Derived resolution (for documentation / UI display)

```
ticks per wheel revolution = CPR × gearRatio × 4
distance per tick (mm)     = (2π × wheelRadius × 1000) / (CPR × gearRatio × 4)
```

Default values (in `src/constants.ts` as `ENCODER_DEFAULTS`):

| Parameter   | Default | Notes                        |
|-------------|---------|------------------------------|
| CPR         | 20      | pulses per encoder shaft rev |
| Gear ratio  | 3.0     | encoder turns per wheel turn |
| Wheel radius| 0.033 m | mirrors `WHEEL_RADIUS_M`     |
| Noise rate  | 0.02    | 2% tick drop when noise on   |

---

## Section 2 — 3D Visualization & Telemetry Tab

### Technology

Three.js added as a project dependency. Renders inside a `<canvas>` mounted in the encoder tab. Animated with its own `requestAnimationFrame` loop, paused when the tab is not visible.

### 3D scene

- Disc mesh with radial slots matching the live CPR value, spinning at encoder shaft speed (visually scaled for readability at high RPM)
- Two sensor dots above the disc surface — **A (blue)** and **B (red)** — that illuminate when their channel is `true`
- Directional arrow on the hub indicating forward vs reverse rotation

### Scrolling waveform (2D canvas below the disc)

Shows the last ~200 ticks of A and B channel states as live square waves, matching the style of the existing telemetry graphs.

### Tab layout

```
[ Graphs ]  [ Encoder ]          ← added to existing telemetry tab bar
```

- **Encoder tab** hides the telemetry canvas and shows the Three.js canvas + waveform
- **Left / Right selector** to switch which wheel's encoder is shown
- **Tick count readout**: `L: +00412  R: +00408` (monospace, updates each render frame)
- Encoder parameters shown as read-only values (CPR, gear ratio, wheel radius)

### Files

- `src/render/EncoderTab.ts` — Three.js scene, waveform canvas, tick readout
- `index.html` — tab buttons, encoder canvas mount point
- `src/main.ts` — passes encoder state to `EncoderTab` each render frame

---

## Section 3 — User API & Parameter UI

### `pid_control` — updated `car` object

```ts
interface SandboxCarState {
  voltage: number   // existing
  speed:   number   // existing (approximate combined speed)
  time:    number   // existing
  ticksL:  number   // NEW — accumulated signed ticks, left wheel
  ticksR:  number   // NEW — accumulated signed ticks, right wheel
}
```

Ticks are never reset mid-run — only on car Reset. The user computes per-wheel speed:

```js
// In pid_control:
const dTicksL = ticksL - prevTicksL
const dTicksR = ticksR - prevTicksR
// ticks/s → m/s:  dTicks * (2π * 0.033) / (20 * 3 * 4) / dt
```

### Default code template addition

A commented example block is added to `src/editor/defaultCode.ts` showing the encoder-to-speed pattern above.

### Parameter UI

New row in the options panel (same style as variance/battery/caster):

| Control         | Type     | Default |
|-----------------|----------|---------|
| CPR             | number input | 20  |
| Gear ratio      | number input | 3.0 |
| Wheel radius    | read-only    | 33 mm |
| Encoder noise   | checkbox     | off (active only when variance is on) |

---

## Files Touched (summary)

| File | Change |
|------|--------|
| `src/simulation/Encoder.ts` | **new** — EncoderParams, EncoderState, createEncoder, stepEncoder |
| `src/render/EncoderTab.ts` | **new** — Three.js scene, waveform, tick readout |
| `src/simulation/Car.ts` | Add `encoderL`, `encoderR` to CarState; call stepEncoder in stepCarModel |
| `src/editor/Sandbox.ts` | Add `ticksL`, `ticksR` to SandboxCarState |
| `src/editor/defaultCode.ts` | Add commented encoder usage example |
| `src/constants.ts` | Add `ENCODER_DEFAULTS` |
| `index.html` | Encoder tab button, canvas mount, parameter inputs |
| `src/main.ts` | Pass encoder state to EncoderTab each frame |
