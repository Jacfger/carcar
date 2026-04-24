export const DEFAULT_PID_CODE = `// sensors: array of 7 floats — 0.0 = white (off line), 1.0 = black (on line)
// dt:      seconds since last tick (~0.0083 s at 120 Hz)
// car:     { voltage, speed, time, ticksL, ticksR }
//   ticksL / ticksR — accumulated encoder ticks since last Reset
//   wheel speed example:
//     let prevL = 0
//     const dL  = ticksL - prevL;  prevL = ticksL
//     const speedL_ms = (dL / dt) * (2 * Math.PI * 0.033) / (20 * 3 * 4)
//     // wheel radius 0.033 m, CPR 20, gear ratio 3, ×4 quadrature
// helpers: weightedCentroid(sensors) → [-1, 1],  clamp(v, lo, hi)
//
// Return { left, right } PWM in range [-255, 255]

let errorSum  = 0
let lastError = 0

function pid_control(sensors, dt, car) {
  const error = -weightedCentroid(sensors)

  errorSum  += error * dt
  const dError = (error - lastError) / dt
  lastError = error

  const Kp = 150
  const Ki = 1
  const Kd = 12

  const base       = 180
  const correction = Kp * error + Ki * errorSum + Kd * dError

  return {
    left:  clamp(base + correction, -255, 255),
    right: clamp(base - correction, -255, 255),
  }
}
`
