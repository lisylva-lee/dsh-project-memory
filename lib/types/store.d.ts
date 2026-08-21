import { type MemoryConfig } from './core/contract.ts';
/** Resolve the config file path under the dsh home. */
export declare function configPath(home?: string): string;
/** Validate/normalize an untrusted config document (file or request body). */
export declare function normalizeConfig(raw: unknown): MemoryConfig;
/** Global switches a config PUT may patch. */
export interface GlobalPatch {
    enabled?: boolean;
    autoInit?: boolean;
    autoMaintain?: boolean;
    announceToAgent?: boolean;
    autoCompress?: boolean;
    compressInterval?: number;
}
/** Atomic file store for the plugin config. */
export declare class MemoryStore {
    private readonly path;
    /** @param path - config file path (test seam; defaults to ~/.dsh/dsh-project-memory.json). */
    constructor(path?: string);
    /** Whether a user config document exists on disk. */
    exists(): boolean;
    /** Load the config document; undefined when no file exists (or it is unreadable). */
    load(): MemoryConfig | undefined;
    /** Persist a full config document (atomic tmp+rename, mode 0600). */
    save(config: MemoryConfig): void;
    /** Merge global switches into the document and persist. */
    updateGlobal(patch: GlobalPatch): MemoryConfig;
    /** Set (boolean) or clear (null) one session memory override, then persist. */
    setSession(sessionId: string, enabled: boolean | null): MemoryConfig;
    /** Set (boolean) or clear (null) one session compression override, then persist. */
    setSessionCompress(sessionId: string, compressEnabled: boolean | null): MemoryConfig;
    /** Set one per-project session counter (0 removes the key), then persist. */
    setCount(cwd: string, count: number): MemoryConfig;
}
