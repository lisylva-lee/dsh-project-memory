# Changelog

## v0.3.0 - 2026-09-30

Targets the 0.2.0-rc.2 cohort (Session V4). Requires DSH >= 0.2.0-rc.2; v0.2.1 stays the last release for the 0.1.5-rc.1 cohort.

### Fixed

- **The turn-end guidance steer was rejected on Session V4**: the injected `createUserMessage` carried the retired `{ kind: 'plugin', plugin: ... }` wrapper, which V4 refuses (`format v4 message requires a producer-owned source kind`), and because the steer only enqueues, the rejection surfaced as a failed *next* turn rather than a plugin warning. Both steers (memory auto-maintain, workflow turn-end check) now carry their own producer kind - `dsh-project-memory` and `dsh-agent-workflow` - declared through `MessageSourceMap` module augmentation, the same merge-extensible mechanism core uses for `skill-invocation`.
- **Session-entry auto-init never ran on 0.2.0-rc.x**: the listener was registered on `agent/session-start`, an event the 0.2.0-rc.2 host no longer has (its successor is `agent/created`), so the MEMORY.md / `memory/` scaffolding and the workflow scaffold silently stopped happening when a session entered. The listener now binds `agent/created`, and only `startup` / `clear` count as a new session for the compression interval, so a resume or an in-turn compaction no longer inflates it.
- Client half: the settings contract was renamed upstream (`SettingsScope` -> `ConfigForm`, `SettingsScopeSnapshot` -> `ConfigFormSnapshot`) and the shared card form follows. Its optional batched-write path (a dsh-web-ui bridge extension that the new API replaces) is gone; a save now writes field by field.

### Changed

- Development cohort moved from 0.1.5-rc.1 to 0.2.0-rc.2 for every `@deepseek-ai/dsh-*` devDependency, and `dsh.engines.dsh` plus the `@deepseek-ai/dsh-llm` peer range were raised to match.

### Notes

- `pnpm typecheck`, `pnpm test` (47 tests) and `pnpm build` are green on the new cohort.

## v0.2.1 - 2026-09-29

### Fixed

- **Startup crash in v0.2.0**: the bundled `lib/index.js` resolved the workflow assets relative to the bundle instead of the package root (it looked for `<repo>/../assets/workflow/SKILL.md`) and the ENOENT surfaced while the plugin was mounting, so the cordis loader aborted and the desktop app refused to boot. Asset lookup now probes both layouts (`../assets/workflow/` for the bundle, `../../assets/workflow/` for `src/`) and picks the one that really contains `SKILL.md`.
- Mount-time failures no longer escape `apply()`: prompt-section and runtime-skill registration now run inside a try/catch that logs a warning and keeps the plugin tree alive, so a bad asset path can never stop the host from starting again.

### Notes

- **v0.2.0 is broken - use v0.2.1** (or the default branch, which is what a GitHub install follows).

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
