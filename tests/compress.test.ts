/**
 * Unit tests for the human-readable memory compression logic.
 */
import { mkdirSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, describe, expect, it } from 'vitest'
import { compressMemoryDir, compressMemoryIndex } from '../src/core/compress.ts'

function makeIndex(rows: number): string {
  const lines = ['# MEMORY.md — demo 项目记忆（Wiki 索引）', '', '## 索引（按日期倒序，只加不删）', '', '| 日期 | 标题 | 关键词 | 子记忆 |', '|------|------|--------|--------|']
  for (let i = 1; i <= rows; i++) {
    lines.push(`| 2026-08-${String(i).padStart(2, '0')} | 任务 ${i} | #demo | memory/2026-08-${String(i).padStart(2, '0')}.md |`)
  }
  lines.push('', '## 最近记录摘要（最多 3 条）', '- 摘要一行', '')
  return lines.join('\n')
}

describe('compressMemoryIndex', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-pm-compress-'))
  const indexPath = join(dir, 'MEMORY.md')

  it('keeps the newest rows and folds older rows into [压缩] summary rows', () => {
    writeFileSync(indexPath, makeIndex(14), 'utf8')
    const changed = compressMemoryIndex(indexPath, 10)
    expect(changed).toBe(true)
    const text = readFileSync(indexPath, 'utf8')
    const rows = text.split('\n').filter(line => line.startsWith('| 2026-08-'))
    expect(rows).toHaveLength(14) // 10 kept + 4 folded
    expect(rows[0]).toContain('任务 1')
    expect(rows[9]).toContain('任务 10')
    expect(rows[10]).toContain('[压缩] 任务 11')
    expect(rows[13]).toContain('[压缩] 任务 14')
    expect(text).toContain('## 最近记录摘要')
  })

  it('is a no-op when there is nothing to compress', () => {
    writeFileSync(indexPath, makeIndex(4), 'utf8')
    expect(compressMemoryIndex(indexPath, 10)).toBe(false)
  })

  it('is a no-op for a missing file', () => {
    expect(compressMemoryIndex(join(dir, 'nope.md'), 10)).toBe(false)
  })

  afterAll(() => { rmSync(dir, { recursive: true, force: true }) })
})

describe('compressMemoryDir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-pm-compress-dir-'))
  const memoryDir = join(dir, 'memory')
  mkdirSync(memoryDir, { recursive: true })

  it('keeps the newest files and folds older ones into one-line conclusions', () => {
    for (let day = 1; day <= 7; day++) {
      const date = '2026-08-' + String(day).padStart(2, '0')
      writeFileSync(join(memoryDir, date + '.md'), `# ${date} — 任务 ${day}\n\n## 背景\n做事情\n\n## 结论 / 结果\n结论 ${day}。\n\n## 关联\n- 无\n`, 'utf8')
    }
    const result = compressMemoryDir(memoryDir, 5)
    expect(result.compressed).toBe(2)
    const oldest = readFileSync(join(memoryDir, '2026-08-01.md'), 'utf8')
    expect(oldest).toContain('# 2026-08-01 — 压缩摘要')
    expect(oldest).toContain('结论 1。')
    const newest = readFileSync(join(memoryDir, '2026-08-07.md'), 'utf8')
    expect(newest).toContain('## 背景')
    expect(newest).not.toContain('压缩摘要')
  })

  it('is a no-op for a missing directory', () => {
    expect(compressMemoryDir(join(dir, 'nope'))).toEqual({ compressed: 0 })
  })

  afterAll(() => { rmSync(dir, { recursive: true, force: true }) })
})
