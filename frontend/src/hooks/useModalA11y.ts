import { useEffect } from 'react'
import { useFocusTrap } from './useFocusTrap'

export function useModalA11y(active: boolean, onClose?: () => void, allowBackdropClose = false) {
  const containerRef = useFocusTrap(active)

  useEffect(() => {
    if (!active) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [active, onClose])

  const onBackdropClick = allowBackdropClose && onClose
    ? (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose()
      }
    : undefined

  return { containerRef, onBackdropClick }
}
