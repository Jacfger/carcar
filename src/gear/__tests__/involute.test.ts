import { describe, expect, it } from 'vitest'
import {
  involutePoint,
  involutePolarAngle,
  involuteThetaAtRadius,
  twoCubicInvolute,
} from '../involute'

describe('involute equations', () => {
  it('involuteThetaAtRadius returns theta=0 at base circle', () => {
    expect(involuteThetaAtRadius(10, 10)).toBeCloseTo(0, 10)
  })

  it('involutePoint returns base point at theta=0', () => {
    const p = involutePoint(10, 0)
    expect(p.x).toBeCloseTo(10, 10)
    expect(p.y).toBeCloseTo(0, 10)
  })

  it('twoCubicInvolute returns 2 segments and keeps C0 continuity', () => {
    const segs = twoCubicInvolute({ baseRadius: 20, addendumRadius: 28 })
    expect(segs).toHaveLength(2)
    expect(segs[0].p3.x).toBeCloseTo(segs[1].p0.x, 8)
    expect(segs[0].p3.y).toBeCloseTo(segs[1].p0.y, 8)
  })

  it('involutePolarAngle returns finite value', () => {
    const psi = involutePolarAngle(10, 12)
    expect(Number.isFinite(psi)).toBe(true)
  })
})
