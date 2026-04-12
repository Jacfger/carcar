import { CAR_GEOMETRY } from '../constants'
import type { TrackRenderer } from '../track/TrackRenderer'

/**
 * Sample the 7 IR sensors based on the car's world position and heading.
 * Each sensor returns 0.0 (white/off-line) → 1.0 (black/on-line).
 */
export function readSensors(
  carX: number,
  carY: number,
  heading: number,  // radians, 0 = right, π/2 = down
  trackRenderer: TrackRenderer,
): number[] {
  const { sensor_count, sensor_spread, sensor_y } = CAR_GEOMETRY

  // Apply the same +π/2 offset as the renderer so sensor world-positions
  // match what is drawn on screen.
  // cos(heading + π/2) = -sin(heading),  sin(heading + π/2) = cos(heading)
  const cosH = -Math.sin(heading)
  const sinH =  Math.cos(heading)

  const readings: number[] = []

  for (let i = 0; i < sensor_count; i++) {
    // Local position of this sensor
    const lx = (i / (sensor_count - 1) - 0.5) * sensor_spread
    const ly = sensor_y

    // Rotate from car-local to world coords (using the corrected basis)
    const wx = carX + lx * cosH - ly * sinH
    const wy = carY + lx * sinH + ly * cosH

    readings.push(trackRenderer.sampleAt(wx, wy))
  }

  return readings
}

/**
 * Weighted centroid of sensor readings.
 * Returns a value in [-1, 1]:  -1 = line far left, 0 = centred, +1 = line far right.
 * Provided as a helper that gets injected into the user's sandbox.
 */
export function weightedCentroid(sensors: number[]): number {
  let weightedSum = 0
  let totalWeight = 0
  const n = sensors.length

  for (let i = 0; i < n; i++) {
    const pos = (i / (n - 1)) * 2 - 1   // maps index to [-1, 1]
    weightedSum += pos * sensors[i]
    totalWeight += sensors[i]
  }

  if (totalWeight < 0.01) return 0  // no line detected — return centred
  return weightedSum / totalWeight
}
