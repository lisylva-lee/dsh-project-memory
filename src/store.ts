/**
 * File-backed config store at ~/.dsh/dsh-project-memory.json (mode 0600,
 * atomic tmp+rename writes). The file is the GUI-edited source of truth;
 * a missing file means "no user config yet".
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { CONFIG_FILE_NAME, DEFAULT_CONFIG, type MemoryConfig, type SessionOverride } from './core/contract.ts'

/** Resolve the config file path under the dsh home. */
export function configPath(home: string = homedir()): string {
  return join(home, '.dsh', CONFIG_FILE_NAME)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** Validate/normalize an untrusted config document (file or request body). */
export function normalizeConfig(raw: unknown): MemoryConfig {
  const base = { ...DEFAULT_CONFIG }
  if (!isRecord(raw)) return base
  const sessions: Record<string, SessionOverride> = {}
  if (isRecord(raw.sessions)) {
    for (const [id, entry] of Object.entries(raw.sessions)) {
      if (id === '' || !isRecord(entry)) continue
      if (typeof entry.enabled === 'boolean') sessions[id] = { enabled: entry.enabled }
    }
  }
  return {
    enabled: toBool(raw.enabled, base.enabled),
    autoInit: toBool(raw.autoInit, base.autoInit),
    autoMaintain: toBool(raw.autoMaintain, base.autoMaintain),
    announceToAgent: toBool(raw.announceToAgent, base.announceToAgent),
    sessions,
  }
}

/** Atomic file store for the plugin config. */
export class MemoryStore {
  /** @param path - config file path (test seam; defaults to ~/.dsh/dsh-project-memory.json). */
  constructor(private readonly path: string = configPath()) {}

  /** Whether a user config document exists on disk. */
  exists(): boolean {
    return existsSync(this.path)
  }

  /** Load the config document; undefined when no file exists (or it is unreadable). */
  load(): MemoryConfig | undefined {
    try {
      if (!existsSync(this.path)) return undefined
      return normalizeConfig(JSON.parse(readFileSync(this.path, 'utf8')) as unknown)
    } catch {
      return undefined
    }
  }

  /** Persist a full config document (atomic tmp+rename, mode 0600). */
  save(config: MemoryConfig): void {
    const dir = dirname(this.path)
    mkdirSync(dir, { recursive: true })
    const tmp = this.path + '.tmp-' + process.pid
    writeFileSync(tmp, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
    renameSync(tmp, this.path)
  }

  /** Merge global switches into the document and persist. */
  updateGlobal(patch: {
    enabled?: boolean
    autoInit?: boolean
    autoMaintain?: boolean
    announceToAgent?: boolean
  }): MemoryConfig {
    const current = this.load() ?? DEFAULT_CONFIG
    const next = normalizeConfig({
      ...current,
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.autoInit !== undefined ? { autoInit: patch.autoInit } : {}),
      ...(patch.autoMaintain !== undefined ? { autoMaintain: patch.autoMaintain } : {}),
      ...(patch.announceToAgent !== undefined ? { announceToAgent: patch.announceToAgent } : {}),
    })
    this.save(next)
    return next
  }

  /** Set (boolean) or clear (null) one session override, then persist. */
  setSession(sessionId: string, enabled: boolean | null): MemoryConfig {
    const current = this.load() ?? DEFAULT_CONFIG
    const sessions = { ...current.sessions }
    if (enabled === null) {
      delete sessions[sessionId]
    } else {
      sessions[sessionId] = { enabled }
    }
    const next = normalizeConfig({ ...current, sessions })
    this.save(next)
    return next
  }
}
