/**
 * Unit tests for the config store and normalization.
 */
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, describe, expect, it } from 'vitest'
import { MemoryStore, normalizeConfig } from '../src/store.ts'

describe('normalizeConfig', () => {
  it('applies defaults for a missing document', () => {
    expect(normalizeConfig(undefined)).toEqual({
      enabled: true,
      autoInit: true,
      autoMaintain: true,
      announceToAgent: true,
      autoCompress: true,
      compressInterval: 5,
      sessions: {},
      counts: {},
    })
  })

  it('keeps boolean globals, intervals and drops invalid session entries', () => {
    const raw = {
      enabled: false,
      autoInit: 1,
      autoCompress: false,
      compressInterval: 3,
      counts: { '/x': 2, '/y': -1, '/z': 'nope' },
      sessions: {
        good: { enabled: false, compressEnabled: true },
        badEnabled: { enabled: 'yes' },
        badCompress: { compressEnabled: 1 },
        empty: {},
      },
    }
    const result = normalizeConfig(raw)
    expect(result.enabled).toBe(false)
    expect(result.autoInit).toBe(true)
    expect(result.autoCompress).toBe(false)
    expect(result.compressInterval).toBe(3)
    expect(result.counts).toEqual({ '/x': 2 })
    expect(result.sessions).toEqual({ good: { enabled: false, compressEnabled: true } })
  })

  it('rejects non-positive intervals with the default', () => {
    expect(normalizeConfig({ compressInterval: 0 }).compressInterval).toBe(5)
    expect(normalizeConfig({ compressInterval: 2.5 }).compressInterval).toBe(5)
  })
})

describe('MemoryStore', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-pm-store-'))
  const path = join(dir, 'config.json')

  it('loads undefined before any save', () => {
    const store = new MemoryStore(path)
    expect(store.exists()).toBe(false)
    expect(store.load()).toBeUndefined()
  })

  it('round-trips global updates and session overrides', () => {
    const store = new MemoryStore(path)
    const first = store.updateGlobal({ enabled: false, autoMaintain: false, autoCompress: false })
    expect(first.enabled).toBe(false)
    expect(first.autoMaintain).toBe(false)
    expect(first.autoCompress).toBe(false)

    const withSession = store.setSession('sess-1', false)
    expect(withSession.sessions['sess-1']).toEqual({ enabled: false })

    const withCompress = store.setSessionCompress('sess-1', true)
    expect(withCompress.sessions['sess-1']).toEqual({ enabled: false, compressEnabled: true })

    const reloaded = new MemoryStore(path).load()
    expect(reloaded?.enabled).toBe(false)
    expect(reloaded?.sessions['sess-1']).toEqual({ enabled: false, compressEnabled: true })

    const cleared = store.setSession('sess-1', null)
    expect(cleared.sessions['sess-1']).toEqual({ compressEnabled: true })

    const clearedCompress = store.setSessionCompress('sess-1', null)
    expect(clearedCompress.sessions['sess-1']).toBeUndefined()
  })

  it('persists per-project compression counters and clears them at zero', () => {
    const store = new MemoryStore(path)
    expect(store.setCount('/proj', 3).counts['/proj']).toBe(3)
    expect(store.setCount('/proj', 0).counts['/proj']).toBeUndefined()
  })

  it('persists a 0600 owner-only file (non-Windows)', () => {
    if (process.platform === 'win32') return // Windows has no chmod semantics
    const mode = statSync(path).mode & 0o777
    expect(mode).toBe(0o600)
  })

  afterAll(() => { rmSync(dir, { recursive: true, force: true }) })
})
