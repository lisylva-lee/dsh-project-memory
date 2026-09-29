# Changelog

## v0.2.0 - 2026-09-29

agent-workflow sub-surface, GUI switches and DSH_HOME semantics.

### Added

- **Agent workflow**: `AGENT_WORKFLOW.md` (policy), `STATUS.md` (board) and `_work/<task>/` (per-task scratch space with `notes.md`, `run.log`, `evidence/`, `backup/`, `archive/`) are scaffolded idempotently at session start; the board summary of unfinished rows is injected into the system prompt; a turn-end check nudges once, and only when something is missing (unfinished task without evidence, blocked row without a reason, stray temp files in the project root).
- `agent-workflow` runtime skill registered through `ctx.skills.register`; the full rules live in `assets/workflow/SKILL.md`.
- Standalone installer for projects that do not use the plugin: `assets/workflow/install-workflow.sh`, plus three check scripts under `_work/checks/`.
- Four `workflow` switches (master / auto-scaffold / turn-end checks / board injection) in the plugin-config card, the config file and the PUT route, with a per-session `workflowEnabled` override.
- `src/core/home.ts`: `dshHome()` (with a `$DSH_HOME` override) now backs the config store, the skill/template lookup and the workflow paths.

### Changed

- Package identity: `@lisylva-lee/dsh-project-memory` (the previous published name was `@linxin666/dsh-project-memory` up to 0.1.2). Remove the old name before installing this one.
- Assets resolve from the package root; the README documents deployment, prerequisites, verification, upgrade/uninstall, configuration and troubleshooting.

### Notes

- Workflow data lives only in project files; the plugin owns no workflow state, so uninstalling loses nothing.
- This release merges the upstream 0.1.2 fixes (DSH_HOME semantics, package-root assets) into the 0.1.5-rc.1 line.
