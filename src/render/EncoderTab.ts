import * as THREE from 'three'
import type { EncoderState } from '../simulation/Encoder'

const WAVE_LEN = 200

export class EncoderTab {
  private threeRenderer!: THREE.WebGLRenderer
  private scene!:         THREE.Scene
  private camera!:        THREE.PerspectiveCamera
  private discGroup!:     THREE.Group
  private sensorAMesh!:   THREE.Mesh
  private sensorBMesh!:   THREE.Mesh
  private arrow!:         THREE.ArrowHelper

  private waveCanvas!: HTMLCanvasElement
  private waveCtx!:    CanvasRenderingContext2D
  private waveBuffer: Array<{ a: boolean; b: boolean }> = []

  private tickReadout!: HTMLDivElement
  private leftBtn!:     HTMLButtonElement
  private rightBtn!:    HTMLButtonElement
  private showLeft     = true

  private running  = false
  private rafId    = 0
  private lastCpr  = -1
  private prevTicksL = 0
  private prevTicksR = 0

  constructor(private mount: HTMLElement) {
    this._buildDOM()
    this._buildScene()
  }

  // ── DOM ──────────────────────────────────────────────────────────────────────

  private _buildDOM(): void {
    this.mount.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;flex:1'

    const threeWrap = document.createElement('div')
    threeWrap.style.cssText = 'flex:1;position:relative;min-height:0;overflow:hidden'
    this.mount.appendChild(threeWrap)

    this.threeRenderer = new THREE.WebGLRenderer({ antialias: true })
    this.threeRenderer.setPixelRatio(window.devicePixelRatio)
    this.threeRenderer.setClearColor(0x12122a)
    this.threeRenderer.domElement.style.cssText = 'width:100%;height:100%;display:block'
    threeWrap.appendChild(this.threeRenderer.domElement)

    // L / R buttons
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

    // Tick readout
    this.tickReadout = document.createElement('div')
    this.tickReadout.style.cssText = 'font-family:monospace;font-size:10px;color:#50e090;padding:2px 8px;flex-shrink:0;background:#12122a'
    this.tickReadout.textContent   = 'L: +000000  R: +000000'
    this.mount.appendChild(this.tickReadout)

    // Waveform canvas
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

  // ── Three.js ─────────────────────────────────────────────────────────────────

  private _buildScene(): void {
    this.scene  = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    this.camera.position.set(0, 3.2, 2.2)
    this.camera.lookAt(0, 0, 0)

    this.scene.add(new THREE.AmbientLight(0x404060, 3))
    const dir = new THREE.DirectionalLight(0xffffff, 2)
    dir.position.set(2, 4, 2)
    this.scene.add(dir)

    this.discGroup = new THREE.Group()
    this.scene.add(this.discGroup)

    const sGeo  = new THREE.SphereGeometry(0.1, 16, 16)
    const matA  = new THREE.MeshPhongMaterial({ color: 0x2244aa, emissive: 0x001133 })
    const matB  = new THREE.MeshPhongMaterial({ color: 0xaa2222, emissive: 0x330011 })
    this.sensorAMesh = new THREE.Mesh(sGeo,        matA)
    this.sensorBMesh = new THREE.Mesh(sGeo.clone(), matB)
    this.sensorAMesh.position.set(0.85, 0.22, 0)
    this.sensorBMesh.position.set(0.85, 0.22, 0.22)
    this.scene.add(this.sensorAMesh)
    this.scene.add(this.sensorBMesh)

    this.arrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0.08, 0),
      0.55, 0x50e090,
    )
    this.scene.add(this.arrow)
  }

  private _buildDisc(cpr: number): void {
    // Dispose old geometries
    for (const child of [...this.discGroup.children]) {
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose()
      this.discGroup.remove(child)
    }

    const discMat = new THREE.MeshPhongMaterial({ color: 0x1a1a3a })
    this.discGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.12, 64), discMat))

    const hubMat = new THREE.MeshPhongMaterial({ color: 0x0a0a1a })
    this.discGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 32), hubMat))

    const slotMat = new THREE.MeshPhongMaterial({ color: 0x3d5aff, transparent: true, opacity: 0.75 })
    for (let i = 0; i < cpr; i++) {
      const a    = (i / cpr) * Math.PI * 2
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.15, 0.35), slotMat)
      slot.position.set(Math.sin(a) * 0.72, 0, Math.cos(a) * 0.72)
      this.discGroup.add(slot)
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  /** Called from the simulation tick (120 Hz). Updates disc angle, sensor colours, waveform buffer. */
  update(stateL: EncoderState, stateR: EncoderState): void {
    const state = this.showLeft ? stateL : stateR
    const { cpr } = state.params

    if (cpr !== this.lastCpr) { this._buildDisc(cpr); this.lastCpr = cpr }

    this.discGroup.rotation.y = state.angle

    // Sensor glow
    ;(this.sensorAMesh.material as THREE.MeshPhongMaterial).emissive.setHex(
      state.channelA ? 0x2255ff : 0x001133,
    )
    ;(this.sensorBMesh.material as THREE.MeshPhongMaterial).emissive.setHex(
      state.channelB ? 0xff2222 : 0x330011,
    )

    // Direction arrow — based on tick delta since last update
    const prevTicks  = this.showLeft ? this.prevTicksL : this.prevTicksR
    const tickDelta  = state.ticks - prevTicks
    if (this.showLeft) this.prevTicksL = stateL.ticks
    else               this.prevTicksR = stateR.ticks

    const forward = tickDelta >= 0
    this.arrow.setDirection(new THREE.Vector3(0, 0, forward ? 1 : -1))
    this.arrow.setColor(forward ? 0x50e090 : 0xe94560)

    // Waveform buffer
    this.waveBuffer.push({ a: state.channelA, b: state.channelB })
    if (this.waveBuffer.length > WAVE_LEN) this.waveBuffer.shift()

    // Tick readout
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

  // ── Internal render loop (60 fps) ────────────────────────────────────────────

  private _frame(): void {
    if (!this.running) return
    this.rafId = requestAnimationFrame(() => this._frame())

    const el = this.threeRenderer.domElement
    const w  = el.offsetWidth, h = el.offsetHeight
    if (w > 0 && h > 0) {
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
      this.threeRenderer.setSize(w, h, false)
      this.threeRenderer.render(this.scene, this.camera)
    }
    this._drawWaveform()
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
