/**
 * Shared config contract for dsh-project-memory — the host store, the config
 * routes, and the browser views all speak this shape. No runtime identity is
 * shared across halves; the shape is spelled in each program.
 */

/** One session-level override. Absent means "follow the global switch". */
export interface SessionOverride {
  /** Per-session memory automation switch (auto-init + auto-maintain). */
  enabled?: boolean
  /** Per-session compression switch; absent = follow the global autoCompress. */
  compressEnabled?: boolean
}

/** The effective plugin configuration (global switches + per-session overrides). */
export interface MemoryConfig {
  /** Master switch: off disables skill registration, guidance, init, maintain, compress. */
  enabled: boolean
  /** Auto-init MEMORY.md + memory/ templates at session start. */
  autoInit: boolean
  /** Auto-maintain (write daily memory + update index) at turn end. */
  autoMaintain: boolean
  /** Announce the memory workflow in the system prompt. */
  announceToAgent: boolean
  /** Auto-compress MEMORY.md + memory/ once the session counter reaches the interval. */
  autoCompress: boolean
  /** Sessions between compressions (per project cwd). */
  compressInterval: number
  /** Per-session overrides keyed by session id. */
  sessions: Record<string, SessionOverride>
  /** Per-project session counters keyed by cwd (internal, persisted). */
  counts: Record<string, number>
}

/** Defaults applied when a config document (file or request) omits a field. */
export const DEFAULT_CONFIG: MemoryConfig = {
  enabled: true,
  autoInit: true,
  autoMaintain: true,
  announceToAgent: true,
  autoCompress: true,
  compressInterval: 5,
  sessions: {},
  counts: {},
}

/** Config file name under ~/.dsh/. */
export const CONFIG_FILE_NAME = 'dsh-project-memory.json'

/** HTTP prefix of the config route family. */
export const API_PREFIX = '/api/dsh-project-memory'

/** The session-scope "off" note when the per-session switch disables memory. */
export const MEMORY_OFF_GUIDANCE =
  '（dsh-project-memory）本会话的项目记忆开关已关闭：不自动初始化/维护 MEMORY.md 与 memory/，仅在用户明确要求时才使用记忆模板。'
