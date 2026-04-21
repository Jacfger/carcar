import { weightedCentroid } from '../simulation/Sensors'

export interface UserOutput {
  left:  number
  right: number
}

export interface SandboxCarState {
  voltage:  number
  speed:    number   // m/s, approximate
  time:     number
  ticksL:   number   // accumulated signed tick count, left wheel encoder
  ticksR:   number   // accumulated signed tick count, right wheel encoder
}

type UserFn = (sensors: number[], dt: number, car: SandboxCarState) => UserOutput

let _compiledFn: UserFn | null = null
let _lastError: string | null = null

const TIMEOUT_MS = 8

/**
 * Compile the user's code string into a callable function.
 * Resets internal state (error_sum etc live inside the user's closure scope).
 */
export function compileUserCode(code: string): string | null {
  _lastError = null
  try {
    // Inject helpers into sandbox scope
    const wrapped = `
"use strict";
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const weightedCentroid = __weightedCentroid__;
${code}
if (typeof pid_control !== 'function') throw new Error('pid_control function not defined');
return pid_control;
`
    // eslint-disable-next-line no-new-func
    const factory = new Function('__weightedCentroid__', wrapped)
    _compiledFn = factory(weightedCentroid) as UserFn
    return null  // no error
  } catch (e) {
    _lastError = (e as Error).message
    _compiledFn = null
    return _lastError
  }
}

/**
 * Call the user's pid_control function with current sensor data.
 * Returns { left: 0, right: 0 } and records error if anything throws.
 */
export function callUserCode(
  sensors: number[],
  dt: number,
  carState: SandboxCarState,
): { output: UserOutput; error: string | null } {
  if (!_compiledFn) return { output: { left: 0, right: 0 }, error: _lastError }

  let timedOut = false
  let result: UserOutput = { left: 0, right: 0 }

  try {
    // Rough timeout guard: record start, check after call
    const start = performance.now()
    result = _compiledFn(sensors.slice(), dt, { ...carState })
    const elapsed = performance.now() - start

    if (elapsed > TIMEOUT_MS) {
      timedOut = true
      throw new Error(`pid_control took ${elapsed.toFixed(1)}ms — must run in < ${TIMEOUT_MS}ms`)
    }

    // Validate output shape
    if (typeof result?.left !== 'number' || typeof result?.right !== 'number') {
      throw new Error('pid_control must return { left: number, right: number }')
    }
  } catch (e) {
    _lastError = (e as Error).message
    if (timedOut) _compiledFn = null   // disable runaway function
    return { output: { left: 0, right: 0 }, error: _lastError }
  }

  return { output: result, error: null }
}

export function getLastError(): string | null { return _lastError }
export function clearError(): void { _lastError = null }
