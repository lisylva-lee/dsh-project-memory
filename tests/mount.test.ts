/**
 * Mount smoke test: plugin apply() must never throw. The cordis loader aborts
 * the whole profile when a plugin throws while mounting, which is exactly how
 * v0.2.0 broke the desktop app (ENOENT on a workflow asset at mount time).
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, describe, expect, it } from 'vitest'
import { apply } from '../src/index.ts'

const home = mkdtempSync(join(tmpdir(), 'dsh-mount-'))
const previousHome = process.env.DSH_HOME
process.env.DSH_HOME = home

afterAll(() => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  rmSync(home, { recursive: true, force: true })
})

interface FakeContext {
  logger: { info: (m: string) => void; warn: (m: string) => void }
  on: (name: string, handler: (payload?: unknown) => void) => () => void
  effect: (fn: () => (() => void) | void, label?: string) => () => void
  systemPrompt: { section: (input: unknown) => () => void }
  skills: { register: (input: unknown) => () => void }
  webServer: { register: (input: unknown) => () => void }
}

function fakeContext(): { ctx: FakeContext; warnings: string[] } {
  const warnings: string[] = []
  const ctx: FakeContext = {
    logger: { info: () => {}, warn: (message: string) => { warnings.push(String(message)) } },
    on: () => () => {},
    effect: (fn) => { const dispose = fn(); return typeof dispose === 'function' ? dispose : () => {} },
    systemPrompt: { section: () => () => {} },
    skills: { register: () => () => {} },
    webServer: { register: () => () => {} },
  }
  return { ctx, warnings }
}

describe('apply() mount safety', () => {
  it('mounts without throwing and without warnings', () => {
    const { ctx, warnings } = fakeContext()
    expect(() => apply(ctx as never)).not.toThrow()
    expect(warnings).toEqual([])
  })

  it('still mounts when every optional surface is disabled', () => {
    const { ctx, warnings } = fakeContext()
    expect(() =>
      apply(ctx as never, {
        enabled: false,
        workflow: { enabled: false },
      }),
    ).not.toThrow()
    expect(warnings).toEqual([])
  })

  it('survives a broken surface registration (warning instead of a crash)', () => {
    const { ctx, warnings } = fakeContext()
    ctx.skills.register = () => { throw new Error('boom') }
    expect(() => apply(ctx as never)).not.toThrow()
    expect(warnings.length).toBeGreaterThan(0)
  })
})
