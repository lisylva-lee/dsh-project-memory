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

function toInterval(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : fallback
}

function toCounts(raw: unknown): Record<string, number> {
  const counts: Record<string, number> = {}
  if (isRecord(raw)) {
    for (const [cwd, value] of Object.entries(raw)) {
      if (cwd !== '' && typeof value === 'number' && Number.isInteger(value) && value >= 0) {
        counts[cwd] = value
      }
    }
  }
  return counts
}

/** Validate/normalize an untrusted config document (file or request body). */
export function normalizeConfig(raw: unknown): MemoryConfig {
  const base = { ...DEFAULT_CONFIG }
  if (!isRecord(raw)) return base
  const sessions: Record<string, SessionOverride> = {}
  if (isRecord(raw.sessions)) {
    for (const [id, entry] of Object.entries(raw.sessions)) {
      if (id === '' || !isRecord(entry)) continue
      const override: SessionOverride = {}
      if (typeof entry.enabled === 'boolean') override.enabled = entry.enabled
      if (typeof entry.compressEnabled === 'boolean') override.compressEnabled = entry.compressEnabled
      if (override.enabled !== undefined || override.compressEnabled !== undefined) sessions[id] = override
    }
  }
  return {
    enabled: toBool(raw.enabled, base.enabled),
    autoInit: toBool(raw.autoInit, base.autoInit),
    autoMaintain: toBool(raw.autoMaintain, base.autoMaintain),
    announceToAgent: toBool(raw.announceToAgent, base.announceToAgent),
    autoCompress: toBool(raw.autoCompress, base.autoCompress),
    compressInterval: toInterval(raw.compressInterval, base.compressInterval),
    sessions,
    counts: toCounts(raw.counts),
  }
}

/** Global switches a config PUT may patch. */
export interface GlobalPatch {
  enabled?: boolean
  autoInit?: boolean
  autoMaintain?: boolean
  announceToAgent?: boolean
  autoCompress?: boolean
  compressInterval?: number
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
  updateGlobal(patch: GlobalPatch): MemoryConfig {
    const current = this.load() ?? DEFAULT_CONFIG
    const next = normalizeConfig({
      ...current,
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.autoInit !== undefined ? { autoInit: patch.autoInit } : {}),
      ...(patch.autoMaintain !== undefined ? { autoMaintain: patch.autoMaintain } : {}),
      ...(patch.announceToAgent !== undefined ? { announceToAgent: patch.announceToAgent } : {}),
      ...(patch.autoCompress !== undefined ? { autoCompress: patch.autoCompress } : {}),
      ...(patch.compressInterval !== undefined ? { compressInterval: patch.compressInterval } : {}),
    })
    this.save(next)
    return next
  }

  /** Set (boolean) or clear (null) one session memory override, then persist. */
  setSession(sessionId: string, enabled: boolean | null): MemoryConfig {
    const current = this.load() ?? DEFAULT_CONFIG
    const sessions = { ...current.sessions }
    const entry = { ...sessions[sessionId] }
    if (enabled === null) {
      delete entry.enabled
    } else {
      entry.enabled = enabled
    }
    if (entry.enabled === undefined && entry.compressEnabled === undefined) {
      delete sessions[sessionId]
    } else {
      sessions[sessionId] = entry
    }
    const next = normalizeConfig({ ...current, sessions })
    this.save(next)
    return next
  }

  /** Set (boolean) or clear (null) one session compression override, then persist. */
  setSessionCompress(sessionId: string, compressEnabled: boolean | null): MemoryConfig {
    const current = this.load() ?? DEFAULT_CONFIG
    const sessions = { ...current.sessions }
    const entry = { ...sessions[sessionId] }
    if (compressEnabled === null) {
      delete entry.compressEnabled
    } else {
      entry.compressEnabled = compressEnabled
    }
    if (entry.enabled === undefined && entry.compressEnabled === undefined) {
      delete sessions[sessionId]
    } else {
      sessions[sessionId] = entry
    }
    const next = normalizeConfig({ ...current, sessions })
    this.save(next)
    return next
  }

  /** Set one per-project session counter (0 removes the key), then persist. */
  setCount(cwd: string, count: number): MemoryConfig {
    const current = this.load() ?? DEFAULT_CONFIG
    const counts = { ...current.counts }
    if (count <= 0) {
      delete counts[cwd]
    } else {
      counts[cwd] = count
    }
    const next = normalizeConfig({ ...current, counts })
    this.save(next)
    return next
  }
}
