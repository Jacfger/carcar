import { describe, expect, it } from 'vitest'
import type {
  BezierSegment,
  GearGeometry,
  GearParams,
  MeshOptions,
  Point,
  PointOptions,
  SvgOptions,
} from '../types'
import { clamp, degToRad, rotatePoint, toCartesian } from '../math'

describe('gear type exports', () => {
  it('accepts all Task 1 exported type shapes', () => {
    const point: Point = { x: 0, y: 0 }
    const params: GearParams = { module: 3, teeth: 17, pressureAngle: 20 }
    const geometry: GearGeometry = {
      module: 3,
      teeth: 17,
      pressureAngleDeg: 20,
      pressureAngleRad: 0.3490658504,
      pitchRadius: 25.5,
      baseRadius: 23.96,
      addendumRadius: 28.5,
      dedendumRadius: 21.75,
      addendum: 3,
      dedendum: 3.75,
      clearance: 0.75,
      circularPitch: 9.42477796,
      basePitch: 8.858,
      isInternal: false,
    }
    const svgOptions: SvgOptions = {
      centerX: 0,
      centerY: 0,
      rotation: 0,
      includeAxleHole: true,
      axleHoleRadius: 4,
      decimals: 3,
    }
    const pointOptions: PointOptions = { samplesPerCurve: 8 }
    const meshOptions: MeshOptions = { backlash: 0.05, centerDistance: 51 }
    const segment: BezierSegment = {
      p0: point,
      p1: { x: 1, y: 2 },
      p2: { x: 3, y: 4 },
      p3: { x: 5, y: 6 },
    }

    expect(params.module).toBe(3)
    expect(geometry.teeth).toBe(17)
    expect(svgOptions.decimals).toBe(3)
    expect(pointOptions.samplesPerCurve).toBe(8)
    expect(meshOptions.centerDistance).toBe(51)
    expect(segment.p0).toEqual(point)
  })
})

describe('math helpers', () => {
  it('converts degrees to radians', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 10)
  })

  it('rotates point around origin', () => {
    const p = rotatePoint({ x: 1, y: 0 }, Math.PI / 2)
    expect(p.x).toBeCloseTo(0, 10)
    expect(p.y).toBeCloseTo(1, 10)
  })

  it('converts polar to cartesian', () => {
    const p = toCartesian(2, 0)
    expect(p.x).toBeCloseTo(2, 10)
    expect(p.y).toBeCloseTo(0, 10)
  })

  it('clamps values', () => {
    expect(clamp(5, 0, 2)).toBe(2)
    expect(clamp(-1, 0, 2)).toBe(0)
  })
})
