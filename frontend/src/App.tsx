import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import StartMenu from './components/StartMenu'
import GameScreen from './components/GameScreen'
import type { GameConfig } from './lib/types'

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'game'>('menu')
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null)

  const handlePlay = useCallback((config: GameConfig) => {
    setGameConfig(config)
    setScreen('game')
  }, [])

  const handleNewGame = useCallback(() => {
    setGameConfig(null)
    setScreen('menu')
  }, [])

  return (
    <AnimatePresence mode="wait">
      {screen === 'menu' ? (
        <motion.div
          key="menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <StartMenu onPlay={handlePlay} />
        </motion.div>
      ) : gameConfig ? (
        <motion.div
          key="game"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <GameScreen config={gameConfig} onNewGame={handleNewGame} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
