import Editor, { type BeforeMount } from '@monaco-editor/react'
import { useRef, useCallback, type CSSProperties } from 'react'

interface EditorPanelProps {
  codeRef: React.MutableRefObject<string>
  style?: CSSProperties
}

const handleBeforeMount: BeforeMount = (monaco) => {
  monaco.editor.defineTheme('pid-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#12122a',
      'editor.lineHighlightBorder': '#1a1a3a',
    },
  })
}

export function EditorPanel({ codeRef, style }: EditorPanelProps) {
  const initialCode = useRef(codeRef.current)

  const handleChange = useCallback((value: string | undefined) => {
    codeRef.current = value ?? ''
  }, [codeRef])

  return (
    <div className="panel" id="editor-panel" style={style}>
      <div className="panel-header">PID Code</div>
      <div id="editor-mount" style={{ flex: 1, minHeight: 0 }}>
        <Editor
          defaultLanguage="javascript"
          defaultValue={initialCode.current}
          theme="pid-dark"
          beforeMount={handleBeforeMount}
          onChange={handleChange}
          options={{
            fontSize: 12,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            wordWrap: 'on',
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  )
}
