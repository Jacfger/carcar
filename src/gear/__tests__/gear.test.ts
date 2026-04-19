import { describe, expect, it } from 'vitest'
import { createInternalGear, createSpurGear } from '../gear'

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

  it('createInternalGear marks geometry as internal', () => {
    const gear = createInternalGear({ module: 3, teeth: -40, pressureAngle: 20 })

    expect(gear.geometry.isInternal).toBe(true)
  })
})
