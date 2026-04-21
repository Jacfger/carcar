import { type RefObject } from 'react'

interface TelemetryCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  visible: boolean
}

export function TelemetryCanvas({ canvasRef, visible }: TelemetryCanvasProps) {
  return (
    <canvas
      id="telemetry-canvas"
      ref={canvasRef}
      style={{ display: visible ? 'block' : 'none' }}
    />
  )
}
