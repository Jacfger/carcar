import { describe, expect, it } from 'vitest'
import { createInternalGear, createSpurGear } from '../gear'
import { calculateMesh, createGearPair } from '../mesh'

describe('mesh calculations', () => {
  it('computes external pair center distance', () => {
    const a = createSpurGear({ module: 3, teeth: 20, pressureAngle: 20 })
    const b = createSpurGear({ module: 3, teeth: 40, pressureAngle: 20 })
    const pair = calculateMesh(a, b, { backlash: 0 })
    expect(pair.centerDistance).toBeCloseTo(90, 8)
  })

  it('applies backlash as increased center distance', () => {
    const pair = createGearPair(
      { module: 3, teeth: 20, pressureAngle: 20 },
      { module: 3, teeth: 40, pressureAngle: 20 },
      { backlash: 0.12 },
    )
    expect(pair.centerDistance).toBeGreaterThan(90)
  })

  it('supports external-internal pair', () => {
    const pinion = createSpurGear({ module: 3, teeth: 20, pressureAngle: 20 })
    const ring = createInternalGear({ module: 3, teeth: -60, pressureAngle: 20 })
    const pair = calculateMesh(pinion, ring)
    expect(pair.centerDistance).toBeCloseTo(60, 8)
  })
})
