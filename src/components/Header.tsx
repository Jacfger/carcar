interface HeaderProps {
  trackName: string
  onTrackChange: (name: string) => void
  running: boolean
  onToggleRun: () => void
  onReset: () => void
  onAddCar: () => void
  carCount: number
  maxCars: number
  graphsVisible: boolean
  codeVisible: boolean
  onToggleGraphs: () => void
  onToggleCode: () => void
}

export function Header({
  trackName, onTrackChange,
  running, onToggleRun, onReset,
  onAddCar, carCount, maxCars,
  graphsVisible, codeVisible,
  onToggleGraphs, onToggleCode,
}: HeaderProps) {
  return (
    <header>
      <h1>PID Car Simulator</h1>
      <select value={trackName} onChange={(e) => onTrackChange(e.target.value)}>
        <option value="oval">Oval</option>
        <option value="figure8">Figure 8</option>
        <option value="chicane">Chicane</option>
      </select>
      <div className="spacer" />
      <button
        className={`btn pane-toggle ${graphsVisible ? 'on' : ''}`}
        title="Toggle graphs panel"
        onClick={onToggleGraphs}
      >
        Graphs
      </button>
      <button
        className={`btn pane-toggle ${codeVisible ? 'on' : ''}`}
        title="Toggle code panel"
        onClick={onToggleCode}
      >
        Code
      </button>
      <button className="btn primary" onClick={onToggleRun}>
        {running ? '⏸ Pause' : '▶ Run'}
      </button>
      <button className="btn" onClick={onReset}>
        &#8635; Reset
      </button>
      <button className="btn" onClick={onAddCar} disabled={carCount >= maxCars}>
        + Car
      </button>
      <span style={{ fontSize: '11px', color: '#7090b0', minWidth: '40px' }}>
        {carCount} car{carCount !== 1 ? 's' : ''}
      </span>
    </header>
  )
}
