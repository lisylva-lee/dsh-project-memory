/**
 * Unit tests for the config route family (loopback fence + JSON handling).
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, describe, expect, it } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { isLoopbackRequest, makeRoutes } from '../src/routes.ts'
import { MemoryStore } from '../src/store.ts'

function fakeRequest(method: string, body?: unknown): IncomingMessage {
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body))
  let index = 0
  const req = {
    method,
    socket: { remoteAddress: '127.0.0.1' },
    [Symbol.asyncIterator]() {
      return {
        next: async () => {
          if (payload === null || index >= payload.length) return { done: true, value: undefined }
          const end = Math.min(index + 64, payload.length)
          const chunk = payload.subarray(index, end)
          index = end
          return { done: false, value: chunk }
        },
      }
    },
  } as unknown as IncomingMessage
  return req
}

interface CapturedResponse {
  res: ServerResponse
  status: number
  body: unknown
}

function fakeResponse(): CapturedResponse {
  const captured = { status: 0, body: undefined as unknown } as CapturedResponse
  captured.res = {
    writeHead(status: number) { captured.status = status },
    end(body: unknown) { captured.body = typeof body === 'string' ? JSON.parse(body) : body },
  } as unknown as ServerResponse
  return captured
}

describe('config routes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-pm-routes-'))
  const store = new MemoryStore(join(dir, 'config.json'))
  let changed = 0
  const routes = makeRoutes(store, () => { changed += 1 })
  const configRoute = routes.find(route => route.path.endsWith('/config'))
  const sessionRoute = routes.find(route => route.path.endsWith('/session'))

  it('fences non-loopback peers and admits loopback', () => {
    expect(isLoopbackRequest({ socket: { remoteAddress: '127.0.0.1' } } as IncomingMessage)).toBe(true)
    expect(isLoopbackRequest({ socket: { remoteAddress: '::1' } } as IncomingMessage)).toBe(true)
    expect(isLoopbackRequest({ socket: { remoteAddress: '10.0.0.5' } } as IncomingMessage)).toBe(false)
  })

  it('GET returns defaults before any save', async () => {
    const captured = fakeResponse()
    await configRoute?.handler(fakeRequest('GET'), captured.res)
    expect(captured.status).toBe(200)
    expect((captured.body as { enabled?: boolean }).enabled).toBe(true)
    expect((captured.body as { sessions?: unknown }).sessions).toEqual({})
  })

  it('PUT config patches globals and fires onChange', async () => {
    const captured = fakeResponse()
    await configRoute?.handler(fakeRequest('PUT', { enabled: false, autoMaintain: false }), captured.res)
    expect(captured.status).toBe(200)
    expect((captured.body as { enabled?: boolean }).enabled).toBe(false)
    expect(changed).toBe(1)
  })

  it('PUT session sets and clears an override', async () => {
    const setRes = fakeResponse()
    await sessionRoute?.handler(fakeRequest('PUT', { sessionId: 's-1', enabled: false }), setRes.res)
    expect(setRes.status).toBe(200)
    expect((setRes.body as { sessions?: Record<string, { enabled?: boolean }> }).sessions?.['s-1']).toEqual({ enabled: false })

    const clearRes = fakeResponse()
    await sessionRoute?.handler(fakeRequest('PUT', { sessionId: 's-1', enabled: null }), clearRes.res)
    expect((clearRes.body as { sessions?: Record<string, unknown> }).sessions?.['s-1']).toBeUndefined()
  })

  it('rejects a missing sessionId', async () => {
    const captured = fakeResponse()
    await sessionRoute?.handler(fakeRequest('PUT', { enabled: true }), captured.res)
    expect(captured.status).toBe(400)
  })

  afterAll(() => { rmSync(dir, { recursive: true, force: true }) })
})