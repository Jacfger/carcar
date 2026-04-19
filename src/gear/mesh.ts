import { createInternalGear, createSpurGear } from './gear'
import type { Gear } from './gear'
import { fmt } from './svg'
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

function transformPoint(x: number, y: number, rotationDeg: number, tx: number, ty: number) {
  const radians = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: x * cos - y * sin + tx,
    y: x * sin + y * cos + ty,
  }
}

function transformSvgPath(pathData: string, rotationDeg: number, tx: number, ty: number, decimals: number): string {
  const tokens = pathData.trim().split(/\s+/)
  const output: string[] = []
  let i = 0

  while (i < tokens.length) {
    const command = tokens[i]
    output.push(command)
    i += 1

    if (command === 'M') {
      const x = Number(tokens[i])
      const y = Number(tokens[i + 1])
      const point = transformPoint(x, y, rotationDeg, tx, ty)
      output.push(fmt(point.x, decimals), fmt(point.y, decimals))
      i += 2
      continue
    }

    if (command === 'C') {
      for (let pair = 0; pair < 3; pair += 1) {
        const x = Number(tokens[i])
        const y = Number(tokens[i + 1])
        const point = transformPoint(x, y, rotationDeg, tx, ty)
        output.push(fmt(point.x, decimals), fmt(point.y, decimals))
        i += 2
      }
      continue
    }

    if (command === 'Z') {
      continue
    }

    throw new Error(`unsupported SVG command: ${command}`)
  }

  return output.join(' ')
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
    if (backlash < 0) {
      throw new Error('centerDistance cannot be below nominal for non-negative backlash')
    }
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
      const pinionPath = pinion.toSvgPath(options)
      const positionedGear = this.getPositionedGear()
      const gearPath = positionedGear.gear.toSvgPath(options)
      const decimals = options?.decimals ?? 3
      const transformedGearPath = transformSvgPath(
        gearPath,
        positionedGear.rotation,
        positionedGear.x,
        positionedGear.y,
        decimals,
      )
      return `${pinionPath} ${transformedGearPath}`
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
