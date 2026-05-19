import { useCallback, useRef, type RefObject } from 'react'
import type { PieceColor, PieceType } from '../lib/types'

const DRAG_THRESHOLD_PX = 8

function squareFromPoint(
  boardEl: HTMLElement | null,
  clientX: number,
  clientY: number,
): string | null {
  if (!boardEl) return null
  const el = document.elementFromPoint(clientX, clientY)
  const cell = el?.closest('[data-square]')
  if (!cell || !boardEl.contains(cell)) return null
  return cell.getAttribute('data-square')
}

export function useBoardPieceDrag(
  boardRef: RefObject<HTMLElement | null>,
  ghostRef: RefObject<HTMLDivElement | null>,
  onDrop: (from: string, to: string) => void,
  onDragEnd?: () => void,
) {
  const startRef = useRef<{ x: number; y: number; sq: string } | null>(null)
  const isDraggingRef = useRef(false)
  const hoverSqRef = useRef<string | null>(null)
  const rafRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)
  const listenersRef = useRef<{
    move: (e: PointerEvent) => void
    up: (e: PointerEvent) => void
    cancel: (e: PointerEvent) => void
  } | null>(null)

  const clearHover = useCallback(() => {
    const board = boardRef.current
    if (!board || !hoverSqRef.current) return
    const cell = board.querySelector(`[data-square="${hoverSqRef.current}"]`)
    cell?.classList.remove('sq-drop-hover')
    hoverSqRef.current = null
  }, [boardRef])

  const hideGhost = useCallback(() => {
    const ghost = ghostRef.current
    if (!ghost) return
    ghost.style.opacity = '0'
    ghost.style.visibility = 'hidden'
  }, [ghostRef])

  const finishDrag = useCallback(
    (clientX: number, clientY: number) => {
      const board = boardRef.current
      const from = startRef.current?.sq

      if (isDraggingRef.current && from) {
        const to = squareFromPoint(board, clientX, clientY)
        if (to && to !== from) onDrop(from, to)
      }

      if (from && board) {
        board.querySelector(`[data-square="${from}"]`)?.classList.remove('sq-drag-source')
      }
      board?.removeAttribute('data-dragging')
      board?.removeAttribute('data-drag-from')
      clearHover()
      hideGhost()

      startRef.current = null
      isDraggingRef.current = false

      if (listenersRef.current) {
        document.removeEventListener('pointermove', listenersRef.current.move)
        document.removeEventListener('pointerup', listenersRef.current.up)
        document.removeEventListener('pointercancel', listenersRef.current.cancel)
        listenersRef.current = null
      }

      onDragEnd?.()
    },
    [boardRef, clearHover, hideGhost, onDrop, onDragEnd],
  )

  const consumeClickSuppression = useCallback(() => {
    if (!suppressClickRef.current) return false
    suppressClickRef.current = false
    return true
  }, [])

  const beginPieceDrag = useCallback(
    (sq: string, e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()

      const board = boardRef.current
      const ghost = ghostRef.current
      if (!board || !ghost) return

      startRef.current = { x: e.clientX, y: e.clientY, sq }
      isDraggingRef.current = false
      suppressClickRef.current = false

      const onPointerMove = (ev: PointerEvent) => {
        const start = startRef.current
        if (!start) return

        const dx = ev.clientX - start.x
        const dy = ev.clientY - start.y
        if (!isDraggingRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return

        if (!isDraggingRef.current) {
          isDraggingRef.current = true
          suppressClickRef.current = true
          board.setAttribute('data-dragging', 'true')
          board.setAttribute('data-drag-from', start.sq)
          board.querySelector(`[data-square="${start.sq}"]`)?.classList.add('sq-drag-source')
          ghost.style.visibility = 'visible'
          ghost.style.opacity = '0.92'
        }

        if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
          ghost.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px) translate(-50%, -50%)`

          const nextSq = squareFromPoint(board, ev.clientX, ev.clientY)
          if (nextSq === hoverSqRef.current) return
          clearHover()
          hoverSqRef.current = nextSq
          if (nextSq) {
            board.querySelector(`[data-square="${nextSq}"]`)?.classList.add('sq-drop-hover')
          }
        })
      }

      const onPointerUp = (ev: PointerEvent) => {
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
        finishDrag(ev.clientX, ev.clientY)
      }

      listenersRef.current = { move: onPointerMove, up: onPointerUp, cancel: onPointerUp }
      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', onPointerUp)
      document.addEventListener('pointercancel', onPointerUp)
    },
    [boardRef, clearHover, finishDrag, ghostRef],
  )

  return { beginPieceDrag, consumeClickSuppression }
}

export interface DragGhostPiece {
  type: PieceType
  color: PieceColor
}
