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
    const tc = this.trackCanvas
    const pr = window.devicePixelRatio || 1

    tc.width  = tc.clientWidth  * pr
    tc.height = tc.clientHeight * pr
    this.trackCtx.scale(pr, pr)

    const tel = this.telemetryCanvas
    tel.width  = tel.clientWidth  * pr
    tel.height = tel.clientHeight * pr
    this.telemetryCtx.scale(pr, pr)
  }

  drawFrame(
    trackRenderer: TrackRenderer,
    car: CarState,
    telemetry: TelemetryData,
    showSensors: boolean,
  ): void {
    const ctx = this.trackCtx
    const W   = this.trackCanvas.clientWidth
    const H   = this.trackCanvas.clientHeight

    // Blit the offscreen track image
    ctx.drawImage(trackRenderer.offscreen, 0, 0, W, H)

    // Draw car
    drawCar(ctx, car, showSensors)

    // Draw telemetry
    drawTelemetry(
      this.telemetryCtx,
      this.telemetryCanvas,
      telemetry,
      BATTERY.V_min,
      BATTERY.V_full,
    )
  }
}
