import { useRef, useCallback } from 'react'

// ─── Efectos de sonido con Web Audio API ───
export function useSoundFX() {
  const ctxRef = useRef<AudioContext | null>(null)

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext()
    }
    return ctxRef.current
  }, [])

  const playTone = useCallback(
    (freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.12) => {
      try {
        const ctx = getCtx()
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = type
        osc.frequency.value = freq
        g.gain.setValueAtTime(gain, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
        osc.connect(g).connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + duration)
      } catch {
        /* Silenciar errores de audio */
      }
    },
    [getCtx]
  )

  const playMove = useCallback(() => playTone(600, 0.08, 'sine', 0.1), [playTone])
  const playCapture = useCallback(() => playTone(300, 0.12, 'triangle', 0.15), [playTone])
  const playCheck = useCallback(() => {
    playTone(800, 0.1, 'square', 0.08)
    setTimeout(() => playTone(1000, 0.15, 'square', 0.06), 100)
  }, [playTone])
  const playGameEnd = useCallback(() => {
    playTone(523, 0.2, 'sine', 0.1)
    setTimeout(() => playTone(659, 0.2, 'sine', 0.1), 150)
    setTimeout(() => playTone(784, 0.4, 'sine', 0.1), 300)
  }, [playTone])

  return { playMove, playCapture, playCheck, playGameEnd }
}
