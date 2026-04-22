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
  varName:  string   // short variable name shown left (e.g. "e", "v")
  rowName:  string   // descriptive name shown right (e.g. "Error", "Voltage")
  color:    string
  min:      number
  max:      number
  ring:     RingBuffer
  unit?:    string
  varName2?: string
  color2?:  string
  ring2?:   RingBuffer
}

export function drawTelemetry(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  data: TelemetryData,
  voltage_min: number,
  voltage_max: number,
): void {
  // canvas.width/height are physical pixels; context is already scaled by DPR,
  // so all drawing coordinates must be in CSS pixels.
  const pr = window.devicePixelRatio || 1
  const W = canvas.width / pr
  const H = canvas.height / pr
  const rowH = H / 3

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#12122a'
  ctx.fillRect(0, 0, W, H)

  const configs: SparklineConfig[] = [
    { varName: 'e',  rowName: 'Error',   color: '#e94560', min: -1,          max: 1,           ring: data.error,   unit: '' },
    { varName: 'L',  rowName: 'PWM',     color: '#50b4f0', min: -255,        max: 255,         ring: data.pwmL,    unit: '',
      varName2: 'R', color2: '#f0a050',  ring2: data.pwmR },
    { varName: 'v',  rowName: 'Voltage', color: '#50e090', min: voltage_min, max: voltage_max, ring: data.voltage, unit: 'V' },
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

  const drawLine = (ring: RingBuffer, color: string) => {
    if (ring.count < 2) return
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i < ring.count; i++) {
      const v    = getRing(ring, i)
      const frac = (v - cfg.min) / (cfg.max - cfg.min)
      const px   = x0 + pad.left + (i / (TELEMETRY_SAMPLES - 1)) * innerW
      const py   = y0 + pad.top  + innerH * (1 - Math.max(0, Math.min(1, frac)))
      if (i === 0) ctx.moveTo(px, py)
      else         ctx.lineTo(px, py)
    }
    ctx.stroke()
  }

  drawLine(cfg.ring, cfg.color)
  if (cfg.ring2) drawLine(cfg.ring2, cfg.color2!)

  // Labels: "varName: value" on left(/middle), descriptive rowName on right
  ctx.font         = '10px monospace'
  ctx.textBaseline = 'alphabetic'
  const labelY     = y0 + 10

  if (cfg.ring2) {
    const lVal = n >= 2 ? getRing(cfg.ring, n - 1).toFixed(0) : '—'
    ctx.fillStyle = cfg.color; ctx.textAlign = 'left'
    ctx.fillText(`${cfg.varName}: ${lVal}`, x0 + pad.left, labelY)

    if (cfg.ring2.count >= 2) {
      const rVal = getRing(cfg.ring2, cfg.ring2.count - 1).toFixed(0)
      ctx.fillStyle = cfg.color2!; ctx.textAlign = 'left'
      ctx.fillText(`${cfg.varName2}: ${rVal}`, x0 + W * 0.45, labelY)
    }

    ctx.fillStyle = '#506080'; ctx.textAlign = 'right'
    ctx.fillText(cfg.rowName, x0 + W - pad.right, labelY)
  } else {
    const val = n >= 2 ? getRing(cfg.ring, n - 1).toFixed(2) : '—'
    ctx.fillStyle = cfg.color; ctx.textAlign = 'left'
    ctx.fillText(`${cfg.varName}: ${val}${cfg.unit ?? ''}`, x0 + pad.left, labelY)

    ctx.fillStyle = '#506080'; ctx.textAlign = 'right'
    ctx.fillText(cfg.rowName, x0 + W - pad.right, labelY)
  }

  ctx.textAlign = 'left'
}
