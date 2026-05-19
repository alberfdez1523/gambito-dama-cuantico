import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { Chess } from 'chess.js'
import { requestAIMove, requestEval } from '../lib/api'
import { PIECE_VALUES, FILES } from '../lib/constants'
import { getColorName, getPieceName, translateGameOverInfo, ui } from '../lib/i18n'
import type {
  GameConfig,
  Language,
  PieceColor,
  PieceType,
  Chances,
  MoveInfo,
  CapturedPieces,
  GameOverInfo,
} from '../lib/types'

// ─── Helpers ───

function evalToChances(ev: number | null | undefined): Chances {
  if (ev === null || ev === undefined) return { white: 33, draw: 34, black: 33 }

  // Modelo aproximado: score esperado Elo + probabilidad de tablas decreciente
  // al aumentar la ventaja en centipeones.
  const cp = Math.max(-1200, Math.min(1200, ev))
  const expectedScoreWhite = 1 / (1 + Math.pow(10, -cp / 280))
  const drawProb = Math.max(0.06, 0.44 * Math.exp(-Math.abs(cp) / 240))
  const whiteRaw = Math.max(0, expectedScoreWhite - drawProb / 2)
  const blackRaw = Math.max(0, 1 - expectedScoreWhite - drawProb / 2)

  const total = whiteRaw + drawProb + blackRaw
  const white = Math.round((whiteRaw / total) * 100)
  const black = Math.round((blackRaw / total) * 100)
  const draw = 100 - white - black
  return { white, draw, black }
}

function describeMove(m: {
  piece: string; to: string; flags: string; captured?: string; promotion?: string
}, language: Language): string {
  if (m.flags.includes('k')) return language === 'es' ? 'Enroque corto' : 'Kingside castling'
  if (m.flags.includes('q')) return language === 'es' ? 'Enroque largo' : 'Queenside castling'
  if (m.promotion) {
    return language === 'es'
      ? `Promoción a ${getPieceName(m.promotion as PieceType, language)}`
      : `Promotion to ${getPieceName(m.promotion as PieceType, language)}`
  }
  if (m.captured) {
    return language === 'es'
      ? `${getPieceName(m.piece as PieceType, language)} captura en ${m.to}`
      : `${getPieceName(m.piece as PieceType, language)} captures on ${m.to}`
  }
  return language === 'es'
    ? `${getPieceName(m.piece as PieceType, language)} a ${m.to}`
    : `${getPieceName(m.piece as PieceType, language)} to ${m.to}`
}

function needsPromotion(game: InstanceType<typeof Chess>, from: string, to: string): boolean {
  const piece = game.get(from)
  if (!piece || piece.type !== 'p') return false
  const rank = to[1]
  return (piece.color === 'w' && rank === '8') || (piece.color === 'b' && rank === '1')
}

function detectGameEnd(
  game: InstanceType<typeof Chess>,
  playerColor: PieceColor,
  isAIMode: boolean,
  language: Language,
): GameOverInfo | null {
  if (!game.game_over()) return null
  if (game.in_checkmate()) {
    const loserTurn = game.turn()
    if (!isAIMode) {
      return loserTurn === 'w'
        ? { title: language === 'es' ? 'Jaque mate' : 'Checkmate', message: language === 'es' ? 'Ganan negras' : 'Black wins', result: 'lose' }
        : { title: language === 'es' ? 'Jaque mate' : 'Checkmate', message: language === 'es' ? 'Ganan blancas' : 'White wins', result: 'win' }
    }
    return loserTurn === playerColor
      ? { title: language === 'es' ? 'Derrota' : 'Defeat', message: language === 'es' ? 'La IA te ha dado jaque mate' : 'The AI checkmated you', result: 'lose' }
      : { title: language === 'es' ? '¡Victoria!' : 'Victory!', message: language === 'es' ? 'Has ganado por jaque mate' : 'You won by checkmate', result: 'win' }
  }
  if (game.in_stalemate()) return { title: language === 'es' ? 'Tablas' : 'Draw', message: language === 'es' ? 'Rey ahogado' : 'Stalemate', result: 'draw' }
  if (game.in_threefold_repetition()) return { title: language === 'es' ? 'Tablas' : 'Draw', message: language === 'es' ? 'Triple repetición' : 'Threefold repetition', result: 'draw' }
  if (game.insufficient_material()) return { title: language === 'es' ? 'Tablas' : 'Draw', message: language === 'es' ? 'Material insuficiente' : 'Insufficient material', result: 'draw' }
  if (game.in_draw()) return { title: language === 'es' ? 'Tablas' : 'Draw', message: language === 'es' ? 'Empate técnico' : 'Draw', result: 'draw' }
  return { title: language === 'es' ? 'Fin' : 'Game Over', message: language === 'es' ? 'Partida terminada' : 'Game finished', result: 'draw' }
}

// ─── Sonidos ───
export interface GameSounds {
  playMove: () => void
  playCapture: () => void
  playCheck: () => void
  playGameEnd: () => void
}

// ─── Hook principal ───

export function useChessGame(config: GameConfig, sounds: GameSounds, language: Language) {
  const gameRef = useRef(new Chess())
  const isThinkingRef = useRef(false)
  const evalFailCountRef = useRef(0)

  const [fen, setFen] = useState(gameRef.current.fen())
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [boardFlipped, setBoardFlipped] = useState(config.playerColor === 'b')
  const [isThinking, setIsThinking] = useState(false)
  const [engineError, setEngineError] = useState<string | null>(null)
  const [evalError, setEvalError] = useState<string | null>(null)
  const [aiRetryToken, setAiRetryToken] = useState(0)
  const [boardReady, setBoardReady] = useState(false)
  const [chances, setChances] = useState<Chances>({ white: 33, draw: 34, black: 33 })
  const [promotionPending, setPromotionPending] = useState<{ from: string; to: string } | null>(null)
  const [gameOverInfo, setGameOverInfo] = useState<GameOverInfo | null>(null)
  const isAIMode = config.opponentMode === 'ai'
  const t = ui(language)

  useEffect(() => {
    const timer = setTimeout(() => setBoardReady(true), 80)
    return () => clearTimeout(timer)
  }, [])

  // ─── Valores derivados ───

  const legalSquares = useMemo(() => {
    if (!selectedSquare) return new Set<string>()
    try {
      const moves = gameRef.current.moves({ square: selectedSquare, verbose: true }) as any[]
      return new Set<string>(moves.map((m: any) => m.to))
    } catch {
      return new Set<string>()
    }
  }, [fen, selectedSquare])

  const classicalCastleOptions = useMemo(() => {
    const game = gameRef.current
    const allowedColor = isAIMode ? config.playerColor : (game.turn() as PieceColor)
    if (game.turn() !== allowedColor) return [] as Array<'k' | 'q'>

    const rank = allowedColor === 'w' ? '1' : '8'
    try {
      const moves = game.moves({ square: `e${rank}`, verbose: true }) as any[]
      const options: Array<'k' | 'q'> = []
      if (moves.some((m: any) => m.to === `g${rank}` && m.flags.includes('k'))) options.push('k')
      if (moves.some((m: any) => m.to === `c${rank}` && m.flags.includes('q'))) options.push('q')
      return options
    } catch {
      return []
    }
  }, [fen, isAIMode, config.playerColor])

  const history: MoveInfo[] = useMemo(() => {
    const moves = gameRef.current.history({ verbose: true }) as any[]
    return moves.map((m: any) => ({ ...m, description: describeMove(m, language) }))
  }, [fen, language])

  const captures: CapturedPieces = useMemo(() => {
    const player: PieceType[] = []
    const ai: PieceType[] = []
    for (const m of history) {
      if (m.captured) {
        if (m.color === config.playerColor) player.push(m.captured as PieceType)
        else ai.push(m.captured as PieceType)
      }
    }
    player.sort((a, b) => PIECE_VALUES[b] - PIECE_VALUES[a])
    ai.sort((a, b) => PIECE_VALUES[b] - PIECE_VALUES[a])
    return { player, ai }
  }, [history, config.playerColor])

  const materialDiff = useMemo(() => {
    const sum = (arr: PieceType[]) => arr.reduce((s, p) => s + PIECE_VALUES[p], 0)
    return sum(captures.player) - sum(captures.ai)
  }, [captures])

  const turn = gameRef.current.turn() as PieceColor
  const gameOver = !!gameOverInfo || gameRef.current.game_over()

  const checkSquare = useMemo(() => {
    const game = gameRef.current
    if (!game.in_check()) return null
    const t = game.turn()
    const board = game.board()
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c]
        if (piece && piece.type === 'k' && piece.color === t) {
          return `${FILES[c]}${8 - r}`
        }
      }
    }
    return null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen])

  const status = useMemo(() => {
    if (gameOverInfo) return { text: translateGameOverInfo(gameOverInfo, language).title, type: 'over' as const }
    if (isAIMode) {
      if (isThinking) return { text: t.aiThinking, type: 'thinking' as const }
      if (turn === config.playerColor) return { text: t.yourTurn, type: 'player' as const }
      return { text: t.aiTurn, type: 'ai' as const }
    }
    return { text: t.turnColor(getColorName(turn, language)), type: 'player' as const }
  }, [gameOverInfo, isThinking, turn, config.playerColor, isAIMode, language, t])

  const pgn = useMemo(() => {
    try {
      return gameRef.current.pgn()
    } catch {
      return ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen])

  // ─── Obtener pieza en casilla ───

  const getPiece = useCallback(
    (sq: string) => gameRef.current.get(sq) as { type: PieceType; color: PieceColor } | null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fen]
  )

  // ─── Ejecutar movimiento ───

  const doMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      const game = gameRef.current
      const result = game.move({ from, to, promotion })
      if (!result) return false

      if (result.captured) sounds.playCapture()
      else sounds.playMove()
      if (game.in_check()) setTimeout(() => sounds.playCheck(), 80)

      setSelectedSquare(null)
      setLastMove({ from, to })
      setFen(game.fen())

      const endInfo = detectGameEnd(game, config.playerColor, isAIMode, language)
      if (endInfo) {
        sounds.playGameEnd()
        setGameOverInfo(endInfo)
      }

      return true
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.playerColor, sounds, isAIMode, language]
  )

  // ─── Turno de la IA (efecto) ───

  useEffect(() => {
    if (!isAIMode) return
    const game = gameRef.current
    if (game.game_over() || isThinkingRef.current || !!gameOverInfo) return
    if (game.turn() === config.playerColor) return

    const timer = setTimeout(async () => {
      isThinkingRef.current = true
      setIsThinking(true)

      try {
        const data = await requestAIMove(game.fen(), config.difficulty)
        if (!data.bestmove || data.bestmove === '(none)') return

        setEngineError(null)

        const from = data.bestmove.slice(0, 2)
        const to = data.bestmove.slice(2, 4)
        const promotion = data.bestmove[4] || undefined

        const result = game.move({ from, to, promotion })
        if (!result) return

        if (result.captured) sounds.playCapture()
        else sounds.playMove()

        const ev =
          data.mate !== null ? (data.mate > 0 ? 10000 : -10000) : data.evaluation
        setChances(evalToChances(ev))
        evalFailCountRef.current = 0
        setEvalError(null)

        setLastMove({ from, to })
        setFen(game.fen())

        if (game.in_check()) setTimeout(() => sounds.playCheck(), 80)

        const endInfo = detectGameEnd(game, config.playerColor, isAIMode, language)
        if (endInfo) {
          sounds.playGameEnd()
          setGameOverInfo(endInfo)
        }
      } catch (err) {
        console.error('Error IA:', err)
        setEngineError(t.engineError)
      } finally {
        isThinkingRef.current = false
        setIsThinking(false)
      }
    }, 350)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, gameOverInfo, isAIMode, language, aiRetryToken, config.difficulty])

  // ─── Evaluación continua de la posición para probabilidades realistas ───

  useEffect(() => {
    if (!isAIMode) {
      setChances({ white: 50, draw: 0, black: 50 })
      return
    }
    if (isThinkingRef.current) return

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const data = await requestEval(gameRef.current.fen())
        if (cancelled) return

        const ev = data.mate !== null ? (data.mate > 0 ? 10000 : -10000) : data.evaluation
        setChances(evalToChances(ev))
        evalFailCountRef.current = 0
        setEvalError(null)
      } catch {
        evalFailCountRef.current += 1
        if (evalFailCountRef.current >= 2) {
          setEvalError(t.evalError)
        }
      }
    }, 160)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [fen, isAIMode])

  // ─── Atajo de teclado (Ctrl+Z = deshacer) ───

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault()
        undoMove()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Acciones del jugador ───

  const handleSquareClick = useCallback(
    (sq: string) => {
      const game = gameRef.current
      if (isThinkingRef.current || gameOverInfo) return
      const allowedColor = isAIMode ? config.playerColor : (game.turn() as PieceColor)
      if (game.turn() !== allowedColor) return

      const clicked = game.get(sq)

      if (selectedSquare) {
        const moves = game.moves({ square: selectedSquare, verbose: true }) as any[]
        const isLegal = moves.some((m: any) => m.to === sq)

        if (isLegal) {
          if (needsPromotion(game, selectedSquare, sq)) {
            setPromotionPending({ from: selectedSquare, to: sq })
          } else {
            doMove(selectedSquare, sq)
          }
          return
        }
        if (clicked && clicked.color === allowedColor) {
          setSelectedSquare(sq)
          return
        }
        setSelectedSquare(null)
        return
      }

      if (clicked && clicked.color === allowedColor) {
        setSelectedSquare(sq)
      }
    },
    [selectedSquare, config.playerColor, gameOverInfo, doMove, isAIMode]
  )

  const handleDrop = useCallback(
    (from: string, to: string) => {
      const game = gameRef.current
      if (isThinkingRef.current || gameOverInfo) return
      const allowedColor = isAIMode ? config.playerColor : (game.turn() as PieceColor)
      if (game.turn() !== allowedColor) return

      const piece = game.get(from)
      if (!piece || piece.color !== allowedColor) return

      const moves = game.moves({ square: from, verbose: true }) as any[]
      const isLegal = moves.some((m: any) => m.to === to)
      if (!isLegal) {
        setSelectedSquare(null)
        return
      }

      if (needsPromotion(game, from, to)) {
        setSelectedSquare(from)
        setPromotionPending({ from, to })
      } else {
        doMove(from, to)
      }
    },
    [config.playerColor, gameOverInfo, doMove, isAIMode]
  )

  const handlePromotion = useCallback(
    (piece: string) => {
      if (!promotionPending) return
      doMove(promotionPending.from, promotionPending.to, piece)
      setPromotionPending(null)
    },
    [promotionPending, doMove]
  )

  const doClassicalCastle = useCallback((side: 'k' | 'q') => {
    const game = gameRef.current
    if (isThinkingRef.current || gameOverInfo) return

    const allowedColor = isAIMode ? config.playerColor : (game.turn() as PieceColor)
    if (game.turn() !== allowedColor) return

    const rank = allowedColor === 'w' ? '1' : '8'
    const from = `e${rank}`
    const to = side === 'k' ? `g${rank}` : `c${rank}`
    doMove(from, to)
  }, [config.playerColor, doMove, gameOverInfo, isAIMode])

  function undoMove() {
    const game = gameRef.current
    if (game.history().length < 2 || isThinkingRef.current || gameOverInfo) return
    game.undo()
    game.undo()
    setSelectedSquare(null)
    setLastMove(null)
    setFen(game.fen())
  }

  const undo = useCallback(() => undoMove(), [gameOverInfo])

  const flip = useCallback(() => {
    setBoardFlipped(prev => !prev)
  }, [])

  const resign = useCallback(() => {
    if (gameOverInfo) return
    sounds.playGameEnd()
    setGameOverInfo({
      title: language === 'es' ? 'Resignación' : 'Resignation',
      message: language === 'es' ? 'Has abandonado la partida' : 'You resigned the game',
      result: 'lose',
    })
  }, [gameOverInfo, sounds, language])

  const handleTimedOut = useCallback(
    (color: PieceColor) => {
      if (gameOverInfo) return
      sounds.playGameEnd()
      setGameOverInfo(
        isAIMode
          ? color === config.playerColor
            ? { title: language === 'es' ? '¡Tiempo agotado!' : 'Time Out!', message: language === 'es' ? 'Se te acabó el tiempo' : 'You ran out of time', result: 'lose' }
            : { title: language === 'es' ? '¡Victoria!' : 'Victory!', message: language === 'es' ? 'La IA se quedó sin tiempo' : 'The AI ran out of time', result: 'win' }
          : color === 'w'
            ? { title: language === 'es' ? 'Tiempo agotado' : 'Time Out', message: language === 'es' ? 'Ganan negras por tiempo' : 'Black wins on time', result: 'lose' }
            : { title: language === 'es' ? 'Tiempo agotado' : 'Time Out', message: language === 'es' ? 'Ganan blancas por tiempo' : 'White wins on time', result: 'win' }
      )
    },
    [gameOverInfo, config.playerColor, sounds, isAIMode, language]
  )

  const dismissGameOver = useCallback(() => setGameOverInfo(null), [])

  const retryAIMove = useCallback(() => {
    if (!isAIMode || gameOverInfo || isThinkingRef.current) return
    setEngineError(null)
    setAiRetryToken((n) => n + 1)
  }, [isAIMode, gameOverInfo])

  return {
    fen,
    selectedSquare,
    legalSquares,
    lastMove,
    boardFlipped,
    isThinking,
    boardReady,
    engineError,
    evalError,
    retryAIMove,
    turn,
    gameOver,
    gameOverInfo,
    promotionPending,
    chances,
    captures,
    materialDiff,
    history,
    pgn,
    status,
    checkSquare,
    classicalCastleOptions,
    getPiece,
    handleSquareClick,
    handleDrop,
    handlePromotion,
    doClassicalCastle,
    undo,
    flip,
    resign,
    handleTimedOut,
    dismissGameOver,
    playerColor: config.playerColor,
    controlColor: isAIMode ? config.playerColor : turn,
    isAIMode,
    difficulty: config.difficulty,
  }
}
