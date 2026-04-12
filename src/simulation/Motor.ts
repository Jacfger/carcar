import { MOTOR_DEFAULTS, BATTERY } from '../constants'

function randInRange(range: readonly [number, number]): number {
  return range[0] + Math.random() * (range[1] - range[0])
}

export interface MotorParams {
  efficiency: number   // multiplier on omega_max
  deadband:   number   // normalised duty fraction below which motor is silent
  tau:        number   // mechanical time constant (s)
}

export interface MotorState {
  params:    MotorParams
  omega:     number    // current angular velocity (rad/s)
}

export function createMotor(varianceEnabled: boolean): MotorState {
  return {
    params: {
      efficiency: varianceEnabled ? randInRange(MOTOR_DEFAULTS.efficiency_range) : 1.0,
      deadband:   varianceEnabled ? randInRange(MOTOR_DEFAULTS.deadband_range)   : 0.0,
      tau:        varianceEnabled ? randInRange(MOTOR_DEFAULTS.tau_range)        : 0.05,
    },
    omega: 0,
  }
}

/**
 * Step the motor model one simulation tick.
 * @param motor  mutable motor state (omega is updated in place)
 * @param pwm    raw PWM from user code, will be clamped [-255, 255]
 * @param voltage current battery voltage
 * @param dt     seconds since last tick
 * @returns wheel linear speed in m/s
 */
export function stepMotor(
  motor: MotorState,
  pwm: number,
  voltage: number,
  dt: number,
  wheelRadiusM: number,
): number {
  // 1. Clamp PWM to valid duty-cycle range
  const pwm_c = Math.max(-255, Math.min(255, pwm))

  // 2. Normalise to [-1, 1]
  const duty = pwm_c / 255

  // 3. Apply deadband — remap remaining range to [-1, 1]
  const db = motor.params.deadband
  let effective: number
  if (Math.abs(duty) < db) {
    effective = 0
  } else {
    effective = Math.sign(duty) * (Math.abs(duty) - db) / (1 - db)
  }

  // 4. Target angular velocity (voltage scaling + motor efficiency)
  const omega_target = effective
    * MOTOR_DEFAULTS.omega_max
    * motor.params.efficiency
    * (voltage / BATTERY.V_nominal)

  // 5. First-order lag toward target (motor mechanical inertia)
  const alpha = 1 - Math.exp(-dt / motor.params.tau)
  motor.omega += (omega_target - motor.omega) * alpha

  // 6. Return wheel linear speed
  return motor.omega * wheelRadiusM
}
