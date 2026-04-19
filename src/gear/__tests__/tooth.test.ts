import { describe, expect, it } from 'vitest'
import { buildToothProfile, computeGearGeometry } from '../tooth'

describe('tooth generation', () => {
  it('computeGearGeometry gives expected pitch and base radius', () => {
    const g = computeGearGeometry({ module: 3, teeth: 20, pressureAngle: 20 })
    expect(g.pitchRadius).toBeCloseTo(30, 10)
    expect(g.baseRadius).toBeCloseTo(30 * Math.cos((20 * Math.PI) / 180), 10)
  })

  it('buildToothProfile returns two segments per flank and mirrored flank', () => {
    const geometry = computeGearGeometry({ module: 3, teeth: 20, pressureAngle: 20 })
    const tooth = buildToothProfile(geometry)

    expect(tooth.flank).toHaveLength(2)
    expect(tooth.mirroredFlank).toHaveLength(2)

    expect(tooth.flank[0].p3.x).toBeCloseTo(tooth.flank[1].p0.x, 8)
    expect(tooth.flank[0].p3.y).toBeCloseTo(tooth.flank[1].p0.y, 8)

    expect(tooth.mirroredFlank[0].p3.x).toBeCloseTo(tooth.mirroredFlank[1].p0.x, 8)
    expect(tooth.mirroredFlank[0].p3.y).toBeCloseTo(tooth.mirroredFlank[1].p0.y, 8)

    expect(tooth.mirroredFlank[0].p0.x).toBeCloseTo(tooth.flank[0].p0.x, 8)
    expect(tooth.mirroredFlank[0].p0.y).toBeCloseTo(-tooth.flank[0].p0.y, 8)
    expect(tooth.mirroredFlank[1].p3.x).toBeCloseTo(tooth.flank[1].p3.x, 8)
    expect(tooth.mirroredFlank[1].p3.y).toBeCloseTo(-tooth.flank[1].p3.y, 8)
  })

  it('buildToothProfile supports internal gears', () => {
    const geometry = computeGearGeometry({ module: 3, teeth: -40, pressureAngle: 20 })

    expect(() => buildToothProfile(geometry)).not.toThrow()
  })
})
