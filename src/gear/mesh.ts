import { createInternalGear, createSpurGear } from './gear'
import type { Gear } from './gear'
import type { GearParams, MeshOptions, SvgOptions } from './types'

export interface PositionedGear {
  gear: Gear
  x: number
  y: number
  rotation: number
}

export interface GearPair {
  pinion: Gear
  gear: Gear
  centerDistance: number
  backlash: number
  contactRatio: number
  operatingPressureAngle: number
  getPositionedPinion(): PositionedGear
  getPositionedGear(): PositionedGear
  toSvgPath(options?: SvgOptions): string
}

function defaultBacklash(moduleValue: number): number {
  return 0.04 * moduleValue
}

export function calculateMesh(pinion: Gear, gear: Gear, options?: MeshOptions): GearPair {
  const moduleA = pinion.geometry.module
  const moduleB = gear.geometry.module

  if (Math.abs(moduleA - moduleB) > 1e-9) {
    throw new Error('gear modules must match')
  }

  const pressureAngle = pinion.geometry.pressureAngleRad
  if (Math.abs(pressureAngle - gear.geometry.pressureAngleRad) > 1e-9) {
    throw new Error('pressure angle must match')
  }

  if (options?.backlash !== undefined && options.backlash < 0) {
    throw new Error('backlash must be >= 0')
  }

  const r1 = pinion.geometry.pitchRadius
  const r2 = gear.geometry.pitchRadius
  const pinionInternal = pinion.geometry.isInternal
  const gearInternal = gear.geometry.isInternal
  if (pinionInternal && gearInternal) {
    throw new Error('internal-internal pairs are not supported')
  }

  const hasInternal = pinionInternal || gearInternal
  const nominalCenterDistance = hasInternal ? Math.abs(r2 - r1) : r1 + r2
  const hasBacklash = options?.backlash !== undefined
  const hasCenterDistance = options?.centerDistance !== undefined
  const tanPressure = Math.tan(pressureAngle)
  const epsilon = 1e-9

  let centerDistance: number
  let backlash: number

  if (hasBacklash && hasCenterDistance) {
    const providedBacklash = options.backlash as number
    const providedCenterDistance = options.centerDistance as number
    const expectedCenterDistance = nominalCenterDistance + providedBacklash / (2 * tanPressure)

    if (Math.abs(providedCenterDistance - expectedCenterDistance) > epsilon) {
      throw new Error('centerDistance and backlash must be consistent')
    }

    centerDistance = providedCenterDistance
    backlash = providedBacklash
  } else if (hasCenterDistance) {
    centerDistance = options.centerDistance as number
    backlash = 2 * tanPressure * (centerDistance - nominalCenterDistance)
  } else {
    backlash = hasBacklash ? (options.backlash as number) : defaultBacklash(moduleA)
    centerDistance = nominalCenterDistance + backlash / (2 * tanPressure)
  }

  return {
    pinion,
    gear,
    centerDistance,
    backlash,
    contactRatio: 1.1,
    operatingPressureAngle: pressureAngle,
    getPositionedPinion(): PositionedGear {
      return { gear: pinion, x: 0, y: 0, rotation: 0 }
    },
    getPositionedGear(): PositionedGear {
      return { gear, x: centerDistance, y: 0, rotation: 180 / Math.abs(gear.geometry.teeth) }
    },
    toSvgPath(options?: SvgOptions): string {
      void options
      throw new Error('GearPair.toSvgPath is not implemented: Gear.toSvgPath cannot position gears yet')
    },
  }
}

export function createGearPair(
  pinionParams: GearParams,
  gearParams: GearParams,
  options?: MeshOptions,
): GearPair {
  const pinion = pinionParams.teeth < 0 ? createInternalGear(pinionParams) : createSpurGear(pinionParams)
  const driven = gearParams.teeth < 0 ? createInternalGear(gearParams) : createSpurGear(gearParams)
  return calculateMesh(pinion, driven, options)
}
