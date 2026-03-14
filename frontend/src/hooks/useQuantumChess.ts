import { useState, useRef, useCallback, useMemo } from 'react'
import { QuantumChessEngine } from '../lib/quantumEngine'
import { getColorName, translateGameOverInfo } from '../lib/i18n'
import type {
  GameConfig, Language, PieceColor, PieceType, Chances, QBoardCell,
  QMoveRecord, QMoveMode, QGameOver, GameOverInfo, QMeasurementEvent,
} from '../lib/types'

export interface GameSounds {
  playMove: () => void
  playCapture: () => void
  playCheck: () => void
  playGameEnd: () => void
}

const Q_PIECE_VALUES: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
}

function quantumEvalToChances(cp: number): Chances {
  const clamped = Math.max(-1200, Math.min(1200, cp))
  const expectedScoreWhite = 1 / (1 + Math.pow(10, -clamped / 280))
  const drawProb = Math.max(0.06, 0.44 * Math.exp(-Math.abs(clamped) / 240))
  const whiteRaw = Math.max(0, expectedScoreWhite - drawProb / 2)
  const blackRaw = Math.max(0, 1 - expectedScoreWhite - drawProb / 2)

  const total = whiteRaw + drawProb + blackRaw
  const white = Math.round((whiteRaw / total) * 100)
  const black = Math.round((blackRaw / total) * 100)
  const draw = 100 - white - black
  return { white, draw, black }
}

function qGameOverToClassic(qgo: QGameOver, playerColor: PieceColor, language: Language): GameOverInfo {
  const isWin = qgo.winner === playerColor
  const reason = language === 'es'
    ? qgo.reason
    : qgo.reason === 'Rey blanco capturado'
      ? 'White king captured'
      : qgo.reason === 'Rey negro capturado'
        ? 'Black king captured'
        : qgo.reason
  return isWin
    ? { title: language === 'es' ? '¡Victoria!' : 'Victory!', message: reason, result: 'win' }
    : { title: language === 'es' ? 'Derrota' : 'Defeat', message: reason, result: 'lose' }
}

export function useQuantumChess(config: GameConfig, sounds: GameSounds, language: Language) {
  const engineRef = useRef(new QuantumChessEngine())

  const [boardVersion, setBoardVersion] = useState(0)
  const [selectedPiece, setSelectedPiece] = useState<{ id: string; square: string } | null>(null)
  const [moveMode, setMoveMode] = useState<QMoveMode>('classical')
  const [firstQuantumTarget, setFirstQuantumTarget] = useState<string | null>(null)
  const [gameOverInfo, setGameOverInfo] = useState<GameOverInfo | null>(null)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [boardFlipped, setBoardFlipped] = useState(config.playerColor === 'b')
  const [measurementEvent, setMeasurementEvent] = useState<QMeasurementEvent | null>(null)
  const [promotionPending, setPromotionPending] = useState<{
    pieceId: string; from: string; to: string
  } | null>(null)

  const engine = engineRef.current
  const state = engine.state

  const board: Record<string, QBoardCell[]> = useMemo(() => {
    void boardVersion
    return engine.getBoard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardVersion])

  const turn = state.turn
  const gameOver = !!gameOverInfo || !!state.gameOver

  const history: QMoveRecord[] = useMemo(() => {
    void boardVersion
    return [...state.history]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardVersion])

  // Evaluacion global del tablero cuantico (material esperado por probabilidad).
  const chances: Chances = useMemo(() => {
    void boardVersion

    const whiteKing = state.pieces['w_k']
    const blackKing = state.pieces['b_k']
    if (!whiteKing?.alive) return { white: 0, draw: 0, black: 100 }
    if (!blackKing?.alive) return { white: 100, draw: 0, black: 0 }

    let whiteExpected = 0
    let blackExpected = 0

    for (const piece of Object.values(state.pieces)) {
      if (!piece.alive) continue
      const base = Q_PIECE_VALUES[piece.type]
      if (!base) continue

      const presenceProb = Object.values(piece.positions).reduce((sum, p) => sum + p, 0)
      const expected = base * presenceProb

      if (piece.color === 'w') whiteExpected += expected
      else blackExpected += expected
    }

    const cp = (whiteExpected - blackExpected) * 100
    return quantumEvalToChances(cp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardVersion])

  const legalTargets: Set<string> = useMemo(() => {
    if (!selectedPiece) return new Set()
    if (moveMode === 'merge') return new Set(engine.getMergeTargets(selectedPiece.id, selectedPiece.square))
    if (firstQuantumTarget) {
      const moves = engine.getLegalMoves(selectedPiece.id, selectedPiece.square)
      return new Set(moves.filter(m => !m.isCapture && m.square !== firstQuantumTarget).map(m => m.square))
    }
    const moves = engine.getLegalMoves(selectedPiece.id, selectedPiece.square)
    if (moveMode === 'quantum') {
      return new Set(moves.filter(m => !m.isCapture).map(m => m.square))
    }
    return new Set(moves.map(m => m.square))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPiece, moveMode, firstQuantumTarget, boardVersion])

  const mergeTargets: Set<string> = useMemo(() => {
    if (!selectedPiece) return new Set()
    return new Set(engine.getMergeTargets(selectedPiece.id, selectedPiece.square))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPiece, boardVersion])

  const quantumCastleOptions = useMemo(() => {
    void boardVersion
    return engine.canQuantumCastle(turn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardVersion, turn])

  const classicalCastleOptions = useMemo(() => {
    void boardVersion
    const rank = turn === 'w' ? '1' : '8'
    const kingId = `${turn}_k`
    const moves = engine.getLegalMoves(kingId, `e${rank}`)
    const options: Array<'k' | 'q'> = []
    if (moves.some((move) => move.square === `g${rank}`)) options.push('k')
    if (moves.some((move) => move.square === `c${rank}`)) options.push('q')
    return options
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardVersion, turn])

  const availableMoveModes: QMoveMode[] = useMemo(() => {
    if (!selectedPiece) return ['classical', 'quantum']
    const piece = engine.getPiece(selectedPiece.id)
    if (!piece) return ['classical']

    const modes: QMoveMode[] = ['classical']
    if (piece.type !== 'p') modes.push('quantum')
    if (Object.keys(piece.positions).length > 1 && engine.getMergeTargets(piece.id, selectedPiece.square).length > 0) {
      modes.push('merge')
    }
    return modes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPiece, boardVersion])

  const status = useMemo(() => {
    if (gameOverInfo) return { text: translateGameOverInfo(gameOverInfo, language).title, type: 'over' as const }
    return { text: language === 'es' ? `Turno: ${getColorName(turn, language)}` : `${getColorName(turn, language)} to move`, type: 'player' as const }
  }, [gameOverInfo, turn, language])

  const refresh = useCallback(() => {
    setBoardVersion(v => v + 1)
    const qgo = engine.checkGameOverPublic()
    if (qgo && !gameOverInfo) {
      sounds.playGameEnd()
      setGameOverInfo(qGameOverToClassic(qgo, config.playerColor, language))
    }
  }, [engine, sounds, config.playerColor, gameOverInfo, language])

  const handleSquareClick = useCallback((sq: string) => {
    if (gameOverInfo) return
    const allowedColor = state.turn

    const cellsOnSquare = board[sq] || []
    const myPiece = cellsOnSquare.find(c => c.color === allowedColor)

    if (firstQuantumTarget && selectedPiece) {
      if (legalTargets.has(sq)) {
        engine.doQuantumMove(selectedPiece.id, selectedPiece.square, firstQuantumTarget, sq)
        sounds.playMove()
        setSelectedPiece(null)
        setFirstQuantumTarget(null)
        setMoveMode('classical')
        setLastMove({ from: selectedPiece.square, to: sq })
        refresh()
        return
      }
      setFirstQuantumTarget(null)
      setSelectedPiece(null)
      setMoveMode('classical')
      return
    }

    if (selectedPiece) {
      if (legalTargets.has(sq)) {
        if (moveMode === 'merge') {
          engine.doMergeFrom(selectedPiece.id, selectedPiece.square, sq)
          sounds.playMove()
          setSelectedPiece(null)
          setMoveMode('classical')
          setLastMove({ from: selectedPiece.square, to: sq })
          refresh()
          return
        }

        if (moveMode === 'quantum') {
          setFirstQuantumTarget(sq)
          return
        }

        const piece = engine.getPiece(selectedPiece.id)
        if (piece?.type === 'p') {
          const destRank = sq[1]
          const isPromo = (piece.color === 'w' && destRank === '8') || (piece.color === 'b' && destRank === '1')
          if (isPromo) {
            setPromotionPending({ pieceId: selectedPiece.id, from: selectedPiece.square, to: sq })
            return
          }
        }

        const record = engine.doClassicalMove(selectedPiece.id, selectedPiece.square, sq)
        if (record.measurement) setMeasurementEvent(record.measurement)
        if (record.captured) sounds.playCapture()
        else sounds.playMove()
        if (record.measurement) sounds.playCheck()

        setSelectedPiece(null)
        setMoveMode('classical')
        setLastMove({ from: record.from, to: record.to })
        refresh()
        return
      }

      if (myPiece) {
        setSelectedPiece({ id: myPiece.pieceId, square: sq })
        setFirstQuantumTarget(null)
        return
      }

      setSelectedPiece(null)
      setFirstQuantumTarget(null)
      setMoveMode('classical')
      return
    }

    if (myPiece) {
      setSelectedPiece({ id: myPiece.pieceId, square: sq })
      const piece = engine.getPiece(myPiece.pieceId)
      if (piece?.type === 'p' && moveMode === 'quantum') setMoveMode('classical')
      setFirstQuantumTarget(null)
    }
  }, [
    board, engine, firstQuantumTarget, gameOverInfo,
    legalTargets, moveMode, refresh, selectedPiece, sounds, state.turn,
  ])

  const handleDrop = useCallback((from: string, to: string) => {
    if (gameOverInfo) return
    const allowedColor = state.turn

    const cellsOnFrom = board[from] || []
    const myPiece = cellsOnFrom.find(c => c.color === allowedColor)
    if (!myPiece) return

    const moves = engine.getLegalMoves(myPiece.pieceId, from)
    if (!moves.some(m => m.square === to)) return

    const piece = engine.getPiece(myPiece.pieceId)
    if (piece?.type === 'p') {
      const destRank = to[1]
      const isPromo = (piece.color === 'w' && destRank === '8') || (piece.color === 'b' && destRank === '1')
      if (isPromo) {
        setSelectedPiece({ id: myPiece.pieceId, square: from })
        setPromotionPending({ pieceId: myPiece.pieceId, from, to })
        return
      }
    }

    const record = engine.doClassicalMove(myPiece.pieceId, from, to)
    if (record.measurement) setMeasurementEvent(record.measurement)
    if (record.captured) sounds.playCapture()
    else sounds.playMove()

    setSelectedPiece(null)
    setLastMove({ from: record.from, to: record.to })
    refresh()
  }, [board, engine, gameOverInfo, refresh, sounds, state.turn])

  const handlePromotion = useCallback((pieceType: string) => {
    if (!promotionPending) return
    const record = engine.doClassicalMove(
      promotionPending.pieceId, promotionPending.from, promotionPending.to,
      pieceType as PieceType
    )
    if (record.measurement) setMeasurementEvent(record.measurement)
    if (record.captured) sounds.playCapture()
    else sounds.playMove()
    setPromotionPending(null)
    setSelectedPiece(null)
    setLastMove({ from: record.from, to: record.to })
    refresh()
  }, [promotionPending, engine, sounds, refresh])

  const doQuantumCastle = useCallback((side: 'k' | 'q') => {
    if (gameOverInfo) return
    const allowedColor = state.turn

    engine.doQuantumCastle(allowedColor, side)
    sounds.playMove()
    setSelectedPiece(null)
    setLastMove(null)
    refresh()
  }, [engine, gameOverInfo, refresh, sounds, state.turn])

  const doClassicalCastle = useCallback((side: 'k' | 'q') => {
    if (gameOverInfo) return

    const allowedColor = state.turn
    const rank = allowedColor === 'w' ? '1' : '8'
    const kingId = `${allowedColor}_k`
    const from = `e${rank}`
    const to = side === 'k' ? `g${rank}` : `c${rank}`

    const record = engine.doClassicalMove(kingId, from, to)
    if (record.measurement) setMeasurementEvent(record.measurement)
    sounds.playMove()
    setSelectedPiece(null)
    setFirstQuantumTarget(null)
    setMoveMode('classical')
    setLastMove({ from: record.from, to: record.to })
    refresh()
  }, [engine, gameOverInfo, refresh, sounds, state.turn])

  const chooseMoveMode = useCallback((mode: QMoveMode) => {
    if (!availableMoveModes.includes(mode)) return
    setMoveMode(mode)
    setFirstQuantumTarget(null)
  }, [availableMoveModes])

  const flip = useCallback(() => setBoardFlipped(p => !p), [])

  const resign = useCallback(() => {
    if (gameOverInfo) return
    sounds.playGameEnd()
    setGameOverInfo({
      title: language === 'es' ? 'Resignación' : 'Resignation',
      message: language === 'es' ? 'Partida terminada por rendición' : 'Game ended by resignation',
      result: 'lose',
    })
  }, [gameOverInfo, sounds, language])

  const handleTimedOut = useCallback((color: PieceColor) => {
    if (gameOverInfo) return
    sounds.playGameEnd()
    setGameOverInfo(
      color === 'w'
        ? { title: language === 'es' ? 'Tiempo agotado' : 'Time Out', message: language === 'es' ? 'Ganan negras por tiempo' : 'Black wins on time', result: 'lose' }
        : { title: language === 'es' ? 'Tiempo agotado' : 'Time Out', message: language === 'es' ? 'Ganan blancas por tiempo' : 'White wins on time', result: 'win' }
    )
  }, [gameOverInfo, sounds, language])

  const dismissGameOver = useCallback(() => setGameOverInfo(null), [])
  const dismissMeasurement = useCallback(() => setMeasurementEvent(null), [])

  return {
    board,
    selectedPiece,
    legalTargets,
    mergeTargets,
    moveMode,
    firstQuantumTarget,
    lastMove,
    boardFlipped,
    isThinking: false,
    turn,
    gameOver,
    gameOverInfo,
    promotionPending: promotionPending ? { from: promotionPending.from, to: promotionPending.to } : null,
    chances,
    history,
    status,
    classicalCastleOptions,
    quantumCastleOptions,
    availableMoveModes,
    measurementEvent,
    handleSquareClick,
    handleDrop,
    handlePromotion,
    chooseMoveMode,
    doClassicalCastle,
    doQuantumCastle,
    flip,
    resign,
    handleTimedOut,
    dismissGameOver,
    dismissMeasurement,
    playerColor: config.playerColor,
    controlColor: turn,
    isAIMode: false,
    difficulty: config.difficulty,
  }
}
