import { useRef, useEffect, type RefObject } from 'react'
import type { EncoderState } from '../simulation/Encoder'

const WAVE_LEN       = 400
const VEL_LEN        = 400
const SENSOR_A_ANGLE =  Math.PI / 10
const SENSOR_B_ANGLE = -Math.PI / 10

export type EncoderUpdateFn = (L: EncoderState, R: EncoderState) => void

interface Props {
  updateRef: RefObject<EncoderUpdateFn | null>
  visible:   boolean
}

interface MutableData {
  curAngleL:     number
  curAngleR:     number
  curCpr:        number
  waveBufferL:   Array<{ a: boolean; b: boolean }>
  waveBufferR:   Array<{ a: boolean; b: boolean }>
  velBufL:       number[]
  velBufR:       number[]
  metersPerTick: number
  displayMaxAbs: number
  prevTicksL:    number
  prevTicksR:    number
  lastUpdateMs:  number
}

export function EncoderView({ updateRef, visible }: Props) {
  const discCanvasRef   = useRef<HTMLCanvasElement>(null)
  const waveCanvasRef   = useRef<HTMLCanvasElement>(null)
  const velCanvasRef    = useRef<HTMLCanvasElement>(null)
  const tickReadoutRef  = useRef<HTMLDivElement>(null)
  const unitBtnRef      = useRef<HTMLButtonElement>(null)
  const smoothLabelRef  = useRef<HTMLSpanElement>(null)
  const showMetersRef   = useRef(false)
  const smoothWinRef    = useRef(10)

  const data = useRef<MutableData>({
    curAngleL: 0, curAngleR: 0, curCpr: 12,
    waveBufferL: [], waveBufferR: [],
    velBufL: [], velBufR: [],
    metersPerTick: 0, displayMaxAbs: 10,
    prevTicksL: 0, prevTicksR: 0, lastUpdateMs: -1,
  })

  // Expose update function for SimulationEngine to call each frame
  useEffect(() => {
    updateRef.current = (stateL: EncoderState, stateR: EncoderState) => {
      const d   = data.current
      const now = performance.now()
      const dt  = d.lastUpdateMs >= 0 ? (now - d.lastUpdateMs) / 1000 : 0
      d.lastUpdateMs = now

      d.curAngleL = stateL.angle
      d.curAngleR = stateR.angle
      d.curCpr    = stateL.params.cpr

      d.waveBufferL.push({ a: stateL.channelA, b: stateL.channelB })
      if (d.waveBufferL.length > WAVE_LEN) d.waveBufferL.shift()
      d.waveBufferR.push({ a: stateR.channelA, b: stateR.channelB })
      if (d.waveBufferR.length > WAVE_LEN) d.waveBufferR.shift()

      if (dt > 0) {
        const rateL = (stateL.ticks - d.prevTicksL) / dt
        const rateR = (stateR.ticks - d.prevTicksR) / dt
        d.velBufL.push(rateL); if (d.velBufL.length > VEL_LEN) d.velBufL.shift()
        d.velBufR.push(rateR); if (d.velBufR.length > VEL_LEN) d.velBufR.shift()
      }
      d.prevTicksL = stateL.ticks
      d.prevTicksR = stateR.ticks

      const { wheelRadius, cpr, gearRatio } = stateL.params
      d.metersPerTick = (2 * Math.PI * wheelRadius) / (cpr * gearRatio * 4)

      const fmt = (n: number) =>
        (n >= 0 ? '+' : '') + String(Math.abs(Math.trunc(n))).padStart(6, '0')
      if (tickReadoutRef.current) {
        tickReadoutRef.current.textContent =
          `L: ${fmt(stateL.ticks)}  R: ${fmt(stateR.ticks)}`
      }
    }
    return () => { updateRef.current = null }
  }, [updateRef])

  // RAF draw loop — active only when visible
  useEffect(() => {
    if (!visible) return

    let rafId = 0

    const drawDiscs = () => {
      const canvas = discCanvasRef.current
      if (!canvas) return
      const wrap = canvas.parentElement!
      const dpr = window.devicePixelRatio || 1
      const W = wrap.offsetWidth  * dpr
      const H = wrap.offsetHeight * dpr
      if (W <= 0 || H <= 0) return
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W; canvas.height = H
      }
      const ctx = canvas.getContext('2d')!
      const d = data.current
      ctx.fillStyle = '#12122a'
      ctx.fillRect(0, 0, W, H)

      const R   = Math.min(H * 0.38, W * 0.20)
      const cy  = H / 2
      const gap = R * 0.25
      const cxL = W / 2 - gap - R
      const cxR = W / 2 + gap + R

      drawOneDisc(ctx, cxL, cy, R, d.curAngleL, d.curCpr)
      drawOneDisc(ctx, cxR, cy, R, d.curAngleR, d.curCpr)

      ctx.font = `bold ${Math.round(R * 0.20)}px monospace`
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#00d8d8'
      ctx.fillText('L', cxL, cy + R + R * 0.12)
      ctx.fillStyle = '#d800d8'
      ctx.fillText('R', cxR, cy + R + R * 0.12)
    }

    const drawWaveform = () => {
      const canvas = waveCanvasRef.current
      if (!canvas) return
      const dpr = window.devicePixelRatio || 1
      const W   = canvas.offsetWidth * dpr
      const H   = canvas.height
      if (W <= 0 || H <= 0) return
      if (canvas.width !== W) canvas.width = W
      const ctx = canvas.getContext('2d')!
      const d   = data.current

      ctx.fillStyle = '#12122a'
      ctx.fillRect(0, 0, W, H)

      ctx.strokeStyle = '#1e2a40'
      ctx.lineWidth   = 1
      ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()

      type WaveBuf = Array<{ a: boolean; b: boolean }>
      const channels: Array<{ buf: WaveBuf; ch: 'a' | 'b'; color: string; label: string; y0: number }> = [
        { buf: d.waveBufferL, ch: 'a', color: '#00d8d8', label: 'L·A', y0: 0        },
        { buf: d.waveBufferL, ch: 'b', color: '#0060d8', label: 'L·B', y0: H * 0.25 },
        { buf: d.waveBufferR, ch: 'a', color: '#d800d8', label: 'R·A', y0: H * 0.5  },
        { buf: d.waveBufferR, ch: 'b', color: '#a000a0', label: 'R·B', y0: H * 0.75 },
      ]

      channels.forEach(({ buf, ch, color, label, y0 }) => {
        if (buf.length < 2) return
        const mid = y0 + H * 0.125
        const amp = H * 0.09

        ctx.strokeStyle = color
        ctx.lineWidth   = 1.5 * dpr
        ctx.beginPath()
        let prevHi: boolean | null = null
        buf.forEach((s, i) => {
          const hi = s[ch]
          const x  = (i / (WAVE_LEN - 1)) * W
          const y  = hi ? mid - amp : mid + amp
          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            if (prevHi !== null && hi !== prevHi) {
              ctx.lineTo(x, prevHi ? mid - amp : mid + amp)
              ctx.lineTo(x, y)
            } else {
              ctx.lineTo(x, y)
            }
          }
          prevHi = hi
        })
        ctx.stroke()

        ctx.font         = `${9 * dpr}px monospace`
        ctx.fillStyle    = color
        ctx.textBaseline = 'middle'
        ctx.fillText(label, 3 * dpr, mid)
      })
    }

    const smooth = (buf: number[]): number[] => {
      const w = Math.max(1, smoothWinRef.current)
      if (w === 1) return buf
      const out: number[] = new Array(buf.length)
      let sum = 0, count = 0
      for (let i = 0; i < buf.length; i++) {
        sum += buf[i]; count++
        if (i >= w) { sum -= buf[i - w]; count-- }
        out[i] = sum / count
      }
      return out
    }

    const drawVelocity = () => {
      const canvas = velCanvasRef.current
      if (!canvas) return
      const dpr   = window.devicePixelRatio || 1
      const W     = canvas.offsetWidth * dpr
      const H     = canvas.height
      if (W <= 0 || H <= 0) return
      if (canvas.width !== W) canvas.width = W
      const ctx   = canvas.getContext('2d')!
      const d     = data.current
      const scale = showMetersRef.current ? d.metersPerTick : 1
      const unit  = showMetersRef.current ? 'm/s' : 'ticks/s'

      ctx.fillStyle = '#0e0e20'
      ctx.fillRect(0, 0, W, H)

      const smL = smooth(d.velBufL)
      const smR = smooth(d.velBufR)
      let targetMax = showMetersRef.current ? 0.05 : 10
      for (const v of smL) if (Math.abs(v * scale) > targetMax) targetMax = Math.abs(v * scale)
      for (const v of smR) if (Math.abs(v * scale) > targetMax) targetMax = Math.abs(v * scale)
      targetMax *= 1.15
      const lerpK = targetMax > d.displayMaxAbs ? 0.15 : 0.03
      d.displayMaxAbs += (targetMax - d.displayMaxAbs) * lerpK
      const maxAbs = d.displayMaxAbs

      const pad = { top: 16, bottom: 4, left: 4, right: 4 }
      const iW  = W - pad.left - pad.right
      const iH  = H - pad.top  - pad.bottom

      const zy = pad.top + iH * 0.5
      ctx.strokeStyle = '#2a2a4a'
      ctx.lineWidth   = 1
      ctx.setLineDash([2, 3])
      ctx.beginPath(); ctx.moveTo(pad.left, zy); ctx.lineTo(W - pad.right, zy); ctx.stroke()
      ctx.setLineDash([])

      const drawLine = (buf: number[], color: string) => {
        if (buf.length < 2) return
        ctx.strokeStyle = color
        ctx.lineWidth   = 1.5 * dpr
        ctx.beginPath()
        buf.forEach((v0, i) => {
          const v  = v0 * scale
          const fx = 0.5 - v / (2 * maxAbs)
          const px = pad.left + (i / (VEL_LEN - 1)) * iW
          const py = pad.top  + iH * Math.max(0, Math.min(1, fx))
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
        })
        ctx.stroke()
      }

      drawLine(smL, '#00d8d8')
      drawLine(smR, '#d800d8')

      const lv = (smL.length > 0 ? smL[smL.length - 1] : 0) * scale
      const rv = (smR.length > 0 ? smR[smR.length - 1] : 0) * scale
      const dp = showMetersRef.current ? 2 : 0

      ctx.font         = `${10 * dpr}px monospace`
      ctx.textBaseline = 'top'
      ctx.fillStyle    = '#00d8d8'
      ctx.textAlign    = 'left'
      ctx.fillText(`L: ${lv.toFixed(dp)}`, pad.left + 4 * dpr, 3 * dpr)
      ctx.fillStyle    = '#d800d8'
      ctx.textAlign    = 'left'
      ctx.fillText(`R: ${rv.toFixed(dp)}`, W * 0.45, 3 * dpr)
      ctx.fillStyle    = '#506080'
      ctx.textAlign    = 'right'
      ctx.fillText('Velocity', W - pad.right - 4 * dpr, 3 * dpr)

      ctx.fillStyle    = '#3a4a6a'
      ctx.textAlign    = 'right'
      ctx.textBaseline = 'middle'
      ctx.font         = `${9 * dpr}px monospace`
      const scaleLabel = showMetersRef.current
        ? `±${maxAbs.toFixed(2)} m/s`
        : `±${Math.round(maxAbs)} ticks/s`
      ctx.fillText(scaleLabel, W - pad.right - 2 * dpr, zy)
    }

    const frame = () => {
      rafId = requestAnimationFrame(frame)
      drawDiscs()
      drawWaveform()
      drawVelocity()
    }
    rafId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafId)
  }, [visible])

  return (
    <div style={{ display: visible ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
      {/* Disc visualiser — flex:1 to fill remaining space */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: '#12122a' }}>
        <canvas ref={discCanvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', gap: 4, padding: '4px 8px', flexShrink: 0, background: '#16213e', alignItems: 'center' }}>
        <div style={{ flex: 1 }} />
        <span ref={smoothLabelRef} style={{ fontSize: 10, color: '#7090b0', whiteSpace: 'nowrap' }}>avg: 10</span>
        <input
          type="range" min={1} max={60} step={1} defaultValue={10}
          style={{ width: 56, accentColor: '#e94560', cursor: 'pointer' }}
          onChange={(e) => {
            smoothWinRef.current = parseInt(e.target.value)
            if (smoothLabelRef.current) smoothLabelRef.current.textContent = `avg: ${e.target.value}`
          }}
        />
        <button
          ref={unitBtnRef}
          style={{ fontSize: 10, padding: '2px 10px', borderRadius: 3, cursor: 'pointer', border: '1px solid #1a4a80', background: '#1a4a80', color: '#e0e0e0' }}
          onClick={() => {
            showMetersRef.current = !showMetersRef.current
            if (unitBtnRef.current) {
              unitBtnRef.current.textContent = showMetersRef.current ? 'm/s' : 'ticks/s'
            }
          }}
        >
          ticks/s
        </button>
      </div>

      {/* Tick counter readout */}
      <div ref={tickReadoutRef} style={{ fontFamily: 'monospace', fontSize: 10, color: '#50e090', padding: '2px 8px', flexShrink: 0, background: '#12122a' }}>
        L: +000000  R: +000000
      </div>

      {/* A/B square-wave channels */}
      <canvas ref={waveCanvasRef} style={{ width: '100%', height: 80, display: 'block', flexShrink: 0 }} />

      {/* Velocity graph */}
      <canvas ref={velCanvasRef}  style={{ width: '100%', height: 72, display: 'block', flexShrink: 0 }} />
    </div>
  )
}

// ── Pure drawing helpers ──────────────────────────────────────────────────────

function drawOneDisc(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, R: number, angle: number, cpr: number,
): void {
  const Rslot = R * 0.88
  const Ri    = R * 0.30
  const Rh    = R * 0.09
  const S     = R * 2

  const grd = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.1)
  grd.addColorStop(0, 'rgba(30,50,120,0)')
  grd.addColorStop(1, 'rgba(30,60,180,0.12)')
  ctx.fillStyle = grd
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.1, 0, Math.PI * 2); ctx.fill()

  ctx.fillStyle = '#1a1a3a'
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill()

  for (let i = 0; i < cpr; i++) {
    const center = angle + (i / cpr) * Math.PI * 2
    const a0 = center - Math.PI / cpr * 0.5
    const a1 = center + Math.PI / cpr * 0.5
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a0) * Ri, cy + Math.sin(a0) * Ri)
    ctx.arc(cx, cy, Rslot, a0, a1)
    ctx.arc(cx, cy, Ri, a1, a0, true)
    ctx.closePath()
    ctx.fillStyle   = '#1e35cc'
    ctx.fill()
    ctx.strokeStyle = '#3a55ee'
    ctx.lineWidth   = 0.8
    ctx.stroke()
  }

  const Rmid = (Rslot + Ri) * 0.5
  drawSensor(ctx, cx, cy, SENSOR_A_ANGLE, Rmid, S, '#2255ff', '#4a80ff', discSensorHigh(SENSOR_A_ANGLE, angle, cpr), 'A')
  drawSensor(ctx, cx, cy, SENSOR_B_ANGLE, Rmid, S, '#cc2222', '#ff5555', discSensorHigh(SENSOR_B_ANGLE, angle, cpr), 'B')

  ctx.fillStyle = '#0a0a20'
  ctx.beginPath(); ctx.arc(cx, cy, Ri, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#1a1a38'
  ctx.beginPath(); ctx.arc(cx, cy, Rh, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#2a3a6a'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(cx, cy, Rh, 0, Math.PI * 2); ctx.stroke()

  ctx.strokeStyle = '#2a3a6a'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()
}

function drawSensor(
  ctx: CanvasRenderingContext2D, cx: number, cy: number,
  worldAngle: number, r: number, S: number,
  dimColor: string, brightColor: string, active: boolean, label: string,
): void {
  const sx = cx + Math.cos(worldAngle) * r
  const sy = cy + Math.sin(worldAngle) * r
  const sr = S * 0.023

  if (active) { ctx.shadowColor = brightColor; ctx.shadowBlur = 16 }
  ctx.fillStyle   = active ? brightColor : dimColor
  ctx.strokeStyle = active ? brightColor : '#1e2a50'
  ctx.lineWidth   = active ? 1.5 : 1
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  ctx.shadowBlur  = 0

  if (active) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.beginPath(); ctx.arc(sx - sr * 0.25, sy - sr * 0.3, sr * 0.35, 0, Math.PI * 2); ctx.fill()
  }

  const labelDist = S * 0.42 * 1.16
  const lx = cx + Math.cos(worldAngle) * labelDist
  const ly = cy + Math.sin(worldAngle) * labelDist
  ctx.font         = `bold ${S * 0.03}px monospace`
  ctx.fillStyle    = active ? brightColor : '#404060'
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, lx, ly)
}

function discSensorHigh(worldAngle: number, discAngle: number, cpr: number): boolean {
  const local  = ((worldAngle - discAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
  const period = Math.PI * 2 / cpr
  const phase  = local % period
  const halfW  = Math.PI / cpr * 0.5
  return phase < halfW || phase > period - halfW
}
