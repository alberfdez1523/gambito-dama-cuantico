import type { Difficulty, GameOverInfo, Language, PieceColor, PieceType } from './types'

const PIECE_NAMES: Record<Language, Record<PieceType, string>> = {
  es: {
    p: 'Peón',
    n: 'Caballo',
    b: 'Alfil',
    r: 'Torre',
    q: 'Dama',
    k: 'Rey',
  },
  en: {
    p: 'Pawn',
    n: 'Knight',
    b: 'Bishop',
    r: 'Rook',
    q: 'Queen',
    k: 'King',
  },
}

const TITLE_TRANSLATIONS: Record<string, Record<Language, string>> = {
  'Jaque mate': { es: 'Jaque mate', en: 'Checkmate' },
  'Checkmate': { es: 'Jaque mate', en: 'Checkmate' },
  'Derrota': { es: 'Derrota', en: 'Defeat' },
  'Defeat': { es: 'Derrota', en: 'Defeat' },
  '¡Victoria!': { es: '¡Victoria!', en: 'Victory!' },
  'Victory!': { es: '¡Victoria!', en: 'Victory!' },
  'Tablas': { es: 'Tablas', en: 'Draw' },
  'Draw': { es: 'Tablas', en: 'Draw' },
  'Fin': { es: 'Fin', en: 'Game Over' },
  'Game Over': { es: 'Fin', en: 'Game Over' },
  'Resignación': { es: 'Resignación', en: 'Resignation' },
  'Resignation': { es: 'Resignación', en: 'Resignation' },
  '¡Tiempo agotado!': { es: '¡Tiempo agotado!', en: 'Time Out!' },
  'Time Out!': { es: '¡Tiempo agotado!', en: 'Time Out!' },
  'Tiempo agotado': { es: 'Tiempo agotado', en: 'Time Out' },
  'Time Out': { es: 'Tiempo agotado', en: 'Time Out' },
}

const MESSAGE_TRANSLATIONS: Record<string, Record<Language, string>> = {
  'Ganan negras': { es: 'Ganan negras', en: 'Black wins' },
  'Black wins': { es: 'Ganan negras', en: 'Black wins' },
  'Ganan blancas': { es: 'Ganan blancas', en: 'White wins' },
  'White wins': { es: 'Ganan blancas', en: 'White wins' },
  'La IA te ha dado jaque mate': { es: 'La IA te ha dado jaque mate', en: 'The AI checkmated you' },
  'The AI checkmated you': { es: 'La IA te ha dado jaque mate', en: 'The AI checkmated you' },
  'Has ganado por jaque mate': { es: 'Has ganado por jaque mate', en: 'You won by checkmate' },
  'You won by checkmate': { es: 'Has ganado por jaque mate', en: 'You won by checkmate' },
  'Rey ahogado': { es: 'Rey ahogado', en: 'Stalemate' },
  'Stalemate': { es: 'Rey ahogado', en: 'Stalemate' },
  'Triple repetición': { es: 'Triple repetición', en: 'Threefold repetition' },
  'Threefold repetition': { es: 'Triple repetición', en: 'Threefold repetition' },
  'Material insuficiente': { es: 'Material insuficiente', en: 'Insufficient material' },
  'Insufficient material': { es: 'Material insuficiente', en: 'Insufficient material' },
  'Empate técnico': { es: 'Empate técnico', en: 'Draw' },
  'Draw': { es: 'Empate técnico', en: 'Draw' },
  'Partida terminada': { es: 'Partida terminada', en: 'Game finished' },
  'Game finished': { es: 'Partida terminada', en: 'Game finished' },
  'Has abandonado la partida': { es: 'Has abandonado la partida', en: 'You resigned the game' },
  'You resigned the game': { es: 'Has abandonado la partida', en: 'You resigned the game' },
  'Se te acabó el tiempo': { es: 'Se te acabó el tiempo', en: 'You ran out of time' },
  'You ran out of time': { es: 'Se te acabó el tiempo', en: 'You ran out of time' },
  'La IA se quedó sin tiempo': { es: 'La IA se quedó sin tiempo', en: 'The AI ran out of time' },
  'The AI ran out of time': { es: 'La IA se quedó sin tiempo', en: 'The AI ran out of time' },
  'Ganan negras por tiempo': { es: 'Ganan negras por tiempo', en: 'Black wins on time' },
  'Black wins on time': { es: 'Ganan negras por tiempo', en: 'Black wins on time' },
  'Ganan blancas por tiempo': { es: 'Ganan blancas por tiempo', en: 'White wins on time' },
  'White wins on time': { es: 'Ganan blancas por tiempo', en: 'White wins on time' },
  'Partida terminada por rendición': { es: 'Partida terminada por rendición', en: 'Game ended by resignation' },
  'Game ended by resignation': { es: 'Partida terminada por rendición', en: 'Game ended by resignation' },
  'Rey blanco capturado': { es: 'Rey blanco capturado', en: 'White king captured' },
  'White king captured': { es: 'Rey blanco capturado', en: 'White king captured' },
  'Rey negro capturado': { es: 'Rey negro capturado', en: 'Black king captured' },
  'Black king captured': { es: 'Rey negro capturado', en: 'Black king captured' },
}

const DIFFICULTY_LABELS: Record<Difficulty, Record<Language, string>> = {
  beginner: { es: 'Principiante', en: 'Beginner' },
  easy: { es: 'Fácil', en: 'Easy' },
  medium: { es: 'Medio', en: 'Medium' },
  hard: { es: 'Difícil', en: 'Hard' },
  master: { es: 'Maestro', en: 'Master' },
}

const PIECE_NAME_FROM_LABEL: Record<string, PieceType> = {
  Peón: 'p',
  Pawn: 'p',
  Caballo: 'n',
  Knight: 'n',
  Alfil: 'b',
  Bishop: 'b',
  Torre: 'r',
  Rook: 'r',
  Dama: 'q',
  Queen: 'q',
  Rey: 'k',
  King: 'k',
}

function translateByMap(value: string, language: Language, map: Record<string, Record<Language, string>>) {
  return map[value]?.[language] ?? value
}

function translatePieceLabel(label: string, language: Language) {
  const pieceType = PIECE_NAME_FROM_LABEL[label]
  return pieceType ? PIECE_NAMES[language][pieceType] : label
}

export function getPieceName(pieceType: PieceType, language: Language) {
  return PIECE_NAMES[language][pieceType]
}

export function getDifficultyLabel(difficulty: Difficulty, language: Language) {
  return DIFFICULTY_LABELS[difficulty][language]
}

export function getColorName(color: PieceColor, language: Language) {
  if (language === 'en') return color === 'w' ? 'White' : 'Black'
  return color === 'w' ? 'Blancas' : 'Negras'
}

export function getPlayerLabel(color: PieceColor, language: Language) {
  if (language === 'en') return color === 'w' ? 'White Player' : 'Black Player'
  return color === 'w' ? 'Jugador Blancas' : 'Jugador Negras'
}

export function translateGameOverInfo(info: GameOverInfo, language: Language): GameOverInfo {
  return {
    ...info,
    title: translateByMap(info.title, language, TITLE_TRANSLATIONS),
    message: translateByMap(info.message, language, MESSAGE_TRANSLATIONS),
  }
}

export function translateMoveDescription(description: string, language: Language) {
  if (language === 'es') return description

  const castleMatch = description.match(/^Enroque cuántico (corto|largo) \((.+)\)$/)
  if (castleMatch) {
    return `Quantum ${castleMatch[1] === 'corto' ? 'kingside' : 'queenside'} castling (${castleMatch[2]})`
  }

  const quantumMeasureMatch = description.match(/^⚡ (.+) mide en ([a-h][1-8]) → NO existe$/)
  if (quantumMeasureMatch) {
    return `⚡ ${translatePieceLabel(quantumMeasureMatch[1], language)} measured on ${quantumMeasureMatch[2]} -> not present`
  }

  const quantumSplitMatch = description.match(/^(.+) → ([a-h][1-8]) \| ([a-h][1-8]) \((.+)\)$/)
  if (quantumSplitMatch) {
    return `${translatePieceLabel(quantumSplitMatch[1], language)} -> ${quantumSplitMatch[2]} | ${quantumSplitMatch[3]} (${quantumSplitMatch[4]})`
  }

  const mergeMatch = description.match(/^(.+) fusionado en ([a-h][1-8]) \((.+)\)$/)
  if (mergeMatch) {
    return `${translatePieceLabel(mergeMatch[1], language)} merged on ${mergeMatch[2]} (${mergeMatch[3]})`
  }

  const captureWithMeasurementMatch = description.match(/^⚡ (.+) captura en ([a-h][1-8]) \((atac\.|def\.)(?: (\d+)\/(\d+))?: ([✓✗])\)$/)
  if (captureWithMeasurementMatch) {
    const [, piece, square, target, step, total, icon] = captureWithMeasurementMatch
    const targetLabel = target === 'atac.' ? 'att.' : 'def.'
    const stepLabel = step && total ? ` ${step}/${total}` : ''
    return `⚡ ${translatePieceLabel(piece, language)} captures on ${square} (${targetLabel}${stepLabel}: ${icon})`
  }

  const promotionMatch = description.match(/^Promoción a (.+)$/)
  if (promotionMatch) {
    return `Promotion to ${translatePieceLabel(promotionMatch[1], language)}`
  }

  const captureMatch = description.match(/^(.+) captura en ([a-h][1-8])$/)
  if (captureMatch) {
    return `${translatePieceLabel(captureMatch[1], language)} captures on ${captureMatch[2]}`
  }

  const moveMatch = description.match(/^(.+) a ([a-h][1-8])$/)
  if (moveMatch) {
    return `${translatePieceLabel(moveMatch[1], language)} to ${moveMatch[2]}`
  }

  if (description === 'Enroque corto') return 'Kingside castling'
  if (description === 'Enroque largo') return 'Queenside castling'

  return description
}

// ─── UI strings centralizados ───

export const UI_STRINGS = {
  es: {
    thinking: 'Pensando…',
    quantumThinking: '⚛ Calculando multiverso…',
    yourTurn: 'Tu turno',
    aiTurn: 'Turno de la IA',
    aiThinking: 'La IA está pensando...',
    turnColor: (color: string) => `Turno: ${color}`,
    colorToMove: (color: string) => `${color} mueve`,
    menu: '← Menú',
    settings: 'Ajustes',
    settingsTitle: 'Ajustes',
    theme: 'Tema',
    themeDark: 'Oscuro',
    themeLight: 'Claro',
    language: 'Idioma',
    sfxVolume: 'Efectos de sonido',
    musicVolume: 'Música ambiente',
    close: 'Cerrar',
    undo: 'Deshacer',
    flip: 'Girar',
    resign: 'Rendirse',
    resignConfirmTitle: '¿Rendirse?',
    resignConfirmMessage: 'Abandonarás la partida y contará como derrota.',
    resignConfirm: 'Sí, rendirme',
    cancel: 'Cancelar',
    undoComingSoon: 'Deshacer no disponible en modo cuántico (próximamente)',
    engineError: 'No se pudo conectar con el motor de ajedrez',
    engineErrorRetry: 'Reintentar',
    evalError: 'No se pudo obtener la evaluación de la posición',
    promotion: 'Promoción',
    newGame: 'Nueva partida',
    viewBoard: 'Ver tablero',
    noMovesYet: 'Sin movimientos aún',
    copyMoves: 'Copiar movimientos',
    copyPgn: 'Copiar PGN',
    copied: '¡Copiado!',
    evaluation: 'Evaluación',
    quantumEvalLabel: 'Probabilidad estimada (heurística)',
    classicModeBadge: (diff: string) => `Clásico · ${diff}`,
    classic2P: 'Clásico · 2 jugadores',
    quantumBadge: 'Cuántico · 2 jugadores',
    moveTypes: 'Tipo de jugada',
    modeClassical: 'Clásico',
    modeQuantum: 'Cuántico',
    modeMerge: 'Fusión',
    modeClassicalDesc: 'Movimiento normal.',
    modeQuantumDesc: 'Divide la pieza en 2 destinos.',
    modeMergeDesc: 'Une dos estados en uno.',
    castleShort: (side: 'k' | 'q') => `♜ Enroque ${side === 'k' ? 'corto' : 'largo'}`,
    quantumCastle: (side: 'k' | 'q') => `⚛ Enroque ${side === 'k' ? 'corto' : 'largo'} cuántico`,
    loadingRules: 'Cargando reglas…',
    you: 'Tú',
    pause: 'Pausar',
    play: 'Reproducir',
    squareLabel: (sq: string, piece: string, extra: string) =>
      `${sq}, ${piece}${extra ? `, ${extra}` : ''}`,
    legalMove: 'movimiento legal',
    selected: 'seleccionada',
    check: 'jaque',
    lastMoveFrom: 'último movimiento desde aquí',
    lastMoveTo: 'último movimiento aquí',
    boardAriaLabel: 'Tablero de ajedrez',
    liveRegionLabel: 'Estado de la partida',
    quantumMeasurement: 'Medición cuántica',
    opponentTurn: 'Turno del rival',
    online: 'En línea',
    onlineTitle: 'Multijugador en línea',
    onlineSubtitle: 'Crea una sala o únete con un código',
    onlineCreateRoom: 'Crear sala',
    onlineJoinRoom: 'Unirse a sala',
    onlineCreateHint: 'Obtendrás un código para compartir con tu rival',
    onlineRoomCode: 'Código de sala',
    onlineWaitingOpponent: 'Esperando al rival…',
    onlineBothConnected: 'Rival conectado. Iniciando…',
    onlineCopyLink: 'Copiar enlace de invitación',
    onlineStartGame: 'Empezar partida',
    onlineConnecting: 'Conectando…',
    onlineError: 'Error de conexión',
    onlineRoomNotFound: 'Sala no encontrada',
    onlineRoomFull: 'La sala está llena',
    onlineRoomFinished: 'La partida ya terminó',
    onlineNotConfigured: 'Multijugador no configurado',
    onlineNotConfiguredHint:
      'Añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver frontend/.env.example y supabase/migrations).',
    onlineBadge: 'En línea · 2 jugadores',
    onlineOpponentLeftTitle: 'Partida cerrada',
    onlineOpponentLeftMessage: 'Tu rival ha abandonado la partida o se ha desconectado.',
    gameMode: 'Modo de juego',
  },
  en: {
    thinking: 'Thinking…',
    quantumThinking: '⚛ Calculating multiverse…',
    yourTurn: 'Your turn',
    aiTurn: 'AI turn',
    aiThinking: 'The AI is thinking...',
    turnColor: (color: string) => `${color} to move`,
    colorToMove: (color: string) => `${color} to move`,
    menu: '← Menu',
    settings: 'Settings',
    settingsTitle: 'Settings',
    theme: 'Theme',
    themeDark: 'Dark',
    themeLight: 'Light',
    language: 'Language',
    sfxVolume: 'Sound effects',
    musicVolume: 'Ambient music',
    close: 'Close',
    undo: 'Undo',
    flip: 'Flip',
    resign: 'Resign',
    resignConfirmTitle: 'Resign?',
    resignConfirmMessage: 'You will abandon the game and it will count as a loss.',
    resignConfirm: 'Yes, resign',
    cancel: 'Cancel',
    undoComingSoon: 'Undo not available in quantum mode (coming soon)',
    engineError: 'Could not connect to the chess engine',
    engineErrorRetry: 'Retry',
    evalError: 'Could not fetch position evaluation',
    promotion: 'Promotion',
    newGame: 'New game',
    viewBoard: 'View board',
    noMovesYet: 'No moves yet',
    copyMoves: 'Copy moves',
    copyPgn: 'Copy PGN',
    copied: 'Copied!',
    evaluation: 'Evaluation',
    quantumEvalLabel: 'Estimated probability (heuristic)',
    classicModeBadge: (diff: string) => `Classic · ${diff}`,
    classic2P: 'Classic · 2 players',
    quantumBadge: 'Quantum · 2 players',
    moveTypes: 'Move type',
    modeClassical: 'Classic',
    modeQuantum: 'Quantum',
    modeMerge: 'Merge',
    modeClassicalDesc: 'Normal move.',
    modeQuantumDesc: 'Split piece into 2 targets.',
    modeMergeDesc: 'Combine two states into one.',
    castleShort: (side: 'k' | 'q') => `♜ ${side === 'k' ? 'Kingside' : 'Queenside'} castling`,
    quantumCastle: (side: 'k' | 'q') => `⚛ Quantum ${side === 'k' ? 'kingside' : 'queenside'} castling`,
    loadingRules: 'Loading rules…',
    you: 'You',
    pause: 'Pause',
    play: 'Play',
    squareLabel: (sq: string, piece: string, extra: string) =>
      `${sq}, ${piece}${extra ? `, ${extra}` : ''}`,
    legalMove: 'legal move',
    selected: 'selected',
    check: 'check',
    lastMoveFrom: 'last move from here',
    lastMoveTo: 'last move here',
    boardAriaLabel: 'Chess board',
    liveRegionLabel: 'Game status',
    quantumMeasurement: 'Quantum measurement',
    opponentTurn: "Opponent's turn",
    online: 'Online',
    onlineTitle: 'Online multiplayer',
    onlineSubtitle: 'Create a room or join with a code',
    onlineCreateRoom: 'Create room',
    onlineJoinRoom: 'Join room',
    onlineCreateHint: 'You will get a code to share with your opponent',
    onlineRoomCode: 'Room code',
    onlineWaitingOpponent: 'Waiting for opponent…',
    onlineBothConnected: 'Opponent connected. Starting…',
    onlineCopyLink: 'Copy invite link',
    onlineStartGame: 'Start game',
    onlineConnecting: 'Connecting…',
    onlineError: 'Connection error',
    onlineRoomNotFound: 'Room not found',
    onlineRoomFull: 'Room is full',
    onlineRoomFinished: 'Game already finished',
    onlineNotConfigured: 'Multiplayer not configured',
    onlineNotConfiguredHint:
      'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see frontend/.env.example and supabase/migrations).',
    onlineBadge: 'Online · 2 players',
    onlineOpponentLeftTitle: 'Game closed',
    onlineOpponentLeftMessage: 'Your opponent left the game or disconnected.',
    gameMode: 'Game mode',
  },
} as const

export type UIStringKey = keyof typeof UI_STRINGS.es

export function ui(language: Language) {
  return UI_STRINGS[language]
}