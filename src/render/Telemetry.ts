import { TELEMETRY_SAMPLES } from '../constants'

interface RingBuffer {
  data:  Float32Array
  head:  number
  count: number
}

function makeRing(): RingBuffer {
  return { data: new Float32Array(TELEMETRY_SAMPLES), head: 0, count: 0 }
}

function pushRing(ring: RingBuffer, value: number): void {
  ring.data[ring.head] = value
  ring.head = (ring.head + 1) % TELEMETRY_SAMPLES
  if (ring.count < TELEMETRY_SAMPLES) ring.count++
}

function getRing(ring: RingBuffer, i: number): number {
  // i=0 is oldest, i=count-1 is newest
  const idx = (ring.head - ring.count + i + TELEMETRY_SAMPLES * 2) % TELEMETRY_SAMPLES
  return ring.data[idx]
}

export interface TelemetryData {
  error:    RingBuffer
  pwmL:     RingBuffer
  pwmR:     RingBuffer
  voltage:  RingBuffer
}

export function createTelemetry(): TelemetryData {
  return {
    error:   makeRing(),
    pwmL:    makeRing(),
    pwmR:    makeRing(),
    voltage: makeRing(),
  }
}

export function pushTelemetry(
  data: TelemetryData,
  error: number,
  pwmL: number,
  pwmR: number,
  voltage: number,
): void {
  pushRing(data.error,   error)
  pushRing(data.pwmL,    pwmL)
  pushRing(data.pwmR,    pwmR)
  pushRing(data.voltage, voltage)
}

interface SparklineConfig {
  label: string
  color: string
  min:   number
  max:   number
  ring:  RingBuffer
  unit?: string
}

export function drawTelemetry(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  data: TelemetryData,
  voltage_min: number,
  voltage_max: number,
): void {
  const W = canvas.width
  const H = canvas.height
  const rowH = H / 3

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#12122a'
  ctx.fillRect(0, 0, W, H)

  const configs: SparklineConfig[] = [
    { label: 'Error',    color: '#e94560', min: -1,           max: 1,           ring: data.error,   unit: '' },
    { label: 'PWM',      color: '#50b4f0', min: -255,         max: 255,         ring: data.pwmL,    unit: '' },
    { label: 'Voltage',  color: '#50e090', min: voltage_min,  max: voltage_max, ring: data.voltage, unit: 'V' },
  ]

  configs.forEach((cfg, row) => {
    const y0 = row * rowH
    drawSparkline(ctx, cfg, 0, y0, W, rowH)
  })
}

function drawSparkline(
  ctx: CanvasRenderingContext2D,
  cfg: SparklineConfig,
  x0: number,
  y0: number,
  W: number,
  H: number,
): void {
  const pad = { top: 14, bottom: 4, left: 4, right: 4 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top  - pad.bottom

  // Row background
  ctx.fillStyle = '#16162e'
  ctx.fillRect(x0, y0, W, H)

  // Separator
  ctx.strokeStyle = '#0f3460'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x0, y0 + H)
  ctx.lineTo(x0 + W, y0 + H)
  ctx.stroke()

  // Zero / centre line
  const zeroFrac = (0 - cfg.min) / (cfg.max - cfg.min)
  const zy = y0 + pad.top + innerH * (1 - Math.max(0, Math.min(1, zeroFrac)))
  ctx.strokeStyle = '#2a2a4a'
  ctx.lineWidth = 1
  ctx.setLineDash([2, 3])
  ctx.beginPath()
  ctx.moveTo(x0 + pad.left, zy)
  ctx.lineTo(x0 + W - pad.right, zy)
  ctx.stroke()
  ctx.setLineDash([])

  const n = cfg.ring.count
  if (n < 2) {
    drawLabel(ctx, cfg, x0 + pad.left, y0 + 10, 0)
    return
  }

  // Sparkline
  ctx.strokeStyle = cfg.color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const v    = getRing(cfg.ring, i)
    const frac = (v - cfg.min) / (cfg.max - cfg.min)
    const px   = x0 + pad.left + (i / (TELEMETRY_SAMPLES - 1)) * innerW
    const py   = y0 + pad.top  + innerH * (1 - Math.max(0, Math.min(1, frac)))
    if (i === 0) ctx.moveTo(px, py)
    else         ctx.lineTo(px, py)
  }
  ctx.stroke()

  const latest = getRing(cfg.ring, n - 1)
  drawLabel(ctx, cfg, x0 + pad.left, y0 + 10, latest)
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  cfg: SparklineConfig,
  x: number,
  y: number,
  value: number,
): void {
  ctx.font      = '10px monospace'
  ctx.fillStyle = cfg.color
  ctx.fillText(`${cfg.label}  ${value.toFixed(2)}${cfg.unit ?? ''}`, x, y)
}
