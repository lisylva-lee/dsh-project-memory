/**
 * Shared config contract for dsh-project-memory — the host store, the config
 * routes, and the browser views all speak this shape. No runtime identity is
 * shared across halves; the shape is spelled in each program.
 */
/** One session-level override. Absent means "follow the global switch". */
export interface SessionOverride {
    enabled?: boolean;
}
/** The effective plugin configuration (global switches + per-session overrides). */
export interface MemoryConfig {
    /** Master switch: off disables skill registration, guidance, init, maintain. */
    enabled: boolean;
    /** Auto-init MEMORY.md + memory/ templates at session start. */
    autoInit: boolean;
    /** Auto-maintain (write daily memory + update index) at turn end. */
    autoMaintain: boolean;
    /** Announce the memory workflow in the system prompt. */
    announceToAgent: boolean;
    /** Per-session overrides keyed by session id. */
    sessions: Record<string, SessionOverride>;
}
/** Defaults applied when a config document (file or request) omits a field. */
export declare const DEFAULT_CONFIG: MemoryConfig;
/** Config file name under ~/.dsh/. */
export declare const CONFIG_FILE_NAME = "dsh-project-memory.json";
/** HTTP prefix of the config route family. */
export declare const API_PREFIX = "/api/dsh-project-memory";
/** The session-scope "off" note when the per-session switch disables memory. */
export declare const MEMORY_OFF_GUIDANCE = "\uFF08dsh-project-memory\uFF09\u672C\u4F1A\u8BDD\u7684\u9879\u76EE\u8BB0\u5FC6\u5F00\u5173\u5DF2\u5173\u95ED\uFF1A\u4E0D\u81EA\u52A8\u521D\u59CB\u5316/\u7EF4\u62A4 MEMORY.md \u4E0E memory/\uFF0C\u4EC5\u5728\u7528\u6237\u660E\u786E\u8981\u6C42\u65F6\u624D\u4F7F\u7528\u8BB0\u5FC6\u6A21\u677F\u3002";
