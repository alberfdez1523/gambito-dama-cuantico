import { useRef, useState, useCallback, useEffect } from 'react'

// ─── Música ambiente (lofi) ───
export function useAmbientMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolumeState] = useState(0.3)

  useEffect(() => {
    const audio = new Audio('/music/lofi.mp3')
    audio.loop = true
    audio.volume = volume
    audioRef.current = audio

    return () => {
      audio.pause()
      audio.src = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      audio.play().catch(() => {})
    }
    setPlaying(!playing)
  }, [playing])

  const setVolume = useCallback(
    (v: number) => {
      setVolumeState(v)
      if (audioRef.current) audioRef.current.volume = v
    },
    []
  )

  return { playing, toggle, volume, setVolume }
}
