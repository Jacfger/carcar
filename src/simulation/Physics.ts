import Matter from 'matter-js'
import { CAR_GEOMETRY, WHEEL_OFFSET_X } from '../constants'

// Car collision body dimensions — match the visual geometry
const BODY_W = (WHEEL_OFFSET_X + CAR_GEOMETRY.wheel_w / 2) * 2   // full width incl. wheels
const BODY_H = CAR_GEOMETRY.chassis_h

const WALL_THICKNESS = 40

export class PhysicsWorld {
  private _engine: Matter.Engine
  private _world:  Matter.World
  private _walls:  Matter.Body[] = []

  constructor() {
    this._engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } })
    this._world  = this._engine.world
  }

  /** Replace boundary walls to match canvas size (CSS pixels). */
  setBounds(width: number, height: number): void {
    if (this._walls.length > 0) Matter.Composite.remove(this._world, this._walls)
    const T  = WALL_THICKNESS
    const hw = width  / 2
    const hh = height / 2
    this._walls = [
      Matter.Bodies.rectangle(hw, -T / 2,        width + T * 2, T,      { isStatic: true, label: 'wall' }),
      Matter.Bodies.rectangle(hw, height + T / 2, width + T * 2, T,      { isStatic: true, label: 'wall' }),
      Matter.Bodies.rectangle(-T / 2,     hh,    T, height + T * 2,      { isStatic: true, label: 'wall' }),
      Matter.Bodies.rectangle(width + T / 2, hh, T, height + T * 2,      { isStatic: true, label: 'wall' }),
    ]
    Matter.Composite.add(this._world, this._walls)
  }

  /** Create and register a car collision body. */
  addCarBody(x: number, y: number, angle: number): Matter.Body {
    const body = Matter.Bodies.rectangle(x, y, BODY_W, BODY_H, {
      isStatic:    false,
      frictionAir: 0,
      friction:    0,
      restitution: 0,
      label:       'car',
      // Distinct collision category so cars collide with walls AND each other
      collisionFilter: { category: 0x0001, mask: 0xFFFF },
    })
    Matter.Body.setAngle(body, angle)
    // Prevent Matter.js integrating velocity on its own — we drive it manually
    Matter.Body.setMass(body, 1e9)
    Matter.Composite.add(this._world, body)
    return body
  }

  removeCarBody(body: Matter.Body): void {
    Matter.Composite.remove(this._world, body)
  }

  /**
   * Move a car body kinematically and resolve penetrations.
   *
   * Algorithm:
   *   1. Move body to desired new position.
   *   2. Query overlaps with walls + other car bodies.
   *   3. For each overlap: push body out (MTV) and remove the penetrating
   *      velocity component (inelastic wall bounce, restitution ≈ 0.1).
   *   4. Return the resolved velocity (may differ from desired on collision).
   *
   * We never call Engine.update() — Matter.js is used purely for geometry.
   */
  resolve(
    body:        Matter.Body,
    desiredVx:   number,    // px / s
    desiredVy:   number,
    desiredOmega: number,   // rad / s  (already includes caster noise)
    otherBodies: Matter.Body[],
    dt:          number,
  ): { vx: number; vy: number; omega: number; collided: boolean } {
    let vx    = desiredVx
    let vy    = desiredVy
    let omega = desiredOmega
    let collided = false

    // Move to desired position
    Matter.Body.setPosition(body, {
      x: body.position.x + vx * dt,
      y: body.position.y + vy * dt,
    })
    Matter.Body.setAngle(body, body.angle + omega * dt)

    // Detect collisions — up to 3 resolution passes to handle corners
    const obstacles = [...this._walls, ...otherBodies]
    for (let pass = 0; pass < 3; pass++) {
      const pairs = Matter.Query.collides(body, obstacles)
      if (pairs.length === 0) break
      collided = true

      for (const pair of pairs) {
        // Identify the obstacle body (the other one)
        const obstacle = pair.bodyA === body ? pair.bodyB : pair.bodyA

        // Build separation normal pointing FROM obstacle TOWARD our car
        // (robust regardless of Matter.js normal sign convention)
        const dx = body.position.x - obstacle.position.x
        const dy = body.position.y - obstacle.position.y

        // Collision object has .normal and .depth directly on it (not nested)
        let nx = pair.normal.x
        let ny = pair.normal.y
        if (dx * nx + dy * ny < 0) { nx = -nx; ny = -ny }

        const depth = pair.depth

        // Push body out of penetration
        Matter.Body.setPosition(body, {
          x: body.position.x + nx * (depth + 0.5),
          y: body.position.y + ny * (depth + 0.5),
        })

        // Project velocity: remove component going into the surface
        const vDotN = vx * nx + vy * ny
        if (vDotN < 0) {
          // Inelastic: restitution 0.1 (slight bounce to prevent sticking)
          vx -= vDotN * nx * 1.1
          vy -= vDotN * ny * 1.1
        }

        // Dampen angular velocity on collision (spinning into a wall looks wrong)
        omega *= 0.5

        // For car-to-car: also nudge the other car slightly (Newton's 3rd)
        if (obstacle.label === 'car') {
          Matter.Body.setPosition(obstacle, {
            x: obstacle.position.x - nx * (depth * 0.5),
            y: obstacle.position.y - ny * (depth * 0.5),
          })
        }
      }
    }

    return { vx, vy, omega, collided }
  }
}
