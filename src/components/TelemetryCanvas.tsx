import { type RefObject } from 'react'

interface TelemetryCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  visible: boolean
}

export function TelemetryCanvas({ canvasRef, visible }: TelemetryCanvasProps) {
  return (
    <div style={{ display: visible ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
      <canvas
        id="telemetry-canvas"
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
