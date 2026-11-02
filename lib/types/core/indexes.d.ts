export declare const AUTO_BEGIN = "<!-- AUTO:BEGIN \u7531 dsh-project-memory \u81EA\u52A8\u751F\u6210\uFF1B\u624B\u5199\u5185\u5BB9\u8BF7\u653E\u5728 AUTO:END \u4E4B\u540E -->";
export declare const AUTO_END = "<!-- AUTO:END -->";
export interface IndexOptions {
    /** dsh home（默认 $DSH_HOME 或 ~/.dsh）。 */
    home?: string;
    /** 每个顶层目录最多列出的子目录名。 */
    subdirsPerDir?: number;
    /** 顶层目录最多列出条数。 */
    maxTopDirs?: number;
    /** 机器级工具清单缓存的有效期（小时）。 */
    toolsTtlHours?: number;
    /** 额外的技能根目录（除 <home>/skills 与 <cwd>/.dsh/skills）。 */
    skillRoots?: string[];
}
export interface IndexResult {
    kind: 'navigation' | 'skills' | 'tools';
    path: string;
    changed: boolean;
    /** 一行摘要，可直接注入 system prompt。 */
    summary: string;
}
export interface NavSnapshot {
    fingerprint: string;
    topDirs: Array<{
        name: string;
        subdirs: string[];
        subdirCount: number;
    }>;
    files: string[];
}
/** 只读一层：顶层目录 + 每个顶层目录的直接子目录名（不递归，避免百万文件级扫描）。 */
export declare function navSnapshot(cwd: string, opts?: IndexOptions): NavSnapshot;
export declare function renderNavigation(cwd: string, snap: NavSnapshot): string;
export declare function buildNavigation(cwd: string, opts?: IndexOptions): IndexResult;
export interface SkillEntry {
    name: string;
    description: string;
    /** registered = 已注册可 skill() 加载；project = 仅存在于项目 .dsh/skills；library = 其他库根。 */
    status: 'registered' | 'project' | 'library';
    path: string;
}
/**
 * 发现项目内（含子目录）的 .dsh/skills 根，最多下探 depth 层。
 * 目的：把散在各子项目里的技能库（例如 <cwd>/DSH/破译/.dsh/skills）也纳入清单，
 * 同时明确标注它们「未注册、不能 skill() 加载」。
 */
export declare function findNestedSkillRoots(cwd: string, depth?: number): string[];
export declare function collectSkills(cwd: string, opts?: IndexOptions): SkillEntry[];
export declare function renderSkills(entries: SkillEntry[]): string;
export declare function buildSkills(cwd: string, opts?: IndexOptions): IndexResult;
export interface ToolEntry {
    name: string;
    path: string;
    version: string;
    /** how = PATH 可直接调用；path = 需全路径；env = 需设环境变量。 */
    how: 'how' | 'path' | 'env';
}
/** 机器级工具缓存：<home>/env/tools.json，带 TTL。 */
export declare function probeTools(home?: string, ttlHours?: number, force?: boolean): {
    file: string;
    tools: ToolEntry[];
    probedAt: number;
    fresh: boolean;
};
export declare function renderTools(tools: ToolEntry[], cacheFile: string, missing: string[]): string;
export declare function buildTools(cwd: string, opts?: IndexOptions): IndexResult;
/** 结构指纹：目录树 + 技能数量。用于「只在变化时才提醒模型」。 */
export declare function structureFingerprint(cwd: string, opts?: IndexOptions): Record<string, string>;
/** 是否与上次记录的结构指纹不同（不写盘，纯比较）。 */
export declare function structureChanged(cwd: string, opts?: IndexOptions): string[];
/**
 * 刷新三棵树索引。默认只重建指纹已变化的文件（force 时全部重建）。
 * 返回结果里 changed=false 表示「没变化、没写盘」。
 */
export declare function refreshIndexes(cwd: string, opts?: IndexOptions, force?: boolean): IndexResult[];
/** 索引文件是否都已存在（用于会话开始时决定要不要建）。 */
export declare function indexesPresent(cwd: string): boolean;
/** 一行 system prompt 摘要（≤160 字符）。 */
export declare function indexHint(cwd: string): string;
