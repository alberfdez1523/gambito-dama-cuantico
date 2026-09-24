import { useCallback } from 'react'
import { getPlayerLabel, ui } from '../lib/i18n'
import type { Language, PieceColor } from '../lib/types'

interface PlayerLabelOptions {
  playerColor: PieceColor
  language: Language
  isAIMode: boolean
  isOnline: boolean
  /** Nombre mostrado para la IA rival ("Stockfish", "IA cuántica"...). */
  aiName: string
}

/** Etiqueta de cada color en las barras de jugador: "Tú", el rival o el color. */
export function usePlayerLabel({ playerColor, language, isAIMode, isOnline, aiName }: PlayerLabelOptions) {
  return useCallback((color: PieceColor) => {
    const t = ui(language)
    if (isOnline) return color === playerColor ? t.you : t.opponent
    if (isAIMode) return color === playerColor ? t.you : aiName
    return getPlayerLabel(color, language)
  }, [aiName, isAIMode, isOnline, language, playerColor])
}
