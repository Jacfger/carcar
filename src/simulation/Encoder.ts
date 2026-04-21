import type { MotorState } from './Motor'

export interface EncoderParams {
  cpr:         number   // pulses per encoder shaft revolution
  gearRatio:   number   // encoder shaft turns per wheel turn
  wheelRadius: number   // metres
  noiseRate:   number   // probability [0,1] of dropping a tick (0 = clean)
}

export interface EncoderState {
  params:   EncoderParams
  angle:    number    // accumulated encoder shaft angle (radians)
  channelA: boolean   // current A channel state
  channelB: boolean   // current B channel state
  ticks:    number    // accumulated signed tick count (reset on car reset only)
  fracTick: number    // sub-tick accumulator (internal — avoids rounding drift)
}

export function createEncoder(params: EncoderParams): EncoderState {
  return { params, angle: 0, channelA: false, channelB: false, ticks: 0, fracTick: 0 }
}

export function resetEncoder(state: EncoderState): void {
  state.angle    = 0
  state.channelA = false
  state.channelB = false
  state.ticks    = 0
  state.fracTick = 0
}

/**
 * Step the encoder one simulation tick.
 * Updates angle, channelA, channelB, and ticks in place.
 *
 * Uses analytical tick counting (not an edge state-machine) to avoid
 * undersampling at 120 Hz with high CPR × gearRatio values.
 * The fracTick accumulator preserves sub-tick precision across steps.
 */
export function stepEncoder(
  state: EncoderState,
  motor: MotorState,
  dt:    number,
): void {
  const { cpr, gearRatio, noiseRate } = state.params

  // 1. Advance encoder shaft angle (wheel omega × gear ratio)
  const dAngle = motor.omega * gearRatio * dt
  state.angle += dAngle

  // 2. Derive A/B channel states from angle — B lags A by 90° (quadrature)
  state.channelA = Math.sin(state.angle * cpr) > 0
  state.channelB = Math.sin(state.angle * cpr - Math.PI / 2) > 0

  // 3. Compute ticks analytically: one encoder shaft revolution = CPR × 4 ticks
  //    fracTick carries the sub-tick remainder across steps.
  //    Round to nearest integer when within epsilon to avoid floating-point drift.
  const rawDelta = (dAngle / (2 * Math.PI)) * cpr * 4
  state.fracTick += rawDelta
  const rounded = Math.round(state.fracTick)
  const eps = 1e-9
  const intDelta = Math.abs(state.fracTick - rounded) < eps
    ? rounded
    : Math.trunc(state.fracTick)
  state.fracTick -= intDelta

  // 4. Noise: randomly drop one tick (only active when noiseRate > 0)
  if (noiseRate > 0 && intDelta !== 0 && Math.random() < noiseRate) return

  state.ticks += intDelta
}
