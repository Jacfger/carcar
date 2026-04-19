import type { Point } from './types'

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function rotatePoint(pt: Point, radians: number): Point {
  const s = Math.sin(radians)
  const c = Math.cos(radians)
  return {
    x: pt.x * c - pt.y * s,
    y: pt.x * s + pt.y * c,
  }
}

export function toCartesian(radius: number, angle: number): Point {
  return {
    x: radius * Math.cos(angle),
    y: radius * Math.sin(angle),
  }
}
