interface SimulationTogglesProps {
  varianceEnabled: boolean
  batteryEnabled: boolean
  casterEnabled: boolean
  showSensors: boolean
  speedPercent: number
  encoderCpr: number
  encoderGearRatio: number
  encoderNoise: boolean
  onToggleVariance: () => void
  onToggleBattery: () => void
  onToggleCaster: () => void
  onToggleSensors: () => void
  onSpeedChange: (v: number) => void
  onEncoderCprChange: (v: number) => void
  onEncoderGearRatioChange: (v: number) => void
  onToggleEncoderNoise: () => void
}

export function SimulationToggles(props: SimulationTogglesProps) {
  return (
    <div className="telemetry-toggles">
      <label className="toggle-row">
        <input type="checkbox" checked={props.varianceEnabled} onChange={props.onToggleVariance} />
        <span className="toggle-label">Motor variance</span>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={props.batteryEnabled} onChange={props.onToggleBattery} />
        <span className="toggle-label">Battery drain</span>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={props.casterEnabled} onChange={props.onToggleCaster} />
        <span className="toggle-label">Ball caster noise</span>
      </label>
      <label className="toggle-row">
        <input type="checkbox" checked={props.showSensors} onChange={props.onToggleSensors} />
        <span className="toggle-label">Show sensors</span>
      </label>
      <div className="toggle-row speed-row">
        <span className="toggle-label">Max speed</span>
        <input
          type="range"
          min="5"
          max="100"
          step="5"
          value={props.speedPercent}
          onChange={(e) => props.onSpeedChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: '#e94560' }}
        />
        <span style={{ fontSize: '11px', color: '#e94560', minWidth: '32px', textAlign: 'right' }}>
          {props.speedPercent}%
        </span>
      </div>
      <div className="toggle-row" style={{ gap: '6px' }}>
        <span className="toggle-label">Encoder CPR</span>
        <input
          type="number"
          value={props.encoderCpr}
          min={1}
          max={128}
          step={1}
          onChange={(e) => props.onEncoderCprChange(Number(e.target.value))}
          style={{
            width: '46px', background: '#0f3460', color: '#e0e0e0',
            border: '1px solid #1a4a80', borderRadius: '3px',
            padding: '2px 4px', fontSize: '11px',
          }}
        />
        <span className="toggle-label" style={{ marginLeft: '6px' }}>Gear ratio</span>
        <input
          type="number"
          value={props.encoderGearRatio}
          min={0.1}
          max={20}
          step={0.1}
          onChange={(e) => props.onEncoderGearRatioChange(Number(e.target.value))}
          style={{
            width: '40px', background: '#0f3460', color: '#e0e0e0',
            border: '1px solid #1a4a80', borderRadius: '3px',
            padding: '2px 4px', fontSize: '11px',
          }}
        />
      </div>
      <label className="toggle-row">
        <input type="checkbox" checked={props.encoderNoise} onChange={props.onToggleEncoderNoise} />
        <span className="toggle-label">Encoder noise</span>
      </label>
    </div>
  )
}
