import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Language } from '../lib/types'

interface RulesScreenProps {
  onBack: () => void
  language: Language
}

// ─── Mini Board Component ───
interface MiniSquare {
  piece?: string
  isLight: boolean
  highlight?: 'selected' | 'target' | 'quantum' | 'merge' | 'check' | 'arrow'
  label?: string
  arrowDir?: string
}

function MiniBoard({ squares, size = 5, sqPx = 44 }: { squares: MiniSquare[][]; size?: number; sqPx?: number }) {
  return (
    <div
      className="mini-board mx-auto"
      style={{ gridTemplateColumns: `repeat(${size}, ${sqPx}px)`, gridTemplateRows: `repeat(${squares.length}, ${sqPx}px)` }}
    >
      {squares.flat().map((sq, i) => {
        const hlClass =
          sq.highlight === 'selected' ? 'mini-sq-highlight' :
          sq.highlight === 'target' ? 'mini-sq-highlight' :
          sq.highlight === 'quantum' ? 'mini-sq-quantum' :
          sq.highlight === 'merge' ? 'mini-sq-merge' :
          sq.highlight === 'check' ? 'sq-check' : ''
        return (
          <div
            key={i}
            className={`mini-sq ${sq.isLight ? 'mini-sq-light' : 'mini-sq-dark'} ${hlClass}`}
            style={{ width: sqPx, height: sqPx, fontSize: sqPx * 0.55 }}
          >
            {sq.piece && (
              <span style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>
                {sq.piece}
              </span>
            )}
            {sq.label && (
              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[8px] font-bold text-indigo-300">
                {sq.label}
              </span>
            )}
            {sq.arrowDir && (
              <span className={`mini-sq-arrow ${sq.highlight === 'quantum' ? 'mini-sq-arrow-quantum' : ''}`}>
                {sq.arrowDir}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function makeGrid(rows: number, cols: number): MiniSquare[][] {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      isLight: (r + c) % 2 === 0,
    }))
  )
}

function placeMiniSquare(
  grid: MiniSquare[][],
  row: number,
  col: number,
  patch: Omit<MiniSquare, 'isLight'>,
) {
  grid[row][col] = {
    ...grid[row][col],
    ...patch,
  }
}

type Tab = 'classic' | 'quantum'

export default function RulesScreen({ onBack, language }: RulesScreenProps) {
  const [tab, setTab] = useState<Tab>('quantum')
  const es = language === 'es'

  // ─── Classic Rules Data ───
  const classicRules = useMemo(() => [
    {
      title: es ? 'Movimiento de piezas' : 'Piece movement',
      icon: '♞',
      desc: es
        ? 'Cada pieza se mueve de forma única: el peón avanza, la torre en línea recta, el alfil en diagonal, el caballo en "L", la dama combina torre y alfil, y el rey se mueve una casilla en cualquier dirección.'
        : 'Each piece moves uniquely: the pawn advances, the rook in straight lines, the bishop diagonally, the knight in an "L" shape, the queen combines rook and bishop, and the king moves one square in any direction.',
      board: (() => {
        const g = makeGrid(5, 5)
        placeMiniSquare(g, 2, 2, { piece: '♞', highlight: 'selected' })
        placeMiniSquare(g, 0, 1, { highlight: 'target' })
        placeMiniSquare(g, 0, 3, { highlight: 'target' })
        placeMiniSquare(g, 1, 0, { highlight: 'target' })
        placeMiniSquare(g, 1, 4, { highlight: 'target' })
        placeMiniSquare(g, 3, 0, { highlight: 'target' })
        placeMiniSquare(g, 3, 4, { highlight: 'target' })
        placeMiniSquare(g, 4, 1, { highlight: 'target' })
        placeMiniSquare(g, 4, 3, { highlight: 'target' })
        return g
      })(),
    },
    {
      title: es ? 'Jaque y jaque mate' : 'Check and checkmate',
      icon: '♚',
      desc: es
        ? 'Cuando el rey está amenazado, está en jaque. Si no puede escapar, bloquear ni capturar al atacante, es jaque mate y la partida termina.'
        : 'When the king is threatened, it is in check. If it cannot escape, block, or capture the attacker, it is checkmate and the game ends.',
      board: (() => {
        const g = makeGrid(4, 5)
        placeMiniSquare(g, 0, 4, { piece: '♚', highlight: 'check' })
        placeMiniSquare(g, 2, 4, { piece: '♖' })
        placeMiniSquare(g, 2, 2, { piece: '♕' })
        return g
      })(),
    },
    {
      title: es ? 'Enroque' : 'Castling',
      icon: '♜',
      desc: es
        ? 'El rey se mueve dos casillas hacia una torre, y la torre salta al otro lado del rey. Solo si ninguno se ha movido, no hay piezas entre ellos y el rey no está en jaque.'
        : 'The king moves two squares toward a rook, and the rook jumps to the king\'s other side. Only if neither has moved, no pieces are between them, and the king is not in check.',
      board: (() => {
        const g = makeGrid(2, 5)
        placeMiniSquare(g, 1, 0, { piece: '♜' })
        placeMiniSquare(g, 1, 1, { highlight: 'target' })
        placeMiniSquare(g, 1, 2, { piece: '♚', highlight: 'selected' })
        placeMiniSquare(g, 1, 3, { highlight: 'target' })
        placeMiniSquare(g, 1, 4, { piece: '♜' })
        placeMiniSquare(g, 0, 1, { piece: '♜', label: '→' })
        placeMiniSquare(g, 0, 3, { piece: '♜', label: '←' })
        return g
      })(),
    },
    {
      title: es ? 'Promoción' : 'Promotion',
      icon: '♟',
      desc: es
        ? 'Cuando un peón llega a la última fila, se promociona a dama, torre, alfil o caballo.'
        : 'When a pawn reaches the last rank, it promotes to a queen, rook, bishop, or knight.',
      board: (() => {
        const g = makeGrid(3, 4)
        placeMiniSquare(g, 1, 1, { piece: '♟', highlight: 'selected' })
        placeMiniSquare(g, 0, 1, { highlight: 'target' })
        placeMiniSquare(g, 0, 0, { piece: '♛', label: '?' })
        placeMiniSquare(g, 0, 2, { piece: '♜', label: '?' })
        placeMiniSquare(g, 0, 3, { piece: '♞', label: '?' })
        return g
      })(),
    },
    {
      title: es ? 'Tablas' : 'Draw',
      icon: '½',
      desc: es
        ? 'La partida puede terminar en tablas por ahogado (sin movimientos legales sin estar en jaque), triple repetición de posición, material insuficiente (ej: rey contra rey), o regla de 50 movimientos.'
        : 'The game can end in a draw by stalemate (no legal moves while not in check), threefold repetition, insufficient material (e.g., king vs king), or the 50-move rule.',
      board: (() => {
        const g = makeGrid(3, 3)
        placeMiniSquare(g, 0, 0, { piece: '♚' })
        placeMiniSquare(g, 2, 2, { piece: '♔' })
        placeMiniSquare(g, 1, 2, { piece: '♕' })
        return g
      })(),
    },
  ], [es])

  // ─── Quantum Rules Data ───
  const quantumRules = useMemo(() => [
    {
      title: es ? 'Movimiento clásico' : 'Classic move',
      icon: '♟',
      color: 'text-accent',
      bgColor: 'bg-accent/10 border-accent/20',
      desc: es
        ? 'Funciona exactamente como en el ajedrez tradicional: selecciona una pieza y muévela a una casilla legal. La pieza queda al 100% en el destino.'
        : 'Works exactly like traditional chess: select a piece and move it to a legal square. The piece stays at 100% on the destination.',
      board: (() => {
        const g = makeGrid(4, 5)
        placeMiniSquare(g, 2, 1, { piece: '♞', highlight: 'selected' })
        placeMiniSquare(g, 0, 2, { highlight: 'target' })
        return g
      })(),
    },
    {
      title: es ? 'Movimiento cuántico (superposición)' : 'Quantum move (superposition)',
      icon: '⚛',
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10 border-indigo-500/20',
      desc: es
        ? 'La pieza se divide en dos posiciones simultáneas (superposición). Elige dos casillas de destino: la pieza existirá al 50% en cada una. Los peones no pueden hacer movimientos cuánticos.'
        : 'The piece splits into two simultaneous positions (superposition). Choose two target squares: the piece will exist at 50% in each. Pawns cannot make quantum moves.',
      board: (() => {
        const g = makeGrid(5, 5)
        placeMiniSquare(g, 3, 2, { piece: '♝', highlight: 'selected' })
        placeMiniSquare(g, 1, 0, { piece: '♝', highlight: 'quantum', label: '50%' })
        placeMiniSquare(g, 1, 4, { piece: '♝', highlight: 'quantum', label: '50%' })
        return g
      })(),
    },
    {
      title: es ? 'Fusión (merge)' : 'Merge',
      icon: '🔗',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10 border-cyan-500/20',
      desc: es
        ? 'Si una pieza está dividida en dos casillas, puedes reunirla: elige una de las dos posiciones y la pieza colapsa al 100% ahí. Solo funciona con piezas que ya están en superposición.'
        : 'If a piece is split across two squares, you can reunite it: choose one of the two positions and the piece collapses to 100% there. Only works with pieces already in superposition.',
      board: (() => {
        const g = makeGrid(4, 5)
        placeMiniSquare(g, 1, 0, { piece: '♜', highlight: 'quantum', label: '50%' })
        placeMiniSquare(g, 1, 4, { piece: '♜', highlight: 'quantum', label: '50%' })
        placeMiniSquare(g, 2, 4, { highlight: 'merge' })
        placeMiniSquare(g, 3, 2, { piece: '♜', highlight: 'merge', label: '100%' })
        return g
      })(),
    },
    {
      title: es ? 'Medición (captura con ruleta)' : 'Measurement (capture with roulette)',
      icon: '🎰',
      color: 'text-yellow-300',
      bgColor: 'bg-yellow-500/10 border-yellow-500/20',
      desc: es
        ? 'Cuando una captura involucra una pieza en superposición, se activa la ruleta de medición. La probabilidad de éxito depende del porcentaje de la pieza en esa casilla. El resultado puede ser "vivo" (la pieza existía ahí) o "muerto" (no estaba ahí y colapsa a su otra posición).'
        : 'When a capture involves a piece in superposition, the measurement roulette activates. The success probability depends on the piece\'s percentage on that square. The result can be "alive" (the piece was there) or "dead" (it was not there and collapses to its other position).',
      board: (() => {
        const g = makeGrid(4, 5)
        placeMiniSquare(g, 2, 1, { piece: '♗', highlight: 'selected' })
        placeMiniSquare(g, 0, 3, { piece: '♝', highlight: 'quantum', label: '50%' })
        placeMiniSquare(g, 2, 4, { piece: '♝', label: '50%' })
        return g
      })(),
    },
    {
      title: es ? 'Captura de una pieza clásica a una pieza clásica' : 'Capture from a classic piece to a classic piece',
      icon: '⚔',
      color: 'text-neutral-300',
      bgColor: 'bg-surface-3 border-white/10',
      desc: es
        ? 'Sin medición. La captura se resuelve como en ajedrez normal, sin ruleta.'
        : 'No measurement. The capture resolves like normal chess, without roulette.',
      board: (() => {
        const g = makeGrid(3, 4)
        placeMiniSquare(g, 2, 0, { piece: '♖', highlight: 'selected' })
        placeMiniSquare(g, 0, 0, { piece: '♜', highlight: 'target' })
        return g
      })(),
    },
    {
      title: es ? 'Captura de una pieza clásica a una pieza cuántica' : 'Capture from a classic piece to a quantum piece',
      icon: '🎯',
      color: 'text-indigo-300',
      bgColor: 'bg-indigo-500/8 border-indigo-500/15',
      desc: es
        ? 'Se mide la pieza OBJETIVO (la que vamos a capturar). Si sale "vivo", la pieza estaba realmente ahí y es capturada. Si sale "muerto", la casilla estaba vacía y la pieza objetivo colapsa a su otra posición.'
        : 'The TARGET piece (the one being captured) is measured. If "alive", it was really there and is captured. If "dead", the square was empty and the target piece collapses to its other position.',
      board: (() => {
        const g = makeGrid(4, 5)
        placeMiniSquare(g, 2, 1, { piece: '♗' })
        placeMiniSquare(g, 0, 3, { piece: '♝', highlight: 'quantum', label: '50%' })
        placeMiniSquare(g, 2, 4, { piece: '♝', label: '50%' })
        placeMiniSquare(g, 1, 2, { highlight: 'target' })
        return g
      })(),
    },
    {
      title: es ? 'Captura de una pieza cuántica a una pieza clásica' : 'Capture from a quantum piece to a classic piece',
      icon: '🎲',
      color: 'text-amber-300',
      bgColor: 'bg-amber-500/8 border-amber-500/15',
      desc: es
        ? 'Se mide la pieza ATACANTE. Si sale "vivo", el atacante existía en esa posición y la captura se completa. Si sale "muerto", no estaba realmente ahí, la jugada falla y la pieza atacante colapsa a su otra posición.'
        : 'The ATTACKING piece is measured. If "alive", the attacker existed at that position and the capture completes. If "dead", it was not really there, the move fails, and the attacking piece collapses to its other position.',
      board: (() => {
        const g = makeGrid(4, 5)
        placeMiniSquare(g, 2, 0, { piece: '♖', highlight: 'quantum', label: '50%' })
        placeMiniSquare(g, 2, 4, { piece: '♖', label: '50%' })
        placeMiniSquare(g, 0, 0, { piece: '♜', highlight: 'target' })
        return g
      })(),
    },
    {
      title: es ? 'Captura de una pieza cuántica a una pieza cuántica' : 'Capture from a quantum piece to a quantum piece',
      icon: '⚛⚛',
      color: 'text-indigo-200',
      bgColor: 'bg-indigo-500/8 border-indigo-500/15',
      desc: es
        ? 'Se resuelve en dos pasos:\n1. Primero se mide la atacante. Si sobrevive, continúa.\n2. Luego se mide la objetivo. Si sobrevive, es capturada.\nSi cualquiera sale "muerto", colapsa a su otra posición y ese paso de la captura falla.'
        : 'Resolved in two steps:\n1. First the attacker is measured. If it survives, proceed.\n2. Then the target is measured. If it survives, it is captured.\nIf either result is "dead", that piece collapses to its other position and that step of the capture fails.',
      board: (() => {
        const g = makeGrid(4, 6)
        placeMiniSquare(g, 3, 0, { piece: '♖', highlight: 'quantum', label: '50%' })
        placeMiniSquare(g, 3, 3, { piece: '♖', label: '50%' })
        placeMiniSquare(g, 1, 0, { piece: '♜', highlight: 'quantum', label: '50%' })
        placeMiniSquare(g, 1, 5, { piece: '♜', label: '50%' })
        placeMiniSquare(g, 2, 0, { highlight: 'target' })
        return g
      })(),
    },
    {
      title: es ? 'Enroque cuántico' : 'Quantum castling',
      icon: '🏰',
      color: 'text-indigo-300',
      bgColor: 'bg-indigo-500/8 border-indigo-500/15',
      desc: es
        ? 'Similar al enroque clásico, pero rey y torre quedan entrelazados: en superposición entre su posición original y la posición enrocada. Cuando se mide uno, el otro colapsa al estado correspondiente.'
        : 'Similar to classic castling, but king and rook become entangled: in superposition between their original position and the castled position. When one is measured, the other collapses to the corresponding state.',
      board: (() => {
        const g = makeGrid(3, 5)
        placeMiniSquare(g, 2, 0, { piece: '♜', label: '50%' })
        placeMiniSquare(g, 2, 2, { piece: '♚', label: '50%' })
        placeMiniSquare(g, 0, 1, { piece: '♜', highlight: 'quantum', label: '50%' })
        placeMiniSquare(g, 0, 0, { piece: '♚', highlight: 'quantum', label: '50%' })
        return g
      })(),
    },
    {
      title: es ? 'Efecto túnel' : 'Tunnel effect',
      icon: '🕳',
      color: 'text-emerald-300',
      bgColor: 'bg-emerald-500/8 border-emerald-500/15',
      desc: es
        ? 'Las piezas pueden pasar a través de casillas ocupadas por piezas en superposición (estados cuánticos). Esto simula el efecto túnel de la mecánica cuántica, permitiendo movimientos que serían bloqueados en ajedrez clásico.'
        : 'Pieces can pass through squares occupied by pieces in superposition (quantum states). This simulates quantum tunneling, allowing moves that would be blocked in classic chess.',
      board: (() => {
        const g = makeGrid(4, 5)
        placeMiniSquare(g, 3, 2, { piece: '♖', highlight: 'selected' })
        placeMiniSquare(g, 1, 2, { piece: '♝', highlight: 'quantum', label: '50%' })
        placeMiniSquare(g, 0, 2, { highlight: 'target' })
        return g
      })(),
    },
    {
      title: es ? 'Fin de partida cuántico' : 'Quantum game end',
      icon: '👑',
      color: 'text-red-400',
      bgColor: 'bg-red-500/8 border-red-500/15',
      desc: es
        ? 'La partida termina cuando un rey es capturado (no existe jaque mate clásico en modo cuántico). Como los reyes pueden estar en superposición, una medición exitosa sobre un rey en combate puede terminar la partida.'
        : 'The game ends when a king is captured (there is no classic checkmate in quantum mode). Since kings can be in superposition, a successful measurement on a king in combat can end the game.',
      board: (() => {
        const g = makeGrid(3, 4)
        placeMiniSquare(g, 1, 1, { piece: '♕', highlight: 'selected' })
        placeMiniSquare(g, 1, 2, { piece: '♚', highlight: 'check', label: '50%' })
        placeMiniSquare(g, 1, 3, { piece: '♚', label: '50%' })
        return g
      })(),
    },
  ], [es])

  const rules = tab === 'classic' ? classicRules : quantumRules
  const tabTitle = tab === 'classic'
    ? (es ? 'Reglas del Ajedrez Clásico' : 'Classic Chess Rules')
    : (es ? 'Reglas del Ajedrez Cuántico' : 'Quantum Chess Rules')

  return (
    <div className="min-h-screen bg-surface-0">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-surface-4 bg-surface-0/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 lg:px-8 lg:py-4">
          <div className="flex items-center gap-2.5">
            <span className="font-serif text-lg text-accent">♛</span>
            <span className="text-sm font-semibold text-white">
              Gambito de Dama <span className="text-accent">Cuántico</span>
            </span>
          </div>
          <button
            onClick={onBack}
            className="rounded-md border border-surface-4 bg-surface-1 px-4 py-2 text-sm font-semibold text-neutral-300 transition-colors hover:border-accent/30 hover:text-white"
          >
            ← {es ? 'Menú' : 'Menu'}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8 lg:py-12">
        {/* Page title */}
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <h1 className="font-serif text-3xl text-white lg:text-4xl">
            {es ? 'Reglas del Juego' : 'Game Rules'}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            {es ? 'Aprende los modos de juego y sus mecánicas' : 'Learn the game modes and their mechanics'}
          </p>
        </motion.div>

        {/* Tab selector — segmented control */}
        <div className="mb-10 flex justify-center">
          <div className="flex overflow-hidden rounded border border-surface-4">
            {[
              { key: 'classic' as Tab, label: es ? '♛ Clásico' : '♛ Classic' },
              { key: 'quantum' as Tab, label: es ? '⚛ Cuántico' : '⚛ Quantum' },
            ].map((t, i) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 py-2 text-sm font-semibold transition-colors
                  ${i > 0 ? 'border-l border-surface-4' : ''}
                  ${tab === t.key
                    ? t.key === 'quantum'
                      ? 'bg-indigo-500/10 text-indigo-400'
                      : 'bg-accent/10 text-accent'
                    : 'text-neutral-500 hover:text-neutral-300'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section title */}
        <h2
          className="mb-8 text-center font-serif text-xl text-white lg:text-2xl"
          key={tabTitle}
        >
          {tabTitle}
        </h2>

        {/* Rules list */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-5 lg:space-y-6"
          >
            {rules.map((rule, idx) => (
              <motion.div
                key={rule.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.3, ease: 'easeOut' }}
                className="overflow-hidden rounded border border-surface-4 bg-surface-1"
              >
                <div className="flex flex-col gap-5 p-5 lg:flex-row lg:gap-8 lg:p-6">
                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded border text-base
                        ${tab === 'quantum'
                          ? (rule as any).bgColor || 'bg-indigo-500/10 border-indigo-500/20'
                          : 'bg-accent/10 border-accent/20'
                        }`}
                      >
                        {rule.icon}
                      </div>
                      <div>
                        <h3 className={`text-sm font-bold lg:text-base ${tab === 'quantum' ? ((rule as any).color || 'text-indigo-300') : 'text-white'}`}>
                          {rule.title}
                        </h3>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-neutral-600">
                          {tab === 'classic' ? (es ? 'Regla clásica' : 'Classic rule') : (es ? 'Mecánica cuántica' : 'Quantum mechanic')} #{idx + 1}
                        </span>
                      </div>
                    </div>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-400">
                      {rule.desc}
                    </p>
                  </div>

                  {/* Mini board */}
                  <div className="flex flex-shrink-0 flex-col items-center justify-center gap-1.5">
                    <MiniBoard
                      squares={rule.board}
                      size={rule.board[0]?.length || 5}
                      sqPx={window.innerWidth < 640 ? 36 : 44}
                    />
                    <span className="text-[10px] text-neutral-600">
                      {es ? 'Ejemplo visual' : 'Visual example'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        <div className="h-16" />
      </div>
    </div>
  )
}
