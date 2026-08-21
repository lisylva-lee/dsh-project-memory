/**
 * The /api/dsh-project-memory route family: GET/PUT the plugin config, PUT
 * one session override (memory and/or compression), GET the per-project
 * compression counter and POST a manual compression. Every route carries the
 * same loopback-only trust fence as the dsh-ssh / dsh-desktop-launcher routes
 * — this endpoint writes files on the host machine, so LAN-exposed dsh web
 * deployments must not serve it.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { runCompression } from './core/compress.ts'
import { API_PREFIX, DEFAULT_CONFIG } from './core/contract.ts'
import type { MemoryStore } from './store.ts'

/** Whether a request arrived over a loopback socket. */
export function isLoopbackRequest(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress ?? ''
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

/** Write one JSON response. */
export function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'referrer-policy': 'no-referrer',
  })
  res.end(payload)
}

const MAX_BODY_BYTES = 64 * 1024

/** Read and JSON-parse a bounded request body; null on failure. */
export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    size += buffer.length
    if (size > MAX_BODY_BYTES) return null
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    return null
  }
}

/** Whether the body's named value is a boolean or null. */
function isBoolOrNull(value: unknown): value is boolean | null {
  return value === null || typeof value === 'boolean'
}

/**
 * Build the config route family.
 * @param store - the config store.
 * @param onChange - invoked after a successful write (re-syncs plugin surfaces).
 * @returns the routes.
 */
export function makeRoutes(store: MemoryStore, onChange: () => void): WebRoute[] {
  return [
    {
      kind: 'exact',
      path: API_PREFIX + '/config',
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: 'forbidden: loopback-only' })
          return
        }
        const method = req.method ?? 'GET'
        if (method === 'GET') {
          writeJson(res, 200, store.load() ?? DEFAULT_CONFIG)
          return
        }
        if (method === 'PUT') {
          const body = await readJsonBody(req)
          if (typeof body !== 'object' || body === null || Array.isArray(body)) {
            writeJson(res, 400, { error: 'invalid JSON body' })
            return
          }
          const patch = body as Record<string, unknown>
          const clean: {
            enabled?: boolean
            autoInit?: boolean
            autoMaintain?: boolean
            announceToAgent?: boolean
            autoCompress?: boolean
            compressInterval?: number
          } = {}
          for (const key of ['enabled', 'autoInit', 'autoMaintain', 'announceToAgent', 'autoCompress'] as const) {
            if (typeof patch[key] === 'boolean') clean[key] = patch[key] as boolean
          }
          if (typeof patch.compressInterval === 'number' && Number.isInteger(patch.compressInterval) && patch.compressInterval >= 1) {
            clean.compressInterval = patch.compressInterval
          }
          const next = store.updateGlobal(clean)
          onChange()
          writeJson(res, 200, next)
          return
        }
        writeJson(res, 405, { error: 'method not allowed: ' + method })
      },
    },
    {
      kind: 'exact',
      path: API_PREFIX + '/session',
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: 'forbidden: loopback-only' })
          return
        }
        const method = req.method ?? 'GET'
        if (method !== 'PUT') {
          writeJson(res, 405, { error: 'method not allowed: ' + method })
          return
        }
        const body = await readJsonBody(req)
        if (typeof body !== 'object' || body === null || Array.isArray(body)) {
          writeJson(res, 400, { error: 'invalid JSON body' })
          return
        }
        const { sessionId, enabled, compress } = body as { sessionId?: unknown; enabled?: unknown; compress?: unknown }
        if (typeof sessionId !== 'string' || sessionId === '') {
          writeJson(res, 400, { error: 'sessionId required' })
          return
        }
        if (enabled === undefined && compress === undefined) {
          writeJson(res, 400, { error: 'enabled or compress required' })
          return
        }
        if (enabled !== undefined && !isBoolOrNull(enabled)) {
          writeJson(res, 400, { error: 'enabled must be a boolean (or null to clear)' })
          return
        }
        if (compress !== undefined && !isBoolOrNull(compress)) {
          writeJson(res, 400, { error: 'compress must be a boolean (or null to clear)' })
          return
        }
        let next = store.load() ?? DEFAULT_CONFIG
        if (enabled !== undefined) next = store.setSession(sessionId, enabled as boolean | null)
        if (compress !== undefined) next = store.setSessionCompress(sessionId, compress as boolean | null)
        onChange()
        writeJson(res, 200, next)
      },
    },
    {
      kind: 'exact',
      path: API_PREFIX + '/count',
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: 'forbidden: loopback-only' })
          return
        }
        if ((req.method ?? 'GET') !== 'GET') {
          writeJson(res, 405, { error: 'method not allowed: ' + (req.method ?? 'GET') })
          return
        }
        const url = new URL(req.url ?? '/', 'http://x')
        const cwd = url.searchParams.get('cwd')
        const config = store.load() ?? DEFAULT_CONFIG
        writeJson(res, 200, {
          cwd,
          count: cwd ? (config.counts[cwd] ?? 0) : 0,
          interval: config.compressInterval,
        })
      },
    },
    {
      kind: 'exact',
      path: API_PREFIX + '/compress-now',
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: 'forbidden: loopback-only' })
          return
        }
        const method = req.method ?? 'GET'
        if (method !== 'POST') {
          writeJson(res, 405, { error: 'method not allowed: ' + method })
          return
        }
        const body = await readJsonBody(req)
        if (typeof body !== 'object' || body === null || Array.isArray(body)) {
          writeJson(res, 400, { error: 'invalid JSON body' })
          return
        }
        const { cwd } = body as { cwd?: unknown }
        if (typeof cwd !== 'string' || cwd === '' || !existsSync(join(cwd, 'MEMORY.md'))) {
          writeJson(res, 400, { error: 'invalid cwd' })
          return
        }
        const results = runCompression(cwd)
        store.setCount(cwd, 0)
        writeJson(res, 200, results)
      },
    },
  ]
}
