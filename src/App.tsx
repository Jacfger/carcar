import { useReducer, useRef, useEffect, useCallback, useMemo } from 'react'
import { Header } from './components/Header'
import { TrackPanel } from './components/TrackPanel'
import { TelemetryPanel } from './components/TelemetryPanel'
import { TelemetryCanvas } from './components/TelemetryCanvas'
import { EncoderView, type EncoderUpdateFn } from './components/EncoderView'
import { EditorPanel } from './components/EditorPanel'
import { SimulationToggles } from './components/SimulationToggles'
import { useSimulation } from './hooks/useSimulation'
import { DEFAULT_PID_CODE } from './editor/defaultCode'
import type { SimSettings } from './engine/SimulationEngine'
import './App.css'

interface State {
  running: boolean
  trackName: string
  activeTab: 'graphs' | 'encoder'
  speedPercent: number
  varianceEnabled: boolean
  batteryEnabled: boolean
  casterEnabled: boolean
  showSensors: boolean
  encoderCpr: number
  encoderGearRatio: number
  encoderNoise: boolean
  graphsVisible: boolean
  codeVisible: boolean
  errorMessage: string | null
  carCount: number
}

type Action =
  | { type: 'SET_RUNNING'; value: boolean }
  | { type: 'SET_TRACK'; value: string }
  | { type: 'SET_ACTIVE_TAB'; value: 'graphs' | 'encoder' }
  | { type: 'SET_SPEED'; value: number }
  | { type: 'TOGGLE_VARIANCE' }
  | { type: 'TOGGLE_BATTERY' }
  | { type: 'TOGGLE_CASTER' }
  | { type: 'TOGGLE_SENSORS' }
  | { type: 'SET_ENCODER_CPR'; value: number }
  | { type: 'SET_ENCODER_GEAR_RATIO'; value: number }
  | { type: 'TOGGLE_ENCODER_NOISE' }
  | { type: 'TOGGLE_GRAPHS' }
  | { type: 'TOGGLE_CODE' }
  | { type: 'SET_ERROR'; value: string | null }
  | { type: 'SET_CAR_COUNT'; value: number }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_RUNNING': return { ...state, running: action.value }
    case 'SET_TRACK': return { ...state, trackName: action.value }
    case 'SET_ACTIVE_TAB': return { ...state, activeTab: action.value }
    case 'SET_SPEED': return { ...state, speedPercent: action.value }
    case 'TOGGLE_VARIANCE': return { ...state, varianceEnabled: !state.varianceEnabled }
    case 'TOGGLE_BATTERY': return { ...state, batteryEnabled: !state.batteryEnabled }
    case 'TOGGLE_CASTER': return { ...state, casterEnabled: !state.casterEnabled }
    case 'TOGGLE_SENSORS': return { ...state, showSensors: !state.showSensors }
    case 'SET_ENCODER_CPR': return { ...state, encoderCpr: action.value }
    case 'SET_ENCODER_GEAR_RATIO': return { ...state, encoderGearRatio: action.value }
    case 'TOGGLE_ENCODER_NOISE': return { ...state, encoderNoise: !state.encoderNoise }
    case 'TOGGLE_GRAPHS': return { ...state, graphsVisible: !state.graphsVisible }
    case 'TOGGLE_CODE': return { ...state, codeVisible: !state.codeVisible }
    case 'SET_ERROR': return { ...state, errorMessage: action.value }
    case 'SET_CAR_COUNT': return { ...state, carCount: action.value }
  }
}

const initialState: State = {
  running: false,
  trackName: 'oval',
  activeTab: 'graphs',
  speedPercent: 60,
  varianceEnabled: true,
  batteryEnabled: true,
  casterEnabled: true,
  showSensors: true,
  encoderCpr: 20,
  encoderGearRatio: 3.0,
  encoderNoise: false,
  graphsVisible: true,
  codeVisible: true,
  errorMessage: null,
  carCount: 1,
}

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const codeRef = useRef(DEFAULT_PID_CODE)

  // DOM refs — set during commit phase, before any useEffect runs
  const trackCanvasRef     = useRef<HTMLCanvasElement>(null)
  const telemetryCanvasRef = useRef<HTMLCanvasElement>(null)
  // Shared callback ref: EncoderView writes its update fn here; engine calls it each frame
  const encoderUpdateRef   = useRef<EncoderUpdateFn | null>(null)

  const simSettings: SimSettings = useMemo(() => ({
    trackName: state.trackName,
    speedPercent: state.speedPercent,
    varianceEnabled: state.varianceEnabled,
    batteryEnabled: state.batteryEnabled,
    casterEnabled: state.casterEnabled,
    showSensors: state.showSensors,
    encoderCpr: state.encoderCpr,
    encoderGearRatio: state.encoderGearRatio,
    encoderNoise: state.encoderNoise,
  }), [
    state.trackName, state.speedPercent, state.varianceEnabled,
    state.batteryEnabled, state.casterEnabled, state.showSensors,
    state.encoderCpr, state.encoderGearRatio, state.encoderNoise,
  ])

  const callbacks = useMemo(() => ({
    onError: (msg: string | null) => dispatch({ type: 'SET_ERROR', value: msg }),
    onRunningChange: (r: boolean) => dispatch({ type: 'SET_RUNNING', value: r }),
    onCarCountChange: (c: number) => dispatch({ type: 'SET_CAR_COUNT', value: c }),
  }), [])

  const { engineRef } = useSimulation(simSettings, callbacks, {
    trackCanvas:     trackCanvasRef,
    telemetryCanvas: telemetryCanvasRef,
    encoderUpdate:   encoderUpdateRef,
  })

  // Track change
  const prevTrackRef = useRef(state.trackName)
  useEffect(() => {
    if (prevTrackRef.current === state.trackName) return
    prevTrackRef.current = state.trackName
    const engine = engineRef.current
    if (engine) { engine.stop(); engine.rebuildScene() }
  }, [state.trackName, engineRef])

  // Window resize
  useEffect(() => {
    const handleResize = () => {
      const engine = engineRef.current
      if (engine) { engine.stop(); engine.rebuildScene() }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [engineRef])

  // Encoder tab visibility
  useEffect(() => {
    engineRef.current?.setEncoderVisible(state.activeTab === 'encoder')
  }, [state.activeTab, engineRef])

  // Panel toggle — rebuildScene after layout settles
  useEffect(() => {
    const timer = setTimeout(() => engineRef.current?.rebuildScene(), 0)
    return () => clearTimeout(timer)
  }, [state.graphsVisible, state.codeVisible, engineRef])

  const handleToggleRun = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.isRunning() ? engine.stop() : engine.start(codeRef.current)
  }, [engineRef])

  const handleReset = useCallback(() => engineRef.current?.reset(), [engineRef])
  const handleAddCar = useCallback(() => engineRef.current?.addCar(), [engineRef])

  // Layout styles — applied directly to the panels (no wrapper divs)
  const showRight = state.graphsVisible || state.codeVisible
  const layoutStyle: React.CSSProperties = {
    gridTemplateColumns: showRight ? '1fr 280px' : '1fr',
    gridTemplateRows: (state.graphsVisible && state.codeVisible) ? '1fr 260px' : '1fr',
  }

  const telemetryStyle: React.CSSProperties = {
    display: state.graphsVisible ? 'flex' : 'none',
    gridRow: (state.graphsVisible && !state.codeVisible) ? '1 / -1' : undefined,
    gridColumn: 2,
  }

  const editorStyle: React.CSSProperties = {
    display: state.codeVisible ? 'flex' : 'none',
    gridRow: (state.codeVisible && !state.graphsVisible) ? '1 / -1' : undefined,
    gridColumn: 2,
  }

  return (
    <>
      <Header
        trackName={state.trackName}
        onTrackChange={(v) => dispatch({ type: 'SET_TRACK', value: v })}
        running={state.running}
        onToggleRun={handleToggleRun}
        onReset={handleReset}
        onAddCar={handleAddCar}
        carCount={state.carCount}
        maxCars={4}
        graphsVisible={state.graphsVisible}
        codeVisible={state.codeVisible}
        onToggleGraphs={() => dispatch({ type: 'TOGGLE_GRAPHS' })}
        onToggleCode={() => dispatch({ type: 'TOGGLE_CODE' })}
      />
      <div className="main-layout" style={layoutStyle}>
        <TrackPanel
          canvasRef={trackCanvasRef}
          errorMessage={state.errorMessage}
        />
        <TelemetryPanel
          activeTab={state.activeTab}
          onTabChange={(tab) => dispatch({ type: 'SET_ACTIVE_TAB', value: tab })}
          style={telemetryStyle}
        >
          <TelemetryCanvas
            canvasRef={telemetryCanvasRef}
            visible={state.activeTab === 'graphs'}
          />
          <EncoderView
            updateRef={encoderUpdateRef}
            visible={state.activeTab === 'encoder'}
          />
          <SimulationToggles
            varianceEnabled={state.varianceEnabled}
            batteryEnabled={state.batteryEnabled}
            casterEnabled={state.casterEnabled}
            showSensors={state.showSensors}
            speedPercent={state.speedPercent}
            encoderCpr={state.encoderCpr}
            encoderGearRatio={state.encoderGearRatio}
            encoderNoise={state.encoderNoise}
            onToggleVariance={() => dispatch({ type: 'TOGGLE_VARIANCE' })}
            onToggleBattery={() => dispatch({ type: 'TOGGLE_BATTERY' })}
            onToggleCaster={() => dispatch({ type: 'TOGGLE_CASTER' })}
            onToggleSensors={() => dispatch({ type: 'TOGGLE_SENSORS' })}
            onSpeedChange={(v) => dispatch({ type: 'SET_SPEED', value: v })}
            onEncoderCprChange={(v) => dispatch({ type: 'SET_ENCODER_CPR', value: v })}
            onEncoderGearRatioChange={(v) => dispatch({ type: 'SET_ENCODER_GEAR_RATIO', value: v })}
            onToggleEncoderNoise={() => dispatch({ type: 'TOGGLE_ENCODER_NOISE' })}
          />
        </TelemetryPanel>
        <EditorPanel codeRef={codeRef} style={editorStyle} />
      </div>
    </>
  )
}
