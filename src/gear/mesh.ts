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
  void moduleValue
  return 0
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

  const backlash = options?.backlash ?? defaultBacklash(moduleA)
  if (backlash < 0) {
    throw new Error('backlash must be >= 0')
  }

  const r1 = pinion.geometry.pitchRadius
  const r2 = gear.geometry.pitchRadius
  const hasInternal = pinion.geometry.isInternal || gear.geometry.isInternal
  const nominalCenterDistance = hasInternal ? Math.abs(r2 - r1) : r1 + r2
  const deltaC = backlash / (2 * Math.tan(pressureAngle))
  const centerDistance = options?.centerDistance ?? nominalCenterDistance + deltaC

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
      return { gear, x: centerDistance, y: 0, rotation: 0 }
    },
    toSvgPath(options?: SvgOptions): string {
      return `${pinion.toSvgPath(options)} ${gear.toSvgPath(options)}`
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
