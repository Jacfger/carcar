export interface TrackPoint { x: number; y: number }

export interface Track {
  name: string
  // Centre-line path of the track (normalised 0–1 coordinates)
  centerline: TrackPoint[]
  closed: boolean
  lineWidth: number    // width of the black line in sim units (px)
  startX: number       // car start position (sim units)
  startY: number
  startAngle: number   // radians, 0 = facing right
}
