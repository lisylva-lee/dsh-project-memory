/** Runtime-skill name registered by the plugin. */
export declare const WORKFLOW_SKILL_NAME = "agent-workflow";
/** In-repo policy file (the WORKFLOW.md analogue). */
export declare const POLICY_FILE = "AGENT_WORKFLOW.md";
/** In-repo status board. */
export declare const BOARD_FILE = "STATUS.md";
/** Per-task scratch root. */
export declare const WORK_ROOT = "_work";
/** Absolute path of the bundled workflow assets (SKILL.md + templates + checks). */
export declare function packageWorkflowAssetsRoot(): string;
/** Default user skill root: ~/.dsh/skills/agent-workflow. */
export declare function defaultWorkflowSkillDir(home?: string): string;
/** Resolve the workflow skill root: the user skill dir when present, else bundled assets. */
export declare function resolveWorkflowSkillDir(home?: string): string;
/** Resolve the workflow templates directory: the user skill's, else bundled. */
export declare function resolveWorkflowTemplateDir(home?: string): string;
/** Load the workflow skill body: the user skill's SKILL.md, else the bundled copy. */
export declare function loadWorkflowSkillContent(home?: string): string;
/** Local-timezone "YYYY-MM-DD HH:MM" stamp used by run.log lines. */
export declare function localStamp(now?: Date): string;
/**
 * Idempotent per-project workflow scaffold: AGENT_WORKFLOW.md + STATUS.md +
 * _work/ (README, _template/**, helper scripts, checks). Never overwrites.
 * @returns the created paths (empty when nothing was created).
 */
export declare function ensureWorkflowInit(cwd: string, templateDir: string): string[];
/**
 * Create one per-task scratch workspace from _work/_template (idempotent).
 * @returns the created paths (empty when the task dir already exists).
 */
export declare function createTaskWorkspace(cwd: string, taskId: string, title?: string, now?: Date): string[];
/** One row of STATUS.md parsed into cells. */
export interface BoardRow {
    cells: string[];
}
/** Parse the markdown table rows of STATUS.md (header/separator skipped). */
export declare function parseBoard(text: string): BoardRow[];
/** Task rows (first cell looks like a task id or a date) that are not finished. */
export declare function unfinishedRows(text: string): BoardRow[];
/** Compact board summary for prompt injection (undefined when nothing to show). */
export declare function readBoardSummary(cwd: string, maxLines?: number): string | undefined;
/** A single workflow finding (kind + human-readable detail). */
export interface WorkflowFinding {
    kind: string;
    detail: string;
}
/** Cheap, read-only per-turn checks over the project workflow state. */
export declare function checkWorkflow(cwd: string): WorkflowFinding[];
