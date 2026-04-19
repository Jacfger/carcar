import { twoCubicInvolute } from './involute'
import { degToRad } from './math'
import type { BezierSegment, GearGeometry, GearParams, Point } from './types'

export interface ToothProfile {
  flank: [BezierSegment, BezierSegment]
  mirroredFlank: [BezierSegment, BezierSegment]
  tipStart: Point
  tipEnd: Point
  pitchAngle: number
}

export function computeGearGeometry(params: GearParams): GearGeometry {
  const m = params.module
  const z = params.teeth
  const phiDeg = params.pressureAngle ?? 20
  const isInternal = z < 0
  const absZ = Math.abs(z)

  if (!Number.isFinite(m) || m <= 0) {
    throw new Error('module must be > 0')
  }
  if (!Number.isInteger(z) || z === 0) {
    throw new Error('teeth must be non-zero integer')
  }
  if (!Number.isFinite(phiDeg) || phiDeg <= 0 || phiDeg >= 45) {
    throw new Error('pressureAngle must be in (0,45)')
  }

  const phi = degToRad(phiDeg)
  const pitchRadius = (m * absZ) / 2
  const baseRadius = pitchRadius * Math.cos(phi)
  const addendum = m
  const dedendum = 1.25 * m
  const addendumRadius = isInternal ? pitchRadius - addendum : pitchRadius + addendum
  const dedendumRadius = isInternal ? pitchRadius + dedendum : pitchRadius - dedendum

  return {
    module: m,
    teeth: z,
    pressureAngleDeg: phiDeg,
    pressureAngleRad: phi,
    pitchRadius,
    baseRadius,
    addendumRadius,
    dedendumRadius,
    addendum,
    dedendum,
    clearance: dedendum - addendum,
    circularPitch: Math.PI * m,
    basePitch: Math.PI * m * Math.cos(phi),
    isInternal,
  }
}

function mirrorY(segment: BezierSegment): BezierSegment {
  const mirrorPoint = (p: Point): Point => ({ x: p.x, y: -p.y })

  return {
    p0: mirrorPoint(segment.p0),
    p1: mirrorPoint(segment.p1),
    p2: mirrorPoint(segment.p2),
    p3: mirrorPoint(segment.p3),
  }
}

export function buildToothProfile(geometry: GearGeometry): ToothProfile {
  const involuteLimitRadius = geometry.isInternal ? geometry.dedendumRadius : geometry.addendumRadius
  const [first, second] = twoCubicInvolute({
    baseRadius: geometry.baseRadius,
    addendumRadius: involuteLimitRadius,
  })
  const mirroredFirst = mirrorY(first)
  const mirroredSecond = mirrorY(second)

  return {
    flank: [first, second],
    mirroredFlank: [mirroredFirst, mirroredSecond],
    tipStart: second.p3,
    tipEnd: mirroredSecond.p3,
    pitchAngle: (2 * Math.PI) / Math.abs(geometry.teeth),
  }
}
