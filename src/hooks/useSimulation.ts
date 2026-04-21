import { useRef, useEffect, type RefObject } from 'react'
import { SimulationEngine, type SimSettings } from '../engine/SimulationEngine'
import { compileUserCode } from '../editor/Sandbox'
import { DEFAULT_PID_CODE } from '../editor/defaultCode'
import type { EncoderUpdateFn } from '../components/EncoderView'

export function useSimulation(
  settings: SimSettings,
  callbacks: {
    onError: (msg: string | null) => void
    onRunningChange: (running: boolean) => void
    onCarCountChange: (count: number) => void
  },
  refs: {
    trackCanvas:    RefObject<HTMLCanvasElement | null>
    telemetryCanvas: RefObject<HTMLCanvasElement | null>
    encoderUpdate:  RefObject<EncoderUpdateFn | null>
  },
) {
  const engineRef = useRef<SimulationEngine | null>(null)

  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  // All initialization lives here so it's StrictMode-safe:
  // cleanup destroys the engine; each (re)mount fully re-initializes it.
  useEffect(() => {
    const tc = refs.trackCanvas.current
    const tel = refs.telemetryCanvas.current
    if (!tc || !tel) return

    const engine = new SimulationEngine()
    engine.setCallbacks({
      onError: (msg) => callbacksRef.current.onError(msg),
      onRunningChange: (r) => callbacksRef.current.onRunningChange(r),
      onCarCountChange: (c) => callbacksRef.current.onCarCountChange(c),
    })
    engine.setTrackCanvas(tc)
    engine.setTelemetryCanvas(tel)
    engine.setEncoderUpdateRef(refs.encoderUpdate)

    engine.init()
    compileUserCode(DEFAULT_PID_CODE)
    engineRef.current = engine

    return () => {
      engine.destroy()
      engineRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep engine settings in sync on every render
  useEffect(() => {
    if (engineRef.current) {
      Object.assign(engineRef.current.settings, settings)
    }
  })

  return { engineRef }
}
