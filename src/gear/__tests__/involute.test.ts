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

  it('twoCubicInvolute throws when fractions are invalid', () => {
    expect(() =>
      twoCubicInvolute({ baseRadius: 20, addendumRadius: 28, startFraction: -0.1 }),
    ).toThrowError('fractions must satisfy 0 <= startFraction < splitFraction < 1')

    expect(() =>
      twoCubicInvolute({ baseRadius: 20, addendumRadius: 28, splitFraction: 1 }),
    ).toThrowError('fractions must satisfy 0 <= startFraction < splitFraction < 1')

    expect(() =>
      twoCubicInvolute({
        baseRadius: 20,
        addendumRadius: 28,
        startFraction: 0.3,
        splitFraction: 0.2,
      }),
    ).toThrowError('fractions must satisfy 0 <= startFraction < splitFraction < 1')
  })

  it('involuteThetaAtRadius throws when radius is below baseRadius', () => {
    expect(() => involuteThetaAtRadius(10, 9.99)).toThrowError(
      'radius must be >= baseRadius for involute',
    )
  })

  it('involutePolarAngle throws when radius is below baseRadius', () => {
    expect(() => involutePolarAngle(10, 9.99)).toThrowError(
      'radius must be >= baseRadius for involute angle',
    )
  })

  it('twoCubicInvolute continuity points are equal values but not same reference', () => {
    const [first, second] = twoCubicInvolute({ baseRadius: 20, addendumRadius: 28 })
    expect(first.p3.x).toBeCloseTo(second.p0.x, 8)
    expect(first.p3.y).toBeCloseTo(second.p0.y, 8)
    expect(second.p0).not.toBe(first.p3)
  })
})
