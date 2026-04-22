import { Renderer } from '../render/Renderer'
import { TrackRenderer } from '../track/TrackRenderer'
import {
  createCar, resetCar, stepCarModel, applyResolvedMotion,
  type CarState, type CarOptions,
} from '../simulation/Car'
import { PhysicsWorld } from '../simulation/Physics'
import { createTelemetry, pushTelemetry, type TelemetryData } from '../render/Telemetry'
import { compileUserCode, callUserCode } from '../editor/Sandbox'
import { weightedCentroid } from '../simulation/Sensors'
import { makeOvalTrack } from '../track/presets/oval'
import { makeFigure8Track } from '../track/presets/figure8'
import { makeChicaneTrack } from '../track/presets/chicane'
import { PHYSICS_HZ, ENCODER_DEFAULTS, WHEEL_RADIUS_M } from '../constants'
import type { Track } from '../track/Track'
import type { EncoderUpdateFn } from '../components/EncoderView'

const MAX_CARS = 4
const DT = 1 / PHYSICS_HZ

export interface SimSettings {
  trackName: string
  speedPercent: number
  varianceEnabled: boolean
  batteryEnabled: boolean
  casterEnabled: boolean
  showSensors: boolean
  encoderCpr: number
  encoderGearRatio: number
  encoderNoise: boolean
}

export class SimulationEngine {
  private physics = new PhysicsWorld()
  private trackRenderer = new TrackRenderer(1, 1)
  private renderer: Renderer | null = null
  private telemetry: TelemetryData = createTelemetry()

  private currentTrack!: Track
  private cars: CarState[] = []
  private carOptionsList: CarOptions[] = []

  private running = false
  private rafId = 0
  private lastTimestamp = 0
  private accumulator = 0

  private trackCanvas: HTMLCanvasElement | null = null
  private telemetryCanvas: HTMLCanvasElement | null = null
  private encoderVisible = false
  private encoderUpdateRef: { current: EncoderUpdateFn | null } | null = null

  settings: SimSettings = {
    trackName: 'oval',
    speedPercent: 60,
    varianceEnabled: true,
    batteryEnabled: true,
    casterEnabled: true,
    showSensors: true,
    encoderCpr: ENCODER_DEFAULTS.cpr,
    encoderGearRatio: ENCODER_DEFAULTS.gearRatio,
    encoderNoise: false,
  }

  private onError: ((msg: string | null) => void) | null = null
  private onRunningChange: ((running: boolean) => void) | null = null
  private onCarCountChange: ((count: number) => void) | null = null

  setCallbacks(cbs: {
    onError?: (msg: string | null) => void
    onRunningChange?: (running: boolean) => void
    onCarCountChange?: (count: number) => void
  }): void {
    this.onError = cbs.onError ?? null
    this.onRunningChange = cbs.onRunningChange ?? null
    this.onCarCountChange = cbs.onCarCountChange ?? null
  }

  setTrackCanvas(canvas: HTMLCanvasElement): void {
    this.trackCanvas = canvas
  }

  setTelemetryCanvas(canvas: HTMLCanvasElement): void {
    this.telemetryCanvas = canvas
  }

  setEncoderUpdateRef(ref: { current: EncoderUpdateFn | null }): void {
    this.encoderUpdateRef = ref
  }

  setEncoderVisible(visible: boolean): void {
    this.encoderVisible = visible
    if (!visible) {
      this.renderer?.resize()
      this.drawFrame()
    }
  }

  init(): void {
    if (!this.trackCanvas || !this.telemetryCanvas) return
    this.renderer = new Renderer(this.trackCanvas, this.telemetryCanvas)
    this.rebuildScene()
  }

  getCarCount(): number {
    return this.cars.length
  }

  getMaxCars(): number {
    return MAX_CARS
  }

  isRunning(): boolean {
    return this.running
  }

  private buildTrack(): Track {
    if (!this.trackCanvas) return makeOvalTrack(800, 600)
    const W = this.trackCanvas.clientWidth || 800
    const H = this.trackCanvas.clientHeight || 600
    switch (this.settings.trackName) {
      case 'figure8': return makeFigure8Track(W, H)
      case 'chicane': return makeChicaneTrack(W, H)
      default: return makeOvalTrack(W, H)
    }
  }

  private makeCarOptions(index: number): CarOptions {
    const offsetX = Math.sin(index * 1.2) * 20
    const offsetY = -index * 30
    const noiseOn = this.settings.encoderNoise && this.settings.varianceEnabled
    return {
      startX: this.currentTrack.startX + offsetX,
      startY: this.currentTrack.startY + offsetY,
      startAngle: this.currentTrack.startAngle,
      varianceEnabled: this.settings.varianceEnabled,
      batteryEnabled: this.settings.batteryEnabled,
      casterEnabled: this.settings.casterEnabled,
      colorIndex: index,
      encoderParams: {
        cpr: this.settings.encoderCpr || ENCODER_DEFAULTS.cpr,
        gearRatio: this.settings.encoderGearRatio || ENCODER_DEFAULTS.gearRatio,
        wheelRadius: WHEEL_RADIUS_M,
        noiseRate: noiseOn ? ENCODER_DEFAULTS.noiseRate : 0,
      },
    }
  }

  addCar(): void {
    if (this.cars.length >= MAX_CARS) return
    const index = this.cars.length
    const opts = this.makeCarOptions(index)
    this.carOptionsList.push(opts)
    const body = this.physics.addCarBody(opts.startX, opts.startY, opts.startAngle)
    this.cars.push(createCar(opts, body))
    this.onCarCountChange?.(this.cars.length)
    this.drawFrame()
  }

  private clearCars(): void {
    for (const car of this.cars) this.physics.removeCarBody(car.body)
    this.cars = []
    this.carOptionsList = []
  }

  rebuildScene(): void {
    if (!this.trackCanvas || !this.renderer) return
    this.currentTrack = this.buildTrack()

    const pr = window.devicePixelRatio || 1
    this.trackRenderer.resize(
      Math.round(this.trackCanvas.clientWidth * pr),
      Math.round(this.trackCanvas.clientHeight * pr),
      this.currentTrack,
    )

    this.physics.setBounds(this.trackCanvas.clientWidth, this.trackCanvas.clientHeight)

    const prevCount = Math.max(this.cars.length, 1)
    this.clearCars()
    for (let i = 0; i < prevCount; i++) {
      const opts = this.makeCarOptions(i)
      this.carOptionsList.push(opts)
      const body = this.physics.addCarBody(opts.startX, opts.startY, opts.startAngle)
      this.cars.push(createCar(opts, body))
    }
    this.onCarCountChange?.(this.cars.length)

    this.renderer.resize()
    this.drawFrame()
  }

  private drawFrame(): void {
    this.renderer?.drawFrame(this.trackRenderer, this.cars, this.telemetry, this.settings.showSensors)
  }

  start(code: string): void {
    if (this.running) return
    this.running = true
    this.onRunningChange?.(true)
    this.accumulator = 0
    this.lastTimestamp = performance.now()

    const err = compileUserCode(code)
    this.onError?.(err)
    if (err) { this.stop(); return }

    const loop = (ts: number) => {
      if (!this.running) return
      this.rafId = requestAnimationFrame(loop)

      const elapsed = Math.min((ts - this.lastTimestamp) / 1000, 0.1)
      this.lastTimestamp = ts
      this.accumulator += elapsed

      while (this.accumulator >= DT) {
        this.accumulator -= DT

        const allBodies = this.cars.map(c => c.body)

        for (const car of this.cars) {
          const { output, error } = callUserCode(
            car.sensors, DT,
            {
              voltage: car.battery.voltage,
              speed: Math.hypot(car.vx, car.vy) / 1600,
              time: car.time,
              ticksL: car.encoderL.ticks,
              ticksR: car.encoderR.ticks,
            },
          )

          if (error) { this.onError?.(error); this.stop(); return }
          this.onError?.(null)

          const speedFactor = this.settings.speedPercent / 100
          const scaledLeft = output.left * speedFactor
          const scaledRight = output.right * speedFactor

          const desired = stepCarModel(car, scaledLeft, scaledRight, DT, {
            batteryEnabled: this.settings.batteryEnabled,
            casterEnabled: this.settings.casterEnabled,
          })

          const otherBodies = allBodies.filter(b => b !== car.body)
          const resolved = this.physics.resolve(
            car.body,
            desired.vx, desired.vy, desired.omega,
            otherBodies,
            DT,
          )

          applyResolvedMotion(car, resolved.vx, resolved.vy, resolved.omega, DT, this.trackRenderer)
        }

        if (this.cars.length > 0 && Math.round(this.cars[0].time / DT) % 4 === 0) {
          const c = this.cars[0]
          pushTelemetry(this.telemetry, weightedCentroid(c.sensors), c.pwmL, c.pwmR, c.battery.voltage)
        }
      }

      if (this.cars.length > 0 && this.encoderVisible) {
        this.encoderUpdateRef?.current?.(this.cars[0].encoderL, this.cars[0].encoderR)
      }

      this.drawFrame()
    }

    this.rafId = requestAnimationFrame(loop)
  }

  stop(): void {
    this.running = false
    this.onRunningChange?.(false)
    cancelAnimationFrame(this.rafId)
  }

  reset(): void {
    this.stop()
    for (let i = 0; i < this.cars.length; i++) {
      const opts = this.makeCarOptions(i)
      this.carOptionsList[i] = opts
      resetCar(this.cars[i], opts)
    }
    this.drawFrame()
  }

  destroy(): void {
    this.stop()
  }
}
