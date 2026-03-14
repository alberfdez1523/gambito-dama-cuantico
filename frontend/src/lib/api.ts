import type { APIMoveResponse, Difficulty } from './types'

const explicitApiBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, '')
const LOCAL_DEV_API_BASE = 'http://localhost:8000/api'

let cachedApiBase: string | null = explicitApiBase || null

function getApiCandidates(): string[] {
  const candidates = new Set<string>()

  if (explicitApiBase) candidates.add(explicitApiBase)
  candidates.add('/api')

  if (typeof window !== 'undefined') {
    const isLocalDevHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    if (isLocalDevHost && window.location.port === '5173') {
      candidates.add(LOCAL_DEV_API_BASE)
    }
  }

  return [...candidates]
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const tried = new Set<string>()
  const bases = cachedApiBase
    ? [cachedApiBase, ...getApiCandidates().filter((base) => base !== cachedApiBase)]
    : getApiCandidates()

  let lastResponse: Response | null = null
  let lastError: unknown = null

  for (const base of bases) {
    if (tried.has(base)) continue
    tried.add(base)

    try {
      const response = await fetch(`${base}${path}`, init)
      if (response.ok || response.status !== 404) {
        cachedApiBase = base
        return response
      }
      lastResponse = response
    } catch (error) {
      lastError = error
    }
  }

  if (lastResponse) return lastResponse
  throw lastError ?? new Error('No se pudo conectar con la API')
}

export async function requestAIMove(
  fen: string,
  difficulty: Difficulty
): Promise<APIMoveResponse> {
  const res = await apiFetch('/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, difficulty }),
  })
  if (!res.ok) throw new Error(`Error del servidor: ${res.status}`)
  return res.json()
}

export async function requestEval(fen: string): Promise<{ evaluation: number; mate: number | null }> {
  const res = await apiFetch('/eval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen }),
  })
  if (!res.ok) throw new Error(`Error del servidor: ${res.status}`)
  return res.json()
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await apiFetch('/health', { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return false
    const data = await res.json() as { engine?: boolean }
    return !!data.engine
  } catch {
    return false
  }
}
