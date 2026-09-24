import { useMemo, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import MiniBoard from './MiniBoard'
import { makeGrid, placeMiniSquare } from './miniBoardUtils'
import { useMiniSqPx } from './useMiniSqPx'
import type { MiniSquare } from './types'
import GameIcon from '../GameIcon'

interface QuantumTutorialProps {
  es: boolean
}

interface TutorialStep {
  id: string
  eyebrow: string
  title: string
  summary: string
  body: string
  bullets: string[]
  board: MiniSquare[][]
}

interface MissionChallenge {
  prompt: string
  options: Array<{ label: string; correct: boolean }>
}

const W = {
  pawn: '♙',
  knight: '♘',
  bishop: '♗',
  rook: '♖',
  queen: '♕',
  king: '♔',
}

const B = {
  pawn: '♟',
  knight: '♞',
  bishop: '♝',
  rook: '♜',
  queen: '♛',
  king: '♚',
}

function classicMoveBoard() {
  const g = makeGrid(5, 5)
  placeMiniSquare(g, 3, 1, { piece: W.knight, highlight: 'selected' })
  placeMiniSquare(g, 1, 0, { highlight: 'target', arrowDir: '1' })
  placeMiniSquare(g, 1, 2, { highlight: 'target', arrowDir: '2' })
  return g
}

function splitBoard() {
  const g = makeGrid(5, 5)
  placeMiniSquare(g, 3, 2, { piece: W.knight, highlight: 'selected' })
  placeMiniSquare(g, 1, 1, { piece: W.knight, highlight: 'quantum', label: '50%' })
  placeMiniSquare(g, 1, 3, { piece: W.knight, highlight: 'quantum', label: '50%' })
  return g
}

function noPawnSplitBoard() {
  const g = makeGrid(4, 5)
  placeMiniSquare(g, 2, 2, { piece: W.pawn, highlight: 'selected' })
  placeMiniSquare(g, 1, 2, { highlight: 'target' })
  placeMiniSquare(g, 1, 1, { highlight: 'blocked', label: 'NO' })
  placeMiniSquare(g, 1, 3, { highlight: 'blocked', label: 'NO' })
  return g
}

function mergeBoard() {
  const g = makeGrid(5, 5)
  placeMiniSquare(g, 1, 1, { piece: W.knight, highlight: 'quantum', label: '50%' })
  placeMiniSquare(g, 1, 3, { piece: W.knight, highlight: 'quantum', label: '50%' })
  placeMiniSquare(g, 3, 2, { piece: W.knight, highlight: 'merge', label: '100%' })
  return g
}

function measurementBoard() {
  const g = makeGrid(4, 5)
  placeMiniSquare(g, 2, 1, { piece: W.queen, highlight: 'quantum', label: '50%' })
  placeMiniSquare(g, 2, 3, { piece: B.rook, highlight: 'selected' })
  placeMiniSquare(g, 1, 2, { highlight: 'quantum', label: '%' })
  placeMiniSquare(g, 0, 2, { label: 'RNG' })
  return g
}

function getMissionChallenge(id: string, es: boolean): MissionChallenge {
  const missions: Record<string, MissionChallenge> = {
    'classic-move': {
      prompt: es ? '¿Qué modo deja la pieza al 100% en el destino?' : 'Which mode leaves the piece 100% on its target?',
      options: [
        { label: es ? 'Clásico' : 'Classic', correct: true },
        { label: 'Split', correct: false },
        { label: es ? 'Medición' : 'Measurement', correct: false },
      ],
    },
    split: {
      prompt: es ? 'Para crear dos ramas debes…' : 'To create two branches you must…',
      options: [
        { label: es ? 'Elegir dos destinos legales vacíos' : 'Choose two legal empty targets', correct: true },
        { label: es ? 'Capturar dos piezas' : 'Capture two pieces', correct: false },
        { label: es ? 'Mover un peón' : 'Move a pawn', correct: false },
      ],
    },
    merge: {
      prompt: es ? '¿Cuándo se permite una fusión?' : 'When is a merge allowed?',
      options: [
        { label: es ? 'Todas las ramas alcanzan la misma casilla vacía' : 'Every branch reaches the same empty square', correct: true },
        { label: es ? 'Una rama puede capturar' : 'One branch can capture', correct: false },
        { label: es ? 'Las probabilidades son distintas' : 'Probabilities differ', correct: false },
      ],
    },
    measurement: {
      prompt: es ? '¿Qué hace la ruleta?' : 'What does the roulette do?',
      options: [
        { label: es ? 'Revela una medición ya calculada' : 'Reveals an already calculated measurement', correct: true },
        { label: es ? 'Cambia la probabilidad' : 'Changes the probability', correct: false },
        { label: es ? 'Elige la mejor jugada' : 'Chooses the best move', correct: false },
      ],
    },
    tunnel: {
      prompt: es ? '¿Qué bloqueo puede atravesar una pieza lineal?' : 'Which blocker can a sliding piece cross?',
      options: [
        { label: es ? 'Una rama cuántica' : 'A quantum branch', correct: true },
        { label: es ? 'Una pieza clásica al 100%' : 'A 100% classical piece', correct: false },
        { label: es ? 'Cualquier rey' : 'Any king', correct: false },
      ],
    },
    'quantum-castle': {
      prompt: es ? 'Tras el enroque cuántico, rey y torre…' : 'After quantum castling, king and rook…',
      options: [
        { label: es ? 'Quedan entrelazados en dos configuraciones' : 'Are entangled across two configurations', correct: true },
        { label: es ? 'Se fusionan en una pieza' : 'Merge into one piece', correct: false },
        { label: es ? 'Desaparecen hasta el turno siguiente' : 'Disappear until next turn', correct: false },
      ],
    },
    'game-end': {
      prompt: es ? '¿Cómo termina una partida cuántica?' : 'How does a quantum game end?',
      options: [
        { label: es ? 'Capturando el rey' : 'By capturing the king', correct: true },
        { label: es ? 'Declarando jaque mate' : 'By declaring checkmate', correct: false },
        { label: es ? 'Al primer split' : 'At the first split', correct: false },
      ],
    },
  }
  return missions[id]
}

function classicVsQuantumBoard() {
  const g = makeGrid(4, 5)
  placeMiniSquare(g, 2, 1, { piece: W.bishop, highlight: 'selected' })
  placeMiniSquare(g, 1, 2, { piece: B.knight, highlight: 'quantum', label: '50%' })
  placeMiniSquare(g, 2, 3, { piece: B.knight, highlight: 'quantum', label: '50%' })
  return g
}

function quantumVsClassicBoard() {
  const g = makeGrid(4, 5)
  placeMiniSquare(g, 2, 1, { piece: W.queen, highlight: 'quantum', label: '40%' })
  placeMiniSquare(g, 1, 2, { piece: W.queen, highlight: 'quantum', label: '60%' })
  placeMiniSquare(g, 0, 3, { piece: B.rook, highlight: 'selected' })
  return g
}

function quantumVsQuantumBoard() {
  const g = makeGrid(4, 5)
  placeMiniSquare(g, 3, 1, { piece: W.rook, highlight: 'quantum', label: '50%' })
  placeMiniSquare(g, 2, 1, { piece: W.rook, highlight: 'quantum', label: '50%' })
  placeMiniSquare(g, 1, 3, { piece: B.bishop, highlight: 'quantum', label: '50%' })
  placeMiniSquare(g, 2, 3, { piece: B.bishop, highlight: 'quantum', label: '50%' })
  return g
}

function tunnelBoard() {
  const g = makeGrid(3, 6)
  placeMiniSquare(g, 1, 0, { piece: W.rook, highlight: 'selected' })
  placeMiniSquare(g, 1, 2, { piece: W.knight, highlight: 'quantum', label: '50%' })
  placeMiniSquare(g, 1, 5, { highlight: 'target', arrowDir: '→' })
  placeMiniSquare(g, 0, 4, { piece: W.knight, highlight: 'quantum', label: '50%' })
  return g
}

function quantumCastleBoard() {
  const g = makeGrid(3, 7)
  placeMiniSquare(g, 2, 1, { piece: W.king, highlight: 'quantum', label: '50%' })
  placeMiniSquare(g, 2, 3, { piece: W.rook, highlight: 'quantum', label: '50%' })
  placeMiniSquare(g, 2, 5, { piece: W.king, highlight: 'quantum', label: '50%' })
  placeMiniSquare(g, 2, 4, { piece: W.rook, highlight: 'quantum', label: '50%' })
  return g
}

function gameEndBoard() {
  const g = makeGrid(4, 5)
  placeMiniSquare(g, 0, 4, { piece: B.king, highlight: 'check' })
  placeMiniSquare(g, 2, 4, { piece: W.queen, highlight: 'target', arrowDir: '↑' })
  placeMiniSquare(g, 3, 0, { piece: W.king })
  return g
}

function getTutorialSteps(es: boolean): TutorialStep[] {
  const steps: TutorialStep[] = [
    {
      id: 'classic-move',
      eyebrow: es ? 'Paso 1' : 'Step 1',
      title: es ? 'Movimiento clásico' : 'Classic move',
      summary: es
        ? 'Es el ajedrez normal dentro del modo cuántico.'
        : 'This is regular chess movement inside quantum mode.',
      body: es
        ? 'Elige una pieza, deja activo el modo Clásico y pulsa una casilla legal. La pieza termina al 100% en ese destino.'
        : 'Pick a piece, keep Classic mode active, and choose a legal square. The piece ends 100% on that target.',
      bullets: es
        ? ['Sirve para mover con seguridad.', 'También se usa para capturar.', 'Respeta las reglas de movimiento de cada pieza.']
        : ['Use it for safe movement.', 'It is also used to capture.', 'It follows each piece movement pattern.'],
      board: classicMoveBoard(),
    },
    {
      id: 'split',
      eyebrow: es ? 'Paso 2' : 'Step 2',
      title: es ? 'Movimiento cuántico / split' : 'Quantum move / split',
      summary: es
        ? 'Una pieza no peón puede dividirse en dos destinos.'
        : 'A non-pawn piece can split across two targets.',
      body: es
        ? 'Activa Cuántico, selecciona una pieza y elige dos casillas legales sin captura. La pieza queda repartida normalmente al 50% y 50%.'
        : 'Switch to Quantum, select a piece, and choose two legal non-capture targets. The piece is usually split 50% and 50%.',
      bullets: es
        ? ['No captura durante el split.', 'Cada fragmento puede moverse después.', 'Una medición futura decide si estaba en una casilla concreta.']
        : ['A split does not capture.', 'Each fragment can move later.', 'A later measurement decides whether it was on a specific square.'],
      board: splitBoard(),
    },
    {
      id: 'pawn-limit',
      eyebrow: es ? 'Norma' : 'Rule',
      title: es ? 'Los peones no se dividen' : 'Pawns do not split',
      summary: es
        ? 'El peón mantiene su comportamiento clásico.'
        : 'Pawns keep their classic behavior.',
      body: es
        ? 'En este motor, los peones no tienen movimiento cuántico. Pueden avanzar, capturar en diagonal y promocionar como en ajedrez clásico.'
        : 'In this engine, pawns do not have a quantum move. They advance, capture diagonally, and promote as in classic chess.',
      bullets: es
        ? ['Evita promociones probabilísticas confusas.', 'Hace más legible la estructura de peones.', 'El botón Cuántico no se habilita para peones.']
        : ['It avoids confusing probabilistic promotions.', 'It keeps pawn structure readable.', 'The Quantum button is not enabled for pawns.'],
      board: noPawnSplitBoard(),
    },
    {
      id: 'merge',
      eyebrow: es ? 'Paso 3' : 'Step 3',
      title: es ? 'Fusión' : 'Merge',
      summary: es
        ? 'Reúne una pieza dividida en un solo estado al 100%.'
        : 'Combine a split piece into one 100% state.',
      body: es
        ? 'Cuando una pieza existe en varias casillas y todas pueden llegar a un mismo destino vacío, aparece Fusión. Al fusionar, la pieza vuelve a ser clásica.'
        : 'When a piece exists on multiple squares and all states can reach the same empty target, Merge becomes available. After merging, the piece is classical again.',
      bullets: es
        ? ['Reduce incertidumbre.', 'Puede preparar una captura clara.', 'No sirve para capturar directamente.']
        : ['It reduces uncertainty.', 'It can prepare a clear capture.', 'It does not capture directly.'],
      board: mergeBoard(),
    },
    {
      id: 'measurement',
      eyebrow: es ? 'Capturas' : 'Captures',
      title: es ? 'Medición y ruleta' : 'Measurement and roulette',
      summary: es
        ? 'Al capturar estados cuánticos, la partida mide si la pieza existe ahí.'
        : 'When quantum states are involved in captures, the game measures whether the piece exists there.',
      body: es
        ? 'La ruleta no cambia la probabilidad: solo revela el resultado de una medición ya calculada. Hasta cerrarla, el tablero muestra el estado previo para mantener el suspense.'
        : 'The roulette does not change the probability: it reveals an already computed measurement. Until closed, the board shows the previous state for suspense.',
      bullets: es
        ? ['✓ significa que la pieza existe en esa casilla.', '✗ significa que no estaba ahí.', 'En online, ambos ven la ruleta; el iniciador la cierra.']
        : ['✓ means the piece exists on that square.', '✗ means it was not there.', 'Online, both players see the roulette; the initiator closes it.'],
      board: measurementBoard(),
    },
    {
      id: 'classic-vs-quantum',
      eyebrow: es ? 'Caso 1' : 'Case 1',
      title: es ? 'Clásica captura cuántica' : 'Classic captures quantum',
      summary: es
        ? 'Se mide la defensora.'
        : 'The defender is measured.',
      body: es
        ? 'Si una pieza clásica ataca una pieza dividida, primero se comprueba si la defensora estaba realmente en la casilla atacada.'
        : 'If a classic piece attacks a split piece, the defender is checked first to see whether it was really on the attacked square.',
      bullets: es
        ? ['Defensora existe: la captura ocurre.', 'Defensora no existe: colapsa fuera y el movimiento sigue según la regla aplicable.', 'El atacante no necesita medirse.']
        : ['Defender exists: capture happens.', 'Defender absent: it collapses elsewhere and the move continues by rule.', 'The attacker does not need measurement.'],
      board: classicVsQuantumBoard(),
    },
    {
      id: 'quantum-vs-classic',
      eyebrow: es ? 'Caso 2' : 'Case 2',
      title: es ? 'Cuántica captura clásica' : 'Quantum captures classic',
      summary: es
        ? 'Se mide la atacante.'
        : 'The attacker is measured.',
      body: es
        ? 'Si la atacante está dividida y captura una pieza clásica, primero se decide si la atacante existía en la casilla desde la que intenta capturar.'
        : 'If the attacker is split and captures a classic piece, the attacker is measured first on the square it attacks from.',
      bullets: es
        ? ['Atacante existe: captura.', 'Atacante no existe: pierde la acción y colapsa en otro estado.', 'La pieza clásica no se mide.']
        : ['Attacker exists: capture.', 'Attacker absent: the action fails and it collapses elsewhere.', 'The classic piece is not measured.'],
      board: quantumVsClassicBoard(),
    },
    {
      id: 'quantum-vs-quantum',
      eyebrow: es ? 'Caso 3' : 'Case 3',
      title: es ? 'Cuántica captura cuántica' : 'Quantum captures quantum',
      summary: es
        ? 'Se mide atacante y después defensora.'
        : 'The attacker is measured, then the defender.',
      body: es
        ? 'Es la captura con más incertidumbre. Primero debe existir la atacante; si existe, se mide si la defensora también estaba en el destino.'
        : 'This is the most uncertain capture. First the attacker must exist; if it does, the defender is measured on the target.',
      bullets: es
        ? ['Puede tener dos pasos de ruleta.', 'Si falla la atacante, no hay captura.', 'Si existe la atacante y la defensora, se captura.']
        : ['It can have two roulette steps.', 'If the attacker fails, no capture happens.', 'If attacker and defender both exist, capture happens.'],
      board: quantumVsQuantumBoard(),
    },
    {
      id: 'tunnel',
      eyebrow: es ? 'Especial' : 'Special',
      title: es ? 'Efecto túnel' : 'Tunneling',
      summary: es
        ? 'Una pieza lineal puede atravesar una pieza cuántica.'
        : 'A sliding piece can pass through a quantum piece.',
      body: es
        ? 'Torres, alfiles y damas pueden atravesar una casilla ocupada solo probabilísticamente. Eso crea una relación de entrelazamiento que se resolverá al medir.'
        : 'Rooks, bishops, and queens can pass through a probabilistically occupied square. That creates an entanglement that resolves on measurement.',
      bullets: es
        ? ['No atraviesa piezas clásicas al 100%.', 'El bloqueo cuántico puede acabar existiendo o no.', 'Es una forma clave de abrir líneas.']
        : ['It cannot pass through 100% classic pieces.', 'The quantum blocker may later exist or not.', 'It is a key way to open lines.'],
      board: tunnelBoard(),
    },
    {
      id: 'quantum-castle',
      eyebrow: es ? 'Especial' : 'Special',
      title: es ? 'Enroque cuántico' : 'Quantum castling',
      summary: es
        ? 'Rey y torre quedan entrelazados entre posición original y enrocada.'
        : 'King and rook become entangled between original and castled positions.',
      body: es
        ? 'Si el camino no está ocupado por piezas clásicas, puedes enrocar cuánticamente. Rey y torre quedan repartidos entre ambos estados.'
        : 'If the path is not occupied by classic pieces, you can castle quantumly. King and rook are distributed across both states.',
      bullets: es
        ? ['Consume el derecho de enroque.', 'Protege y complica al mismo tiempo.', 'La medición futura resolverá dónde estaban realmente.']
        : ['It consumes castling rights.', 'It protects and complicates at the same time.', 'A future measurement resolves where they really were.'],
      board: quantumCastleBoard(),
    },
    {
      id: 'game-end',
      eyebrow: es ? 'Final' : 'Endgame',
      title: es ? 'Cómo se gana' : 'How to win',
      summary: es
        ? 'En cuántico se gana capturando el rey.'
        : 'In quantum mode, you win by capturing the king.',
      body: es
        ? 'No existe jaque ni jaque mate en esta variante. El rey puede entrar en una casilla atacada y la partida solo acaba cuando uno de los reyes es capturado tras aplicar movimiento y medición.'
        : 'There is no check or checkmate in this variant. A king may enter an attacked square and the game only ends when a king is captured after movement and measurement.',
      bullets: es
        ? ['Una amenaza al rey no invalida la jugada.', 'La captura del rey termina la partida.', 'Sin acciones legales, la partida es tablas.', 'Si hay medición, el resultado decide si la captura existe.']
        : ['A threat to the king does not invalidate a move.', 'Capturing the king ends the game.', 'With no legal actions, the game is drawn.', 'If measurement is involved, the result decides whether the capture exists.'],
      board: gameEndBoard(),
    },
  ]

  const academyMissionIds = new Set([
    'classic-move',
    'split',
    'merge',
    'measurement',
    'tunnel',
    'quantum-castle',
    'game-end',
  ])
  return steps.filter((step) => academyMissionIds.has(step.id))
}

export default function QuantumTutorial({ es }: QuantumTutorialProps) {
  const [index, setIndex] = useState(0)
  const [completed, setCompleted] = useState<Set<string>>(() => new Set())
  const [answer, setAnswer] = useState<'correct' | 'incorrect' | null>(null)
  const sqPx = useMiniSqPx()
  const steps = useMemo(() => getTutorialSteps(es), [es])
  const current = steps[index]
  const isFirst = index === 0
  const isLast = index === steps.length - 1
  const challenge = getMissionChallenge(current.id, es)

  const goTo = (next: number) => {
    setIndex(Math.max(0, Math.min(steps.length - 1, next)))
    setAnswer(null)
  }

  const answerMission = (correct: boolean) => {
    setAnswer(correct ? 'correct' : 'incorrect')
    if (correct) {
      setCompleted((currentCompleted) => new Set(currentCompleted).add(current.id))
    }
  }

  return (
    <section
      id="quantum-tutorial"
      data-testid="quantum-tutorial"
      className="scroll-mt-24"
      aria-labelledby="quantum-tutorial-title"
    >
      <div className="mb-6">
        <span className="text-ui-sm font-semibold text-indigo-400">
          {es ? 'Siete misiones guiadas' : 'Seven guided missions'}
        </span>
        <h2 id="quantum-tutorial-title" className="mt-2 text-3xl font-semibold text-white">
          {es ? 'Academia cuántica' : 'Quantum Academy'}
        </h2>
        <p className="mt-2 max-w-2xl text-ui-sm text-neutral-500">
          {es
            ? 'Aprende los movimientos especiales y las normas del modo cuántico paso a paso.'
            : 'Learn the special moves and rules of quantum mode step by step.'}
        </p>
        <p className="mt-3 font-mono text-ui-xs text-quantum" aria-live="polite">
          {completed.size} / {steps.length} {es ? 'misiones completadas' : 'missions completed'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="space-y-1" aria-label={es ? 'Pasos del tutorial' : 'Tutorial steps'}>
          {steps.map((step, stepIndex) => (
            <button
              key={step.id}
              type="button"
              data-testid={`tutorial-step-${step.id}`}
              onClick={() => goTo(stepIndex)}
              className={`w-full rounded border px-3 py-2 text-left text-ui-xs transition-colors ${
                stepIndex === index
                  ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-200'
                  : 'border-surface-4 bg-surface-1 text-neutral-500 hover:border-indigo-400/30 hover:text-neutral-300'
              }`}
            >
              <span className="block font-semibold uppercase tracking-wider">{step.eyebrow}</span>
              <span className="mt-0.5 block text-ui-sm normal-case tracking-normal">{step.title}</span>
              {completed.has(step.id) && (
                <span className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                  {es ? 'Completada' : 'Completed'}
                </span>
              )}
            </button>
          ))}
        </nav>

        <article className="overflow-hidden rounded-lg border border-indigo-500/20 bg-indigo-500/5">
          <AnimatePresence mode="wait">
            <m.div
              key={current.id}
              className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:p-6"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded border border-indigo-400/25 bg-indigo-500/10 px-2 py-1 text-ui-xs font-semibold uppercase tracking-wider text-indigo-300">
                    {current.eyebrow}
                  </span>
                  <span className="text-ui-xs text-neutral-600">
                    {index + 1} / {steps.length}
                  </span>
                </div>
                <h3 className="mt-4 text-ui-lg font-bold text-white">{current.title}</h3>
                <p className="mt-2 text-ui-sm font-medium text-indigo-200">{current.summary}</p>
                <p className="mt-4 text-ui-sm leading-relaxed text-neutral-300">{current.body}</p>
                <ul className="rules-bullet-list mt-4 space-y-2 text-ui-sm text-neutral-400">
                  {current.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col items-center justify-center gap-3">
                <MiniBoard squares={current.board} sqPx={sqPx} stepKey={current.id} />
                <fieldset className="w-full max-w-sm border-t border-line pt-4">
                  <legend className="px-1 text-ui-xs font-semibold text-ink">{challenge.prompt}</legend>
                  <div className="mt-3 grid gap-2">
                    {challenge.options.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => answerMission(option.correct)}
                        className="min-h-11 border border-line bg-surface-0 px-3 py-2 text-left text-ui-xs text-ink-secondary transition-colors hover:border-quantum hover:text-ink"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {answer && (
                    <p
                      className={`mt-3 border-l-2 px-3 py-2 text-ui-xs ${answer === 'correct' ? 'border-emerald-400 bg-emerald-500/[0.08] text-emerald-300' : 'border-red-400 bg-red-500/[0.08] text-red-300'}`}
                      role="status"
                    >
                      {answer === 'correct'
                        ? (es ? 'Misión completada. Ya puedes pasar a la siguiente.' : 'Mission complete. You can continue.')
                        : (es ? 'Todavía no. Revisa la explicación y prueba otra opción.' : 'Not yet. Review the explanation and try again.')}
                    </p>
                  )}
                </fieldset>
              </div>
            </m.div>
          </AnimatePresence>

          <div className="flex items-center justify-between border-t border-indigo-500/15 px-5 py-4 lg:px-6">
            <button
              type="button"
              data-testid="tutorial-prev"
              className="rules-step-btn"
              disabled={isFirst}
              onClick={() => goTo(index - 1)}
              aria-label={es ? 'Misión anterior' : 'Previous mission'}
            >
              <GameIcon name="chevron" className="rotate-180" />
            </button>
            <div className="flex gap-1.5" aria-hidden="true">
              {steps.map((step, stepIndex) => (
                <span
                  key={step.id}
                  className={`h-1.5 rounded-full transition-all ${
                    stepIndex === index ? 'w-6 bg-indigo-400' : 'w-1.5 bg-surface-4'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              data-testid="tutorial-next"
              className="rules-step-btn"
              disabled={isLast}
              onClick={() => goTo(index + 1)}
              aria-label={es ? 'Siguiente misión' : 'Next mission'}
            >
              <GameIcon name="chevron" />
            </button>
          </div>
        </article>
      </div>
    </section>
  )
}
