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
  const rx = canvasW * 0.43
  const ry = canvasH * 0.40

  const centerline = buildOval(cx, cy, rx, ry)
  const startAngle = Math.atan2(centerline[1].y - centerline[0].y, centerline[1].x - centerline[0].x)
  return {
    name: 'Oval',
    centerline,
    closed: true,
    lineWidth: 8,
    startX: centerline[0].x,
    startY: centerline[0].y,
    startAngle,
  }
}
