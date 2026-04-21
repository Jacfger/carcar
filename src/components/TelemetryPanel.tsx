import { type ReactNode, type CSSProperties } from 'react'

type Tab = 'graphs' | 'encoder'

interface TelemetryPanelProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  children: ReactNode
  style?: CSSProperties
}

const activeStyle = { color: '#e94560', borderBottom: '2px solid #e94560' }
const inactiveStyle = { color: '#7090b0', borderBottom: '2px solid transparent' }

const tabBtnBase: React.CSSProperties = {
  fontSize: '10px',
  padding: '4px 10px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

export function TelemetryPanel({ activeTab, onTabChange, children, style }: TelemetryPanelProps) {
  return (
    <div className="panel" id="telemetry-panel" style={style}>
      <div
        className="panel-header"
        style={{ display: 'flex', alignItems: 'center', padding: '0 0 0 10px', gap: 0 }}
      >
        <span style={{
          fontSize: '11px', fontWeight: 600, color: '#7090b0',
          textTransform: 'uppercase', letterSpacing: '0.8px', marginRight: '12px',
        }}>
          Telemetry
        </span>
        <button
          style={{ ...tabBtnBase, ...(activeTab === 'graphs' ? activeStyle : inactiveStyle) }}
          onClick={() => onTabChange('graphs')}
        >
          Graphs
        </button>
        <button
          style={{ ...tabBtnBase, ...(activeTab === 'encoder' ? activeStyle : inactiveStyle) }}
          onClick={() => onTabChange('encoder')}
        >
          Encoder
        </button>
      </div>
      {children}
    </div>
  )
}
