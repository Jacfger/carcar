import { buildToothProfile, computeGearGeometry } from './tooth'
import { cubicTo, moveTo } from './svg'
import type { BezierSegment, GearGeometry, GearParams, Point, PointOptions, SvgOptions } from './types'

export interface Gear {
  params: GearParams
  geometry: GearGeometry
  toSvgPath(options?: SvgOptions): string
  toPoints(options?: PointOptions): Point[]
  getBezierControlPoints(): BezierSegment[]
}

function sampleCubic(segment: BezierSegment, steps: number): Point[] {
  const points: Point[] = []

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const u = 1 - t
    points.push({
      x:
        u * u * u * segment.p0.x +
        3 * u * u * t * segment.p1.x +
        3 * u * t * t * segment.p2.x +
        t * t * t * segment.p3.x,
      y:
        u * u * u * segment.p0.y +
        3 * u * u * t * segment.p1.y +
        3 * u * t * t * segment.p2.y +
        t * t * t * segment.p3.y,
    })
  }

  return points
}

function createGear(params: GearParams): Gear {
  const geometry = computeGearGeometry(params)
  const tooth = buildToothProfile(geometry)
  const segments: BezierSegment[] = [
    tooth.flank[0],
    tooth.flank[1],
    tooth.mirroredFlank[0],
    tooth.mirroredFlank[1],
  ]

  return {
    params,
    geometry,
    toSvgPath(options?: SvgOptions): string {
      if (options) {
        const unsupportedOptions = [
          'centerX',
          'centerY',
          'rotation',
          'includeAxleHole',
          'axleHoleRadius',
        ] as const

        for (const optionName of unsupportedOptions) {
          if (Object.prototype.hasOwnProperty.call(options, optionName)) {
            throw new Error(`toSvgPath option "${optionName}" is not implemented`)
          }
        }
      }

      const decimals = options?.decimals ?? 3
      const commands = [
        moveTo(segments[0].p0, decimals),
        cubicTo(segments[0].p1, segments[0].p2, segments[0].p3, decimals),
        cubicTo(segments[1].p1, segments[1].p2, segments[1].p3, decimals),
        cubicTo(segments[2].p1, segments[2].p2, segments[2].p3, decimals),
        cubicTo(segments[3].p1, segments[3].p2, segments[3].p3, decimals),
        'Z',
      ]
      return commands.join(' ')
    },
    toPoints(options?: PointOptions): Point[] {
      const samplesPerCurve = options?.samplesPerCurve ?? 12

      if (!Number.isInteger(samplesPerCurve) || samplesPerCurve <= 0) {
        throw new Error('toPoints expects samplesPerCurve to be a positive integer')
      }

      return segments.flatMap((segment) => sampleCubic(segment, samplesPerCurve))
    },
    getBezierControlPoints(): BezierSegment[] {
      return [...segments]
    },
  }
}

export function createSpurGear(params: GearParams): Gear {
  if (params.teeth < 0) {
    throw new Error('createSpurGear expects positive teeth')
  }
  return createGear(params)
}

export function createInternalGear(params: GearParams): Gear {
  if (params.teeth > 0) {
    throw new Error('createInternalGear expects negative teeth')
  }
  return createGear(params)
}
