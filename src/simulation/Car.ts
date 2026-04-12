import Matter from 'matter-js'
import { WHEEL_BASE_M, WHEEL_RADIUS_M, SIM_SCALE } from '../constants'
import { createMotor, stepMotor, type MotorState } from './Motor'
import { createBattery, stepBattery, resetBattery, type BatteryState } from './Battery'
import { ballCasterPerturbation } from './BallCaster'
import { readSensors } from './Sensors'
import type { TrackRenderer } from '../track/TrackRenderer'

export interface CarOptions {
  startX:          number
  startY:          number
  startAngle:      number
  varianceEnabled: boolean
  batteryEnabled:  boolean
  casterEnabled:   boolean
  colorIndex:      number
}

export interface CarState {
  // World position (pixels, CSS-pixel space)
  x:       number
  y:       number
  heading: number   // radians, 0 = right, π/2 = down

  // Actual resolved velocities (set after physics, px/s)
  vx:    number
  vy:    number
  omega: number

  // Subsystems
  motorL:  MotorState
  motorR:  MotorState
  battery: BatteryState

  // Last sensor readings (updated each tick after physics)
  sensors: number[]

  // Last clamped PWM commands (for telemetry)
  pwmL: number
  pwmR: number

  // Simulation time (s)
  time: number

  // Matter.js rigid body (owned by PhysicsWorld)
  body: Matter.Body

  // Visual identity
  colorIndex: number
}

// ─── Colour palette for multi-car ─────────────────────────────────────────────
export const CAR_COLORS = ['#2a5caa', '#aa2a2a', '#1a8a3a', '#a07020'] as const

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export function createCar(opts: CarOptions, body: Matter.Body): CarState {
  return {
    x:       opts.startX,
    y:       opts.startY,
    heading: opts.startAngle,
    vx: 0, vy: 0, omega: 0,
    motorL:  createMotor(opts.varianceEnabled),
    motorR:  createMotor(opts.varianceEnabled),
    battery: createBattery(),
    sensors: new Array(7).fill(0),
    pwmL: 0, pwmR: 0,
    time: 0,
    body,
    colorIndex: opts.colorIndex,
  }
}

export function resetCar(car: CarState, opts: CarOptions): void {
  car.x       = opts.startX
  car.y       = opts.startY
  car.heading = opts.startAngle
  car.vx = 0; car.vy = 0; car.omega = 0
  car.motorL = createMotor(opts.varianceEnabled)
  car.motorR = createMotor(opts.varianceEnabled)
  resetBattery(car.battery)
  car.sensors.fill(0)
  car.pwmL = 0; car.pwmR = 0
  car.time = 0
  Matter.Body.setPosition(car.body, { x: opts.startX, y: opts.startY })
  Matter.Body.setAngle(car.body, opts.startAngle)
}

// ─── Simulation steps ─────────────────────────────────────────────────────────

/**
 * Step 1 of 2: run the car's internal model.
 *
 * Updates: time, PWM clamp, battery voltage, motor omegas, heading.
 * Returns the desired world-space velocity for this tick.
 * Does NOT update car.x / car.y — that is done by applyResolvedMotion
 * after the physics world resolves collisions.
 */
export function stepCarModel(
  car:   CarState,
  pwmL:  number,
  pwmR:  number,
  dt:    number,
  opts:  Pick<CarOptions, 'batteryEnabled' | 'casterEnabled'>,
): { vx: number; vy: number; omega: number } {
  car.time += dt

  // 1. Clamp PWM
  car.pwmL = Math.max(-255, Math.min(255, pwmL))
  car.pwmR = Math.max(-255, Math.min(255, pwmR))

  // 2. Battery voltage (sags under load, drains over time)
  const voltage = stepBattery(car.battery, car.pwmL, car.pwmR, dt, opts.batteryEnabled)

  // 3. Motor model → wheel linear speeds (m/s)
  const vL_m = stepMotor(car.motorL, car.pwmL, voltage, dt, WHEEL_RADIUS_M)
  const vR_m = stepMotor(car.motorR, car.pwmR, voltage, dt, WHEEL_RADIUS_M)

  // 4. Differential drive kinematics
  const v_m = (vL_m + vR_m) / 2          // forward speed (m/s)
  const omega_drive = (vR_m - vL_m) / WHEEL_BASE_M  // angular velocity (rad/s)

  // 5. Ball caster lateral perturbation
  const casterDelta = ballCasterPerturbation(car.time, v_m, opts.casterEnabled)
  const omega = omega_drive + casterDelta

  // 6. Integrate heading (heading is ours — physics doesn't rotate the car)
  car.heading += omega * dt

  // 7. Desired world velocity (px/s)
  const v_px = v_m * SIM_SCALE
  return {
    vx:    v_px * Math.cos(car.heading),
    vy:    v_px * Math.sin(car.heading),
    omega,
  }
}

/**
 * Step 2 of 2: apply the resolved velocity (after collision response) to the
 * car state, then sample sensors.
 *
 * Call this after PhysicsWorld.resolve() returns the corrected velocity.
 */
export function applyResolvedMotion(
  car:           CarState,
  resolvedVx:    number,
  resolvedVy:    number,
  resolvedOmega: number,
  dt:            number,
  trackRenderer: TrackRenderer,
): void {
  // Read back position from physics body (it was updated by PhysicsWorld.resolve)
  car.x  = car.body.position.x
  car.y  = car.body.position.y

  // Store resolved velocities for telemetry / sandbox exposure
  car.vx    = resolvedVx
  car.vy    = resolvedVy
  car.omega = resolvedOmega

  // If collision changed omega, fix up heading to match
  // (physics body angle was set during resolve; re-sync heading from it)
  car.heading = car.body.angle

  // Sample track sensors at new position
  car.sensors = readSensors(car.x, car.y, car.heading, trackRenderer)

  void dt  // dt available if needed for future use
}
