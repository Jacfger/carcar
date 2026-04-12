import { WHEEL_BASE_M, WHEEL_RADIUS_M, SIM_SCALE } from '../constants'
import { createMotor, stepMotor, type MotorState } from './Motor'
import { createBattery, stepBattery, resetBattery, type BatteryState } from './Battery'
import { ballCasterPerturbation } from './BallCaster'
import { readSensors } from './Sensors'
import type { TrackRenderer } from '../track/TrackRenderer'

export interface CarOptions {
  startX:    number
  startY:    number
  startAngle: number
  varianceEnabled: boolean
  batteryEnabled:  boolean
  casterEnabled:   boolean
}

export interface CarState {
  // World position (pixels)
  x:       number
  y:       number
  heading: number   // radians
  // Velocities (pixels/s)
  vx:      number
  vy:      number
  omega:   number   // angular velocity (rad/s)
  // Subsystems
  motorL:   MotorState
  motorR:   MotorState
  battery:  BatteryState
  // Last sensor readings (updated each tick)
  sensors:  number[]
  // Last PWM commands (for telemetry)
  pwmL:     number
  pwmR:     number
  // Simulation time
  time:     number
}

export function createCar(opts: CarOptions): CarState {
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
  }
}

export function resetCar(car: CarState, opts: CarOptions): void {
  car.x       = opts.startX
  car.y       = opts.startY
  car.heading = opts.startAngle
  car.vx = 0; car.vy = 0; car.omega = 0
  car.motorL  = createMotor(opts.varianceEnabled)
  car.motorR  = createMotor(opts.varianceEnabled)
  resetBattery(car.battery)
  car.sensors.fill(0)
  car.pwmL = 0; car.pwmR = 0
  car.time = 0
}

/**
 * Advance the car simulation by one fixed timestep.
 *
 * @param car          mutable car state
 * @param pwmL         user-commanded left PWM  [-255, 255] (will be clamped)
 * @param pwmR         user-commanded right PWM [-255, 255]
 * @param dt           seconds per tick
 * @param trackRenderer for sensor pixel sampling
 * @param opts         feature toggles
 */
export function stepCar(
  car: CarState,
  pwmL: number,
  pwmR: number,
  dt: number,
  trackRenderer: TrackRenderer,
  opts: Pick<CarOptions, 'batteryEnabled' | 'casterEnabled'>,
): void {
  car.time += dt

  // 1. Clamp and store PWM (clamping also happens inside stepMotor, belt+suspenders)
  car.pwmL = Math.max(-255, Math.min(255, pwmL))
  car.pwmR = Math.max(-255, Math.min(255, pwmR))

  // 2. Battery
  const voltage = stepBattery(car.battery, car.pwmL, car.pwmR, dt, opts.batteryEnabled)

  // 3. Motor model → wheel linear speeds (m/s)
  const vL_m = stepMotor(car.motorL, car.pwmL, voltage, dt, WHEEL_RADIUS_M)
  const vR_m = stepMotor(car.motorR, car.pwmR, voltage, dt, WHEEL_RADIUS_M)

  // 4. Differential drive kinematics
  const v_m     = (vL_m + vR_m) / 2                        // linear speed (m/s)
  const omega   = (vR_m - vL_m) / WHEEL_BASE_M             // angular velocity (rad/s)

  // Convert to pixel/s for world-space movement
  const v_px = v_m * SIM_SCALE

  // 5. Ball caster lateral perturbation (adds small yaw noise)
  const casterDelta = ballCasterPerturbation(car.time, v_m, opts.casterEnabled)

  // 6. Integrate heading
  car.omega   = omega + casterDelta
  car.heading += car.omega * dt

  // 7. Integrate position
  car.vx = v_px * Math.cos(car.heading)
  car.vy = v_px * Math.sin(car.heading)
  car.x += car.vx * dt
  car.y += car.vy * dt

  // 8. Sample sensors from track
  car.sensors = readSensors(car.x, car.y, car.heading, trackRenderer)
}
