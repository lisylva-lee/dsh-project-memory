/**
 * Unit tests for the config route family (loopback fence + JSON handling).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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
    url: '/api/dsh-project-memory/placeholder',
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
  const countRoute = routes.find(route => route.path.endsWith('/count'))
  const compressNowRoute = routes.find(route => route.path.endsWith('/compress-now'))

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
    expect((captured.body as { autoCompress?: boolean }).autoCompress).toBe(true)
    expect((captured.body as { sessions?: unknown }).sessions).toEqual({})
  })

  it('PUT config patches globals and fires onChange', async () => {
    const captured = fakeResponse()
    await configRoute?.handler(fakeRequest('PUT', { enabled: false, autoMaintain: false, autoCompress: false, compressInterval: 3 }), captured.res)
    expect(captured.status).toBe(200)
    expect((captured.body as { enabled?: boolean }).enabled).toBe(false)
    expect((captured.body as { autoCompress?: boolean }).autoCompress).toBe(false)
    expect((captured.body as { compressInterval?: number }).compressInterval).toBe(3)
    expect(changed).toBe(1)
  })

  it('PUT session sets and clears memory and compression overrides', async () => {
    const setRes = fakeResponse()
    await sessionRoute?.handler(fakeRequest('PUT', { sessionId: 's-1', enabled: false, compress: true }), setRes.res)
    expect(setRes.status).toBe(200)
    expect((setRes.body as { sessions?: Record<string, { enabled?: boolean; compressEnabled?: boolean }> }).sessions?.['s-1'])
      .toEqual({ enabled: false, compressEnabled: true })

    const clearRes = fakeResponse()
    await sessionRoute?.handler(fakeRequest('PUT', { sessionId: 's-1', compress: null }), clearRes.res)
    expect((clearRes.body as { sessions?: Record<string, { enabled?: boolean; compressEnabled?: boolean }> }).sessions?.['s-1'])
      .toEqual({ enabled: false })
  })

  it('rejects a missing sessionId or an empty payload', async () => {
    const missing = fakeResponse()
    await sessionRoute?.handler(fakeRequest('PUT', { enabled: true }), missing.res)
    expect(missing.status).toBe(400)

    const empty = fakeResponse()
    await sessionRoute?.handler(fakeRequest('PUT', { sessionId: 's-1' }), empty.res)
    expect(empty.status).toBe(400)
  })

  it('count route reports the per-project counter and interval', async () => {
    const project = join(dir, 'proj')
    mkdirSync(project, { recursive: true })
    store.setCount(project, 2)
    const req = fakeRequest('GET')
    req.url = '/api/dsh-project-memory/count?cwd=' + encodeURIComponent(project)
    const captured = fakeResponse()
    await countRoute?.handler(req, captured.res)
    expect(captured.status).toBe(200)
    expect((captured.body as { count?: number }).count).toBe(2)
    expect((captured.body as { interval?: number }).interval).toBe(3)
  })

  it('compress-now compresses a valid project and 400s on a bogus cwd', async () => {
    const project = join(dir, 'proj2')
    mkdirSync(join(project, 'memory'), { recursive: true })
    writeFileSync(
      join(project, 'MEMORY.md'),
      '# MEMORY.md — t\n\n| 日期 | 标题 | 关键词 | 子记忆 |\n|------|------|--------|--------|\n| 2026-08-21 | a | #x | memory/a.md |\n',
      'utf8',
    )
    const good = fakeResponse()
    await compressNowRoute?.handler(fakeRequest('POST', { cwd: project }), good.res)
    expect(good.status).toBe(200)
    expect((good.body as { index?: boolean }).index).toBe(false) // single row: nothing to compress

    const bad = fakeResponse()
    await compressNowRoute?.handler(fakeRequest('POST', { cwd: join(dir, 'nope') }), bad.res)
    expect(bad.status).toBe(400)
  })

  afterAll(() => { rmSync(dir, { recursive: true, force: true }) })
})
