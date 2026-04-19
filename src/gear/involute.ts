import type { BezierSegment, Point } from './types'

export function involutePoint(baseRadius: number, theta: number): Point {
  return {
    x: baseRadius * Math.cos(theta) + baseRadius * theta * Math.sin(theta),
    y: baseRadius * Math.sin(theta) - baseRadius * theta * Math.cos(theta),
  }
}

export function involuteThetaAtRadius(baseRadius: number, radius: number): number {
  if (radius < baseRadius) {
    throw new Error('radius must be >= baseRadius for involute')
  }
  return Math.sqrt(radius * radius - baseRadius * baseRadius) / baseRadius
}

export function involutePolarAngle(baseRadius: number, radius: number): number {
  if (radius < baseRadius) {
    throw new Error('radius must be >= baseRadius for involute angle')
  }
  return (
    Math.sqrt(radius * radius - baseRadius * baseRadius) / baseRadius -
    Math.acos(baseRadius / radius)
  )
}

function cubicFromArcFractions(
  baseRadius: number,
  thetaA: number,
  f0: number,
  f1: number,
): BezierSegment {
  const t0 = thetaA * Math.sqrt(f0)
  const t3 = thetaA * Math.sqrt(f1)
  const p0 = involutePoint(baseRadius, t0)
  const p3 = involutePoint(baseRadius, t3)
  const dt = (t3 - t0) / 3
  const p1 = involutePoint(baseRadius, t0 + dt)
  const p2 = involutePoint(baseRadius, t0 + 2 * dt)
  return { p0, p1, p2, p3 }
}

export function twoCubicInvolute(input: {
  baseRadius: number
  addendumRadius: number
  startFraction?: number
  splitFraction?: number
}): [BezierSegment, BezierSegment] {
  if (!Number.isFinite(input.baseRadius) || !Number.isFinite(input.addendumRadius)) {
    throw new Error('baseRadius and addendumRadius must be finite numbers')
  }
  if (input.baseRadius <= 0) {
    throw new Error('baseRadius must be > 0')
  }

  const fs = input.startFraction ?? 0.01
  const fm = input.splitFraction ?? 0.25
  if (!(fs >= 0 && fs < fm && fm < 1)) {
    throw new Error('fractions must satisfy 0 <= startFraction < splitFraction < 1')
  }

  const thetaA = involuteThetaAtRadius(input.baseRadius, input.addendumRadius)
  const first = cubicFromArcFractions(input.baseRadius, thetaA, fs, fm)
  const second = cubicFromArcFractions(input.baseRadius, thetaA, fm, 1)
  second.p0 = { x: first.p3.x, y: first.p3.y }
  return [first, second]
}
