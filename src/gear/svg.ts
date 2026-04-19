import type { Point } from './types'

export function fmt(value: number, decimals = 3): string {
  return Number(value.toFixed(decimals)).toString()
}

export function moveTo(point: Point, decimals = 3): string {
  return `M ${fmt(point.x, decimals)} ${fmt(point.y, decimals)}`
}

export function cubicTo(control1: Point, control2: Point, point: Point, decimals = 3): string {
  return `C ${fmt(control1.x, decimals)} ${fmt(control1.y, decimals)} ${fmt(control2.x, decimals)} ${fmt(control2.y, decimals)} ${fmt(point.x, decimals)} ${fmt(point.y, decimals)}`
}
