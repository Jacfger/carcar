import type { EncoderState } from '../simulation/Encoder'

const WAVE_LEN       = 200
const SENSOR_A_ANGLE =  Math.PI / 10   // +18° from 3 o'clock
const SENSOR_B_ANGLE = -Math.PI / 10   // -18° from 3 o'clock

export class EncoderTab {
  private discCanvas!: HTMLCanvasElement
  private discCtx!:    CanvasRenderingContext2D

  private waveCanvas!: HTMLCanvasElement
  private waveCtx!:    CanvasRenderingContext2D
  private waveBuffer: Array<{ a: boolean; b: boolean }> = []

  private tickReadout!: HTMLDivElement
  private leftBtn!:     HTMLButtonElement
  private rightBtn!:    HTMLButtonElement
  private showLeft      = true

  private running = false
  private rafId   = 0

  private curAngle    = 0
  private curCpr      = 12
  private curChannelA = false
  private curChannelB = false

  constructor(private mount: HTMLElement) {
    this._buildDOM()
  }

  // ── DOM ──────────────────────────────────────────────────────────────────────

  private _buildDOM(): void {
    this.mount.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;flex:1'

    const discWrap = document.createElement('div')
    discWrap.style.cssText =
      'flex:1;min-height:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#12122a'
    this.mount.appendChild(discWrap)

    this.discCanvas = document.createElement('canvas')
    this.discCanvas.style.cssText = 'display:block'
    discWrap.appendChild(this.discCanvas)
    this.discCtx = this.discCanvas.getContext('2d')!

    const btnRow = document.createElement('div')
    btnRow.style.cssText = 'display:flex;gap:4px;padding:4px 8px;flex-shrink:0;background:#16213e'
    this.leftBtn  = document.createElement('button')
    this.rightBtn = document.createElement('button')
    this.leftBtn.textContent  = 'Left'
    this.rightBtn.textContent = 'Right'
    this.leftBtn.addEventListener('click',  () => { this.showLeft = true;  this._refreshBtns() })
    this.rightBtn.addEventListener('click', () => { this.showLeft = false; this._refreshBtns() })
    btnRow.append(this.leftBtn, this.rightBtn)
    this.mount.appendChild(btnRow)
    this._refreshBtns()

    this.tickReadout = document.createElement('div')
    this.tickReadout.style.cssText =
      'font-family:monospace;font-size:10px;color:#50e090;padding:2px 8px;flex-shrink:0;background:#12122a'
    this.tickReadout.textContent = 'L: +000000  R: +000000'
    this.mount.appendChild(this.tickReadout)

    this.waveCanvas = document.createElement('canvas')
    this.waveCanvas.height        = 50
    this.waveCanvas.style.cssText = 'width:100%;height:50px;display:block;flex-shrink:0'
    this.mount.appendChild(this.waveCanvas)
    this.waveCtx = this.waveCanvas.getContext('2d')!
  }

  private _refreshBtns(): void {
    const on  = 'background:#1a4a80;color:#e0e0e0;border-color:#1a4a80'
    const off = 'background:#0f3460;color:#a0b0c0;border-color:#0f3460'
    this.leftBtn.style.cssText  = `font-size:10px;padding:2px 10px;border-radius:3px;cursor:pointer;border:1px solid;${this.showLeft  ? on : off}`
    this.rightBtn.style.cssText = `font-size:10px;padding:2px 10px;border-radius:3px;cursor:pointer;border:1px solid;${!this.showLeft ? on : off}`
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  update(stateL: EncoderState, stateR: EncoderState): void {
    const state = this.showLeft ? stateL : stateR

    this.curAngle    = state.angle
    this.curCpr      = state.params.cpr
    this.curChannelA = state.channelA
    this.curChannelB = state.channelB

    this.waveBuffer.push({ a: state.channelA, b: state.channelB })
    if (this.waveBuffer.length > WAVE_LEN) this.waveBuffer.shift()

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
    const size = Math.min(wrap.offsetWidth, wrap.offsetHeight)
    if (size > 0) {
      if (this.discCanvas.width !== size || this.discCanvas.height !== size) {
        this.discCanvas.width  = size
        this.discCanvas.height = size
      }
      this._drawDisc(size)
    }
    this._drawWaveform()
  }

  private _drawDisc(S: number): void {
    const ctx   = this.discCtx
    const cx    = S / 2, cy = S / 2
    const R     = S * 0.42
    const Rslot = R * 0.88
    const Ri    = R * 0.30
    const Rh    = R * 0.09
    const cpr   = this.curCpr
    const angle = this.curAngle

    ctx.clearRect(0, 0, S, S)

    // outer glow
    const grd = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.1)
    grd.addColorStop(0, 'rgba(30,50,120,0)')
    grd.addColorStop(1, 'rgba(30,60,180,0.12)')
    ctx.fillStyle = grd
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.1, 0, Math.PI * 2); ctx.fill()

    // disc body
    ctx.fillStyle = '#1a1a3a'
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill()

    // slot segments (rotate with disc)
    for (let i = 0; i < cpr; i++) {
      const center = angle + (i / cpr) * Math.PI * 2
      const a0 = center - Math.PI / cpr * 0.5
      const a1 = center + Math.PI / cpr * 0.5
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a0) * Ri, cy + Math.sin(a0) * Ri)
      ctx.arc(cx, cy, Rslot, a0, a1)
      ctx.arc(cx, cy, Ri,    a1, a0, true)
      ctx.closePath()
      ctx.fillStyle   = '#1e35cc'
      ctx.fill()
      ctx.strokeStyle = '#3a55ee'
      ctx.lineWidth   = 0.8
      ctx.stroke()
    }

    // sensors (fixed in world space, channelA/B from simulation)
    const Rmid = (Rslot + Ri) * 0.5
    this._drawSensor(ctx, cx, cy, SENSOR_A_ANGLE, Rmid, S, '#2255ff', '#4a80ff', this.curChannelA, 'A')
    this._drawSensor(ctx, cx, cy, SENSOR_B_ANGLE, Rmid, S, '#cc2222', '#ff5555', this.curChannelB, 'B')

    // hub
    ctx.fillStyle = '#0a0a20'
    ctx.beginPath(); ctx.arc(cx, cy, Ri, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#1a1a38'
    ctx.beginPath(); ctx.arc(cx, cy, Rh, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#2a3a6a'
    ctx.lineWidth   = 1
    ctx.beginPath(); ctx.arc(cx, cy, Rh, 0, Math.PI * 2); ctx.stroke()

    // outer ring
    ctx.strokeStyle = '#2a3a6a'
    ctx.lineWidth   = 1.5
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()
  }

  private _drawSensor(
    ctx:         CanvasRenderingContext2D,
    cx:          number,
    cy:          number,
    worldAngle:  number,
    r:           number,
    S:           number,
    dimColor:    string,
    brightColor: string,
    active:      boolean,
    label:       string,
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
      ctx.beginPath()
      ctx.arc(sx - sr * 0.25, sy - sr * 0.3, sr * 0.35, 0, Math.PI * 2)
      ctx.fill()
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
}
