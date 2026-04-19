export interface Point {
  x: number;
  y: number;
}

export interface GearParams {
  module: number;
  teeth: number;
  pressureAngle?: number;
}

export interface GearGeometry {
  module: number;
  teeth: number;
  pressureAngleDeg: number;
  pressureAngleRad: number;
  pitchRadius: number;
  baseRadius: number;
  addendumRadius: number;
  dedendumRadius: number;
  addendum: number;
  dedendum: number;
  clearance: number;
  circularPitch: number;
  basePitch: number;
  isInternal: boolean;
}

export interface SvgOptions {
  centerX?: number;
  centerY?: number;
  rotation?: number;
  includeAxleHole?: boolean;
  axleHoleRadius?: number;
  decimals?: number;
}

export interface PointOptions {
  samplesPerCurve?: number;
}

export interface MeshOptions {
  backlash?: number;
  centerDistance?: number;
}

export interface BezierSegment {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
}
