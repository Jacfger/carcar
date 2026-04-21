import { describe, it, expect } from 'vitest'
import { createEncoder, resetEncoder, stepEncoder } from '../../src/simulation/Encoder'
import type { MotorState } from '../../src/simulation/Motor'
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
    expect(enc.channelA).toBe(false)
    expect(enc.channelB).toBe(false)
  })
})

function makeMockMotor(omega: number): MotorState {
  return { params: { efficiency: 1, deadband: 0, tau: 0.05 }, omega }
}

const DT = 1 / 120

describe('stepEncoder', () => {
  it('accumulates CPR * gearRatio * 4 ticks per wheel revolution (forward)', () => {
    // One wheel revolution in 100 steps:  omega * DT * 100 = 2π → omega = 2π * 120/100
    const enc   = createEncoder({ cpr: 20, gearRatio: 3, wheelRadius: 0.033, noiseRate: 0 })
    const motor = makeMockMotor(2 * Math.PI * 120 / 100)
    for (let i = 0; i < 100; i++) stepEncoder(enc, motor, DT)
    expect(enc.ticks).toBe(20 * 3 * 4)   // 240
  })

  it('accumulates negative ticks when rotating backward', () => {
    const enc   = createEncoder({ cpr: 20, gearRatio: 3, wheelRadius: 0.033, noiseRate: 0 })
    const motor = makeMockMotor(-(2 * Math.PI * 120 / 100))
    for (let i = 0; i < 100; i++) stepEncoder(enc, motor, DT)
    expect(enc.ticks).toBe(-(20 * 3 * 4))  // -240
  })

  it('produces zero ticks when omega is zero', () => {
    const enc   = createEncoder({ cpr: 20, gearRatio: 3, wheelRadius: 0.033, noiseRate: 0 })
    const motor = makeMockMotor(0)
    for (let i = 0; i < 100; i++) stepEncoder(enc, motor, DT)
    expect(enc.ticks).toBe(0)
  })

  it('higher CPR produces proportionally more ticks per revolution', () => {
    const motor = makeMockMotor(2 * Math.PI * 120 / 100)
    const enc4  = createEncoder({ cpr: 4,  gearRatio: 1, wheelRadius: 0.033, noiseRate: 0 })
    const enc20 = createEncoder({ cpr: 20, gearRatio: 1, wheelRadius: 0.033, noiseRate: 0 })
    for (let i = 0; i < 100; i++) {
      stepEncoder(enc4,  motor, DT)
      stepEncoder(enc20, motor, DT)
    }
    expect(enc4.ticks).toBe(4  * 1 * 4)   // 16
    expect(enc20.ticks).toBe(20 * 1 * 4)  // 80
  })

  it('channelA and channelB reflect the current angle', () => {
    const enc   = createEncoder({ cpr: 4, gearRatio: 1, wheelRadius: 0.033, noiseRate: 0 })
    const motor = makeMockMotor(1)
    for (let i = 0; i < 10; i++) stepEncoder(enc, motor, DT)
    expect(enc.channelA).toBe(Math.sin(enc.angle * enc.params.cpr) > 0)
    expect(enc.channelB).toBe(Math.sin(enc.angle * enc.params.cpr - Math.PI / 2) > 0)
  })
})
