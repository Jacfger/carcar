import { Renderer }        from './render/Renderer'
import { TrackRenderer }   from './track/TrackRenderer'
import {
  createCar, resetCar, stepCarModel, applyResolvedMotion,
  type CarState, type CarOptions,
} from './simulation/Car'
import { PhysicsWorld }                        from './simulation/Physics'
import { createTelemetry, pushTelemetry }      from './render/Telemetry'
import { compileUserCode, callUserCode }        from './editor/Sandbox'
import { weightedCentroid }                    from './simulation/Sensors'
import { makeOvalTrack }                       from './track/presets/oval'
import { makeFigure8Track }                    from './track/presets/figure8'
import { makeChicaneTrack }                    from './track/presets/chicane'
import { DEFAULT_PID_CODE }                    from './editor/defaultCode'
import { PHYSICS_HZ }                          from './constants'
import type { Track }                          from './track/Track'

const MAX_CARS = 4

// ─── Monaco lazy-load ─────────────────────────────────────────────────────────
async function loadMonaco(container: HTMLElement, initialCode: string) {
  const monaco = await import('monaco-editor')
  monaco.editor.defineTheme('pid-dark', {
    base: 'vs-dark', inherit: true, rules: [],
    colors: {
      'editor.background':          '#12122a',
      'editor.lineHighlightBorder': '#1a1a3a',
    },
  })
  return monaco.editor.create(container, {
    value:    initialCode,
    language: 'javascript',
    theme:    'pid-dark',
    fontSize: 12,
    minimap:  { enabled: false },
    scrollBeyondLastLine: false,
    lineNumbers:    'on',
    wordWrap:       'on',
    automaticLayout: true,
  })
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const trackCanvas     = document.getElementById('track-canvas')     as HTMLCanvasElement
const telemetryCanvas = document.getElementById('telemetry-canvas') as HTMLCanvasElement
const editorMount     = document.getElementById('editor-mount')     as HTMLElement
const btnRun          = document.getElementById('btn-run')          as HTMLButtonElement
const btnReset        = document.getElementById('btn-reset')        as HTMLButtonElement
const btnAddCar       = document.getElementById('btn-add-car')      as HTMLButtonElement
const carCountLabel   = document.getElementById('car-count-label')  as HTMLSpanElement
const trackSelect     = document.getElementById('track-select')     as HTMLSelectElement
const errorDisplay    = document.getElementById('error-display')    as HTMLDivElement
const togVariance     = document.getElementById('tog-variance')     as HTMLInputElement
const togBattery      = document.getElementById('tog-battery')      as HTMLInputElement
const togCaster       = document.getElementById('tog-caster')       as HTMLInputElement
const togSensors      = document.getElementById('tog-sensors')      as HTMLInputElement
const speedControl    = document.getElementById('speed-control')    as HTMLInputElement
const speedValueLabel = document.getElementById('speed-value')      as HTMLSpanElement

// ─── Simulation state ─────────────────────────────────────────────────────────
let running       = false
let rafId         = 0
let lastTimestamp = 0
let accumulator   = 0
const DT          = 1 / PHYSICS_HZ

const physics        = new PhysicsWorld()
const trackRenderer  = new TrackRenderer(1, 1)
const renderer       = new Renderer(trackCanvas, telemetryCanvas)
const telemetry      = createTelemetry()

let currentTrack: Track
let cars: CarState[] = []
let carOptionsList: CarOptions[] = []

// ─── Track & car management ───────────────────────────────────────────────────

function buildTrack(): Track {
  const W = trackCanvas.clientWidth  || window.innerWidth  * 0.7
  const H = trackCanvas.clientHeight || window.innerHeight - 48
  switch (trackSelect.value) {
    case 'figure8': return makeFigure8Track(W, H)
    case 'chicane': return makeChicaneTrack(W, H)
    default:        return makeOvalTrack(W, H)
  }
}

function makeCarOptions(index: number): CarOptions {
  // Offset start position slightly per car so they don't stack exactly
  const offsetX =  Math.sin(index * 1.2) * 20
  const offsetY = -index * 30
  return {
    startX:          currentTrack.startX + offsetX,
    startY:          currentTrack.startY + offsetY,
    startAngle:      currentTrack.startAngle,
    varianceEnabled: togVariance.checked,
    batteryEnabled:  togBattery.checked,
    casterEnabled:   togCaster.checked,
    colorIndex:      index,
  }
}

function addCar(index: number): void {
  const opts = makeCarOptions(index)
  carOptionsList.push(opts)
  const body = physics.addCarBody(opts.startX, opts.startY, opts.startAngle)
  cars.push(createCar(opts, body))
  updateCarCountLabel()
}

function clearCars(): void {
  for (const car of cars) physics.removeCarBody(car.body)
  cars = []
  carOptionsList = []
}

function updateCarCountLabel(): void {
  carCountLabel.textContent = `${cars.length} car${cars.length !== 1 ? 's' : ''}`
  btnAddCar.disabled = cars.length >= MAX_CARS
}

function rebuildScene(): void {
  currentTrack = buildTrack()

  // Resize offscreen track canvas (in physical pixels)
  const pr = window.devicePixelRatio || 1
  trackRenderer.resize(
    Math.round(trackCanvas.clientWidth  * pr),
    Math.round(trackCanvas.clientHeight * pr),
    currentTrack,
  )

  // Rebuild physics walls
  physics.setBounds(trackCanvas.clientWidth, trackCanvas.clientHeight)

  // Rebuild all cars
  const prevCount = Math.max(cars.length, 1)
  clearCars()
  for (let i = 0; i < prevCount; i++) addCar(i)

  renderer.resize()
  renderer.drawFrame(trackRenderer, cars, telemetry, togSensors.checked)
}

// ─── Error display ────────────────────────────────────────────────────────────

function showError(msg: string | null): void {
  errorDisplay.textContent = msg ?? ''
  errorDisplay.style.display = msg ? 'block' : 'none'
}

// ─── Simulation loop ──────────────────────────────────────────────────────────

let monacoEditor: Awaited<ReturnType<typeof loadMonaco>> | null = null

function startSim(): void {
  if (running) return
  running = true
  btnRun.textContent = '⏸ Pause'
  accumulator   = 0
  lastTimestamp = performance.now()

  const code = monacoEditor?.getValue() ?? DEFAULT_PID_CODE
  const err  = compileUserCode(code)
  showError(err)
  if (err) { stopSim(); return }

  function loop(ts: number) {
    if (!running) return
    rafId = requestAnimationFrame(loop)

    const elapsed = Math.min((ts - lastTimestamp) / 1000, 0.1)
    lastTimestamp = ts
    accumulator  += elapsed

    while (accumulator >= DT) {
      accumulator -= DT

      // Collect other car bodies for collision (filled per-car below)
      const allBodies = cars.map(c => c.body)

      for (const car of cars) {
        // 1. Call user PID
        const { output, error } = callUserCode(
          car.sensors,
          DT,
          {
            voltage: car.battery.voltage,
            speed:   Math.hypot(car.vx, car.vy) / 1600,
            time:    car.time,
          },
        )

        if (error) { showError(error); stopSim(); return }
        showError(null)

        // 2. Scale PWM by max-speed factor before motor model.
        //    User's code still outputs in [-255, 255]; we reduce the effective
        //    duty cycle here so the car runs slower without touching the PID.
        const speedFactor = parseInt(speedControl.value) / 100
        const scaledLeft  = output.left  * speedFactor
        const scaledRight = output.right * speedFactor

        const desired = stepCarModel(car, scaledLeft, scaledRight, DT, {
          batteryEnabled: togBattery.checked,
          casterEnabled:  togCaster.checked,
        })

        // 3. Resolve collisions (walls + all other car bodies)
        const otherBodies = allBodies.filter(b => b !== car.body)
        const resolved = physics.resolve(
          car.body,
          desired.vx, desired.vy, desired.omega,
          otherBodies,
          DT,
        )

        // 4. Apply resolved motion + sample sensors
        applyResolvedMotion(car, resolved.vx, resolved.vy, resolved.omega, DT, trackRenderer)
      }

      // Record telemetry for car[0] every 4 ticks
      if (cars.length > 0 && Math.round(cars[0].time / DT) % 4 === 0) {
        const c = cars[0]
        pushTelemetry(telemetry, weightedCentroid(c.sensors), c.pwmL, c.pwmR, c.battery.voltage)
      }
    }

    renderer.drawFrame(trackRenderer, cars, telemetry, togSensors.checked)
  }

  rafId = requestAnimationFrame(loop)
}

function stopSim(): void {
  running = false
  btnRun.textContent = '▶ Run'
  cancelAnimationFrame(rafId)
}

function resetSim(): void {
  stopSim()
  for (let i = 0; i < cars.length; i++) {
    const opts = makeCarOptions(i)
    carOptionsList[i] = opts
    resetCar(cars[i], opts)
  }
  renderer.drawFrame(trackRenderer, cars, telemetry, togSensors.checked)
}

// ─── Events ───────────────────────────────────────────────────────────────────

btnRun.addEventListener('click', () => running ? stopSim() : startSim())
btnReset.addEventListener('click', resetSim)

btnAddCar.addEventListener('click', () => {
  if (cars.length >= MAX_CARS) return
  addCar(cars.length)
  renderer.drawFrame(trackRenderer, cars, telemetry, togSensors.checked)
})

trackSelect.addEventListener('change', () => { stopSim(); rebuildScene() })

speedControl.addEventListener('input', () => {
  speedValueLabel.textContent = `${speedControl.value}%`
})

window.addEventListener('resize', () => { stopSim(); rebuildScene() })

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  rebuildScene()

  monacoEditor = await loadMonaco(editorMount, DEFAULT_PID_CODE)
  compileUserCode(DEFAULT_PID_CODE)
}

boot()
