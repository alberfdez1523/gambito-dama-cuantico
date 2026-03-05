import { useState, useEffect, useCallback, useRef } from 'react'
import type { PieceColor } from '../lib/types'

// ─── Reloj de ajedrez ───

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface UseTimerProps {
  enabled: boolean
  minutes: number
  turn: PieceColor
  gameStarted: boolean
  gameOver: boolean
}

export function useTimer({ enabled, minutes, turn, gameStarted, gameOver }: UseTimerProps) {
  const initialSeconds = minutes * 60
  const [whiteTime, setWhiteTime] = useState(initialSeconds)
  const [blackTime, setBlackTime] = useState(initialSeconds)
  const [timedOut, setTimedOut] = useState<PieceColor | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reiniciar al cambiar config
  useEffect(() => {
    setWhiteTime(minutes * 60)
    setBlackTime(minutes * 60)
    setTimedOut(null)
  }, [minutes])

  useEffect(() => {
    if (!enabled || !gameStarted || gameOver || timedOut) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(() => {
      if (turn === 'w') {
        setWhiteTime(prev => {
          if (prev <= 1) {
            setTimedOut('w')
            return 0
          }
          return prev - 1
        })
      } else {
        setBlackTime(prev => {
          if (prev <= 1) {
            setTimedOut('b')
            return 0
          }
          return prev - 1
        })
      }
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [enabled, gameStarted, gameOver, turn, timedOut])

  const reset = useCallback(() => {
    setWhiteTime(minutes * 60)
    setBlackTime(minutes * 60)
    setTimedOut(null)
  }, [minutes])

  return { whiteTime, blackTime, timedOut, reset }
}
