import { useEffect, useRef, useState } from 'react'
import { MoreVertical } from './Icons.jsx'
import './AudioSettingsMenu.css'

// Compact popover anchored to the trigger button. Three controls:
//   1. order  — Chinese first vs Korean first
//   2. repeat — play each pair once or twice
//   3. speed  — playback rate (0.7 .. 1.25)
//
// Settings are owned by the caller (useAudioSettings hook); this is purely
// presentational. Changes apply immediately so the user can hear the next
// card with new settings without dismissing the menu.
export default function AudioSettingsMenu({ settings, onChange }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="audio-settings" ref={rootRef}>
      <button
        className={`nav-btn settings-btn${open ? ' active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="듣기 설정"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <MoreVertical />
      </button>

      {open && (
        <div className="audio-settings-popover" role="menu">
          <div className="setting-group">
            <div className="setting-label">재생 순서</div>
            <Segmented
              value={settings.order}
              onChange={(v) => onChange({ order: v })}
              options={[
                { value: 'zh-first', label: '중국어 먼저' },
                { value: 'ko-first', label: '한국어 먼저' },
              ]}
            />
          </div>

          <div className="setting-group">
            <div className="setting-label">반복 횟수</div>
            <Segmented
              value={settings.repeat}
              onChange={(v) => onChange({ repeat: v })}
              options={[
                { value: 1, label: '한 번' },
                { value: 2, label: '두 번' },
              ]}
            />
          </div>

          <div className="setting-group">
            <div className="setting-label">속도</div>
            <Segmented
              value={settings.speed}
              onChange={(v) => onChange({ speed: v })}
              options={[
                { value: 0.75, label: '0.75×' },
                { value: 1,    label: '1×' },
                { value: 1.25, label: '1.25×' },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={String(o.value)}
          className={`segment${o.value === value ? ' active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
