/**
 * DSH home resolution shared by the config store and the skill/template
 * lookup. The harness convention is `${DSH_HOME:-$HOME/.dsh}` — DSH_HOME
 * already IS the `.dsh` directory, so callers join directly against it
 * (`<home>/dsh-project-memory.json`, `<home>/skills/project-memory`, ...).
 */
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Resolve the dsh home directory: $DSH_HOME when set, else ~/.dsh. */
export function dshHome(): string {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}