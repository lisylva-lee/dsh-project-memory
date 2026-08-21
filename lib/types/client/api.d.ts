/**
 * Browser-side API client for /api/dsh-project-memory — plain same-origin
 * fetch, the only data path the settings card and the per-session switch use.
 */
/** One session-level override. */
export interface SessionOverride {
    enabled?: boolean;
    compressEnabled?: boolean;
}
/** The config view the GUI renders. */
export interface MemoryConfigView {
    enabled: boolean;
    autoInit: boolean;
    autoMaintain: boolean;
    announceToAgent: boolean;
    autoCompress: boolean;
    compressInterval: number;
    sessions: Record<string, SessionOverride>;
}
/** Global switches a PUT may patch. */
export type GlobalConfigPatch = Partial<Pick<MemoryConfigView, 'enabled' | 'autoInit' | 'autoMaintain' | 'announceToAgent' | 'autoCompress' | 'compressInterval'>>;
/** Read the full config. */
export declare function fetchConfig(): Promise<MemoryConfigView>;
/** Patch the global switches. */
export declare function updateConfig(patch: GlobalConfigPatch): Promise<MemoryConfigView>;
/** Set (true/false) one session memory override. */
export declare function updateSession(sessionId: string, enabled: boolean): Promise<MemoryConfigView>;
/** Set (true/false) one session compression override. */
export declare function updateSessionCompress(sessionId: string, enabled: boolean): Promise<MemoryConfigView>;
