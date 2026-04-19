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
    const pair = calculateMesh(pinion, ring, { backlash: 0 })
    expect(pair.centerDistance).toBeCloseTo(60, 8)
  })

  it('rejects internal-internal pair', () => {
    const a = createInternalGear({ module: 3, teeth: -40, pressureAngle: 20 })
    const b = createInternalGear({ module: 3, teeth: -60, pressureAngle: 20 })
    expect(() => calculateMesh(a, b)).toThrow(/internal-internal/i)
  })

  it('throws when centerDistance and backlash are inconsistent', () => {
    const a = createSpurGear({ module: 3, teeth: 20, pressureAngle: 20 })
    const b = createSpurGear({ module: 3, teeth: 40, pressureAngle: 20 })
    expect(() => calculateMesh(a, b, { centerDistance: 90, backlash: 0.2 })).toThrow(
      /centerDistance.*backlash.*consistent/i,
    )
  })

  it('returns svg path with positioned driven gear', () => {
    const a = createSpurGear({ module: 3, teeth: 20, pressureAngle: 20 })
    const b = createSpurGear({ module: 3, teeth: 40, pressureAngle: 20 })
    const pair = calculateMesh(a, b, { backlash: 0 })

    const rawUnpositionedConcat = `${a.toSvgPath()} ${b.toSvgPath()}`
    const path = pair.toSvgPath()

    expect(typeof path).toBe('string')
    expect(path).not.toBe(rawUnpositionedConcat)
    expect(path.match(/\bM\b/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('throws when centerDistance is below nominal and implies negative backlash', () => {
    const a = createSpurGear({ module: 3, teeth: 20, pressureAngle: 20 })
    const b = createSpurGear({ module: 3, teeth: 40, pressureAngle: 20 })
    expect(() => calculateMesh(a, b, { centerDistance: 89.9 })).toThrow(/centerDistance cannot be below nominal/i)
  })
})
