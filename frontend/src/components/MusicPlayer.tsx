import { motion } from 'framer-motion'

interface MusicPlayerProps {
  playing: boolean
  volume: number
  onToggle: () => void
  onVolumeChange: (v: number) => void
}

export default function MusicPlayer({ playing, volume, onToggle, onVolumeChange }: MusicPlayerProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
      <motion.button
        onClick={onToggle}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors
          ${playing
            ? 'bg-accent text-white shadow-glow-sm'
            : 'bg-surface-3 text-neutral-400 hover:text-white'
          }`}
        title={playing ? 'Pausar música' : 'Reproducir música'}
      >
        {playing ? '⏸' : '♫'}
      </motion.button>

      <div className="flex flex-1 items-center gap-2">
        <span className="text-[10px] text-neutral-500">🔈</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-surface-4
            [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-accent"
        />
        <span className="text-[10px] text-neutral-500">🔊</span>
      </div>
    </div>
  )
}
