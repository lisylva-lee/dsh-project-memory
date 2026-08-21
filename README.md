# @linxin666/dsh-project-memory

English | [中文](README.zh.md)

The `project-memory` skill as a DSH plugin: a global master switch plus a
per-session switch. When enabled, every project uses the memory template
(`MEMORY.md` index + `memory/YYYY-MM-DD.md` daily details) by default,
auto-remembered and categorized.

## What it does

- **GUI plugin configuration**: a "Project Memory" card inside Settings →
  Plugin configuration → Web UI plugins (a task-board-style collapsible card,
  collapsed by default, expand on click), with four switches (master /
  auto-init / auto-maintain / announce to agent). Saving applies immediately.
- **Per-session switch**: every conversation shows a "Project memory" control
  below the chat (above the composer), collapsed to a compact row by default
  (label + current state + expand chevron); clicking it expands the hint and
  the switch. Turning it off disables auto-init and auto-maintain for that
  session; it only takes effect while the master switch is on.
- **Automatic behavior** (master on):
  - At session start, initializes `MEMORY.md` + `memory/_TEMPLATE.md` +
    `memory/YYYY-MM-DD.md` in the project directory (idempotent, never
    overwrites);
  - At turn end of each worked turn, steers the model to write/update the
    daily memory (background / changes / conclusions / related) and update the
    `MEMORY.md` index (#tag classification, newest-first, summary ≤3);
  - Registers the `project-memory` runtime skill via `ctx.skills`; skill
    content and templates prefer `~/.dsh/skills/project-memory/` (single
    source of truth), falling back to bundled copies.
- Config persists at `~/.dsh/dsh-project-memory.json` (0600), read/written
  through the loopback-only `/api/dsh-project-memory/config` and
  `/api/dsh-project-memory/session` routes.

## Install

```sh
# run inside the dsh installation directory
node lib/bin.js plugin --profile web add link:<this repo>/packages/dsh-project-memory
```

Restart `dsh web` after installing.

## Development

```sh
pnpm --filter @linxin666/dsh-project-memory typecheck
pnpm --filter @linxin666/dsh-project-memory test
pnpm --filter @linxin666/dsh-project-memory build
```

## Notes

- Auto-maintain fires once per worked turn for top-level agents only; when
  there is nothing to record, the model replies "no memory needed this turn".
- Runs in parallel with `dsh-memoir` (machine memory): this plugin writes the
  human-readable memory.
- Uninstall: `node lib/bin.js plugin --profile web remove @linxin666/dsh-project-memory`.
