import type { Track, TrackPoint } from '../Track'

function buildOval(cx: number, cy: number, rx: number, ry: number, steps = 80): TrackPoint[] {
  const pts: TrackPoint[] = []
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry })
  }
  return pts
}

export function makeOvalTrack(canvasW: number, canvasH: number): Track {
  const cx = canvasW / 2
  const cy = canvasH / 2
  const rx = canvasW * 0.36
  const ry = canvasH * 0.32

  // Start at the rightmost point of the oval, facing downward (π/2)
  return {
    name: 'Oval',
    centerline: buildOval(cx, cy, rx, ry),
    closed: true,
    lineWidth: 20,
    startX: cx + rx,
    startY: cy,
    startAngle: Math.PI / 2,
  }
}
