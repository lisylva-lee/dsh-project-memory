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
      enabled: true, autoInit: true, autoMaintain: true, announceToAgent: true, sessions: {},
    })
  })

  it('keeps boolean globals and drops invalid session entries', () => {
    const raw = {
      enabled: false,
      autoInit: 1,
      sessions: { good: { enabled: false }, bad: { enabled: 'yes' }, empty: {} },
    }
    const result = normalizeConfig(raw)
    expect(result.enabled).toBe(false)
    expect(result.autoInit).toBe(true)
    expect(result.sessions).toEqual({ good: { enabled: false } })
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
    const first = store.updateGlobal({ enabled: false, autoMaintain: false })
    expect(first.enabled).toBe(false)
    expect(first.autoMaintain).toBe(false)

    const withSession = store.setSession('sess-1', false)
    expect(withSession.sessions['sess-1']).toEqual({ enabled: false })

    const reloaded = new MemoryStore(path).load()
    expect(reloaded?.enabled).toBe(false)
    expect(reloaded?.sessions['sess-1']).toEqual({ enabled: false })

    const cleared = store.setSession('sess-1', null)
    expect(cleared.sessions['sess-1']).toBeUndefined()
  })

  it('persists a 0600 owner-only file (non-Windows)', () => {
    if (process.platform === 'win32') return // Windows has no chmod semantics
    const mode = statSync(path).mode & 0o777
    expect(mode).toBe(0o600)
  })

  afterAll(() => { rmSync(dir, { recursive: true, force: true }) })
})