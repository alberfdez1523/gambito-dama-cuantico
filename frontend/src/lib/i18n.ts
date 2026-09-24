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
  'Rendición': { es: 'Rendición', en: 'Resignation' },
  'Resignation': { es: 'Rendición', en: 'Resignation' },
  'Resignación': { es: 'Rendición', en: 'Resignation' },
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
  return color === 'w' ? 'Jugador de las blancas' : 'Jugador de las negras'
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

  const mergeMatch = description.match(/^(.+) fusionad[oa] en ([a-h][1-8]) \((.+)\)$/)
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
    joinMyRoom: (code: string) => `Únete a mi sala ${code}`,
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
    resignConfirmMessage: 'Si te rindes, la partida contará como derrota.',
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
    measurementPending: 'Medición pendiente — espera a que tu rival gire la ruleta.',
    measurementCanMove: 'Tu rival cerró la medición. Ya puedes mover.',
    opponentTurn: 'Turno del rival',
    online: 'En línea',
    onlineTitle: 'Multijugador en línea',
    onlineSubtitle: 'Crea una sala o únete con un código',
    onlineCreateRoom: 'Crear sala',
    onlineJoinRoom: 'Unirse a sala',
    onlineCreateHint: 'Obtendrás un código para compartir con tu rival',
    onlineRoomCode: 'Código de sala',
    onlineWaitingOpponent: 'Esperando al rival…',
    onlineBothConnected: 'Rival conectado. El anfitrión puede empezar.',
    onlineCopyLink: 'Copiar enlace de invitación',
    onlineStartGame: 'Empezar partida',
    onlineConnecting: 'Conectando…',
    onlineError: 'Error de conexión',
    onlineRoomNotFound: 'Sala no encontrada',
    onlineRoomFull: 'La sala está llena',
    onlineRoomFinished: 'La partida ya terminó',
    onlineNotConfigured: 'Multijugador no configurado',
    onlineNotConfiguredHint:
      'Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu entorno privado para activar el multijugador.',
    onlineBadge: 'En línea · 2 jugadores',
    onlineBetaBadge: 'Beta',
    onlineBetaNotice:
      'El multijugador en línea está en fase beta. Pueden aparecer desincronizaciones o cortes; estamos mejorándolo.',
    onlineBetaTitle: 'Multijugador en línea',
    onlineConnected: 'Rival conectado',
    onlineReconnecting: 'Rival reconectando',
    onlineSyncing: 'Sincronizando',
    onlineStatusConnecting: 'Conectando sala',
    onlineStatusWaiting: 'Esperando rival',
    onlineStatusSynced: 'Sincronizado',
    onlineStatusReconnecting: 'Reconectando',
    onlineStatusConflict: 'Conflicto de sincronización',
    onlineStatusEnded: 'Sala cerrada',
    quantumUndoReady: 'Deshacer local disponible',
    quantumUndoOnlineDisabled: 'Deshacer bloqueado en online para evitar conflictos',
    onlineOpponentLeftTitle: 'Partida cerrada',
    onlineOpponentLeftMessage: 'Tu rival ha abandonado la partida o se ha desconectado.',
    onlineOpponentLeftHint:
      'Pulsa Menú para cerrar la sala. Si no lo haces, se eliminará sola tras 15 minutos sin actividad.',
    gameMode: 'Modo de juego',
    quantumMode: ' | Modo Cuántico',
    openingRoom: 'Abriendo sala...',
    openingAcademy: 'Abriendo la Academia...',
    preparingActivity: 'Preparando actividad...',
    loadingProfile: 'Cargando perfil...',
    loadingGame: 'Cargando partida...',
    gameHub: 'Centro de juego',
    inviteCopyFailed: 'No se pudo copiar la invitación.',
    roomSummary: 'Resumen de sala',
    summary: 'Resumen',
    clock: 'Reloj',
    noClock: 'Sin reloj',
    color: 'Color',
    random: 'Aleatorio',
    white: 'Blancas',
    black: 'Negras',
    multiplayerBetaNotice: 'El multijugador permanece en beta casual mientras se completa la validación autoritativa del servidor.',
    shareInvitation: 'Compartir invitación',
    players: 'Jugadores',
    guest: 'Invitado',
    waiting: 'Esperando',
    connected: 'Conectado',
    disconnected: 'Desconectado',
    tryReconnecting: 'Intentar reconectar',
    branches: 'ramas',
    empty: 'vacía',
    mergeTarget: 'fusión posible',
    opponent: 'Rival',
    toMove: 'Mueve',
    boardResyncedWithServer: 'Tablero resincronizado con el servidor.',
    syncError: 'Error de sincronización: ',
    reconnect: 'Reconectar',
    openGameInspector: 'Abrir inspector de partida',
    gameInspector: 'Inspector de partida',
    game: 'Partida',
    history: 'Historial',
    analysis: 'Análisis',
    currentState: 'Estado actual',
    undoUnavailableOnline: 'Deshacer no está disponible en partidas en línea.',
    evalPerspectiveHint: 'La evaluación compara la posición actual desde tu color.',
    quantumAi: 'IA cuántica',
    coherenceUsed: 'Coherencia usada',
    measurementSpinHint: 'Medición en curso — gira la ruleta para revelar el movimiento.',
    measurementShareHint: 'Medición en curso. Comparte la revelación con tu rival.',
    quantumAiMoveFailed: 'La IA cuántica no pudo completar la jugada.',
    quantumStateResynced: 'Estado cuántico resincronizado con el servidor.',
    limitedCoherence: 'Coherencia limitada',
    openQuantumInspector: 'Abrir inspector cuántico',
    quantumInspector: 'Inspector cuántico',
    coherenceCostHint: 'Cada rama adicional y túnel activo ocupa una unidad. Fusionar o colapsar la libera.',
    selection: 'Selección',
    branchesPlural: 'rama(s)',
    selectPieceToInspect: 'Selecciona una pieza para inspeccionar todas sus ramas.',
    expectedMaterialHint: 'Balance material esperado, ponderado por la probabilidad de cada rama. No es una probabilidad de victoria.',
    primaryNavigation: 'Navegación principal',
    routeSelector: 'Selector de ruta',
    draw: 'Tablas',
    victory: '¡Victoria!',
    defeat: 'Derrota',
    measurementSpinTheRoulette: 'Medición — gira la ruleta',
    aiEnumeratingActions: 'IA enumerando acciones…',
    aiComparingReplies: 'IA comparando respuestas…',
    aiCheckingVariations: 'IA verificando variantes…',
    aiPreparingMove: 'IA preparando jugada…',
    quantumAiCalcFailed: 'La IA cuántica no pudo calcular una jugada.',
    resignation: 'Rendición',
    gameEndedByResignation: 'Partida terminada por rendición',
    timeOut: 'Tiempo agotado',
    blackWinsOnTime: 'Ganan negras por tiempo',
    whiteWinsOnTime: 'Ganan blancas por tiempo',
    kingsideCastling: 'Enroque corto',
    queensideCastling: 'Enroque largo',
    checkmate: 'Jaque mate',
    blackWins: 'Ganan negras',
    whiteWins: 'Ganan blancas',
    aiCheckmatedYou: 'La IA te ha dado jaque mate',
    youWonByCheckmate: 'Has ganado por jaque mate',
    stalemate: 'Rey ahogado',
    threefoldRepetition: 'Triple repetición',
    insufficientMaterial: 'Material insuficiente',
    technicalDraw: 'Empate técnico',
    gameOver: 'Fin',
    gameFinished: 'Partida terminada',
    youResignedTheGame: 'Has abandonado la partida',
    timeOutExclaimed: '¡Tiempo agotado!',
    youRanOutOfTime: 'Se te acabó el tiempo',
    aiRanOutOfTime: 'La IA se quedó sin tiempo',
  },
  en: {
    thinking: 'Thinking…',
    quantumThinking: '⚛ Calculating multiverse…',
    yourTurn: 'Your turn',
    aiTurn: "AI's turn",
    joinMyRoom: (code: string) => `Join my room ${code}`,
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
    measurementPending: 'Measurement pending — wait for your opponent to spin the roulette.',
    measurementCanMove: 'Your opponent closed the measurement. You can move now.',
    opponentTurn: "Opponent's turn",
    online: 'Online',
    onlineTitle: 'Online multiplayer',
    onlineSubtitle: 'Create a room or join with a code',
    onlineCreateRoom: 'Create room',
    onlineJoinRoom: 'Join room',
    onlineCreateHint: 'You will get a code to share with your opponent',
    onlineRoomCode: 'Room code',
    onlineWaitingOpponent: 'Waiting for opponent…',
    onlineBothConnected: 'Opponent connected. Host can start.',
    onlineCopyLink: 'Copy invite link',
    onlineStartGame: 'Start game',
    onlineConnecting: 'Connecting…',
    onlineError: 'Connection error',
    onlineRoomNotFound: 'Room not found',
    onlineRoomFull: 'Room is full',
    onlineRoomFinished: 'Game already finished',
    onlineNotConfigured: 'Multiplayer not configured',
    onlineNotConfiguredHint:
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your private environment to enable multiplayer.',
    onlineBadge: 'Online · 2 players',
    onlineBetaBadge: 'Beta',
    onlineBetaNotice:
      'Online multiplayer is in beta. You may see sync issues or disconnects; we are actively improving it.',
    onlineBetaTitle: 'Online multiplayer',
    onlineConnected: 'Opponent connected',
    onlineReconnecting: 'Opponent reconnecting',
    onlineSyncing: 'Syncing',
    onlineStatusConnecting: 'Connecting room',
    onlineStatusWaiting: 'Waiting for opponent',
    onlineStatusSynced: 'Synced',
    onlineStatusReconnecting: 'Reconnecting',
    onlineStatusConflict: 'Sync conflict',
    onlineStatusEnded: 'Room closed',
    quantumUndoReady: 'Local undo available',
    quantumUndoOnlineDisabled: 'Undo is blocked online to avoid conflicts',
    onlineOpponentLeftTitle: 'Game closed',
    onlineOpponentLeftMessage: 'Your opponent left the game or disconnected.',
    onlineOpponentLeftHint:
      'Press Menu to close the room. Otherwise it is removed automatically after 15 minutes of inactivity.',
    gameMode: 'Game mode',
    quantumMode: ' | Quantum Mode',
    openingRoom: 'Opening room...',
    openingAcademy: 'Opening Academy...',
    preparingActivity: 'Preparing activity...',
    loadingProfile: 'Loading profile...',
    loadingGame: 'Loading game...',
    gameHub: 'Game hub',
    inviteCopyFailed: 'The invitation could not be copied.',
    roomSummary: 'Room summary',
    summary: 'Summary',
    clock: 'Clock',
    noClock: 'No clock',
    color: 'Color',
    random: 'Random',
    white: 'White',
    black: 'Black',
    multiplayerBetaNotice: 'Multiplayer remains in casual beta while server-authoritative validation is completed.',
    shareInvitation: 'Share invitation',
    players: 'Players',
    guest: 'Guest',
    waiting: 'Waiting',
    connected: 'Connected',
    disconnected: 'Disconnected',
    tryReconnecting: 'Try reconnecting',
    branches: 'branches',
    empty: 'empty',
    mergeTarget: 'merge target',
    opponent: 'Opponent',
    toMove: 'To move',
    boardResyncedWithServer: 'Board resynced with server.',
    syncError: 'Sync error: ',
    reconnect: 'Reconnect',
    openGameInspector: 'Open game inspector',
    gameInspector: 'Game inspector',
    game: 'Game',
    history: 'History',
    analysis: 'Analysis',
    currentState: 'Current state',
    undoUnavailableOnline: 'Undo is unavailable in online games.',
    evalPerspectiveHint: 'The evaluation compares the current position from your colour.',
    quantumAi: 'Quantum AI',
    coherenceUsed: 'Coherence used',
    measurementSpinHint: 'Measurement in progress — spin the roulette to reveal the move.',
    measurementShareHint: 'Measurement in progress. Share the reveal with your opponent.',
    quantumAiMoveFailed: 'Quantum AI could not complete its move.',
    quantumStateResynced: 'Quantum state resynced with the server.',
    limitedCoherence: 'Limited coherence',
    openQuantumInspector: 'Open quantum inspector',
    quantumInspector: 'Quantum inspector',
    coherenceCostHint: 'Each extra branch and active tunnel uses one unit. Merging or collapsing releases it.',
    selection: 'Selection',
    branchesPlural: 'branch(es)',
    selectPieceToInspect: 'Select a piece to inspect all of its branches.',
    expectedMaterialHint: 'Expected material balance weighted by each branch probability. It is not a win probability.',
    primaryNavigation: 'Primary navigation',
    routeSelector: 'Route selector',
    draw: 'Draw',
    victory: 'Victory!',
    defeat: 'Defeat',
    measurementSpinTheRoulette: 'Measurement — spin the roulette',
    aiEnumeratingActions: 'AI enumerating actions…',
    aiComparingReplies: 'AI comparing replies…',
    aiCheckingVariations: 'AI checking variations…',
    aiPreparingMove: 'AI preparing move…',
    quantumAiCalcFailed: 'Quantum AI could not calculate a move.',
    resignation: 'Resignation',
    gameEndedByResignation: 'Game ended by resignation',
    timeOut: 'Time Out',
    blackWinsOnTime: 'Black wins on time',
    whiteWinsOnTime: 'White wins on time',
    kingsideCastling: 'Kingside castling',
    queensideCastling: 'Queenside castling',
    checkmate: 'Checkmate',
    blackWins: 'Black wins',
    whiteWins: 'White wins',
    aiCheckmatedYou: 'The AI checkmated you',
    youWonByCheckmate: 'You won by checkmate',
    stalemate: 'Stalemate',
    threefoldRepetition: 'Threefold repetition',
    insufficientMaterial: 'Insufficient material',
    technicalDraw: 'Draw',
    gameOver: 'Game Over',
    gameFinished: 'Game finished',
    youResignedTheGame: 'You resigned the game',
    timeOutExclaimed: 'Time Out!',
    youRanOutOfTime: 'You ran out of time',
    aiRanOutOfTime: 'The AI ran out of time',
  },
} as const

export type UIStringKey = keyof typeof UI_STRINGS.es

export function ui(language: Language) {
  return UI_STRINGS[language]
}
