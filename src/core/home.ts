/**
 * DSH home resolution shared by the config store and the skill/template
 * lookup. The harness convention is `${DSH_HOME:-$HOME/.dsh}`; a custom
 * DSH_HOME must win over `homedir()`, or the plugin would write its config
 * and read its skills from the wrong directory on such deployments.
 */
import { homedir } from 'node:os'

/** Resolve the dsh home directory: $DSH_HOME when set, else ~/.dsh. */
export function dshHome(): string {
  return process.env.DSH_HOME ?? homedir()
}
