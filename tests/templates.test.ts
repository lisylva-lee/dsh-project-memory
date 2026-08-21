/**
 * Unit tests for template rendering and per-project init.
 */
import { mkdirSync, mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, describe, expect, it } from 'vitest'
import {
  ensureMemoryInit,
  localToday,
  renderDaily,
  renderIndex,
  stripUsageBlock,
} from '../src/core/templates.ts'

const INDEX_TPL = [
  '# MEMORY.md — {项目名} 项目记忆（Wiki 索引）',
  '',
  '> **使用说明（首次使用时整段删除）：**',
  '> 1. 复制本文件到新项目根目录，重命名为 MEMORY.md。',
  '> 6. 主记忆超 10K：旧条目压缩为"关键词 + 一行结论"，详情文件保留不删。',
  '',
  '## 项目概况',
  '- 项目名：{项目名}',
  '- 创建日期：{YYYY-MM-DD}',
  '',
  '## 索引（按日期倒序，只加不删）',
  '',
  '| 日期 | 标题 | 关键词 | 子记忆 |',
  '|------|------|--------|--------|',
  '| {YYYY-MM-DD} | {简短标题} | #{tag1} #{tag2} | memory/{YYYY-MM-DD}.md |',
  '',
  '## 最近记录摘要（最多 3 条）',
  '- {YYYY-MM-DD} {标题}：{一行结论}',
].join('\n')

const DAILY_TPL = '# {YYYY-MM-DD} — {简短标题}\n\n## 背景\n\n## 改动 / 内容\n\n## 结论 / 结果\n\n## 关联\n'

describe('template rendering', () => {
  it('strips the first-use instructions block', () => {
    const stripped = stripUsageBlock(INDEX_TPL)
    expect(stripped).not.toContain('使用说明')
    expect(stripped).toContain('## 项目概况')
  })

  it('renders the MEMORY.md index with placeholders replaced', () => {
    const index = renderIndex(INDEX_TPL, 'demo', '2026-08-21')
    expect(index).toContain('# MEMORY.md — demo 项目记忆（Wiki 索引）')
    expect(index).toContain('| 2026-08-21 | 初始化项目记忆 | #记忆体系 | memory/2026-08-21.md |')
    expect(index).toContain('创建日期：2026-08-21')
    expect(index).not.toContain('{')
  })

  it('renders the daily file with the four categories', () => {
    const daily = renderDaily(DAILY_TPL, '2026-08-21')
    expect(daily).toContain('# 2026-08-21 — 初始化项目记忆')
    expect(daily).toContain('## 背景')
    expect(daily).toContain('## 改动 / 内容')
    expect(daily).toContain('## 结论 / 结果')
    expect(daily).toContain('## 关联')
  })

  it('formats the local date as YYYY-MM-DD', () => {
    expect(localToday(new Date(2026, 7, 21))).toBe('2026-08-21')
  })
})

describe('ensureMemoryInit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-pm-tpl-'))
  const tplDir = join(dir, 'tpl')
  const target = join(dir, 'project')
  mkdirSync(target, { recursive: true })
  mkdirSync(join(tplDir, 'memory'), { recursive: true })
  writeFileSync(join(tplDir, 'MEMORY.md'), INDEX_TPL, 'utf8')
  writeFileSync(join(tplDir, 'memory', '_TEMPLATE.md'), DAILY_TPL, 'utf8')

  it('creates the three files on first run and is idempotent after', () => {
    const created = ensureMemoryInit(target, tplDir, new Date(2026, 7, 21))
    expect(created.length).toBe(3)
    expect(existsSync(join(target, 'MEMORY.md'))).toBe(true)
    expect(existsSync(join(target, 'memory', '_TEMPLATE.md'))).toBe(true)
    expect(existsSync(join(target, 'memory', '2026-08-21.md'))).toBe(true)
    expect(ensureMemoryInit(target, tplDir, new Date(2026, 7, 21)).length).toBe(0)
    const nextDay = ensureMemoryInit(target, tplDir, new Date(2026, 7, 22))
    expect(nextDay.length).toBe(1)
    expect(nextDay[0]).toContain('2026-08-22.md')
  })

  it('is a no-op for empty or missing cwd', () => {
    expect(ensureMemoryInit('', tplDir).length).toBe(0)
    expect(ensureMemoryInit(join(dir, 'nope'), tplDir).length).toBe(0)
  })

  afterAll(() => { rmSync(dir, { recursive: true, force: true }) })
})