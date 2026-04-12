import type { Track } from './Track'

/**
 * Renders a track to an offscreen canvas that is used both for:
 *   1. Display (blitted to the main canvas each frame)
 *   2. Sensor sampling (pixel colour lookup)
 *
 * Black line on white background — sensors read pixel brightness.
 */
export class TrackRenderer {
  readonly offscreen: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor(width: number, height: number) {
    this.offscreen = document.createElement('canvas')
    this.offscreen.width  = width
    this.offscreen.height = height
    this.ctx = this.offscreen.getContext('2d', { willReadFrequently: true })!
  }

  render(track: Track): void {
    const { ctx } = this
    const { width, height } = this.offscreen

    // White background
    ctx.fillStyle = '#f5f5f0'
    ctx.fillRect(0, 0, width, height)

    // Draw outer track boundary (subtle grey fill between outer & inner lines)
    this.drawTrackSurface(track)

    // Draw the black centre line
    this.drawCentreLine(track)
  }

  private drawTrackSurface(track: Track): void {
    const { ctx } = this
    const pts = track.centerline
    const hw = track.lineWidth * 3.5   // half-width of the track surface

    ctx.save()
    ctx.strokeStyle = '#d8d0c0'
    ctx.lineWidth = hw * 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    if (track.closed) ctx.closePath()
    ctx.stroke()
    ctx.restore()
  }

  private drawCentreLine(track: Track): void {
    const { ctx } = this
    const pts = track.centerline

    ctx.save()
    ctx.strokeStyle = '#111'
    ctx.lineWidth = track.lineWidth
    ctx.lineCap  = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    if (track.closed) ctx.closePath()
    ctx.stroke()

    // Start marker — a short white dash
    const p0 = pts[0], p1 = pts[1]
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 3
    ctx.beginPath()
    const hw = track.lineWidth / 2 + 4
    ctx.moveTo(p0.x - Math.sin(ang) * hw, p0.y + Math.cos(ang) * hw)
    ctx.lineTo(p0.x + Math.sin(ang) * hw, p0.y - Math.cos(ang) * hw)
    ctx.stroke()

    ctx.restore()
  }

  /**
   * Sample a single pixel's darkness at world position (wx, wy).
   * Returns 0.0 = white (off line) → 1.0 = black (on line).
   */
  sampleAt(wx: number, wy: number): number {
    const x = Math.round(wx)
    const y = Math.round(wy)
    if (x < 0 || y < 0 || x >= this.offscreen.width || y >= this.offscreen.height) return 0
    const d = this.ctx.getImageData(x, y, 1, 1).data
    // Luminance from RGB
    const lum = (d[0] * 0.299 + d[1] * 0.587 + d[2] * 0.114) / 255
    return 1 - lum   // invert: black line → 1.0
  }

  resize(width: number, height: number, track: Track): void {
    this.offscreen.width  = width
    this.offscreen.height = height
    this.render(track)
  }
}
