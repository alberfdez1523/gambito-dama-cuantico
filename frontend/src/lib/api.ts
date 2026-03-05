import type { APIMoveResponse, Difficulty, QuantumAIMoveResponse } from './types'

const API_BASE = '/api'

// ─── Solicitar movimiento de la IA ───
export async function requestAIMove(
  fen: string,
  difficulty: Difficulty
): Promise<APIMoveResponse> {
  const res = await fetch(`${API_BASE}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen, difficulty }),
  })
  if (!res.ok) throw new Error(`Error del servidor: ${res.status}`)
  return res.json()
}

// ─── Solicitar evaluación de la posición ───
export async function requestEval(fen: string): Promise<{ evaluation: number; mate: number | null }> {
  const res = await fetch(`${API_BASE}/eval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fen }),
  })
  if (!res.ok) throw new Error(`Error del servidor: ${res.status}`)
  return res.json()
}

// ─── Solicitar movimiento cuántico de la IA (Enfoque Multiverso) ───
export async function requestQuantumAIMove(
  quantumState: object,
  difficulty: Difficulty,
): Promise<QuantumAIMoveResponse> {
  const res = await fetch(`${API_BASE}/quantum/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantum_state: quantumState, difficulty }),
  })
  if (!res.ok) throw new Error(`Error del servidor: ${res.status}`)
  return res.json()
}

// ─── Verificar estado del servidor ───
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return false
    const data = await res.json() as { engine?: boolean }
    return !!data.engine
  } catch {
    return false
  }
}
