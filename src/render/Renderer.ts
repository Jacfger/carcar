import { drawCar } from './CarShape'
import { drawTelemetry } from './Telemetry'
import type { CarState } from '../simulation/Car'
import type { TrackRenderer } from '../track/TrackRenderer'
import type { TelemetryData } from './Telemetry'
import { BATTERY } from '../constants'

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
    const newTcW = Math.round(tc.clientWidth  * pr)
    const newTcH = Math.round(tc.clientHeight * pr)
    if (newTcW > 0 && newTcH > 0 && (tc.width !== newTcW || tc.height !== newTcH)) {
      tc.width  = newTcW
      tc.height = newTcH
      this.trackCtx.scale(pr, pr)
    }

    const tel = this.telemetryCanvas
    const newTelW = Math.round(tel.clientWidth  * pr)
    const newTelH = Math.round(tel.clientHeight * pr)
    if (newTelW > 0 && newTelH > 0 && (tel.width !== newTelW || tel.height !== newTelH)) {
      tel.width  = newTelW
      tel.height = newTelH
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

    // Blit the offscreen track image
    ctx.drawImage(trackRenderer.offscreen, 0, 0, W, H)

    // Draw all cars (back-to-front by colorIndex so car 0 is always on top)
    for (let i = cars.length - 1; i >= 0; i--) {
      drawCar(ctx, cars[i], showSensors)
    }

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
