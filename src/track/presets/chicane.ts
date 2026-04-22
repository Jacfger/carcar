import type { Track, TrackPoint } from '../Track'

export function makeChicaneTrack(canvasW: number, canvasH: number): Track {
  const margin = canvasW * 0.1
  const top    = canvasH * 0.15
  const bottom = canvasH * 0.85
  const w      = canvasW - margin * 2

  // Waypoints: a looped track with tight S-bends
  const raw: TrackPoint[] = [
    { x: margin,          y: canvasH * 0.5 },
    { x: margin + w*0.1,  y: top },
    { x: margin + w*0.3,  y: top },
    { x: margin + w*0.4,  y: canvasH * 0.5 },   // chicane 1 centre
    { x: margin + w*0.5,  y: bottom },
    { x: margin + w*0.7,  y: bottom },
    { x: margin + w*0.8,  y: canvasH * 0.5 },   // chicane 2 centre
    { x: margin + w*0.9,  y: top },
    { x: margin + w,      y: top },
    { x: margin + w,      y: bottom },
    { x: margin,          y: bottom },
  ]

  // Catmull-Rom interpolation for smooth curves
  const pts = catmullRomChain(raw, 12, true)

  return {
    name: 'Chicane',
    centerline: pts,
    closed: true,
    lineWidth: 8,
    startX: pts[0].x,
    startY: pts[0].y,
    startAngle: 0,
  }
}

function catmullRomChain(pts: TrackPoint[], divisions: number, closed: boolean): TrackPoint[] {
  const out: TrackPoint[] = []
  const n = pts.length

  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]

    for (let j = 0; j < divisions; j++) {
      const t = j / divisions
      out.push(catmullRom(p0, p1, p2, p3, t))
    }
  }
  if (!closed) out.push(pts[n - 1])
  return out
}

function catmullRom(p0: TrackPoint, p1: TrackPoint, p2: TrackPoint, p3: TrackPoint, t: number): TrackPoint {
  const t2 = t * t, t3 = t2 * t
  return {
    x: 0.5 * ((2*p1.x) + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
    y: 0.5 * ((2*p1.y) + (-p0.y+p2.y)*t + (2*p0.y-5*p1.y+4*p2.y-p3.y)*t2 + (-p0.y+3*p1.y-3*p2.y+p3.y)*t3),
  }
}
