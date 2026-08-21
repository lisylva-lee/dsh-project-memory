/** Absolute path of this package's assets directory (SKILL.md + templates). */
export declare function packageAssetsRoot(): string;
/** Default user skill root: ~/.dsh/skills/project-memory (single source of truth). */
export declare function defaultSkillDir(home?: string): string;
/** Resolve the skill root: the user skill dir when present, else the bundled assets. */
export declare function resolveSkillDir(home?: string): string;
/** Resolve the templates directory: the user skill's templates, else bundled. */
export declare function resolveTemplateDir(home?: string): string;
/** Load the skill body: the user skill's SKILL.md, else the bundled copy. */
export declare function loadSkillContent(home?: string): string;
/** Local-timezone YYYY-MM-DD (the skill's date convention). */
export declare function localToday(now?: Date): string;
/** Strip the "首次使用时整段删除" usage block from the MEMORY.md template. */
export declare function stripUsageBlock(text: string): string;
/** Render the MEMORY.md index from the template (mirrors init-memory.sh). */
export declare function renderIndex(template: string, projectName: string, today?: string): string;
/** Render a daily memory file from the daily template. */
export declare function renderDaily(template: string, today?: string, title?: string): string;
/**
 * Idempotent per-project init: create MEMORY.md, memory/_TEMPLATE.md and
 * memory/<today>.md when missing; never overwrite existing files.
 * @returns the created paths (empty when nothing was created).
 */
export declare function ensureMemoryInit(cwd: string, templateDir: string, now?: Date): string[];
