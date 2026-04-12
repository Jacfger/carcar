import { BATTERY } from '../constants'

export interface BatteryState {
  voltage: number   // current voltage (V)
  charge:  number   // normalised capacity 0–1
}

export function createBattery(): BatteryState {
  return { voltage: BATTERY.V_full, charge: 1.0 }
}

/**
 * Step battery one simulation tick.
 * Voltage sags under motor load and drains slowly over time.
 * @returns updated voltage (also stored in state)
 */
export function stepBattery(
  state: BatteryState,
  pwm_L: number,
  pwm_R: number,
  dt: number,
  drainEnabled: boolean,
): number {
  const load = (Math.abs(pwm_L) + Math.abs(pwm_R)) / 510   // 0–1
  const current = load * BATTERY.I_stall * 2               // total A (two motors)

  if (drainEnabled) {
    // Slow capacity drain
    state.charge = Math.max(0, state.charge - BATTERY.capacity_drain * dt)
  }

  // Ohmic sag under load
  const sag = current * BATTERY.R_internal
  state.voltage = Math.max(
    BATTERY.V_min,
    BATTERY.V_full * state.charge - sag,
  )

  return state.voltage
}

export function resetBattery(state: BatteryState): void {
  state.voltage = BATTERY.V_full
  state.charge  = 1.0
}
