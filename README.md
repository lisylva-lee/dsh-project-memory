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

The package ships prebuilt artifacts (`lib/` is committed), so installing from
GitHub requires no build step — no `prepare` script, no pnpm `allowBuilds`
dance.

### CLI install (source-checkout layout)

Run inside the dsh installation directory; for a private repo, first
authenticate this machine to GitHub via `gh auth login` or an SSH key:

```sh
# Option 1: install from GitHub
cd "D:/deepseek-harness/DeepSeek Harness/resources/harness"
node lib/bin.js plugin --profile web add github:lisylva-lee/dsh-project-memory

# Option 2: local link install (development)
node lib/bin.js plugin --profile web add link:<path to this repo>/dsh-project-memory
```

Restart `dsh web` after installing (bundle layers are read at boot; only the
profile's `cordis.patch.yml` hot-reloads).

### DeepSeek Harness desktop app

On the desktop app the CLI lives in the bundled runtime instead:

```sh
cd "D:/DeepSeek-Harness/DeepSeek Harness/resources/runtime/host"
node node_modules/@deepseek-ai/dsh/lib/bin.js plugin --profile web add github:lisylva-lee/dsh-project-memory
```

- The active profile is user-level at `%USERPROFILE%\.dsh\profiles\web`
  (`package.json` → `dsh.profile.bundles` + `cordis.patch.yml`).
- **Always restart the app after install** for the new bundle layer to boot.
- Desktop profiles ship with `node_modules` seeded by CI (pnpm store metadata
  points at a runner path that does not exist locally). Any pnpm-based plugin
  operation (GUI plugin manager install/update/remove, `dsh plugin add/remove`)
  therefore needs the app **stopped** and one `pnpm install` run in the profile
  directory first — it recreates the modules dir against a local pnpm store
  (a one-time ~400 MB download). This is a quirk of the shipped profile seed,
  not of this plugin.
- If the CLI reports `dsh` is not on `PATH`, invoke it via the bundled node:
  `node node_modules/@deepseek-ai/dsh/lib/bin.js ...` as shown above.

## Development

`lib/` is committed; the standalone repo consumes the prebuilt artifacts.
Rebuilding requires the author's dsh-web monorepo toolchain (this package's
`tsdown.config.ts` imports `shared/tsdown.client.ts` from the monorepo root):

```sh
pnpm install
pnpm --filter @linxin666/dsh-project-memory typecheck
pnpm --filter @linxin666/dsh-project-memory test
pnpm --filter @linxin666/dsh-project-memory build
```

## Notes

- Auto-maintain fires once per worked turn for top-level agents only; when
  there is nothing to record, the model replies "no memory needed this turn".
- Runs in parallel with `dsh-memoir` (machine memory): this plugin writes the
  human-readable memory.
- Config and the user skill/template lookup honor `$DSH_HOME` (falling back to
  `~/.dsh`) since 0.1.1.
- Uninstall: `node lib/bin.js plugin --profile web remove @linxin666/dsh-project-memory`.