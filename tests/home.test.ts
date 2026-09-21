/**
 * Unit tests for dsh home resolution: $DSH_HOME already IS the `.dsh`
 * directory, with `~/.dsh` as the fallback; config and skill lookups join
 * directly against it.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { dshHome } from '../src/core/home.ts'
import { defaultSkillDir } from '../src/core/templates.ts'
import { configPath } from '../src/store.ts'
import { CONFIG_FILE_NAME } from '../src/core/contract.ts'

const ORIGINAL = process.env.DSH_HOME

describe('dshHome', () => {
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = ORIGINAL
  })

  it('returns $DSH_HOME verbatim when set (it already is the .dsh dir)', () => {
    process.env.DSH_HOME = 'D:/custom-home/.dsh'
    expect(dshHome()).toBe('D:/custom-home/.dsh')
  })

  it('falls back to ~/.dsh when $DSH_HOME is unset', () => {
    delete process.env.DSH_HOME
    expect(dshHome()).toBe(join(homedir(), '.dsh'))
  })

  it('joins the config file and skill dir directly against the dsh home (no double .dsh)', () => {
    process.env.DSH_HOME = 'D:/custom-home/.dsh'
    expect(configPath()).toBe(join('D:/custom-home/.dsh', CONFIG_FILE_NAME))
    expect(configPath()).not.toContain('.dsh' + '.dsh')
    expect(defaultSkillDir()).toBe(join('D:/custom-home/.dsh', 'skills', 'project-memory'))
  })
})