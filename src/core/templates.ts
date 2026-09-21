/**
 * Template rendering and per-project init for the human-readable memory
 * system (MEMORY.md index + memory/YYYY-MM-DD.md details). Mirrors the
 * original project-memory skill's init-memory.sh behavior.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dshHome } from './home.ts'

/** Absolute path of this package's assets directory (SKILL.md + templates). */
export function packageAssetsRoot(): string {
  return fileURLToPath(new URL('../../assets/', import.meta.url))
}

/** Default user skill root: ~/.dsh/skills/project-memory (single source of truth). */
export function defaultSkillDir(home: string = dshHome()): string {
  return join(home, '.dsh', 'skills', 'project-memory')
}

/** Resolve the skill root: the user skill dir when present, else the bundled assets. */
export function resolveSkillDir(home: string = dshHome()): string {
  const user = defaultSkillDir(home)
  return existsSync(join(user, 'SKILL.md')) ? user : packageAssetsRoot()
}

/** Resolve the templates directory: the user skill's templates, else bundled. */
export function resolveTemplateDir(home: string = dshHome()): string {
  const user = defaultSkillDir(home)
  if (existsSync(join(user, 'templates', 'MEMORY.md'))) return join(user, 'templates')
  return join(packageAssetsRoot(), 'templates')
}

/** Load the skill body: the user skill's SKILL.md, else the bundled copy. */
export function loadSkillContent(home: string = dshHome()): string {
  const user = defaultSkillDir(home)
  const candidate = join(user, 'SKILL.md')
  return existsSync(candidate) ? readFileSync(candidate, 'utf8') : readFileSync(join(packageAssetsRoot(), 'SKILL.md'), 'utf8')
}

/** Local-timezone YYYY-MM-DD (the skill's date convention). */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + d
}

/** Strip the "首次使用时整段删除" usage block from the MEMORY.md template. */
export function stripUsageBlock(text: string): string {
  return text.replace(/^> \*\*使用说明（首次使用时整段删除）：\*\*[\s\S]*?^> 6\.[^\n]*\n?/m, '')
}

/** Render the MEMORY.md index from the template (mirrors init-memory.sh). */
export function renderIndex(template: string, projectName: string, today: string = localToday()): string {
  return stripUsageBlock(template)
    .replaceAll('{项目名}', projectName)
    .replaceAll('{YYYY-MM-DD}', today)
    .replaceAll('{一句话说明项目要做什么}', '（待补充——一句话说明项目要做什么）')
    .replaceAll('{如有}', '（待补充）')
    .replaceAll('{简短标题}', '初始化项目记忆')
    .replaceAll('{标题}', '初始化项目记忆')
    .replaceAll('#{tag1} #{tag2}', '#记忆体系')
    .replaceAll('{一行结论}', '按记忆模板初始化：MEMORY.md 索引 + memory/ 每日详情。')
}

/** Render a daily memory file from the daily template. */
export function renderDaily(template: string, today: string = localToday(), title: string = '初始化项目记忆'): string {
  return template.replaceAll('{YYYY-MM-DD}', today).replaceAll('{简短标题}', title)
}

/**
 * Idempotent per-project init: create MEMORY.md, memory/_TEMPLATE.md and
 * memory/<today>.md when missing; never overwrite existing files.
 * @returns the created paths (empty when nothing was created).
 */
export function ensureMemoryInit(cwd: string, templateDir: string, now: Date = new Date()): string[] {
  const created: string[] = []
  if (typeof cwd !== 'string' || cwd === '') return created
  const target = resolve(cwd)
  try {
    if (!existsSync(target) || !statSync(target).isDirectory()) return created
  } catch {
    return created
  }
  mkdirSync(join(target, 'memory'), { recursive: true })
  const today = localToday(now)

  const memPath = join(target, 'MEMORY.md')
  if (!existsSync(memPath)) {
    const tplPath = join(templateDir, 'MEMORY.md')
    if (existsSync(tplPath)) {
      writeFileSync(memPath, renderIndex(readFileSync(tplPath, 'utf8'), basename(target), today), 'utf8')
      created.push(memPath)
    }
  }

  const tplFile = join(target, 'memory', '_TEMPLATE.md')
  if (!existsSync(tplFile)) {
    const src = join(templateDir, 'memory', '_TEMPLATE.md')
    if (existsSync(src)) {
      copyFileSync(src, tplFile)
      created.push(tplFile)
    }
  }

  const daily = join(target, 'memory', today + '.md')
  if (!existsSync(daily)) {
    const src = join(templateDir, 'memory', '_TEMPLATE.md')
    if (existsSync(src)) {
      writeFileSync(daily, renderDaily(readFileSync(src, 'utf8'), today), 'utf8')
      created.push(daily)
    }
  }
  return created
}
