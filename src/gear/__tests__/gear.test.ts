import { describe, expect, it } from 'vitest'
import { createInternalGear, createSpurGear } from '../gear'
import { calculateMesh as calculateMeshFromIndex, createGearPair as createGearPairFromIndex } from '../index'

describe('gear outputs', () => {
  it('createSpurGear outputs non-empty svg path with M and C commands', () => {
    const gear = createSpurGear({ module: 3, teeth: 17, pressureAngle: 20 })
    const path = gear.toSvgPath()

    expect(path.length).toBeGreaterThan(0)
    expect(path.startsWith('M')).toBe(true)
    expect(path.includes('C')).toBe(true)
  })

  it('toPoints returns more than ten sampled points', () => {
    const gear = createSpurGear({ module: 2, teeth: 24 })
    const points = gear.toPoints({ samplesPerCurve: 8 })

    expect(points.length).toBeGreaterThan(10)
  })

  it('toPoints throws for zero, negative, and non-integer samplesPerCurve', () => {
    const gear = createSpurGear({ module: 2, teeth: 24 })

    expect(() => gear.toPoints({ samplesPerCurve: 0 })).toThrow(/positive integer/)
    expect(() => gear.toPoints({ samplesPerCurve: -1 })).toThrow(/positive integer/)
    expect(() => gear.toPoints({ samplesPerCurve: 2.5 })).toThrow(/positive integer/)
  })

  it('toSvgPath throws when unsupported transform or axle-hole options are provided', () => {
    const gear = createSpurGear({ module: 2, teeth: 24 })

    expect(() => gear.toSvgPath({ centerX: 10 })).toThrow(/not implemented/)
    expect(() => gear.toSvgPath({ centerY: 5 })).toThrow(/not implemented/)
    expect(() => gear.toSvgPath({ rotation: 45 })).toThrow(/not implemented/)
    expect(() => gear.toSvgPath({ includeAxleHole: true })).toThrow(/not implemented/)
    expect(() => gear.toSvgPath({ axleHoleRadius: 1.5 })).toThrow(/not implemented/)
  })

  it('createInternalGear marks geometry as internal', () => {
    const gear = createInternalGear({ module: 3, teeth: -40, pressureAngle: 20 })

    expect(gear.geometry.isInternal).toBe(true)
  })
})

describe('public index exports', () => {
  it('exports meshing API', () => {
    expect(typeof calculateMeshFromIndex).toBe('function')
    expect(typeof createGearPairFromIndex).toBe('function')
  })
})
