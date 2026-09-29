# dsh-project-memory

English | [中文](README.zh.md)

The `project-memory` skill as a DSH plugin: a global master switch plus a
per-session switch. When enabled, every project uses the memory template
(`MEMORY.md` index + `memory/YYYY-MM-DD.md` daily details) by default,
auto-remembered and categorized.

## What it does

- **GUI plugin configuration**: a "Project Memory" card inside Settings →
  Plugin configuration → Web UI plugins (family-shared collapsible card,
  collapsed by default, expand on click), with five switches (master /
  auto-init / auto-maintain / announce to agent / auto-compress). Saving
  applies immediately.
- **Per-session switches**: every conversation shows a "Project memory" control
  below the chat (above the composer), collapsed to a compact row by default
  (label + current state + expand chevron); clicking it expands the hint and
  two switches — memory automation and memory compression. Turning memory off
  disables auto-init and auto-maintain for that session; turning compression
  off skips auto-compression for that session. Both only take effect while the
  master switch is on.
- **Automatic behavior** (master on):
  - At session start, initializes `MEMORY.md` + `memory/_TEMPLATE.md` +
    `memory/YYYY-MM-DD.md` in the project directory (idempotent, never
    overwrites);
  - At turn end of each worked turn, steers the model to write/update the
    daily memory (background / changes / conclusions / related) and update the
    `MEMORY.md` index (#tag classification, newest-first, summary ≤3);
  - Registers the `project-memory` runtime skill via `ctx.skills`; skill
    content and templates prefer `~/.dsh/skills/project-memory/` (single
    source of truth), falling back to bundled copies;
  - **Auto-compress** (master on, per-session compression on): counts sessions
    per project; every `compressInterval` (default 5) sessions it compresses
    the `MEMORY.md` index (keeps the newest 10 rows, folds older rows into
    "[压缩]" summaries) and the `memory/` directory (keeps the newest 5 daily
    files, folds older ones into one-line conclusions).
- Config persists at `~/.dsh/dsh-project-memory.json` (0600), read/written
  through the loopback-only `/api/dsh-project-memory/config`,
  `/api/dsh-project-memory/session`, `/api/dsh-project-memory/count` and
  `/api/dsh-project-memory/compress-now` routes.

## Install

From the GUI: **Settings → Plugins → Market** (or the plugin manager) and
search for `@lisylva-lee/dsh-project-memory`.

From a command line — the paths below are the CLI bundled inside DSH Desktop
v0.3.23 (for a native `dsh web` install, just call `dsh plugin ...`):

```sh
# DSH Desktop v0.3.23: bundled node + bundled dsh host
NODE="D:/deepseek-harness/DeepSeek Harness/resources/runtime/node/node.exe"
BIN="D:/deepseek-harness/DeepSeek Harness/resources/runtime/host/node_modules/@deepseek-ai/dsh/lib/bin.js"

# Option 1: install from GitHub (lib/ is committed, so no build runs on install)
"$NODE" "$BIN" plugin --profile web add github:lisylva-lee/dsh-project-memory

# Option 2: local link install (development)
"$NODE" "$BIN" plugin --profile web add link:<path to this repo>/dsh-project-memory
```

Restart the desktop app (or `dsh web`) after installing.

Requires host `dsh >= 0.1.5-rc.1` (declared in `dsh.engines.dsh`, which the
plugin manager uses to judge compatibility); this repository's client module
table matches the 0.1.5-rc.1 shell (see `build/web-platform.ts`).

## Development

The repository carries its whole build (`build/tsdown.client.ts` +
`build/web-platform.ts`) — **no monorepo is involved**:

```sh
pnpm install
pnpm run typecheck
pnpm run test
pnpm run build        # tsc emits lib/types, tsdown emits lib/index.js + lib/client.js
```

## Notes

- Auto-maintain fires once per worked turn for top-level agents only; when
  there is nothing to record, the model replies "no memory needed this turn".
- Runs in parallel with `dsh-memoir` (machine memory): this plugin writes the
  human-readable memory.
- Uninstall: `"$NODE" "$BIN" plugin --profile web remove @lisylva-lee/dsh-project-memory`
  (or disable/remove it from the plugin manager UI).
## Agent workflow (agent-workflow sub-surface, since 0.3)

Besides memory, the plugin ships an execution-discipline layer (independently switchable):

- at session start it injects the AGENT_WORKFLOW.md policy plus a compact summary of unfinished STATUS.md rows;
- it scaffolds, idempotently, AGENT_WORKFLOW.md (policy), STATUS.md (board) and _work/ (per-task scratch space with new-task.sh, log.sh, sanitize-env.sh and checks/);
- at turn end it runs cheap checks (unfinished task without evidence / blocked row without a reason / stray temp files in the project root) and nudges only when something is missing;
- it registers an agent-workflow runtime skill through ctx.skills.register.

Switches live in the workflow section of ~/.dsh/dsh-project-memory.json (also writable through PUT /api/dsh-project-memory/config):

| Switch | Default | Effect |
| --- | --- | --- |
| workflow.enabled | true | master switch (skill/guidance/scaffold/checks) |
| workflow.autoScaffold | true | idempotent scaffold at session start |
| workflow.turnCheck | true | turn-end checks, only nudges when something is missing |
| workflow.boardInject | true | inject the board summary into the system prompt |

Without the plugin the templates can be installed standalone: bash assets/workflow/install-workflow.sh <target> [--force].
The four switches also appear in the plugin-config card (workflow group: master / scaffold / turn-end checks / board injection); the config file and the PUT route work as well.
Workflow data lives only in project files - the plugin owns no data, so uninstalling or crashing it loses nothing.
