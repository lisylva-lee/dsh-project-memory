/**
 * Shared config contract for dsh-project-memory — the host store, the config
 * routes, and the browser views all speak this shape. No runtime identity is
 * shared across halves; the shape is spelled in each program.
 */

/** One session-level override. Absent means "follow the global switch". */
export interface SessionOverride {
  enabled?: boolean
}

/** The effective plugin configuration (global switches + per-session overrides). */
export interface MemoryConfig {
  /** Master switch: off disables skill registration, guidance, init, maintain. */
  enabled: boolean
  /** Auto-init MEMORY.md + memory/ templates at session start. */
  autoInit: boolean
  /** Auto-maintain (write daily memory + update index) at turn end. */
  autoMaintain: boolean
  /** Announce the memory workflow in the system prompt. */
  announceToAgent: boolean
  /** Per-session overrides keyed by session id. */
  sessions: Record<string, SessionOverride>
}

/** Defaults applied when a config document (file or request) omits a field. */
export const DEFAULT_CONFIG: MemoryConfig = {
  enabled: true,
  autoInit: true,
  autoMaintain: true,
  announceToAgent: true,
  sessions: {},
}

/** Config file name under ~/.dsh/. */
export const CONFIG_FILE_NAME = 'dsh-project-memory.json'

/** HTTP prefix of the config route family. */
export const API_PREFIX = '/api/dsh-project-memory'

/** The session-scope "off" note when the per-session switch disables memory. */
export const MEMORY_OFF_GUIDANCE =
  '（dsh-project-memory）本会话的项目记忆开关已关闭：不自动初始化/维护 MEMORY.md 与 memory/，仅在用户明确要求时才使用记忆模板。'
