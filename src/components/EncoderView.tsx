import { type RefObject } from 'react'

interface EncoderViewProps {
  mountRef: RefObject<HTMLDivElement | null>
  visible: boolean
}

export function EncoderView({ mountRef, visible }: EncoderViewProps) {
  return (
    <div
      id="encoder-mount"
      ref={mountRef}
      style={{
        display: visible ? 'flex' : 'none',
        flex: 1,
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    />
  )
}
