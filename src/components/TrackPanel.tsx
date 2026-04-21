import { type RefObject } from 'react'

interface TrackPanelProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  errorMessage: string | null
}

export function TrackPanel({ canvasRef, errorMessage }: TrackPanelProps) {
  return (
    <div className="panel" id="track-panel">
      <canvas id="track-canvas" ref={canvasRef} />
      <div
        id="error-display"
        style={{ display: errorMessage ? 'block' : 'none' }}
      >
        {errorMessage}
      </div>
    </div>
  )
}
