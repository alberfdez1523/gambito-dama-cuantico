import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { hashQuantumState, QuantumChessEngine } from '../lib/quantumEngine'
import {
  chooseFallbackLegalQAction,
  applyQAIAction,
  isActionStillLegal,
} from '../lib/quantumAi'
import { chooseQuantumAIMoveInWorker } from '../lib/quantumAiWorker'
import {
  neutralQuantumStepFromRecord,
  quantumReplayStep,
  type NeutralQuantumReplayStep,
} from '../lib/gameReplay'
import { pendingMeasurementFromLastMove } from '../lib/onlineTypes'
import type { QPendingMeasurement } from '../lib/onlineTypes'
import { getColorName, translateGameOverInfo } from '../lib/i18n'
import type {
  GameConfig, Language, PieceColor, PieceType, Chances, QBoardCell,
  QMoveRecord, QMoveMode, QGameOver, GameOverInfo, QMeasurementEvent,
  QuantumUndoEntry, QuantumRng, QState,
} from '../lib/types'

export interface GameSounds {
  playMove: () => void
  playSplit: () => void
  playMerge: () => void
  playMeasurement: () => void
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
  if (qgo.winner === null) {
    return {
      title: language === 'es' ? 'Tablas' : 'Draw',
      message: language === 'es' ? qgo.reason : 'No legal actions remain',
      result: 'draw',
    }
  }
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

function cloneQState<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

export interface QuantumStateChangeMeta {
  pendingMeasurement: QPendingMeasurement | null
}

export interface QuantumCapturePreview {
  from: string
  to: string
  attackerProbability: number
  defenderProbability: number
  outcomes: Array<{
    id: 'attacker-absent' | 'capture' | 'defender-absent'
    probability: number
  }>
}

interface PendingQuantumCapture {
  action: { pieceId: string; from: string; to: string; promotion?: PieceType }
  preview: QuantumCapturePreview
}

export interface UseQuantumChessOptions {
  onStateChange?: (engine: QuantumChessEngine, meta?: QuantumStateChangeMeta) => void
  canMove?: () => boolean
  getRng?: (counter: number) => QuantumRng
}

export function useQuantumChess(
  config: GameConfig,
  sounds: GameSounds,
  language: Language,
  options: UseQuantumChessOptions = {},
) {
  const engineRef = useRef(new QuantumChessEngine(Math.random, {
    rulesetId: config.rulesetId ?? 'quantum-standard',
    maxCoherence: config.options?.maxCoherence,
  }))
  const undoStackRef = useRef<QuantumUndoEntry[]>([])
  const replaySnapshotsRef = useRef<QState[]>([])
  const replayActionsRef = useRef<NeutralQuantumReplayStep[]>([])

  const [boardVersion, setBoardVersion] = useState(0)
  const [undoDepth, setUndoDepth] = useState(0)
  const [selectedPiece, setSelectedPiece] = useState<{ id: string; square: string } | null>(null)
  const [moveMode, setMoveMode] = useState<QMoveMode>('classical')
  const [firstQuantumTarget, setFirstQuantumTarget] = useState<string | null>(null)
  const [gameOverInfo, setGameOverInfo] = useState<GameOverInfo | null>(null)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [boardFlipped, setBoardFlipped] = useState(config.playerColor === 'b')
  const [measurementEvent, setMeasurementEvent] = useState<QMeasurementEvent | null>(null)
  const [measurementBoardState, setMeasurementBoardState] = useState<import('../lib/types').QState | null>(null)
  const [isMeasurementBlocking, setIsMeasurementBlocking] = useState(false)
  const syncMetaRef = useRef<QuantumStateChangeMeta | null>(null)
  const [promotionPending, setPromotionPending] = useState<{
    pieceId: string; from: string; to: string
  } | null>(null)
  const [capturePending, setCapturePending] = useState<PendingQuantumCapture | null>(null)

  const isOnline = config.opponentMode === 'online'
  const isAIMode = config.opponentMode === 'ai'
  const isThinkingRef = useRef(false)
  const lastAiHistoryLengthRef = useRef(-1)
  const [isThinking, setIsThinking] = useState(false)
  const [aiStage, setAiStage] = useState<'enumerating' | 'reply-search' | 'engine' | 'complete'>('enumerating')
  const [engineError, setEngineError] = useState<string | null>(null)
  const [aiRetryToken, setAiRetryToken] = useState(0)
  const canMoveRef = useRef(options.canMove)
  canMoveRef.current = options.canMove
  const getRngRef = useRef(options.getRng)
  getRngRef.current = options.getRng
  const onStateChangeRef = useRef(options.onStateChange)
  onStateChangeRef.current = options.onStateChange

  const appendReplayAction = useCallback((action: import('../lib/types').QuantumAction, record: QMoveRecord) => {
    replayActionsRef.current.push(quantumReplayStep(action, record))
  }, [])
  const engine = engineRef.current
  const state = engine.state
  if (replaySnapshotsRef.current.length === 0) {
    replaySnapshotsRef.current = [cloneQState(engine.exportState())]
  }

  const prepareRng = useCallback(() => {
    const next = getRngRef.current?.(engine.state.rngCounter)
    if (next) engine.setRng(next)
  }, [engine])

  const board: Record<string, QBoardCell[]> = useMemo(() => {
    void boardVersion
    if (measurementBoardState) {
      const preview = new QuantumChessEngine()
      preview.loadState(measurementBoardState)
      return preview.getBoard()
    }
    return engine.getBoard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardVersion, measurementBoardState])

  const turn = state.turn
  const gameOver = !!gameOverInfo || !!state.gameOver

  const checkSquare = useMemo(() => {
    void boardVersion
    return engine.getCheckSquareForTurn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardVersion])

  const playCheckIfNeeded = useCallback(() => {
    if (engine.isClassicalKingInCheck(engine.state.turn)) {
      setTimeout(() => sounds.playCheck(), 80)
    }
  }, [engine, sounds])

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
      return new Set(
        engine.getQuantumSplitTargets(selectedPiece.id, selectedPiece.square)
          .filter((square) => square !== firstQuantumTarget),
      )
    }
    const piece = engine.getPiece(selectedPiece.id)
    const moves = engine.getLegalMoves(selectedPiece.id, selectedPiece.square)
    if (moveMode === 'quantum') {
      return new Set(engine.getQuantumSplitTargets(selectedPiece.id, selectedPiece.square))
    }
    return new Set(moves.filter((move) => engine.isActionWithinCoherence({
      kind: 'classical',
      pieceId: selectedPiece.id,
      from: selectedPiece.square,
      to: move.square,
      promotion: piece?.type === 'p' && (move.square[1] === '1' || move.square[1] === '8') ? 'q' : undefined,
    })).map(m => m.square))
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
    if (!selectedPiece) {
      return engine.getRulesConfig().rulesetId === 'quantum-coherence' && engine.getCoherence(state.turn).available < 1
        ? ['classical']
        : ['classical', 'quantum']
    }
    const piece = engine.getPiece(selectedPiece.id)
    if (!piece) return ['classical']

    const modes: QMoveMode[] = ['classical']
    if (piece.type !== 'p' && engine.getQuantumSplitTargets(piece.id, selectedPiece.square).length >= 2) modes.push('quantum')
    if (Object.keys(piece.positions).length > 1 && engine.getMergeTargets(piece.id, selectedPiece.square).length > 0) {
      modes.push('merge')
    }
    return modes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPiece, boardVersion])

  const coherence = useMemo(() => {
    void boardVersion
    if (engine.getRulesConfig().rulesetId !== 'quantum-coherence') return null
    return {
      w: engine.getCoherence('w'),
      b: engine.getCoherence('b'),
    }
  }, [boardVersion, engine])

  const status = useMemo(() => {
    if (gameOverInfo) return { text: translateGameOverInfo(gameOverInfo, language).title, type: 'over' as const }
    if (isMeasurementBlocking) {
      return {
        text: language === 'es' ? 'Medición — gira la ruleta' : 'Measurement — spin the roulette',
        type: 'thinking' as const,
      }
    }
    if (isAIMode) {
      if (isThinking) {
        const stageText = {
          enumerating: language === 'es' ? 'IA enumerando acciones…' : 'AI enumerating actions…',
          'reply-search': language === 'es' ? 'IA comparando respuestas…' : 'AI comparing replies…',
          engine: language === 'es' ? 'IA verificando variantes…' : 'AI checking variations…',
          complete: language === 'es' ? 'IA preparando jugada…' : 'AI preparing move…',
        }[aiStage]
        return { text: stageText, type: 'thinking' as const }
      }
      if (turn === config.playerColor) return { text: language === 'es' ? 'Tu turno' : 'Your turn', type: 'player' as const }
      return { text: language === 'es' ? 'Turno de la IA' : "AI's turn", type: 'ai' as const }
    }
    if (isOnline) {
      if (turn === config.playerColor) {
        return { text: language === 'es' ? 'Tu turno' : 'Your turn', type: 'player' as const }
      }
      return { text: language === 'es' ? 'Turno del rival' : "Opponent's turn", type: 'ai' as const }
    }
    return { text: language === 'es' ? `Turno: ${getColorName(turn, language)}` : `${getColorName(turn, language)} to move`, type: 'player' as const }
  }, [gameOverInfo, turn, language, isOnline, isAIMode, isThinking, isMeasurementBlocking, config.playerColor, aiStage])

  const refresh = useCallback(() => {
    const replayState = cloneQState(engine.exportState())
    const lastReplay = replaySnapshotsRef.current[replaySnapshotsRef.current.length - 1]
    if (!lastReplay || lastReplay.history.length < replayState.history.length) {
      replaySnapshotsRef.current.push(replayState)
    } else if (lastReplay.history.length === replayState.history.length) {
      replaySnapshotsRef.current[replaySnapshotsRef.current.length - 1] = replayState
    }
    setBoardVersion(v => v + 1)
    const qgo = engine.checkGameOverPublic()
    if (qgo && !gameOverInfo && !isMeasurementBlocking) {
      sounds.playGameEnd()
      setGameOverInfo(qGameOverToClassic(qgo, config.playerColor, language))
    }
    const meta = syncMetaRef.current
    syncMetaRef.current = null
    onStateChangeRef.current?.(engine, meta ?? undefined)
  }, [engine, sounds, config.playerColor, gameOverInfo, language, isMeasurementBlocking])

  const beginMeasurementReveal = useCallback((
    preMoveState: import('../lib/types').QState,
    event: QMeasurementEvent,
    moverColor: PieceColor,
  ) => {
    sounds.playMeasurement()
    setMeasurementBoardState(cloneQState(preMoveState))
    setMeasurementEvent(event)
    setIsMeasurementBlocking(true)
    setSelectedPiece(null)
    setFirstQuantumTarget(null)
    setMoveMode('classical')
    setLastMove(null)
    if (isOnline) {
      syncMetaRef.current = {
        pendingMeasurement: pendingMeasurementFromLastMove(
          engine.exportState(),
          moverColor,
          preMoveState,
        ),
      }
    }
  }, [engine, isOnline, sounds])

  const finalizeMeasurementReveal = useCallback(() => {
    setMeasurementBoardState(null)
    setMeasurementEvent(null)
    setIsMeasurementBlocking(false)
    const last = engine.state.history[engine.state.history.length - 1]
    if (last) setLastMove({ from: last.from, to: last.to })
    if (last?.captured) sounds.playCapture()
    else sounds.playMove()
    playCheckIfNeeded()
    setBoardVersion(v => v + 1)
    const qgo = engine.checkGameOverPublic()
    if (qgo && !gameOverInfo) {
      sounds.playGameEnd()
      setGameOverInfo(qGameOverToClassic(qgo, config.playerColor, language))
    }
  }, [engine, sounds, playCheckIfNeeded, gameOverInfo, config.playerColor, language])

  const applyClassicalMoveRecord = useCallback((
    record: QMoveRecord,
    preMoveState: import('../lib/types').QState,
    moverColor: PieceColor,
  ) => {
    if (record.measurement) {
      beginMeasurementReveal(preMoveState, record.measurement, moverColor)
      refresh()
      return
    }
    if (record.captured) sounds.playCapture()
    else if (record.moveType === 'quantum' || record.moveType === 'quantumCastle') sounds.playSplit()
    else if (record.moveType === 'merge') sounds.playMerge()
    else sounds.playMove()
    playCheckIfNeeded()
    setLastMove({ from: record.from, to: record.to })
    refresh()
  }, [beginMeasurementReveal, refresh, sounds, playCheckIfNeeded])

  const pushUndoSnapshot = useCallback(() => {
    if (isOnline) return
    undoStackRef.current.push({
      state: cloneQState(engine.exportState()),
      lastMove,
      moveMode,
      gameOverInfo,
    })
    if (undoStackRef.current.length > 80) undoStackRef.current.shift()
    setUndoDepth(undoStackRef.current.length)
  }, [engine, gameOverInfo, isOnline, lastMove, moveMode])

  const executeClassicalAction = useCallback((action: PendingQuantumCapture['action']) => {
    pushUndoSnapshot()
    const preMove = cloneQState(engine.exportState())
    const mover = engine.state.turn
    prepareRng()
    const record = engine.doClassicalMove(
      action.pieceId,
      action.from,
      action.to,
      action.promotion,
    )
    appendReplayAction({ kind: 'classical', ...action }, record)
    setCapturePending(null)
    setPromotionPending(null)
    setSelectedPiece(null)
    setMoveMode('classical')
    applyClassicalMoveRecord(record, preMove, mover)
  }, [appendReplayAction, applyClassicalMoveRecord, engine, prepareRng, pushUndoSnapshot])

  const queueComplexCapture = useCallback((action: PendingQuantumCapture['action']): boolean => {
    const legalMove = engine
      .getLegalMoves(action.pieceId, action.from)
      .find((move) => move.square === action.to && move.isCapture)
    if (!legalMove) return false

    const attacker = engine.getPiece(action.pieceId)
    const defenderCell = (engine.getBoard()[action.to] ?? []).find(
      (cell) => cell.color !== attacker?.color,
    )
    if (!attacker || !defenderCell) return false
    const defender = engine.getPiece(defenderCell.pieceId)
    if (!defender) return false

    const attackerProbability = attacker.positions[action.from] ?? 0
    const defenderProbability = defender.positions[action.to] ?? 0
    if (attackerProbability >= 1 && defenderProbability >= 1) return false

    const outcomes: QuantumCapturePreview['outcomes'] = [
      {
        id: 'attacker-absent',
        probability: Math.max(0, 1 - attackerProbability),
      },
      {
        id: 'capture',
        probability: attackerProbability * defenderProbability,
      },
      {
        id: 'defender-absent',
        probability: attackerProbability * Math.max(0, 1 - defenderProbability),
      },
    ].filter((outcome) => outcome.probability > 0.0001) as QuantumCapturePreview['outcomes']

    setCapturePending({
      action,
      preview: {
        from: action.from,
        to: action.to,
        attackerProbability,
        defenderProbability,
        outcomes,
      },
    })
    return true
  }, [engine])

  const confirmComplexCapture = useCallback(() => {
    if (!capturePending) return
    executeClassicalAction(capturePending.action)
  }, [capturePending, executeClassicalAction])

  const cancelComplexCapture = useCallback(() => {
    setCapturePending(null)
  }, [])

  const syncRemotePendingMeasurement = useCallback((pending: QPendingMeasurement | null) => {
    if (pending) {
      setMeasurementBoardState(cloneQState(pending.preMoveState))
      setMeasurementEvent(pending.event)
      setIsMeasurementBlocking(true)
      setLastMove(null)
      setBoardVersion(v => v + 1)
      return
    }
    setMeasurementBoardState(null)
    setMeasurementEvent(null)
    setIsMeasurementBlocking(false)
    const last = engine.state.history[engine.state.history.length - 1]
    if (last) {
      setLastMove({ from: last.from, to: last.to })
      if (last.captured) sounds.playCapture()
      else if (last.moveType === 'quantum' || last.moveType === 'quantumCastle') sounds.playSplit()
      else if (last.moveType === 'merge') sounds.playMerge()
      else sounds.playMove()
      playCheckIfNeeded()
    }
    setBoardVersion(v => v + 1)
    const qgo = engine.checkGameOverPublic()
    if (qgo && !gameOverInfo) {
      sounds.playGameEnd()
      setGameOverInfo(qGameOverToClassic(qgo, config.playerColor, language))
    }
  }, [engine, sounds, playCheckIfNeeded, gameOverInfo, config.playerColor, language])

  const loadQuantumState = useCallback((
    qstate: import('../lib/types').QState,
    restoredLastMove?: { from: string; to: string } | null,
    restoredReplayActions?: NeutralQuantumReplayStep[],
    restoredReplaySnapshots?: import('../lib/types').QState[],
  ) => {
    engine.loadState(qstate)
    replayActionsRef.current = restoredReplayActions?.length === qstate.history.length
      ? structuredClone(restoredReplayActions)
      : qstate.history.map(neutralQuantumStepFromRecord)
    if (
      restoredReplaySnapshots?.length === qstate.history.length + 1
      && restoredReplaySnapshots[restoredReplaySnapshots.length - 1]?.history.length === qstate.history.length
    ) {
      replaySnapshotsRef.current = restoredReplaySnapshots.map(cloneQState)
    } else {
      const previousReplay = replaySnapshotsRef.current[replaySnapshotsRef.current.length - 1]
      replaySnapshotsRef.current = previousReplay && qstate.history.length === previousReplay.history.length + 1
        ? [...replaySnapshotsRef.current, cloneQState(qstate)]
        : [cloneQState(qstate)]
    }
    undoStackRef.current = []
    setUndoDepth(0)
    setSelectedPiece(null)
    setFirstQuantumTarget(null)
    setMoveMode('classical')
    setCapturePending(null)
    const latest = qstate.history[qstate.history.length - 1]
    setLastMove(
      restoredLastMove === undefined
        ? latest ? { from: latest.from, to: latest.to } : null
        : restoredLastMove,
    )
    setBoardVersion(v => v + 1)
    const qgo = engine.checkGameOverPublic()
    if (qgo) {
      setGameOverInfo(qGameOverToClassic(qgo, config.playerColor, language))
    } else {
      setGameOverInfo(null)
    }
  }, [engine, config.playerColor, language])

  useEffect(() => {
    if (!isAIMode) return
    if (gameOver) return
    if (isMeasurementBlocking) return
    if (isThinkingRef.current) return
    if (state.turn === config.playerColor) return

    const historyLen = state.history.length
    if (lastAiHistoryLengthRef.current === historyLen) return

    const searchController = new AbortController()
    const timer = window.setTimeout(async () => {
      isThinkingRef.current = true
      setIsThinking(true)
      setAiStage('enumerating')

      try {
        const searchState = engine.exportState()
        const searchSeed = `${hashQuantumState(searchState)}:${config.difficulty}:${searchState.rngCounter}`
        let action = await chooseQuantumAIMoveInWorker(
          searchState,
          engine.getRulesConfig(),
          config.difficulty,
          searchSeed,
          {
            useStockfish: true,
            signal: searchController.signal,
            onStage: setAiStage,
          },
        )

        if (!action || !isActionStillLegal(engine, action)) {
          action = chooseFallbackLegalQAction(engine, `${searchSeed}:fallback`)
        }

        if (!action || !isActionStillLegal(engine, action)) return

        const preMove = cloneQState(engine.exportState())
        const aiColor = preMove.turn
        prepareRng()
        const record = applyQAIAction(engine, action)
        appendReplayAction(action, record)
        lastAiHistoryLengthRef.current = engine.state.history.length
        setEngineError(null)
        applyClassicalMoveRecord(record, preMove, aiColor)
        setSelectedPiece(null)
        setFirstQuantumTarget(null)
        setMoveMode('classical')
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error('Error IA cuántica:', err)
        setEngineError(
          language === 'es'
            ? 'La IA cuántica no pudo calcular una jugada.'
            : 'Quantum AI could not calculate a move.',
        )
      } finally {
        isThinkingRef.current = false
        setIsThinking(false)
      }
    }, 450)

    return () => {
      window.clearTimeout(timer)
      searchController.abort()
      isThinkingRef.current = false
      setIsThinking(false)
    }
  }, [
    boardVersion,
    isAIMode,
    gameOver,
    config.playerColor,
    engine,
    refresh,
    sounds,
    playCheckIfNeeded,
    language,
    state.history.length,
    state.turn,
    isMeasurementBlocking,
    config.difficulty,
    applyClassicalMoveRecord,
    appendReplayAction,
    aiRetryToken,
    prepareRng,
  ])

  const retryAIMove = useCallback(() => {
    if (!isAIMode || gameOver || isThinkingRef.current) return
    lastAiHistoryLengthRef.current = -1
    setEngineError(null)
    setAiRetryToken((value) => value + 1)
  }, [gameOver, isAIMode])

  const undo = useCallback(() => {
    if (capturePending) return
    if (isMeasurementBlocking) return
    if (isThinkingRef.current) return
    if (isAIMode && state.turn !== config.playerColor) return
    if (isOnline || undoStackRef.current.length === 0) return
    const entry = undoStackRef.current.pop()
    if (!entry) return

    engine.loadState(cloneQState(entry.state))
    replaySnapshotsRef.current = replaySnapshotsRef.current.slice(0, engine.state.history.length + 1)
    replayActionsRef.current = replayActionsRef.current.slice(0, engine.state.history.length)
    setSelectedPiece(null)
    setFirstQuantumTarget(null)
    setMoveMode(entry.moveMode)
    setLastMove(entry.lastMove)
    setGameOverInfo(entry.gameOverInfo)
    setMeasurementEvent(null)
    setPromotionPending(null)
    setCapturePending(null)
    setUndoDepth(undoStackRef.current.length)
    setBoardVersion(v => v + 1)
  }, [capturePending, config.playerColor, engine, isAIMode, isMeasurementBlocking, isOnline, state.turn])

  const handleSquareClick = useCallback((sq: string) => {
    if (capturePending) return
    if (gameOver) return
    if (isMeasurementBlocking) return
    if (isThinkingRef.current) return
    if (isAIMode && state.turn !== config.playerColor) return
    if (isOnline && (canMoveRef.current ? !canMoveRef.current() : state.turn !== config.playerColor)) return
    const allowedColor = state.turn

    const cellsOnSquare = board[sq] || []
    const myPiece = cellsOnSquare.find(c => c.color === allowedColor)

    if (firstQuantumTarget && selectedPiece) {
      if (legalTargets.has(sq)) {
        pushUndoSnapshot()
        prepareRng()
        const action = {
          kind: 'quantum' as const,
          pieceId: selectedPiece.id,
          from: selectedPiece.square,
          toA: firstQuantumTarget,
          toB: sq,
        }
        const record = engine.doQuantumMove(action.pieceId, action.from, action.toA, action.toB)
        appendReplayAction(action, record)
        sounds.playSplit()
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
          pushUndoSnapshot()
          prepareRng()
          const action = {
            kind: 'merge' as const,
            pieceId: selectedPiece.id,
            from: selectedPiece.square,
            to: sq,
          }
          const record = engine.doMergeFrom(action.pieceId, action.from, action.to)
          appendReplayAction(action, record)
          sounds.playMerge()
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

        const action = { pieceId: selectedPiece.id, from: selectedPiece.square, to: sq }
        if (queueComplexCapture(action)) return
        executeClassicalAction(action)
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
    board, engine, firstQuantumTarget, gameOver,
    legalTargets, moveMode, prepareRng, pushUndoSnapshot, refresh, selectedPiece, sounds, state.turn, isOnline, isAIMode, isMeasurementBlocking, config.playerColor,
    appendReplayAction, capturePending, executeClassicalAction, queueComplexCapture,
  ])

  const handleDrop = useCallback((from: string, to: string) => {
    if (capturePending) return
    if (gameOver) return
    if (isMeasurementBlocking) return
    if (isThinkingRef.current) return
    if (isAIMode && state.turn !== config.playerColor) return
    if (isOnline && (canMoveRef.current ? !canMoveRef.current() : state.turn !== config.playerColor)) return
    if (moveMode !== 'classical') return
    const allowedColor = state.turn

    const cellsOnFrom = board[from] || []
    const myPiece = cellsOnFrom.find(c => c.color === allowedColor)
    if (!myPiece) return

    const moves = engine.getLegalMoves(myPiece.pieceId, from)
    const draggedPiece = engine.getPiece(myPiece.pieceId)
    const promotion: PieceType | undefined = draggedPiece?.type === 'p' && (to[1] === '1' || to[1] === '8')
      ? 'q'
      : undefined
    if (!moves.some(m => m.square === to) || !engine.isActionWithinCoherence({
      kind: 'classical', pieceId: myPiece.pieceId, from, to, promotion,
    })) return

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

    const action = { pieceId: myPiece.pieceId, from, to, promotion }
    if (queueComplexCapture(action)) return
    executeClassicalAction(action)
  }, [board, capturePending, engine, gameOver, moveMode, state.turn, isOnline, isAIMode, isMeasurementBlocking, config.playerColor, executeClassicalAction, queueComplexCapture])

  const handlePromotion = useCallback((pieceType: string) => {
    if (capturePending) return
    if (!promotionPending) return
    if (isMeasurementBlocking) return
    if (isThinkingRef.current) return
    if (isAIMode && state.turn !== config.playerColor) return
    const action = {
      pieceId: promotionPending.pieceId,
      from: promotionPending.from,
      to: promotionPending.to,
      promotion: pieceType as PieceType,
    }
    if (queueComplexCapture(action)) {
      setPromotionPending(null)
      return
    }
    executeClassicalAction(action)
  }, [capturePending, promotionPending, isAIMode, isMeasurementBlocking, state.turn, config.playerColor, executeClassicalAction, queueComplexCapture])

  const doQuantumCastle = useCallback((side: 'k' | 'q') => {
    if (gameOver) return
    if (isMeasurementBlocking) return
    if (isThinkingRef.current) return
    if (isAIMode && state.turn !== config.playerColor) return
    if (isOnline && (canMoveRef.current ? !canMoveRef.current() : state.turn !== config.playerColor)) return
    const allowedColor = state.turn

    pushUndoSnapshot()
    prepareRng()
    const action = { kind: 'quantumCastle' as const, color: allowedColor, side }
    const record = engine.doQuantumCastle(allowedColor, side)
    appendReplayAction(action, record)
    sounds.playSplit()
    setSelectedPiece(null)
    setLastMove(null)
    refresh()
  }, [appendReplayAction, engine, gameOver, isMeasurementBlocking, prepareRng, pushUndoSnapshot, refresh, sounds, state.turn, isOnline, isAIMode, config.playerColor])

  const doClassicalCastle = useCallback((side: 'k' | 'q') => {
    if (gameOver) return
    if (isMeasurementBlocking) return
    if (isThinkingRef.current) return
    if (isAIMode && state.turn !== config.playerColor) return
    if (isOnline && (canMoveRef.current ? !canMoveRef.current() : state.turn !== config.playerColor)) return

    const allowedColor = state.turn
    const rank = allowedColor === 'w' ? '1' : '8'
    const kingId = `${allowedColor}_k`
    const from = `e${rank}`
    const to = side === 'k' ? `g${rank}` : `c${rank}`

    pushUndoSnapshot()
    const preMove = cloneQState(engine.exportState())
    const mover = allowedColor
    prepareRng()
    const record = engine.doClassicalMove(kingId, from, to)
    appendReplayAction({ kind: 'classical', pieceId: kingId, from, to }, record)
    setSelectedPiece(null)
    setFirstQuantumTarget(null)
    setMoveMode('classical')
    setCapturePending(null)
    applyClassicalMoveRecord(record, preMove, mover)
  }, [appendReplayAction, engine, gameOver, prepareRng, pushUndoSnapshot, applyClassicalMoveRecord, state.turn, isOnline, isAIMode, isMeasurementBlocking, config.playerColor])

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
      title: language === 'es' ? 'Rendición' : 'Resignation',
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
  const dismissMeasurement = useCallback(() => {
    finalizeMeasurementReveal()
  }, [finalizeMeasurementReveal])

  return {
    board,
    selectedPiece,
    legalTargets,
    mergeTargets,
    moveMode,
    firstQuantumTarget,
    lastMove,
    boardFlipped,
    isThinking,
    engineError,
    retryAIMove,
    turn,
    gameOver,
    gameOverInfo,
    checkSquare,
    promotionPending: promotionPending ? { from: promotionPending.from, to: promotionPending.to } : null,
    capturePreview: capturePending?.preview ?? null,
    confirmComplexCapture,
    cancelComplexCapture,
    chances,
    history,
    status,
    classicalCastleOptions,
    quantumCastleOptions,
    availableMoveModes,
    measurementEvent,
    isMeasurementBlocking,
    syncRemotePendingMeasurement,
    handleSquareClick,
    handleDrop,
    handlePromotion,
    chooseMoveMode,
    doClassicalCastle,
    doQuantumCastle,
    undo,
    canUndo: !isOnline && undoDepth > 0,
    flip,
    resign,
    handleTimedOut,
    dismissGameOver,
    exportState: () => engine.exportState(),
    dismissMeasurement,
    replaySnapshots: replaySnapshotsRef.current,
    replayActions: replayActionsRef.current,
    playerColor: config.playerColor,
    controlColor: isOnline || isAIMode ? config.playerColor : turn,
    isAIMode,
    isOnline,
    loadQuantumState,
    difficulty: config.difficulty,
    coherence,
  }
}
