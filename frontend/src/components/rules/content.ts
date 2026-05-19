import type { CaptureScenario, PieceGuideEntry, RuleDefinition } from './types'
import { makeGrid, placeMiniSquare } from './miniBoardUtils'

export function getCategoryLabels(es: boolean): Record<string, string> {
  return {
    intro: es ? 'Conceptos básicos' : 'Core concepts',
    movement: es ? 'Movimiento' : 'Movement',
    captures: es ? 'Capturas y medición' : 'Captures & measurement',
    special: es ? 'Reglas especiales' : 'Special rules',
    endgame: es ? 'Fin de partida' : 'Game end',
  }
}

export function getClassicRules(es: boolean): RuleDefinition[] {
  return [
    {
      id: 'classic-objective',
      category: 'intro',
      icon: '♔',
      title: es ? 'Objetivo de la partida' : 'Game objective',
      summary: es
        ? 'Dar jaque mate al rey enemigo: amenazarlo sin escape legal.'
        : 'Checkmate the enemy king: threaten it with no legal escape.',
      desc: es
        ? 'El ajedrez es un duelo por el control del tablero. Ganas cuando el rey rival queda en jaque mate. Puedes ganar también si el rival abandona o se queda sin tiempo (si hay reloj).'
        : 'Chess is a duel for board control. You win when the enemy king is checkmated. You can also win if the opponent resigns or runs out of time (with a clock).',
      bullets: es
        ? ['Jaque: el rey está amenazado', 'Jaque mate: no hay movimiento legal que lo salve', 'Tablas: ningún bando puede forzar victoria']
        : ['Check: the king is threatened', 'Checkmate: no legal move saves the king', 'Draw: neither side can force a win'],
      steps: [
        {
          caption: es ? 'El rey blanco está en jaque' : 'The white king is in check',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 0, 4, { piece: '♚', highlight: 'check' })
            placeMiniSquare(g, 2, 4, { piece: '♖' })
            return g
          })(),
        },
        {
          caption: es ? 'Sin escape → jaque mate' : 'No escape → checkmate',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 0, 4, { piece: '♚', highlight: 'check' })
            placeMiniSquare(g, 2, 4, { piece: '♖' })
            placeMiniSquare(g, 2, 2, { piece: '♕' })
            placeMiniSquare(g, 1, 3, { highlight: 'blocked' })
            placeMiniSquare(g, 1, 4, { highlight: 'blocked' })
            return g
          })(),
        },
      ],
    },
    {
      id: 'classic-pieces',
      category: 'movement',
      icon: '♞',
      title: es ? 'Movimiento de piezas' : 'Piece movement',
      summary: es
        ? 'Cada pieza tiene su propio patrón; explora la guía interactiva más abajo.'
        : 'Each piece has its own pattern; explore the interactive guide below.',
      desc: es
        ? 'Las piezas no se mueven todas igual. El peón avanza (y captura en diagonal), las piezas mayores recorren líneas rectas o diagonales, y el caballo salta en forma de L sin ser bloqueado por piezas intermedias.'
        : 'Pieces do not all move the same way. Pawns advance (and capture diagonally), major pieces move along ranks/files or diagonals, and the knight jumps in an L-shape without being blocked.',
      tip: es
        ? 'En la partida, toca una pieza para ver sus casillas legales resaltadas.'
        : 'In a game, tap a piece to see its legal squares highlighted.',
      board: (() => {
        const g = makeGrid(5, 5)
        placeMiniSquare(g, 2, 2, { piece: '♞', highlight: 'selected' })
        for (const [r, c] of [
          [0, 1], [0, 3], [1, 0], [1, 4], [3, 0], [3, 4], [4, 1], [4, 3],
        ]) {
          placeMiniSquare(g, r, c, { highlight: 'target' })
        }
        return g
      })(),
    },
    {
      id: 'classic-check',
      category: 'movement',
      icon: '♚',
      title: es ? 'Jaque y jaque mate' : 'Check and checkmate',
      summary: es
        ? 'En jaque debes salvar al rey: moverlo, bloquear o capturar.'
        : 'In check you must save the king: move, block, or capture.',
      desc: es
        ? 'No puedes dejar tu rey en jaque ni hacer un movimiento que lo exponga. Si el rey está amenazado y no hay respuesta legal, la partida termina en jaque mate.'
        : 'You cannot leave your king in check or make a move that exposes it. If the king is threatened and there is no legal response, the game ends in checkmate.',
      bullets: es
        ? ['Bloquear: interponer una pieza en la línea de ataque', 'Capturar: tomar la pieza que da jaque', 'Mover el rey a una casilla segura']
        : ['Block: place a piece on the attack line', 'Capture: take the checking piece', 'Move the king to a safe square'],
      steps: [
        {
          caption: es ? '1. Jaque con torre' : '1. Check by rook',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 0, 4, { piece: '♚', highlight: 'check' })
            placeMiniSquare(g, 2, 4, { piece: '♖' })
            return g
          })(),
        },
        {
          caption: es ? '2. Bloqueo posible en la columna' : '2. Possible block on the file',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 0, 4, { piece: '♚', highlight: 'check' })
            placeMiniSquare(g, 2, 4, { piece: '♖' })
            placeMiniSquare(g, 1, 4, { piece: '♟', highlight: 'target' })
            return g
          })(),
        },
        {
          caption: es ? '3. Sin bloqueo → mate con dama' : '3. No block → mate with queen',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 0, 4, { piece: '♚', highlight: 'check' })
            placeMiniSquare(g, 2, 4, { piece: '♖' })
            placeMiniSquare(g, 2, 2, { piece: '♕' })
            return g
          })(),
        },
      ],
    },
    {
      id: 'classic-castle',
      category: 'special',
      icon: '♜',
      title: es ? 'Enroque' : 'Castling',
      summary: es
        ? 'Mueve rey y torre a la vez para proteger al rey.'
        : 'Moves king and rook together to shelter the king.',
      desc: es
        ? 'El rey avanza dos casillas hacia una torre y la torre salta al lado opuesto. Requisitos: ninguno se ha movido antes, no hay piezas entre ellos, el rey no está en jaque ni pasa por casillas atacadas.'
        : 'The king moves two squares toward a rook and the rook jumps to the king\'s other side. Requirements: neither has moved, no pieces between them, the king is not in check and does not pass through attacked squares.',
      steps: [
        {
          caption: es ? 'Posición inicial' : 'Starting position',
          board: (() => {
            const g = makeGrid(2, 5)
            placeMiniSquare(g, 1, 0, { piece: '♜' })
            placeMiniSquare(g, 1, 2, { piece: '♚', highlight: 'selected' })
            placeMiniSquare(g, 1, 4, { piece: '♜' })
            return g
          })(),
        },
        {
          caption: es ? 'Enroque corto (lado de rey)' : 'Kingside castling',
          board: (() => {
            const g = makeGrid(2, 5)
            placeMiniSquare(g, 1, 0, { piece: '♜' })
            placeMiniSquare(g, 1, 1, { highlight: 'target' })
            placeMiniSquare(g, 1, 3, { piece: '♚', highlight: 'selected' })
            placeMiniSquare(g, 1, 2, { piece: '♜', highlight: 'target', label: '→' })
            return g
          })(),
        },
      ],
    },
    {
      id: 'classic-promotion',
      category: 'special',
      icon: '♟',
      title: es ? 'Promoción del peón' : 'Pawn promotion',
      summary: es
        ? 'Al llegar a la última fila, el peón se convierte en dama, torre, alfil o caballo.'
        : 'Reaching the last rank, the pawn becomes queen, rook, bishop, or knight.',
      desc: es
        ? 'Casi siempre se elige dama por ser la pieza más fuerte, pero en finales técnicos a veces conviene una torre o caballo para evitar tablas o dar mate.'
        : 'Queen is almost always chosen as the strongest piece, but in technical endgames a rook or knight is sometimes better to avoid draws or deliver mate.',
      steps: [
        {
          caption: es ? 'Peón a un paso de promocionar' : 'Pawn one step from promotion',
          board: (() => {
            const g = makeGrid(3, 4)
            placeMiniSquare(g, 1, 1, { piece: '♟', highlight: 'selected' })
            placeMiniSquare(g, 0, 1, { highlight: 'target' })
            return g
          })(),
        },
        {
          caption: es ? 'Elige tu nueva pieza' : 'Choose your new piece',
          board: (() => {
            const g = makeGrid(3, 5)
            placeMiniSquare(g, 0, 2, { piece: '♛', highlight: 'selected', label: '♛' })
            placeMiniSquare(g, 0, 0, { piece: '♜', label: '♜' })
            placeMiniSquare(g, 0, 1, { piece: '♝', label: '♝' })
            placeMiniSquare(g, 0, 3, { piece: '♞', label: '♞' })
            return g
          })(),
        },
      ],
    },
    {
      id: 'classic-draw',
      category: 'endgame',
      icon: '½',
      title: es ? 'Tablas' : 'Draw',
      summary: es
        ? 'La partida puede terminar sin ganador por varias reglas.'
        : 'The game can end with no winner under several rules.',
      desc: es
        ? 'Las tablas equilibran partidas donde nadie puede forzar victoria. Conoce los casos más habituales para no perder ventajas por desconocimiento.'
        : 'Draws balance games where neither side can force a win. Know the common cases so you do not throw away advantages.',
      bullets: es
        ? [
            'Ahogado: sin movimientos legales y sin jaque',
            'Triple repetición de posición',
            'Material insuficiente (ej. rey vs rey)',
            'Regla de los 50 movimientos sin captura ni peón',
          ]
        : [
            'Stalemate: no legal moves and not in check',
            'Threefold repetition of position',
            'Insufficient material (e.g. king vs king)',
            '50-move rule without capture or pawn move',
          ],
      board: (() => {
        const g = makeGrid(3, 3)
        placeMiniSquare(g, 0, 0, { piece: '♚' })
        placeMiniSquare(g, 2, 2, { piece: '♔' })
        placeMiniSquare(g, 1, 2, { piece: '♕' })
        return g
      })(),
    },
  ]
}

export function getQuantumRules(es: boolean): RuleDefinition[] {
  return [
    {
      id: 'quantum-intro',
      category: 'intro',
      icon: '⚛',
      title: es ? '¿Qué añade el modo cuántico?' : 'What does quantum mode add?',
      summary: es
        ? 'Las piezas pueden existir en dos casillas a la vez (50% + 50%) hasta que se miden.'
        : 'Pieces can exist on two squares at once (50% + 50%) until measured.',
      color: 'text-indigo-300',
      bgColor: 'bg-indigo-500/10 border-indigo-500/20',
      desc: es
        ? 'Parte del ajedrez clásico, pero con superposición, fusión, medición probabilística y efecto túnel. No hay jaque mate clásico: ganas capturando el rey enemigo (a veces tras una medición).'
        : 'Built on classic chess, but with superposition, merge, probabilistic measurement, and tunneling. No classic checkmate: you win by capturing the enemy king (sometimes after measurement).',
      bullets: es
        ? ['Movimiento clásico: igual que siempre', 'Movimiento cuántico: divide la pieza', 'Fusión: vuelve al 100% en una casilla', 'Capturas cuánticas: ruleta de medición']
        : ['Classic move: same as always', 'Quantum move: split the piece', 'Merge: return to 100% on one square', 'Quantum captures: measurement roulette'],
    },
    {
      id: 'quantum-classic-move',
      category: 'movement',
      icon: '♟',
      color: 'text-accent',
      bgColor: 'bg-accent/10 border-accent/20',
      title: es ? 'Movimiento clásico' : 'Classic move',
      summary: es
        ? 'Selecciona pieza y destino: la pieza queda al 100% en la casilla elegida.'
        : 'Select piece and destination: the piece stays 100% on the chosen square.',
      desc: es
        ? 'Usa el modo «Clásico» en el panel de jugada. Funciona como ajedrez normal y es la opción segura cuando no quieres dividir una pieza.'
        : 'Use «Classic» mode in the move panel. Works like normal chess and is the safe choice when you do not want to split a piece.',
      tip: es ? 'En modo cuántico, arrastrar solo hace movimiento clásico si el modo está en «Clásico».' : 'In quantum mode, dragging only performs a classic move when mode is set to «Classic».',
      steps: [
        {
          caption: es ? '1. Selecciona la pieza' : '1. Select the piece',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 2, 1, { piece: '♞', highlight: 'selected' })
            return g
          })(),
        },
        {
          caption: es ? '2. Elige destino legal' : '2. Pick a legal destination',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 2, 1, { piece: '♞', highlight: 'selected' })
            placeMiniSquare(g, 0, 2, { highlight: 'target' })
            return g
          })(),
        },
        {
          caption: es ? '3. Pieza al 100% en destino' : '3. Piece at 100% on target',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 0, 2, { piece: '♞', highlight: 'selected', label: '100%' })
            return g
          })(),
        },
      ],
    },
    {
      id: 'quantum-split',
      category: 'movement',
      icon: '⚛',
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10 border-indigo-500/20',
      title: es ? 'Movimiento cuántico (superposición)' : 'Quantum move (superposition)',
      summary: es
        ? 'Divide la pieza: 50% en cada casilla destino. Los peones no pueden.'
        : 'Split the piece: 50% on each target square. Pawns cannot.',
      desc: es
        ? 'Activa el modo «Cuántico», elige la pieza y luego dos casillas de destino legales. La pieza existirá a la vez en ambas hasta que se fusione o se mida en una captura.'
        : 'Enable «Quantum» mode, pick the piece, then two legal target squares. The piece exists on both until merged or measured during a capture.',
      bullets: es
        ? ['Dos destinos obligatorios', 'Cada casilla muestra ~50%', 'Útil para amenazar dos líneas a la vez']
        : ['Two destinations required', 'Each square shows ~50%', 'Useful to threaten two lines at once'],
      steps: [
        {
          caption: es ? '1. Pieza seleccionada' : '1. Piece selected',
          board: (() => {
            const g = makeGrid(5, 5)
            placeMiniSquare(g, 3, 2, { piece: '♝', highlight: 'selected' })
            return g
          })(),
        },
        {
          caption: es ? '2. Primer destino' : '2. First target',
          board: (() => {
            const g = makeGrid(5, 5)
            placeMiniSquare(g, 3, 2, { piece: '♝', highlight: 'selected' })
            placeMiniSquare(g, 1, 0, { highlight: 'target' })
            return g
          })(),
        },
        {
          caption: es ? '3. Superposición 50% + 50%' : '3. Superposition 50% + 50%',
          board: (() => {
            const g = makeGrid(5, 5)
            placeMiniSquare(g, 1, 0, { piece: '♝', highlight: 'quantum', label: '50%' })
            placeMiniSquare(g, 1, 4, { piece: '♝', highlight: 'quantum', label: '50%' })
            return g
          })(),
        },
      ],
    },
    {
      id: 'quantum-merge',
      category: 'movement',
      icon: '🔗',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10 border-cyan-500/20',
      title: es ? 'Fusión (merge)' : 'Merge',
      summary: es
        ? 'Reúne una pieza dividida: elige una casilla y colapsa al 100% ahí.'
        : 'Reunite a split piece: pick one square and collapse to 100% there.',
      desc: es
        ? 'Modo «Fusión»: solo para piezas ya en superposición. La otra posición desaparece y recuperas control total de la pieza.'
        : '«Merge» mode: only for pieces already in superposition. The other position vanishes and you regain full control.',
      steps: [
        {
          caption: es ? 'Torre dividida en dos columnas' : 'Rook split across two files',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 1, 0, { piece: '♜', highlight: 'quantum', label: '50%' })
            placeMiniSquare(g, 1, 4, { piece: '♜', highlight: 'quantum', label: '50%' })
            return g
          })(),
        },
        {
          caption: es ? 'Elige fusionar hacia la derecha' : 'Choose to merge to the right',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 1, 0, { piece: '♜', highlight: 'quantum', label: '50%', opacity: 0.45 })
            placeMiniSquare(g, 1, 4, { piece: '♜', highlight: 'merge', label: '100%' })
            return g
          })(),
        },
      ],
    },
    {
      id: 'quantum-measure',
      category: 'captures',
      icon: '🎰',
      color: 'text-yellow-300',
      bgColor: 'bg-yellow-500/10 border-yellow-500/20',
      title: es ? 'Medición (ruleta)' : 'Measurement (roulette)',
      summary: es
        ? 'Al capturar piezas en superposición, una ruleta decide si estaban «vivas» en esa casilla.'
        : 'When capturing superposed pieces, a roulette decides if they were «alive» on that square.',
      desc: es
        ? 'Resultado «vivo»: la pieza estaba ahí y la captura procede. «Muerto»: la casilla estaba vacía y la pieza colapsa a su otra posición. La probabilidad depende del % en esa casilla.'
        : '«Alive»: the piece was there and the capture proceeds. «Dead»: the square was empty and the piece collapses to its other position. Probability depends on the % on that square.',
      tip: es ? 'Prueba el laboratorio de capturas más abajo para ver cada caso.' : 'Try the capture lab below for each scenario.',
    },
    {
      id: 'quantum-castle',
      category: 'special',
      icon: '🏰',
      color: 'text-indigo-300',
      bgColor: 'bg-indigo-500/8 border-indigo-500/15',
      title: es ? 'Enroque cuántico' : 'Quantum castling',
      summary: es
        ? 'Rey y torre quedan entrelazados entre posición original y enrocada.'
        : 'King and rook become entangled between original and castled positions.',
      desc: es
        ? 'Similar al enroque clásico, pero ambas piezas entran en superposición. Medir una puede colapsar la otra al estado correspondiente.'
        : 'Similar to classic castling, but both pieces enter superposition. Measuring one may collapse the other to the matching state.',
      board: (() => {
        const g = makeGrid(3, 5)
        placeMiniSquare(g, 2, 0, { piece: '♜', label: '50%' })
        placeMiniSquare(g, 2, 2, { piece: '♚', label: '50%' })
        placeMiniSquare(g, 0, 1, { piece: '♜', highlight: 'quantum', label: '50%' })
        placeMiniSquare(g, 0, 3, { piece: '♚', highlight: 'quantum', label: '50%' })
        return g
      })(),
    },
    {
      id: 'quantum-tunnel',
      category: 'special',
      icon: '🕳',
      color: 'text-emerald-300',
      bgColor: 'bg-emerald-500/8 border-emerald-500/15',
      title: es ? 'Efecto túnel' : 'Tunnel effect',
      summary: es
        ? 'Puedes atravesar casillas ocupadas por piezas en superposición (no al 100%).'
        : 'You can pass through squares occupied by pieces in superposition (not at 100%).',
      desc: es
        ? 'En ajedrez clásico una pieza bloquea el camino. Aquí, si el bloqueador está «difuso» (cuántico), otras piezas pueden tunelizar a través de esa casilla.'
        : 'In classic chess a piece blocks the path. Here, if the blocker is «fuzzy» (quantum), other pieces can tunnel through that square.',
      steps: [
        {
          caption: es ? 'Alfil bloqueado en clásico…' : 'Bishop blocked in classic…',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 3, 2, { piece: '♗', highlight: 'selected' })
            placeMiniSquare(g, 1, 2, { piece: '♟', highlight: 'blocked' })
            return g
          })(),
        },
        {
          caption: es ? '…pero el bloqueador está al 50%' : '…but the blocker is at 50%',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 3, 2, { piece: '♗', highlight: 'selected' })
            placeMiniSquare(g, 1, 2, { piece: '♝', highlight: 'quantum', label: '50%' })
            placeMiniSquare(g, 0, 2, { highlight: 'target' })
            return g
          })(),
        },
      ],
    },
    {
      id: 'quantum-end',
      category: 'endgame',
      icon: '👑',
      color: 'text-red-400',
      bgColor: 'bg-red-500/8 border-red-500/15',
      title: es ? 'Fin de partida cuántico' : 'Quantum game end',
      summary: es
        ? 'Ganas capturando el rey enemigo; no hay jaque mate tradicional.'
        : 'You win by capturing the enemy king; there is no traditional checkmate.',
      desc: es
        ? 'Un rey en superposición puede «esconderse» en dos casillas. Una captura o medición exitosa sobre el rey puede terminar la partida al instante.'
        : 'A king in superposition can «hide» on two squares. A successful capture or measurement on the king can end the game immediately.',
      board: (() => {
        const g = makeGrid(3, 4)
        placeMiniSquare(g, 1, 1, { piece: '♕', highlight: 'selected' })
        placeMiniSquare(g, 1, 2, { piece: '♚', highlight: 'check', label: '50%' })
        placeMiniSquare(g, 1, 3, { piece: '♚', label: '50%' })
        return g
      })(),
    },
  ]
}

export function getPieceGuide(es: boolean): PieceGuideEntry[] {
  const knightTargets = (g: ReturnType<typeof makeGrid>, r: number, c: number) => {
    for (const [dr, dc] of [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
    ]) {
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < g.length && nc >= 0 && nc < g[0].length) {
        placeMiniSquare(g, nr, nc, { highlight: 'target' })
      }
    }
  }

  return [
    {
      id: 'king',
      piece: '♚',
      name: es ? 'Rey' : 'King',
      short: es ? '1 casilla en cualquier dirección' : '1 square in any direction',
      detail: es ? 'No puede moverse a casilla atacada. Fundamental en enroque.' : 'Cannot move to an attacked square. Key to castling.',
      board: (() => {
        const g = makeGrid(5, 5)
        placeMiniSquare(g, 2, 2, { piece: '♚', highlight: 'selected' })
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue
            placeMiniSquare(g, 2 + dr, 2 + dc, { highlight: 'target' })
          }
        }
        return g
      })(),
    },
    {
      id: 'queen',
      piece: '♛',
      name: es ? 'Dama' : 'Queen',
      short: es ? 'Líneas rectas y diagonales sin límite' : 'Unlimited ranks, files, and diagonals',
      detail: es ? 'Combina torre y alfil. La pieza más versátil.' : 'Combines rook and bishop. The most versatile piece.',
      board: (() => {
        const g = makeGrid(5, 5)
        placeMiniSquare(g, 2, 2, { piece: '♛', highlight: 'selected' })
        for (let i = 0; i < 5; i++) {
          if (i !== 2) {
            placeMiniSquare(g, 2, i, { highlight: 'target' })
            placeMiniSquare(g, i, 2, { highlight: 'target' })
          }
        }
        placeMiniSquare(g, 0, 0, { highlight: 'target' })
        placeMiniSquare(g, 0, 4, { highlight: 'target' })
        placeMiniSquare(g, 4, 0, { highlight: 'target' })
        placeMiniSquare(g, 4, 4, { highlight: 'target' })
        return g
      })(),
    },
    {
      id: 'rook',
      piece: '♜',
      name: es ? 'Torre' : 'Rook',
      short: es ? 'Filas y columnas' : 'Ranks and files',
      detail: es ? 'Potente en columnas abiertas y torres dobladas.' : 'Strong on open files and doubled rooks.',
      board: (() => {
        const g = makeGrid(5, 5)
        placeMiniSquare(g, 2, 2, { piece: '♜', highlight: 'selected' })
        for (let i = 0; i < 5; i++) {
          if (i !== 2) {
            placeMiniSquare(g, 2, i, { highlight: 'target' })
            placeMiniSquare(g, i, 2, { highlight: 'target' })
          }
        }
        return g
      })(),
    },
    {
      id: 'bishop',
      piece: '♝',
      name: es ? 'Alfil' : 'Bishop',
      short: es ? 'Diagonales' : 'Diagonals',
      detail: es ? 'Cada alfil permanece en casillas de un color.' : 'Each bishop stays on squares of one color.',
      board: (() => {
        const g = makeGrid(5, 5)
        placeMiniSquare(g, 2, 2, { piece: '♝', highlight: 'selected' })
        placeMiniSquare(g, 0, 0, { highlight: 'target' })
        placeMiniSquare(g, 0, 4, { highlight: 'target' })
        placeMiniSquare(g, 4, 0, { highlight: 'target' })
        placeMiniSquare(g, 4, 4, { highlight: 'target' })
        placeMiniSquare(g, 1, 1, { highlight: 'target' })
        placeMiniSquare(g, 1, 3, { highlight: 'target' })
        placeMiniSquare(g, 3, 1, { highlight: 'target' })
        placeMiniSquare(g, 3, 3, { highlight: 'target' })
        return g
      })(),
    },
    {
      id: 'knight',
      piece: '♞',
      name: es ? 'Caballo' : 'Knight',
      short: es ? 'Salto en «L»' : 'L-shaped jump',
      detail: es ? 'Única pieza que salta sobre otras.' : 'The only piece that jumps over others.',
      board: (() => {
        const g = makeGrid(5, 5)
        placeMiniSquare(g, 2, 2, { piece: '♞', highlight: 'selected' })
        knightTargets(g, 2, 2)
        return g
      })(),
    },
    {
      id: 'pawn',
      piece: '♟',
      name: es ? 'Peón' : 'Pawn',
      short: es ? 'Avanza; captura en diagonal' : 'Advances; captures diagonally',
      detail: es ? 'Puede avanzar 2 casillas en su primer movimiento.' : 'May move 2 squares on its first move.',
      board: (() => {
        const g = makeGrid(4, 5)
        placeMiniSquare(g, 2, 2, { piece: '♟', highlight: 'selected' })
        placeMiniSquare(g, 1, 2, { highlight: 'target' })
        placeMiniSquare(g, 0, 2, { highlight: 'target' })
        placeMiniSquare(g, 1, 1, { highlight: 'target' })
        placeMiniSquare(g, 1, 3, { highlight: 'target' })
        return g
      })(),
    },
  ]
}

export function getCaptureScenarios(es: boolean): CaptureScenario[] {
  return [
    {
      id: 'c-c',
      attacker: 'classic',
      defender: 'classic',
      label: es ? 'Clásica → Clásica' : 'Classic → Classic',
      measured: es ? 'Sin medición' : 'No measurement',
      outcome: es
        ? 'Captura directa, como en ajedrez normal.'
        : 'Direct capture, like normal chess.',
      steps: [
        {
          caption: es ? 'Torre captura torre' : 'Rook captures rook',
          board: (() => {
            const g = makeGrid(3, 4)
            placeMiniSquare(g, 2, 0, { piece: '♖', highlight: 'selected' })
            placeMiniSquare(g, 0, 0, { piece: '♜', highlight: 'target' })
            return g
          })(),
        },
        {
          caption: es ? 'Pieza capturada, sin ruleta' : 'Piece captured, no roulette',
          board: (() => {
            const g = makeGrid(3, 4)
            placeMiniSquare(g, 0, 0, { piece: '♖', highlight: 'selected', label: '✓' })
            return g
          })(),
        },
      ],
    },
    {
      id: 'c-q',
      attacker: 'classic',
      defender: 'quantum',
      label: es ? 'Clásica → Cuántica' : 'Classic → Quantum',
      measured: es ? 'Se mide la pieza OBJETIVO' : 'TARGET piece is measured',
      outcome: es
        ? 'Vivo: estaba ahí y muere. Muerto: colapsa a su otra casilla.'
        : 'Alive: it was there and is captured. Dead: collapses to other square.',
      steps: [
        {
          caption: es ? 'Alfil ataca alfil al 50%' : 'Bishop attacks 50% bishop',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 2, 1, { piece: '♗', highlight: 'selected' })
            placeMiniSquare(g, 0, 3, { piece: '♝', highlight: 'quantum', label: '50%' })
            placeMiniSquare(g, 2, 4, { piece: '♝', label: '50%' })
            return g
          })(),
        },
        {
          caption: es ? 'Ruleta sobre la defensora' : 'Roulette on defender',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 2, 1, { piece: '♗', highlight: 'selected' })
            placeMiniSquare(g, 0, 3, { piece: '♝', highlight: 'quantum', label: '🎰' })
            return g
          })(),
        },
        {
          caption: es ? 'Vivo ✓ o muerto → colapso' : 'Alive ✓ or dead → collapse',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 2, 1, { piece: '♗', highlight: 'selected' })
            placeMiniSquare(g, 2, 4, { piece: '♝', highlight: 'quantum', label: '↪' })
            return g
          })(),
        },
      ],
    },
    {
      id: 'q-c',
      attacker: 'quantum',
      defender: 'classic',
      label: es ? 'Cuántica → Clásica' : 'Quantum → Classic',
      measured: es ? 'Se mide la pieza ATACANTE' : 'ATTACKER piece is measured',
      outcome: es
        ? 'Vivo: el ataque procede. Muerto: la jugada falla y el atacante colapsa.'
        : 'Alive: attack proceeds. Dead: move fails and attacker collapses.',
      steps: [
        {
          caption: es ? 'Torre al 50% intenta capturar' : '50% rook tries to capture',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 2, 0, { piece: '♖', highlight: 'quantum', label: '50%' })
            placeMiniSquare(g, 2, 4, { piece: '♖', label: '50%' })
            placeMiniSquare(g, 0, 0, { piece: '♜', highlight: 'target' })
            return g
          })(),
        },
        {
          caption: es ? 'Ruleta sobre la atacante' : 'Roulette on attacker',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 2, 0, { piece: '♖', highlight: 'quantum', label: '🎰' })
            placeMiniSquare(g, 0, 0, { piece: '♜' })
            return g
          })(),
        },
        {
          caption: es ? 'Si vive, captura; si no, colapso' : 'If alive, capture; else collapse',
          board: (() => {
            const g = makeGrid(4, 5)
            placeMiniSquare(g, 0, 0, { piece: '♖', highlight: 'selected', label: '✓' })
            return g
          })(),
        },
      ],
    },
    {
      id: 'q-q',
      attacker: 'quantum',
      defender: 'quantum',
      label: es ? 'Cuántica → Cuántica' : 'Quantum → Quantum',
      measured: es ? 'Dos mediciones: atacante, luego objetivo' : 'Two measurements: attacker, then target',
      outcome: es
        ? 'Si cualquiera sale muerto, ese paso falla y la pieza colapsa.'
        : 'If either is dead, that step fails and the piece collapses.',
      steps: [
        {
          caption: es ? '1. Mide atacante' : '1. Measure attacker',
          board: (() => {
            const g = makeGrid(4, 6)
            placeMiniSquare(g, 3, 0, { piece: '♖', highlight: 'quantum', label: '50%' })
            placeMiniSquare(g, 3, 3, { piece: '♖', label: '50%' })
            placeMiniSquare(g, 1, 0, { piece: '♜', highlight: 'quantum', label: '50%' })
            placeMiniSquare(g, 1, 5, { piece: '♜', label: '50%' })
            return g
          })(),
        },
        {
          caption: es ? '2. Si vive, mide objetivo' : '2. If alive, measure target',
          board: (() => {
            const g = makeGrid(4, 6)
            placeMiniSquare(g, 3, 0, { piece: '♖', highlight: 'selected', label: '✓' })
            placeMiniSquare(g, 1, 0, { piece: '♜', highlight: 'quantum', label: '🎰' })
            return g
          })(),
        },
        {
          caption: es ? '3. Captura si ambos viven' : '3. Capture if both alive',
          board: (() => {
            const g = makeGrid(4, 6)
            placeMiniSquare(g, 3, 0, { piece: '♖', highlight: 'selected' })
            return g
          })(),
        },
      ],
    },
  ]
}

export function getGlossary(es: boolean): { term: string; def: string }[] {
  return es
    ? [
        { term: 'Superposición', def: 'La pieza existe al 50% en dos casillas hasta colapsar.' },
        { term: 'Medición', def: 'Ruleta que decide si la pieza estaba realmente en una casilla.' },
        { term: 'Fusión', def: 'Unir dos estados cuánticos en uno al 100%.' },
        { term: 'Efecto túnel', def: 'Atravesar una casilla ocupada por pieza cuántica (no al 100%).' },
        { term: 'Enroque cuántico', def: 'Rey y torre entrelazados entre posiciones original y enrocada.' },
        { term: 'Jaque mate', def: 'Solo en modo clásico; en cuántico ganas capturando el rey.' },
      ]
    : [
        { term: 'Superposition', def: 'Piece exists at 50% on two squares until it collapses.' },
        { term: 'Measurement', def: 'Roulette deciding if the piece was really on a square.' },
        { term: 'Merge', def: 'Combine two quantum states into one at 100%.' },
        { term: 'Tunnel effect', def: 'Pass through a square held by a quantum (not 100%) piece.' },
        { term: 'Quantum castling', def: 'King and rook entangled between original and castled spots.' },
        { term: 'Checkmate', def: 'Classic mode only; in quantum you win by capturing the king.' },
      ]
}

export function getQuickStart(es: boolean, tab: 'classic' | 'quantum') {
  if (tab === 'classic') {
    return es
      ? [
          { icon: '♔', text: 'Objetivo: jaque mate al rey rival' },
          { icon: '♞', text: 'Cada pieza se mueve de forma distinta' },
          { icon: '½', text: 'Conoce cuándo la partida es tablas' },
        ]
      : [
          { icon: '♔', text: 'Goal: checkmate the enemy king' },
          { icon: '♞', text: 'Each piece moves differently' },
          { icon: '½', text: 'Know when the game is a draw' },
        ]
  }
  return es
    ? [
        { icon: '⚛', text: 'Modo cuántico: divide piezas en 2 casillas' },
        { icon: '🔗', text: 'Fusión: vuelve al 100% donde elijas' },
        { icon: '🎰', text: 'Capturas cuánticas: ruleta de medición' },
      ]
    : [
        { icon: '⚛', text: 'Quantum mode: split pieces across 2 squares' },
        { icon: '🔗', text: 'Merge: return to 100% where you choose' },
        { icon: '🎰', text: 'Quantum captures: measurement roulette' },
      ]
}
