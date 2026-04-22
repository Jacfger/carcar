import { drawCar } from './CarShape'
import { drawTelemetry } from './Telemetry'
import type { CarState } from '../simulation/Car'
import type { TrackRenderer } from '../track/TrackRenderer'
import type { TelemetryData } from './Telemetry'
import { BATTERY } from '../constants'
import { WORLD_W, WORLD_H } from '../engine/SimulationEngine'

export class Renderer {
  private trackCanvas:     HTMLCanvasElement
  private trackCtx:        CanvasRenderingContext2D
  private telemetryCanvas: HTMLCanvasElement
  private telemetryCtx:    CanvasRenderingContext2D

  constructor(trackCanvas: HTMLCanvasElement, telemetryCanvas: HTMLCanvasElement) {
    this.trackCanvas     = trackCanvas
    this.trackCtx        = trackCanvas.getContext('2d')!
    this.telemetryCanvas = telemetryCanvas
    this.telemetryCtx    = telemetryCanvas.getContext('2d')!
  }

  resize(): void {
    const pr = window.devicePixelRatio || 1

    const tc = this.trackCanvas
    if (tc.clientWidth > 0 && tc.clientHeight > 0) {
      tc.width  = tc.clientWidth  * pr
      tc.height = tc.clientHeight * pr
      this.trackCtx.scale(pr, pr)
    }

    const tel = this.telemetryCanvas
    if (tel.clientWidth > 0 && tel.clientHeight > 0) {
      tel.width  = tel.clientWidth  * pr
      tel.height = tel.clientHeight * pr
      this.telemetryCtx.scale(pr, pr)
    }
  }

  /** Draw all cars and telemetry for car[0] (primary car). */
  drawFrame(
    trackRenderer: TrackRenderer,
    cars:          CarState[],
    telemetry:     TelemetryData,
    showSensors:   boolean,
  ): void {
    const ctx = this.trackCtx
    const W   = this.trackCanvas.clientWidth
    const H   = this.trackCanvas.clientHeight

    // Scale world (800x600) to fit display canvas, preserving aspect ratio
    const scale = Math.min(W / WORLD_W, H / WORLD_H)
    const offX  = (W - WORLD_W * scale) / 2
    const offY  = (H - WORLD_H * scale) / 2

    // Clear letterbox areas
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, W, H)

    ctx.save()
    ctx.translate(offX, offY)
    ctx.scale(scale, scale)

    ctx.drawImage(trackRenderer.offscreen, 0, 0, WORLD_W, WORLD_H)

    // Draw all cars (back-to-front by colorIndex so car 0 is always on top)
    for (let i = cars.length - 1; i >= 0; i--) {
      drawCar(ctx, cars[i], showSensors)
    }

    ctx.restore()

    // Telemetry always tracks car[0] (the "player" car)
    if (cars.length > 0) {
      drawTelemetry(
        this.telemetryCtx,
        this.telemetryCanvas,
        telemetry,
        BATTERY.V_min,
        BATTERY.V_full,
      )
    }
  }
}
