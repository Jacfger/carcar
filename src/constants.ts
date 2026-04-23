// ─── Geometry ─────────────────────────────────────────────────────────────────
// All values in simulation units (pixels at 1:1 scale).
// These are shared by the renderer AND the physics model — never duplicate them.

export const CAR_GEOMETRY = {
  chassis_w: 28,       // chassis rectangle width
  chassis_h: 40,       // chassis rectangle height (front-to-back)
  wheel_w: 6,          // each drive wheel width
  wheel_h: 14,         // each drive wheel height
  // wheel centers are at ±(chassis_w/2 + wheel_w/2) horizontally
  axle_y: 7,           // local Y of drive axle (positive = toward back of car)
  caster_y: 18,        // local Y of ball caster
  caster_r: 3,         // ball caster circle radius
  sensor_y: -22,       // local Y of sensor bar (negative = toward front)
  sensor_count: 7,
  sensor_spread: 32,   // total width of sensor array
  sensor_r: 2,         // radius of each sensor dot in renderer
} as const

// Derived — wheel center X offset from car center
export const WHEEL_OFFSET_X = CAR_GEOMETRY.chassis_w / 2 + CAR_GEOMETRY.wheel_w / 2

// Physical wheel base (center-to-center of left/right wheels, in meters)
export const WHEEL_BASE_M = 0.092          // metres
export const WHEEL_RADIUS_M = 0.033        // metres
export const SIM_SCALE = 1600              // pixels per metre

// ─── Motor ────────────────────────────────────────────────────────────────────

export const MOTOR_DEFAULTS = {
  omega_max: 38,                              // rad/s at full PWM + nominal voltage
  tau_range:        [0.04, 0.10] as const,    // mechanical time constant (s)
  efficiency_range: [0.93, 1.07] as const,    // multiplier on omega_max
  deadband_range:   [0.05, 0.18] as const,    // fraction of duty cycle below which no motion
} as const

// ─── Battery ──────────────────────────────────────────────────────────────────

export const BATTERY = {
  V_nominal:      7.4,    // V — reference voltage for motor efficiency
  V_full:         8.1,    // V — fully charged
  V_min:          5.5,    // V — floor (prevents negative voltage)
  R_internal:     0.35,   // Ω — internal resistance (causes sag under load)
  I_stall:        2.8,    // A — stall current per motor at full PWM
  capacity_drain: 2e-5,   // V/s at idle (slow long-term discharge)
} as const

// ─── Physics / simulation ─────────────────────────────────────────────────────

export const PHYSICS_HZ  = 120    // simulation ticks per second
export const RENDER_HZ   = 60     // target render fps

// ─── Ball caster ──────────────────────────────────────────────────────────────

export const CASTER_FRICTION = 0.18   // lateral drag strength
export const CASTER_NOISE_SPEED = 0.4  // frequency of Perlin-like noise

// ─── Telemetry ────────────────────────────────────────────────────────────────

export const TELEMETRY_SAMPLES = 300   // ring-buffer length

// ─── Encoder ─────────────────────────────────────────────────────────────────

export const ENCODER_DEFAULTS = {
  cpr:       20,    // pulses per encoder shaft revolution
  gearRatio:  3.0,  // encoder shaft turns per wheel turn
  noiseRate:  0.02, // probability of dropping a tick per edge (when variance on)
} as const
