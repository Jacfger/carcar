import { CAR_GEOMETRY, WHEEL_OFFSET_X } from '../constants'
import { CAR_COLORS, type CarState } from '../simulation/Car'

const {
  chassis_w, chassis_h,
  wheel_w, wheel_h,
  axle_y, caster_y, caster_r,
  sensor_y, sensor_count, sensor_spread, sensor_r,
} = CAR_GEOMETRY

/**
 * Draw the car at its current world position and heading.
 * All geometry uses the same CAR_GEOMETRY constants as the physics model,
 * so the visual wheels are pixel-perfect with the simulation wheel positions.
 *
 * Coordinate system: local +Y is toward the BACK of the car,
 * local -Y is toward the FRONT (where sensors are).
 */
export function drawCar(
  ctx: CanvasRenderingContext2D,
  car: CarState,
  showSensors: boolean,
): void {
  ctx.save()

  // Move to car world position, rotate to heading
  ctx.translate(car.x, car.y)
  ctx.rotate(car.heading)

  // ── Chassis ────────────────────────────────────────────────────────────────
  const baseColor = CAR_COLORS[car.colorIndex % CAR_COLORS.length]
  ctx.fillStyle   = baseColor
  ctx.strokeStyle = darken(baseColor)
  ctx.lineWidth   = 1.5
  ctx.beginPath()
  ctx.roundRect(-chassis_w / 2, -chassis_h / 2, chassis_w, chassis_h, 4)
  ctx.fill()
  ctx.stroke()

  // Front arrow marker (helps show which way the car is facing)
  ctx.fillStyle = lighten(baseColor)
  ctx.beginPath()
  ctx.moveTo(0,              -chassis_h / 2 + 6)
  ctx.lineTo(-8,             -chassis_h / 2 + 18)
  ctx.lineTo(8,              -chassis_h / 2 + 18)
  ctx.closePath()
  ctx.fill()

  // ── Drive wheels ───────────────────────────────────────────────────────────
  // Left wheel
  drawWheel(ctx, -WHEEL_OFFSET_X, axle_y)
  // Right wheel
  drawWheel(ctx,  WHEEL_OFFSET_X, axle_y)

  // Axle line (visual only)
  ctx.strokeStyle = '#8ab0ff'
  ctx.lineWidth   = 1
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(-WHEEL_OFFSET_X, axle_y)
  ctx.lineTo( WHEEL_OFFSET_X, axle_y)
  ctx.stroke()
  ctx.setLineDash([])

  // ── Ball caster ────────────────────────────────────────────────────────────
  ctx.fillStyle   = '#aaa'
  ctx.strokeStyle = '#777'
  ctx.lineWidth   = 1
  ctx.beginPath()
  ctx.arc(0, caster_y, caster_r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // ── Sensor bar ─────────────────────────────────────────────────────────────
  if (showSensors) {
    drawSensorBar(ctx, car.sensors)
  } else {
    // Still draw the bar outline
    ctx.fillStyle   = '#333'
    ctx.strokeStyle = '#555'
    ctx.lineWidth   = 1
    ctx.beginPath()
    ctx.roundRect(-sensor_spread / 2 - 3, sensor_y - sensor_r - 1, sensor_spread + 6, (sensor_r + 1) * 2, 2)
    ctx.fill()
    ctx.stroke()
  }

  ctx.restore()
}

function drawWheel(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.fillStyle   = '#222'
  ctx.strokeStyle = '#444'
  ctx.lineWidth   = 1
  ctx.beginPath()
  ctx.roundRect(cx - wheel_w / 2, cy - wheel_h / 2, wheel_w, wheel_h, 2)
  ctx.fill()
  ctx.stroke()

  // Tread lines
  ctx.strokeStyle = '#555'
  ctx.lineWidth   = 0.8
  const nLines = 4
  for (let i = 0; i < nLines; i++) {
    const ly = cy - wheel_h / 2 + (i + 0.75) * wheel_h / (nLines)
    ctx.beginPath()
    ctx.moveTo(cx - wheel_w / 2 + 1, ly)
    ctx.lineTo(cx + wheel_w / 2 - 1, ly)
    ctx.stroke()
  }
}

// ─── Colour helpers ────────────────────────────────────────────────────────────

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

function darken(hex: string): string {
  const [r, g, b] = parseHex(hex)
  return `rgb(${Math.max(0, r - 40)},${Math.max(0, g - 40)},${Math.max(0, b - 40)})`
}

function lighten(hex: string): string {
  const [r, g, b] = parseHex(hex)
  return `rgb(${Math.min(255, r + 80)},${Math.min(255, g + 80)},${Math.min(255, b + 80)})`
}

function drawSensorBar(ctx: CanvasRenderingContext2D, sensors: number[]): void {
  // Background bar
  ctx.fillStyle   = '#333'
  ctx.strokeStyle = '#555'
  ctx.lineWidth   = 1
  ctx.beginPath()
  ctx.roundRect(-sensor_spread / 2 - 3, sensor_y - sensor_r - 1, sensor_spread + 6, (sensor_r + 1) * 2, 2)
  ctx.fill()
  ctx.stroke()

  // Individual sensor dots
  for (let i = 0; i < sensor_count; i++) {
    const lx = (i / (sensor_count - 1) - 0.5) * sensor_spread
    const reading = sensors[i] ?? 0

    // Colour: dim green → bright white as reading goes 0→1
    const intensity = Math.round(reading * 255)
    ctx.fillStyle = `rgb(${intensity}, ${intensity}, ${Math.round(intensity * 0.7)})`
    ctx.beginPath()
    ctx.arc(lx, sensor_y, sensor_r, 0, Math.PI * 2)
    ctx.fill()
  }
}
