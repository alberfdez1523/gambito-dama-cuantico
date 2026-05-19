export default function BoardSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-sm ring-1 ring-white/[0.06]"
      style={{ width: 'var(--board-size)', height: 'var(--board-size)' }}
      aria-hidden="true"
    >
      <div className="grid h-full w-full grid-cols-8 grid-rows-8 animate-pulse">
        {Array.from({ length: 64 }, (_, i) => {
          const row = Math.floor(i / 8)
          const col = i % 8
          const isLight = (row + col) % 2 !== 0
          return (
            <div
              key={i}
              className={isLight ? 'bg-surface-3/80' : 'bg-surface-2/90'}
            />
          )
        })}
      </div>
    </div>
  )
}
