import { CASTER_FRICTION, CASTER_NOISE_SPEED } from '../constants'

// Simple value-noise based smooth random for the caster lateral drift.
// No dependency needed — just a pair of interpolated random values.
const _seeds = [Math.random() * 100, Math.random() * 100]

function smoothNoise(t: number, seed: number): number {
  const i = Math.floor(t + seed)
  const f = t + seed - i
  const a = pseudoRand(i)
  const b = pseudoRand(i + 1)
  // Smoothstep interpolation
  const s = f * f * (3 - 2 * f)
  return a + (b - a) * s
}

function pseudoRand(n: number): number {
  // Deterministic hash → [-1, 1]
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

/**
 * Compute the lateral angular perturbation from ball caster friction.
 * Returns a small delta-omega (rad/s) to add to the car's angular velocity.
 *
 * @param t       simulation time (s) — drives the noise
 * @param speed   car speed (m/s) — friction force scales with speed
 * @param enabled toggle for the realism feature
 */
export function ballCasterPerturbation(t: number, speed: number, enabled: boolean): number {
  if (!enabled || Math.abs(speed) < 0.001) return 0
  const noise = smoothNoise(t * CASTER_NOISE_SPEED, _seeds[0])
  // Scale with speed — faster → caster has more grip → bigger perturbation
  return noise * CASTER_FRICTION * Math.min(Math.abs(speed), 1.0)
}
