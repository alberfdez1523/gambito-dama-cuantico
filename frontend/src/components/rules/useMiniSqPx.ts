import { useEffect, useState } from 'react'

export function useMiniSqPx() {
  const [sqPx, setSqPx] = useState(40)

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      setSqPx(w < 640 ? 34 : w < 1024 ? 40 : 44)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return sqPx
}
