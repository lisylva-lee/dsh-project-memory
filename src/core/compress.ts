/**
 * Human-readable memory compression (ported from the former standalone
 * dsh-memoir-compressor plugin, now part of dsh-project-memory):
 *
 *   - MEMORY.md（主索引）：保留最近 {@link MAX_INDEX_ENTRIES} 条索引行，
 *     旧条目压成一行 "[压缩]" 摘要行（原始详情文件保留不删）。
 *   - memory/YYYY-MM-DD.md（子记忆）：保留最近 {@link KEEP_DAILY_FILES} 个
 *     文件，更旧的每日文件压成一行结论摘要（从 "## 结论" 段抽取）。
 *
 * Both operations are idempotent no-ops when there is nothing to compress.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** 主索引最多保留的行数（超出部分压成摘要行）。 */
export const MAX_INDEX_ENTRIES = 10

/** memory/ 目录最多保留的每日文件数（更旧的压成摘要）。 */
export const KEEP_DAILY_FILES = 5

/** Compress the MEMORY.md index table: keep the newest rows, fold the rest into summary rows. */
export function compressMemoryIndex(filePath: string, keepCount: number = MAX_INDEX_ENTRIES): boolean {
  if (!existsSync(filePath)) return false
  const text = readFileSync(filePath, 'utf8')
  const lines = text.split('\n')

  let tableStart = -1
  let tableEnd = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('| 日期 | 标题 | 关键词 | 子记忆 |')) {
      tableStart = i
      break
    }
  }
  if (tableStart === -1) return false
  tableEnd = tableStart + 1
  while (tableEnd < lines.length && lines[tableEnd].startsWith('|')) tableEnd++

  const headerRows = tableStart + 2
  const rows: string[] = []
  for (let i = headerRows; i < tableEnd; i++) {
    const row = lines[i].trim()
    if (row.startsWith('|') && row.endsWith('|')) rows.push(row)
  }
  if (rows.length <= keepCount) return false

  const keepRows = rows.slice(0, keepCount)
  const oldRows = rows.slice(keepCount)
  const compressedSummary = oldRows.map(row => {
    const parts = row.split('|').filter(part => part.trim())
    const date = parts[0]?.trim() || '?'
    const title = parts[1]?.trim() || '?'
    const tags = parts[2]?.trim() || ''
    return `| ${date} | [压缩] ${title} | ${tags} | （详情已压缩，见原始文件） |`
  })

  const before = lines.slice(0, tableStart + 1).join('\n')
  const separator = lines[tableStart + 1]
  const after = lines.slice(tableEnd).join('\n')
  writeFileSync(filePath, [before, separator, ...keepRows, ...compressedSummary, after].join('\n'), 'utf8')
  return true
}

/** Compress old daily memory files beyond the keep window into one-line conclusions. */
export function compressMemoryDir(dirPath: string, keepCount: number = KEEP_DAILY_FILES): { compressed: number } {
  if (!existsSync(dirPath)) return { compressed: 0 }
  let compressed = 0
  const files = readdirSync(dirPath)
    .filter(file => /^\d{4}-\d{2}-\d{2}\.md$/.test(file))
    .sort()
    .reverse()
  const toCompress = files.slice(keepCount)
  for (const file of toCompress) {
    const filePath = join(dirPath, file)
    const content = readFileSync(filePath, 'utf8')
    const textLines = content.split('\n')
    let conclusion = ''
    let inConclusion = false
    for (const line of textLines) {
      if (line.startsWith('## 结论')) {
        inConclusion = true
        continue
      }
      if (inConclusion) {
        if (line.startsWith('## ')) break
        if (line.trim() && !line.startsWith('>')) {
          conclusion = line.trim()
          break
        }
      }
    }
    if (!conclusion) conclusion = '（已自动压缩，详情见原始文件）'
    const summary = `# ${file.slice(0, 10)} — 压缩摘要\n\n> 原始文件已压缩，结论：${conclusion}\n\n`
    writeFileSync(filePath, summary, 'utf8')
    compressed++
  }
  return { compressed }
}

/** Compress one project: the MEMORY.md index and the memory/ directory. */
export function runCompression(cwd: string): { index: boolean; daily: { compressed: number } } {
  return {
    index: compressMemoryIndex(join(cwd, 'MEMORY.md')),
    daily: compressMemoryDir(join(cwd, 'memory')),
  }
}
