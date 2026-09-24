import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { LazyMotion } from 'framer-motion'
import App from './App'
import './index.css'

const loadMotionFeatures = () => import('./lib/motionFeatures').then((module) => module.default)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={loadMotionFeatures} strict>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </LazyMotion>
  </StrictMode>,
)
