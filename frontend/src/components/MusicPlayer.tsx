import type { Language } from '../lib/types'
import { ui } from '../lib/i18n'

interface MusicPlayerProps {
  playing: boolean
  volume: number
  onToggle: () => void
  onVolumeChange: (v: number) => void
  language: Language
}

export default function MusicPlayer({ playing, volume, onToggle, onVolumeChange, language }: MusicPlayerProps) {
  const t = ui(language)
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onToggle}
        className={`min-h-[44px] min-w-[44px] text-sm transition-colors ${playing ? 'text-accent' : 'text-neutral-600 hover:text-neutral-400'}`}
        title={playing ? t.pause : t.play}
        aria-label={playing ? t.pause : t.play}
      >
        {playing ? '⏸' : '♫'}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        className="h-px w-full cursor-pointer appearance-none bg-surface-4
          [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-accent"
      />
    </div>
  )
}
