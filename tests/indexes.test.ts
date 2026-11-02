import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  AUTO_BEGIN,
  AUTO_END,
  buildNavigation,
  buildSkills,
  collectSkills,
  navSnapshot,
  refreshIndexes,
  structureChanged,
} from '../src/core/indexes.ts'

function tempHome(): string {
  return mkdtempSync(join(tmpdir(), 'dpm-indexes-'))
}

describe('indexes: navigation', () => {
  it('只在 AUTO 段内重写，手写段保持原样', () => {
    const home = tempHome()
    const cwd = join(home, 'proj')
    mkdirSync(join(cwd, 'apps', 'demo'), { recursive: true })
    writeFileSync(join(cwd, 'AGENTS.md'), 'x')
    const first = buildNavigation(cwd, { home })
    expect(first.changed).toBe(true)
    const file = join(cwd, 'NAVIGATION.md')
    writeFileSync(file, readFileSync(file, 'utf8') + '\n- 手写：产品 demo 的入口\n')
    mkdirSync(join(cwd, 're'), { recursive: true })
    const second = buildNavigation(cwd, { home })
    expect(second.changed).toBe(true)
    const text = readFileSync(file, 'utf8')
    expect(text).toContain('手写：产品 demo 的入口')
    expect(text).toContain('`re/`')
    expect(text.indexOf(AUTO_BEGIN)).toBeLessThan(text.indexOf(AUTO_END))
  })

  it('结构不变时指纹一致（不触发写盘）', () => {
    const home = tempHome()
    const cwd = join(home, 'proj')
    mkdirSync(join(cwd, 'src'), { recursive: true })
    expect(navSnapshot(cwd).fingerprint).toBe(navSnapshot(cwd).fingerprint)
  })
})

describe('indexes: skills', () => {
  it('区分已注册 / 项目 / 库根三档', () => {
    const home = tempHome()
    const cwd = join(home, 'proj')
    mkdirSync(join(home, 'skills', 'reg-skill'), { recursive: true })
    writeFileSync(join(home, 'skills', 'reg-skill', 'SKILL.md'), '---\nname: reg-skill\ndescription: 已注册技能\n---\n')
    mkdirSync(join(cwd, '.dsh', 'skills', 'lib-skill'), { recursive: true })
    writeFileSync(join(cwd, '.dsh', 'skills', 'lib-skill', 'SKILL.md'), '---\ndescription: 库技能\n---\n')
    const entries = collectSkills(cwd, { home })
    const byName = Object.fromEntries(entries.map(entry => [entry.name, entry.status]))
    expect(byName['reg-skill']).toBe('registered')
    expect(byName['lib-skill']).toBe('project')
    const result = buildSkills(cwd, { home })
    const text = readFileSync(result.path, 'utf8')
    expect(text).toContain('能否 skill() 加载')
    expect(text).toContain('`reg-skill`')
  })
})

describe('indexes: refresh', () => {
  it('第二次刷新无变化则返回空数组', () => {
    const home = tempHome()
    const cwd = join(home, 'proj')
    mkdirSync(join(cwd, 'docs'), { recursive: true })
    refreshIndexes(cwd, { home })
    expect(existsSync(join(cwd, 'NAVIGATION.md'))).toBe(true)
    expect(existsSync(join(cwd, 'SKILLS.md'))).toBe(true)
    const again = refreshIndexes(cwd, { home })
    expect(again.filter(result => result.kind !== 'tools')).toHaveLength(0)
  })

  it('索引文件被删或 AUTO 段为空时会自动重建（指纹未变也重建）', () => {
    const home = tempHome()
    const cwd = join(home, 'proj')
    mkdirSync(join(cwd, 'docs'), { recursive: true })
    refreshIndexes(cwd, { home })
    // 情况一：整个文件被删
    rmSync(join(cwd, 'NAVIGATION.md'))
    const afterDelete = refreshIndexes(cwd, { home })
    expect(afterDelete.some(result => result.kind === 'navigation')).toBe(true)
    expect(existsSync(join(cwd, 'NAVIGATION.md'))).toBe(true)
    // 情况二：AUTO 段被清空
    const file = join(cwd, 'SKILLS.md')
    writeFileSync(file, '# SKILLS.md\n\n' + AUTO_BEGIN + '\n' + AUTO_END + '\n')
    const afterBlank = refreshIndexes(cwd, { home })
    expect(afterBlank.some(result => result.kind === 'skills')).toBe(true)
    expect(readFileSync(file, 'utf8')).toContain('能否 skill() 加载')
  })

  it('检测到变化后刷新一次就不再报漂移（防提醒循环）', () => {
    const home = tempHome()
    const cwd = join(home, 'proj')
    mkdirSync(join(cwd, 'a'), { recursive: true })
    refreshIndexes(cwd, { home })
    mkdirSync(join(cwd, 'b'), { recursive: true })
    expect(structureChanged(cwd, { home })).toContain('navigation')
    // 插件在提醒前会自己刷新一次：指纹随之更新，下一轮不再报
    refreshIndexes(cwd, { home })
    expect(structureChanged(cwd, { home })).toHaveLength(0)
  })

  it('新增目录后 structureChanged 能报出 navigation', () => {
    const home = tempHome()
    const cwd = join(home, 'proj')
    mkdirSync(join(cwd, 'a'), { recursive: true })
    refreshIndexes(cwd, { home })
    expect(structureChanged(cwd, { home })).toHaveLength(0)
    mkdirSync(join(cwd, 'b'), { recursive: true })
    expect(structureChanged(cwd, { home })).toContain('navigation')
  })
})
