import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { Chess } from 'chess.js'
import { requestAIMove } from '../lib/api'
import { PIECE_VALUES, FILES } from '../lib/constants'
import type {
  GameConfig,
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
  const w = 1 / (1 + Math.exp(-ev * 0.4))
  const drawRaw = Math.max(0, 1 - 2 * Math.abs(w - 0.5) - 0.1)
  const bRaw = 1 - w
  const total = w + drawRaw + bRaw
  const white = Math.round((w / total) * 100)
  const black = Math.round((bRaw / total) * 100)
  const draw = 100 - white - black
  return { white, draw, black }
}

const PIECE_LABEL: Record<string, string> = {
  p: 'Peón', n: 'Caballo', b: 'Alfil', r: 'Torre', q: 'Dama', k: 'Rey',
}

function describeMove(m: {
  piece: string; to: string; flags: string; captured?: string; promotion?: string
}): string {
  if (m.flags.includes('k')) return 'Enroque corto'
  if (m.flags.includes('q')) return 'Enroque largo'
  if (m.promotion) return `Promoción a ${PIECE_LABEL[m.promotion] || ''}`
  if (m.captured) return `${PIECE_LABEL[m.piece] || ''} captura en ${m.to}`
  return `${PIECE_LABEL[m.piece] || ''} a ${m.to}`
}

function needsPromotion(game: InstanceType<typeof Chess>, from: string, to: string): boolean {
  const piece = game.get(from)
  if (!piece || piece.type !== 'p') return false
  const rank = to[1]
  return (piece.color === 'w' && rank === '8') || (piece.color === 'b' && rank === '1')
}

function detectGameEnd(
  game: InstanceType<typeof Chess>,
  playerColor: PieceColor
): GameOverInfo | null {
  if (!game.game_over()) return null
  if (game.in_checkmate()) {
    const loserTurn = game.turn()
    return loserTurn === playerColor
      ? { title: 'Derrota', message: 'La IA te ha dado jaque mate', result: 'lose' }
      : { title: '¡Victoria!', message: 'Has ganado por jaque mate', result: 'win' }
  }
  if (game.in_stalemate()) return { title: 'Tablas', message: 'Rey ahogado', result: 'draw' }
  if (game.in_threefold_repetition()) return { title: 'Tablas', message: 'Triple repetición', result: 'draw' }
  if (game.insufficient_material()) return { title: 'Tablas', message: 'Material insuficiente', result: 'draw' }
  if (game.in_draw()) return { title: 'Tablas', message: 'Empate técnico', result: 'draw' }
  return { title: 'Fin', message: 'Partida terminada', result: 'draw' }
}

// ─── Sonidos ───
export interface GameSounds {
  playMove: () => void
  playCapture: () => void
  playCheck: () => void
  playGameEnd: () => void
}

// ─── Hook principal ───

export function useChessGame(config: GameConfig, sounds: GameSounds) {
  const gameRef = useRef(new Chess())
  const isThinkingRef = useRef(false)

  const [fen, setFen] = useState(gameRef.current.fen())
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [boardFlipped, setBoardFlipped] = useState(config.playerColor === 'b')
  const [isThinking, setIsThinking] = useState(false)
  const [chances, setChances] = useState<Chances>({ white: 33, draw: 34, black: 33 })
  const [promotionPending, setPromotionPending] = useState<{ from: string; to: string } | null>(null)
  const [gameOverInfo, setGameOverInfo] = useState<GameOverInfo | null>(null)

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

  const history: MoveInfo[] = useMemo(() => {
    const moves = gameRef.current.history({ verbose: true }) as any[]
    return moves.map((m: any) => ({ ...m, description: describeMove(m) }))
  }, [fen])

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
    if (gameOverInfo) return { text: gameOverInfo.title, type: 'over' as const }
    if (isThinking) return { text: 'La IA está pensando...', type: 'thinking' as const }
    if (turn === config.playerColor) return { text: 'Tu turno', type: 'player' as const }
    return { text: 'Turno de la IA', type: 'ai' as const }
  }, [gameOverInfo, isThinking, turn, config.playerColor])

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

      const endInfo = detectGameEnd(game, config.playerColor)
      if (endInfo) {
        sounds.playGameEnd()
        setGameOverInfo(endInfo)
      }

      return true
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.playerColor, sounds]
  )

  // ─── Turno de la IA (efecto) ───

  useEffect(() => {
    const game = gameRef.current
    if (game.game_over() || isThinkingRef.current || !!gameOverInfo) return
    if (game.turn() === config.playerColor) return

    const timer = setTimeout(async () => {
      isThinkingRef.current = true
      setIsThinking(true)

      try {
        const data = await requestAIMove(game.fen(), config.difficulty)
        if (!data.bestmove || data.bestmove === '(none)') return

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

        setLastMove({ from, to })
        setFen(game.fen())

        if (game.in_check()) setTimeout(() => sounds.playCheck(), 80)

        const endInfo = detectGameEnd(game, config.playerColor)
        if (endInfo) {
          sounds.playGameEnd()
          setGameOverInfo(endInfo)
        }
      } catch (err) {
        console.error('Error IA:', err)
      } finally {
        isThinkingRef.current = false
        setIsThinking(false)
      }
    }, 350)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, gameOverInfo])

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
      if (game.turn() !== config.playerColor) return

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
        if (clicked && clicked.color === config.playerColor) {
          setSelectedSquare(sq)
          return
        }
        setSelectedSquare(null)
        return
      }

      if (clicked && clicked.color === config.playerColor) {
        setSelectedSquare(sq)
      }
    },
    [selectedSquare, config.playerColor, gameOverInfo, doMove]
  )

  const handleDrop = useCallback(
    (from: string, to: string) => {
      const game = gameRef.current
      if (isThinkingRef.current || gameOverInfo) return
      if (game.turn() !== config.playerColor) return

      const piece = game.get(from)
      if (!piece || piece.color !== config.playerColor) return

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
    [config.playerColor, gameOverInfo, doMove]
  )

  const handlePromotion = useCallback(
    (piece: string) => {
      if (!promotionPending) return
      doMove(promotionPending.from, promotionPending.to, piece)
      setPromotionPending(null)
    },
    [promotionPending, doMove]
  )

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
    setGameOverInfo({ title: 'Resignación', message: 'Has abandonado la partida', result: 'lose' })
  }, [gameOverInfo, sounds])

  const handleTimedOut = useCallback(
    (color: PieceColor) => {
      if (gameOverInfo) return
      sounds.playGameEnd()
      setGameOverInfo(
        color === config.playerColor
          ? { title: '¡Tiempo agotado!', message: 'Se te acabó el tiempo', result: 'lose' }
          : { title: '¡Victoria!', message: 'La IA se quedó sin tiempo', result: 'win' }
      )
    },
    [gameOverInfo, config.playerColor, sounds]
  )

  const dismissGameOver = useCallback(() => setGameOverInfo(null), [])

  return {
    fen,
    selectedSquare,
    legalSquares,
    lastMove,
    boardFlipped,
    isThinking,
    turn,
    gameOver,
    gameOverInfo,
    promotionPending,
    chances,
    captures,
    materialDiff,
    history,
    status,
    checkSquare,
    getPiece,
    handleSquareClick,
    handleDrop,
    handlePromotion,
    undo,
    flip,
    resign,
    handleTimedOut,
    dismissGameOver,
    playerColor: config.playerColor,
    difficulty: config.difficulty,
  }
}
