import type { Track, TrackPoint } from '../Track'

export function makeFigure8Track(canvasW: number, canvasH: number): Track {
  const cx = canvasW / 2
  const cy = canvasH / 2
  const rx = canvasW * 0.28
  const ry = canvasH * 0.30
  const steps = 120
  const pts: TrackPoint[] = []

  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2
    // Lemniscate-of-Bernoulli style figure-8 mapped to canvas
    const scale = 1 / (1 + Math.sin(t) * Math.sin(t))
    pts.push({
      x: cx + rx * Math.cos(t) * scale,
      y: cy + ry * Math.sin(t) * Math.cos(t) * scale,
    })
  }

  return {
    name: 'Figure 8',
    centerline: pts,
    closed: true,
    lineWidth: 20,
    startX: pts[0].x,
    startY: pts[0].y,
    startAngle: Math.PI / 2,
  }
}
