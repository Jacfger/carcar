import type { EncoderState } from '../simulation/Encoder'

const WAVE_LEN       = 400
const VEL_LEN        = 400
const SENSOR_A_ANGLE =  Math.PI / 10
const SENSOR_B_ANGLE = -Math.PI / 10

export class EncoderTab {
  private discCanvas!: HTMLCanvasElement
  private discCtx!:    CanvasRenderingContext2D

  private waveCanvas!: HTMLCanvasElement
  private waveCtx!:    CanvasRenderingContext2D
  private waveBuffer: Array<{ a: boolean; b: boolean }> = []

  private velCanvas!:  HTMLCanvasElement
  private velCtx!:     CanvasRenderingContext2D
  // Buffers store ticks/s (raw observed rate); conversion to m/s happens on draw
  private velBufL:     number[] = []
  private velBufR:     number[] = []
  private metersPerTick = 0   // updated each tick from encoder params

  private tickReadout!:  HTMLDivElement
  private unitBtn!:      HTMLButtonElement
  private showMeters     = false   // false = ticks/s, true = m/s
  private smoothWin      = 10      // moving-average window (samples)
  private displayMaxAbs  = 10      // lerped y-scale ceiling (ticks/s or m/s)

  private running = false
  private rafId   = 0

  private curAngleL = 0
  private curAngleR = 0
  private curCpr    = 12

  private prevTicksL   = 0
  private prevTicksR   = 0
  private lastUpdateMs = -1

  constructor(private mount: HTMLElement) {
    this._buildDOM()
  }

  // ── DOM ──────────────────────────────────────────────────────────────────────

  private _buildDOM(): void {
    this.mount.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;flex:1'

    const discWrap = document.createElement('div')
    discWrap.style.cssText =
      'flex:1;min-height:0;overflow:hidden;background:#12122a'
    this.mount.appendChild(discWrap)

    this.discCanvas = document.createElement('canvas')
    this.discCanvas.style.cssText = 'display:block;width:100%;height:100%'
    discWrap.appendChild(this.discCanvas)
    this.discCtx = this.discCanvas.getContext('2d')!

    const btnRow = document.createElement('div')
    btnRow.style.cssText =
      'display:flex;gap:4px;padding:4px 8px;flex-shrink:0;background:#16213e;align-items:center'

    const spacer = document.createElement('div')
    spacer.style.cssText = 'flex:1'

    this.unitBtn = document.createElement('button')
    this.unitBtn.addEventListener('click', () => {
      this.showMeters = !this.showMeters
      this._refreshBtns()
    })

    // Smooth slider
    const smoothLabel = document.createElement('span')
    smoothLabel.style.cssText = 'font-size:10px;color:#7090b0;white-space:nowrap'
    smoothLabel.textContent   = `avg: ${this.smoothWin}`

    const smoothSlider = document.createElement('input')
    smoothSlider.type  = 'range'
    smoothSlider.min   = '1'
    smoothSlider.max   = '60'
    smoothSlider.step  = '1'
    smoothSlider.value = String(this.smoothWin)
    smoothSlider.style.cssText = 'width:56px;accent-color:#e94560;cursor:pointer'
    smoothSlider.addEventListener('input', () => {
      this.smoothWin = parseInt(smoothSlider.value)
      smoothLabel.textContent = `avg: ${this.smoothWin}`
    })

    btnRow.append(spacer, smoothLabel, smoothSlider, this.unitBtn)
    this.mount.appendChild(btnRow)
    this._refreshBtns()

    this.tickReadout = document.createElement('div')
    this.tickReadout.style.cssText =
      'font-family:monospace;font-size:10px;color:#50e090;padding:2px 8px;flex-shrink:0;background:#12122a'
    this.tickReadout.textContent = 'L: +000000  R: +000000'
    this.mount.appendChild(this.tickReadout)

    // A/B square wave
    this.waveCanvas = document.createElement('canvas')
    this.waveCanvas.height        = 46
    this.waveCanvas.style.cssText = 'width:100%;height:46px;display:block;flex-shrink:0'
    this.mount.appendChild(this.waveCanvas)
    this.waveCtx = this.waveCanvas.getContext('2d')!

    // Velocity graph
    this.velCanvas = document.createElement('canvas')
    this.velCanvas.height        = 72
    this.velCanvas.style.cssText = 'width:100%;height:72px;display:block;flex-shrink:0'
    this.mount.appendChild(this.velCanvas)
    this.velCtx = this.velCanvas.getContext('2d')!
  }

  private _refreshBtns(): void {
    const on = 'background:#1a4a80;color:#e0e0e0;border-color:#1a4a80'
    this.unitBtn.textContent   = this.showMeters ? 'm/s' : 'ticks/s'
    this.unitBtn.style.cssText = `font-size:10px;padding:2px 10px;border-radius:3px;cursor:pointer;border:1px solid;${on}`
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  update(stateL: EncoderState, stateR: EncoderState): void {
    const now = performance.now()
    const dt  = this.lastUpdateMs >= 0 ? (now - this.lastUpdateMs) / 1000 : 0
    this.lastUpdateMs = now

    this.curAngleL = stateL.angle
    this.curAngleR = stateR.angle
    this.curCpr    = stateL.params.cpr

    this.waveBuffer.push({ a: stateL.channelA, b: stateL.channelB })
    if (this.waveBuffer.length > WAVE_LEN) this.waveBuffer.shift()

    if (dt > 0) {
      // Store raw ticks/s — conversion to m/s happens in _drawVelocity
      const rateL = (stateL.ticks - this.prevTicksL) / dt
      const rateR = (stateR.ticks - this.prevTicksR) / dt
      this.velBufL.push(rateL); if (this.velBufL.length > VEL_LEN) this.velBufL.shift()
      this.velBufR.push(rateR); if (this.velBufR.length > VEL_LEN) this.velBufR.shift()
    }
    this.prevTicksL = stateL.ticks
    this.prevTicksR = stateR.ticks

    const { wheelRadius, cpr, gearRatio } = stateL.params
    this.metersPerTick = (2 * Math.PI * wheelRadius) / (cpr * gearRatio * 4)

    const fmt = (n: number) => (n >= 0 ? '+' : '') + String(Math.abs(Math.trunc(n))).padStart(6, '0')
    this.tickReadout.textContent = `L: ${fmt(stateL.ticks)}  R: ${fmt(stateR.ticks)}`
  }

  start(): void {
    if (this.running) return
    this.running = true
    this._frame()
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  // ── Render loop ───────────────────────────────────────────────────────────────

  private _frame(): void {
    if (!this.running) return
    this.rafId = requestAnimationFrame(() => this._frame())

    const wrap = this.discCanvas.parentElement!
    const dpr  = window.devicePixelRatio || 1
    const W    = wrap.offsetWidth  * dpr
    const H    = wrap.offsetHeight * dpr
    if (W > 0 && H > 0) {
      if (this.discCanvas.width !== W || this.discCanvas.height !== H) {
        this.discCanvas.width  = W
        this.discCanvas.height = H
      }
      this._drawDiscs(W, H)
    }
    this._drawWaveform()
    this._drawVelocity()
  }

  // ── 2D dual-disc ─────────────────────────────────────────────────────────────

  private _drawDiscs(W: number, H: number): void {
    const ctx = this.discCtx
    ctx.fillStyle = '#12122a'
    ctx.fillRect(0, 0, W, H)

    const R   = Math.min(H * 0.38, W * 0.20)
    const cy  = H / 2
    const gap = R * 0.25
    const cxL = W / 2 - gap - R
    const cxR = W / 2 + gap + R

    this._drawOneDisc(ctx, cxL, cy, R, this.curAngleL)
    this._drawOneDisc(ctx, cxR, cy, R, this.curAngleR)

    // Labels
    ctx.font = `bold ${Math.round(R * 0.20)}px monospace`
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    ctx.fillStyle = '#00d8d8'
    ctx.fillText('L', cxL, cy + R + R * 0.12)
    ctx.fillStyle = '#d800d8'
    ctx.fillText('R', cxR, cy + R + R * 0.12)
  }

  private _drawOneDisc(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number, R: number, angle: number,
  ): void {
    const Rslot = R * 0.88
    const Ri    = R * 0.30
    const Rh    = R * 0.09
    const cpr   = this.curCpr
    const S     = R * 2   // reference size for sensor dot scaling

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
    this._drawSensor(ctx, cx, cy, SENSOR_A_ANGLE, Rmid, S, '#2255ff', '#4a80ff', this._discSensorHigh(SENSOR_A_ANGLE, angle), 'A')
    this._drawSensor(ctx, cx, cy, SENSOR_B_ANGLE, Rmid, S, '#cc2222', '#ff5555', this._discSensorHigh(SENSOR_B_ANGLE, angle), 'B')

    ctx.fillStyle = '#0a0a20'
    ctx.beginPath(); ctx.arc(cx, cy, Ri, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1a1a38'
    ctx.beginPath(); ctx.arc(cx, cy, Rh, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#2a3a6a'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(cx, cy, Rh, 0, Math.PI * 2); ctx.stroke()

    ctx.strokeStyle = '#2a3a6a'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()
  }

  private _drawSensor(
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

    const labelDist  = S * 0.42 * 1.16
    const lx = cx + Math.cos(worldAngle) * labelDist
    const ly = cy + Math.sin(worldAngle) * labelDist
    ctx.font         = `bold ${S * 0.03}px monospace`
    ctx.fillStyle    = active ? brightColor : '#404060'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, lx, ly)
  }

  // Sensor HIGH if a slot is visually under worldAngle — must match slot half-width in _drawOneDisc
  private _discSensorHigh(worldAngle: number, discAngle: number): boolean {
    const local  = ((worldAngle - discAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
    const period = Math.PI * 2 / this.curCpr
    const phase  = local % period
    const halfW  = Math.PI / this.curCpr * 0.5
    return phase < halfW || phase > period - halfW
  }

  // ── A/B waveform ─────────────────────────────────────────────────────────────

  private _drawWaveform(): void {
    const dpr = window.devicePixelRatio || 1
    const W   = this.waveCanvas.offsetWidth * dpr
    const H   = this.waveCanvas.height * dpr
    if (this.waveCanvas.width !== W) this.waveCanvas.width = W

    const ctx = this.waveCtx
    ctx.fillStyle = '#12122a'
    ctx.fillRect(0, 0, W, H)

    if (this.waveBuffer.length < 2) return

    const midA = H * 0.26, midB = H * 0.74, amp = H * 0.18

    ;(['a', 'b'] as const).forEach((ch, idx) => {
      const mid   = idx === 0 ? midA : midB
      const color = idx === 0 ? '#4a80ff' : '#ff6b6b'
      ctx.strokeStyle = color
      ctx.lineWidth   = 1.5 * dpr
      ctx.beginPath()
      let prevHi: boolean | null = null
      this.waveBuffer.forEach((s, i) => {
        const hi = s[ch]
        const x  = (i / (WAVE_LEN - 1)) * W
        const y  = hi ? mid - amp : mid + amp
        if (i === 0) { ctx.moveTo(x, y) }
        else {
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
      ctx.font      = `${10 * dpr}px monospace`
      ctx.fillStyle = color
      ctx.fillText(ch.toUpperCase(), 4 * dpr, mid - amp - 2 * dpr)
    })
  }

  // ── Velocity graph ────────────────────────────────────────────────────────────

  private _smooth(buf: number[]): number[] {
    const w = Math.max(1, this.smoothWin)
    if (w === 1) return buf
    const out: number[] = new Array(buf.length)
    let   sum = 0, count = 0
    for (let i = 0; i < buf.length; i++) {
      sum += buf[i]; count++
      if (i >= w) { sum -= buf[i - w]; count-- }
      out[i] = sum / count
    }
    return out
  }

  private _drawVelocity(): void {
    const dpr   = window.devicePixelRatio || 1
    const W     = this.velCanvas.offsetWidth * dpr
    const H     = this.velCanvas.height * dpr
    if (this.velCanvas.width !== W) this.velCanvas.width = W

    const ctx   = this.velCtx
    const scale = this.showMeters ? this.metersPerTick : 1
    const unit  = this.showMeters ? 'm/s' : 'ticks/s'

    ctx.fillStyle = '#0e0e20'
    ctx.fillRect(0, 0, W, H)

    // Auto y-scale using smoothed buffers; lerp toward target to limit jump rate
    const smL0 = this._smooth(this.velBufL)
    const smR0 = this._smooth(this.velBufR)
    let targetMax = this.showMeters ? 0.05 : 10
    for (const v of smL0) if (Math.abs(v * scale) > targetMax) targetMax = Math.abs(v * scale)
    for (const v of smR0) if (Math.abs(v * scale) > targetMax) targetMax = Math.abs(v * scale)
    targetMax *= 1.15
    // Fast expansion (0.15), slow contraction (0.03) so the scale chases peaks
    // quickly but doesn't shrink back until the signal is clearly lower.
    const lerpK = targetMax > this.displayMaxAbs ? 0.15 : 0.03
    this.displayMaxAbs += (targetMax - this.displayMaxAbs) * lerpK
    const maxAbs = this.displayMaxAbs

    const pad = { top: 16, bottom: 4, left: 4, right: 4 }
    const iW  = W - pad.left - pad.right
    const iH  = H - pad.top  - pad.bottom

    // Zero line
    const zy = pad.top + iH * 0.5
    ctx.strokeStyle = '#2a2a4a'
    ctx.lineWidth   = 1
    ctx.setLineDash([2, 3])
    ctx.beginPath(); ctx.moveTo(pad.left, zy); ctx.lineTo(W - pad.right, zy); ctx.stroke()
    ctx.setLineDash([])

    const drawLine = (buf: number[], color: string): void => {
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

    drawLine(smL0, '#00d8d8')   // cyan   = left
    drawLine(smR0, '#d800d8')   // magenta = right

    // Current-value labels (use smoothed last sample)
    const smL = smL0
    const smR = smR0
    const lv  = (smL.length > 0 ? smL[smL.length - 1] : 0) * scale
    const rv  = (smR.length > 0 ? smR[smR.length - 1] : 0) * scale

    ctx.font         = `${10 * dpr}px monospace`
    ctx.textBaseline = 'top'
    ctx.fillStyle    = '#00d8d8'
    ctx.textAlign    = 'left'
    ctx.fillText(`L ${lv.toFixed(this.showMeters ? 2 : 0)} ${unit}`, pad.left + 4 * dpr, 3 * dpr)
    ctx.fillStyle    = '#d800d8'
    ctx.textAlign    = 'right'
    ctx.fillText(`R ${rv.toFixed(this.showMeters ? 2 : 0)} ${unit}`, W - pad.right - 4 * dpr, 3 * dpr)

    // Scale indicator
    ctx.fillStyle    = '#3a4a6a'
    ctx.textAlign    = 'right'
    ctx.textBaseline = 'middle'
    ctx.font         = `${9 * dpr}px monospace`
    const scaleLabel = this.showMeters
      ? `±${maxAbs.toFixed(2)} m/s`
      : `±${Math.round(maxAbs)} ticks/s`
    ctx.fillText(scaleLabel, W - pad.right - 2 * dpr, zy)
  }
}
