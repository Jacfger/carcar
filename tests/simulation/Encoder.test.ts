import { describe, it, expect } from 'vitest'
import { createEncoder, resetEncoder } from '../../src/simulation/Encoder'
import { ENCODER_DEFAULTS, WHEEL_RADIUS_M } from '../../src/constants'

describe('createEncoder', () => {
  it('initialises with zero ticks, angle, and fracTick', () => {
    const enc = createEncoder({
      cpr:         ENCODER_DEFAULTS.cpr,
      gearRatio:   ENCODER_DEFAULTS.gearRatio,
      wheelRadius: WHEEL_RADIUS_M,
      noiseRate:   0,
    })
    expect(enc.ticks).toBe(0)
    expect(enc.angle).toBe(0)
    expect(enc.fracTick).toBe(0)
    expect(enc.channelA).toBe(false)
    expect(enc.channelB).toBe(false)
  })

  it('stores provided params', () => {
    const params = { cpr: 10, gearRatio: 2, wheelRadius: 0.033, noiseRate: 0 }
    const enc = createEncoder(params)
    expect(enc.params.cpr).toBe(10)
    expect(enc.params.gearRatio).toBe(2)
  })
})

describe('resetEncoder', () => {
  it('zeroes ticks, angle, and fracTick', () => {
    const enc = createEncoder({ cpr: 20, gearRatio: 3, wheelRadius: 0.033, noiseRate: 0 })
    enc.ticks    = 999
    enc.angle    = 12.5
    enc.fracTick = 0.8
    resetEncoder(enc)
    expect(enc.ticks).toBe(0)
    expect(enc.angle).toBe(0)
    expect(enc.fracTick).toBe(0)
  })
})
