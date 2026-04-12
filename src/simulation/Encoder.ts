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
