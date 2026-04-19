import { describe, expect, it } from 'vitest'
import { createInternalGear, createSpurGear } from '../gear'
import { calculateMesh, createGearPair } from '../mesh'

function parseSvgPathTokens(pathData: string): string[] {
  return pathData.trim().split(/\s+/)
}

function getSubpathMovePoints(pathData: string): Array<{ x: number; y: number }> {
  const tokens = parseSvgPathTokens(pathData)
  const movePoints: Array<{ x: number; y: number }> = []

  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i] === 'M') {
      movePoints.push({ x: Number(tokens[i + 1]), y: Number(tokens[i + 2]) })
    }
  }

  return movePoints
}

function rotateThenTranslate(
  point: { x: number; y: number },
  rotationDeg: number,
  tx: number,
  ty: number,
): { x: number; y: number } {
  const radians = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: point.x * cos - point.y * sin + tx,
    y: point.x * sin + point.y * cos + ty,
  }
}

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
    const pinion = createSpurGear({ module: 3, teeth: 20, pressureAngle: 20 })
    const driven = createSpurGear({ module: 3, teeth: 40, pressureAngle: 20 })
    const pair = calculateMesh(pinion, driven, { backlash: 0 })

    const pinionPath = pinion.toSvgPath()
    const rawDrivenPath = driven.toSvgPath()
    const rawUnpositionedConcat = `${pinionPath} ${rawDrivenPath}`
    const pairPath = pair.toSvgPath()
    const pairMovePoints = getSubpathMovePoints(pairPath)
    const pinionMovePoints = getSubpathMovePoints(pinionPath)
    const drivenMovePoints = getSubpathMovePoints(rawDrivenPath)
    const positionedDriven = pair.getPositionedGear()
    const transformedDrivenFirstMove = rotateThenTranslate(
      drivenMovePoints[0],
      positionedDriven.rotation,
      positionedDriven.x,
      positionedDriven.y,
    )

    expect(typeof pairPath).toBe('string')
    expect(pairPath).not.toBe(rawUnpositionedConcat)
    expect(pairMovePoints.length).toBeGreaterThanOrEqual(2)
    expect(pairMovePoints[0]).toEqual(pinionMovePoints[0])
    expect(pairMovePoints[1].x).toBeCloseTo(transformedDrivenFirstMove.x, 3)
    expect(pairMovePoints[1].y).toBeCloseTo(transformedDrivenFirstMove.y, 3)
  })

  it('throws when centerDistance is below nominal and implies negative backlash', () => {
    const a = createSpurGear({ module: 3, teeth: 20, pressureAngle: 20 })
    const b = createSpurGear({ module: 3, teeth: 40, pressureAngle: 20 })
    expect(() => calculateMesh(a, b, { centerDistance: 89.9 })).toThrow(/centerDistance cannot be below nominal/i)
  })
})
