import { useEffect, useRef, useCallback } from 'react'

/** Offset desde el borde superior (header sticky + margen) */
const SCROLL_SPY_OFFSET = 120

/**
 * Resalta en el índice la sección cuya cabecera ha pasado el umbral al hacer scroll.
 */
export function useRulesScrollSpy(sectionIds: string[], setActiveSection: (id: string) => void) {
  const isProgrammaticScroll = useRef(false)
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeRef = useRef('')

  useEffect(() => {
    if (sectionIds.length === 0) return

    activeRef.current = sectionIds[0]
    setActiveSection(sectionIds[0])

    const updateFromScroll = () => {
      if (isProgrammaticScroll.current) return

      let current = sectionIds[0]
      for (const id of sectionIds) {
        const el = document.getElementById(id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= SCROLL_SPY_OFFSET) {
          current = id
        }
      }
      if (current !== activeRef.current) {
        activeRef.current = current
        setActiveSection(current)
      }
    }

    const raf = requestAnimationFrame(updateFromScroll)
    window.addEventListener('scroll', updateFromScroll, { passive: true })
    window.addEventListener('resize', updateFromScroll, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', updateFromScroll)
      window.removeEventListener('resize', updateFromScroll)
    }
  }, [sectionIds, setActiveSection])

  const scrollToSection = useCallback(
    (id: string) => {
      activeRef.current = id
      setActiveSection(id)
      isProgrammaticScroll.current = true
      if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current)

      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

      scrollEndTimer.current = setTimeout(() => {
        isProgrammaticScroll.current = false
      }, 700)
    },
    [setActiveSection],
  )

  return { scrollToSection }
}
