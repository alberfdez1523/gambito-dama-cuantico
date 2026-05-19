import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getApiCandidates, parseAPIError } from '../lib/api'

describe('api', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('includes /api and localhost fallback candidates', () => {
    const candidates = getApiCandidates()
    expect(candidates).toContain('/api')
  })

  it('parses JSON error bodies', async () => {
    const res = new Response(JSON.stringify({ error: 'Invalid FEN', code: 'BAD_REQUEST' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
    await expect(parseAPIError(res)).resolves.toBe('Invalid FEN')
  })

  it('falls back to status code message for non-JSON errors', async () => {
    const res = new Response('nope', { status: 503 })
    await expect(parseAPIError(res)).resolves.toBe('Error del servidor: 503')
  })
})
