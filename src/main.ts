import { Renderer }        from './render/Renderer'
import { TrackRenderer }   from './track/TrackRenderer'
import { createCar, resetCar, stepCar, type CarOptions } from './simulation/Car'
import { createTelemetry, pushTelemetry }  from './render/Telemetry'
import { compileUserCode, callUserCode }   from './editor/Sandbox'
import { weightedCentroid }                from './simulation/Sensors'
import { makeOvalTrack }                   from './track/presets/oval'
import { makeFigure8Track }                from './track/presets/figure8'
import { makeChicaneTrack }                from './track/presets/chicane'
import { DEFAULT_PID_CODE }                from './editor/defaultCode'
import { PHYSICS_HZ }                      from './constants'
import type { Track }                      from './track/Track'

// ─── Monaco lazy-load ──────────────────────────────────────────────────────────
// Monaco bundles are large — import dynamically so Vite can chunk them.
async function loadMonaco(container: HTMLElement, initialCode: string) {
  const monaco = await import('monaco-editor')

  monaco.editor.defineTheme('pid-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background':          '#12122a',
      'editor.lineHighlightBorder': '#1a1a3a',
    },
  })

  const editor = monaco.editor.create(container, {
    value:             initialCode,
    language:          'javascript',
    theme:             'pid-dark',
    fontSize:          12,
    minimap:           { enabled: false },
    scrollBeyondLastLine: false,
    lineNumbers:       'on',
    wordWrap:          'on',
    automaticLayout:   true,
  })

  return editor
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const trackCanvas     = document.getElementById('track-canvas')     as HTMLCanvasElement
const telemetryCanvas = document.getElementById('telemetry-canvas') as HTMLCanvasElement
const editorMount     = document.getElementById('editor-mount')     as HTMLElement
const btnRun          = document.getElementById('btn-run')          as HTMLButtonElement
const btnReset        = document.getElementById('btn-reset')        as HTMLButtonElement
const trackSelect     = document.getElementById('track-select')     as HTMLSelectElement
const errorDisplay    = document.getElementById('error-display')    as HTMLDivElement
const togVariance     = document.getElementById('tog-variance')     as HTMLInputElement
const togBattery      = document.getElementById('tog-battery')      as HTMLInputElement
const togCaster       = document.getElementById('tog-caster')       as HTMLInputElement
const togSensors      = document.getElementById('tog-sensors')      as HTMLInputElement

// ─── State ────────────────────────────────────────────────────────────────────
let running       = false
let rafId         = 0
let lastTimestamp = 0
let accumulator   = 0
const DT          = 1 / PHYSICS_HZ

const trackRenderer  = new TrackRenderer(1, 1)   // sized on first resize
const renderer       = new Renderer(trackCanvas, telemetryCanvas)
const telemetry      = createTelemetry()

let currentTrack: Track
let carOptions: CarOptions
let car = createCar({ startX: 0, startY: 0, startAngle: 0, varianceEnabled: false, batteryEnabled: false, casterEnabled: false })

// ─── Track management ─────────────────────────────────────────────────────────
function buildTrack(): Track {
  const W = trackCanvas.clientWidth  || window.innerWidth  * 0.7
  const H = trackCanvas.clientHeight || window.innerHeight - 48

  switch (trackSelect.value) {
    case 'figure8': return makeFigure8Track(W, H)
    case 'chicane': return makeChicaneTrack(W, H)
    default:        return makeOvalTrack(W, H)
  }
}

function getCarOptions(): CarOptions {
  return {
    startX:          currentTrack.startX,
    startY:          currentTrack.startY,
    startAngle:      currentTrack.startAngle,
    varianceEnabled: togVariance.checked,
    batteryEnabled:  togBattery.checked,
    casterEnabled:   togCaster.checked,
  }
}

function rebuildScene(): void {
  currentTrack = buildTrack()
  trackRenderer.resize(
    Math.round(trackCanvas.clientWidth  * (window.devicePixelRatio || 1)),
    Math.round(trackCanvas.clientHeight * (window.devicePixelRatio || 1)),
    currentTrack,
  )
  carOptions = getCarOptions()
  car = createCar(carOptions)
  // Render one static frame immediately
  renderer.resize()
  renderer.drawFrame(trackRenderer, car, telemetry, togSensors.checked)
}

// ─── Run / stop ───────────────────────────────────────────────────────────────
function showError(msg: string | null): void {
  if (msg) {
    errorDisplay.textContent = msg
    errorDisplay.style.display = 'block'
  } else {
    errorDisplay.style.display = 'none'
  }
}

let monacoEditor: Awaited<ReturnType<typeof import('monaco-editor')['editor']['create']>> | null = null

function startSim(): void {
  if (running) return
  running = true
  btnRun.textContent = '⏸ Pause'
  accumulator   = 0
  lastTimestamp = performance.now()

  // Compile user code from Monaco
  const code = monacoEditor?.getValue() ?? DEFAULT_PID_CODE
  const err  = compileUserCode(code)
  showError(err)
  if (err) { stopSim(); return }

  function loop(ts: number) {
    if (!running) return
    rafId = requestAnimationFrame(loop)

    const elapsed = Math.min((ts - lastTimestamp) / 1000, 0.1)  // cap at 100ms
    lastTimestamp = ts
    accumulator  += elapsed

    while (accumulator >= DT) {
      accumulator -= DT

      // Call user PID
      const { output, error } = callUserCode(
        car.sensors,
        DT,
        { voltage: car.battery.voltage, speed: Math.hypot(car.vx, car.vy) / 1600, time: car.time },
      )

      if (error) {
        showError(error)
        stopSim()
        return
      }
      showError(null)

      // Step physics
      stepCar(car, output.left, output.right, DT, trackRenderer, {
        batteryEnabled: togBattery.checked,
        casterEnabled:  togCaster.checked,
      })

      // Record telemetry at reduced rate (every 4 ticks)
      if (Math.round(car.time / DT) % 4 === 0) {
        const err = weightedCentroid(car.sensors)
        pushTelemetry(telemetry, err, car.pwmL, car.pwmR, car.battery.voltage)
      }
    }

    renderer.drawFrame(trackRenderer, car, telemetry, togSensors.checked)
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
  carOptions = getCarOptions()
  resetCar(car, carOptions)
  renderer.drawFrame(trackRenderer, car, telemetry, togSensors.checked)
}

// ─── Events ───────────────────────────────────────────────────────────────────
btnRun.addEventListener('click', () => running ? stopSim() : startSim())
btnReset.addEventListener('click', resetSim)
trackSelect.addEventListener('change', () => { stopSim(); rebuildScene() })

window.addEventListener('resize', () => {
  stopSim()
  rebuildScene()
})

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function boot() {
  // Initial scene
  rebuildScene()

  // Load Monaco (async, non-blocking for first render)
  monacoEditor = await loadMonaco(editorMount, DEFAULT_PID_CODE) as typeof monacoEditor

  // Pre-compile the default code so Run works immediately
  compileUserCode(DEFAULT_PID_CODE)
}

boot()
