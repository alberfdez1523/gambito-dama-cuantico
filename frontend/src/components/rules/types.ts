export interface MiniSquare {
  piece?: string
  isLight: boolean
  highlight?: 'selected' | 'target' | 'quantum' | 'merge' | 'check' | 'arrow' | 'blocked'
  label?: string
  arrowDir?: string
  opacity?: number
}

export interface RuleStep {
  caption: string
  board: MiniSquare[][]
}

export type RuleCategory = 'intro' | 'movement' | 'captures' | 'special' | 'endgame'

export interface RuleDefinition {
  id: string
  title: string
  icon: string
  summary: string
  desc: string
  bullets?: string[]
  tip?: string
  steps?: RuleStep[]
  board?: MiniSquare[][]
  color?: string
  bgColor?: string
  category: RuleCategory
}

export interface PieceGuideEntry {
  id: string
  piece: string
  name: string
  short: string
  detail: string
  board: MiniSquare[][]
}

export interface CaptureScenario {
  id: string
  attacker: 'classic' | 'quantum'
  defender: 'classic' | 'quantum'
  label: string
  measured: string
  outcome: string
  steps: RuleStep[]
}
