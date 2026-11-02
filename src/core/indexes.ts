/**
 * 三棵树索引生成器：NAVIGATION.md（空间轴）/ SKILLS.md（能力轴）/ TOOLS.md（环境轴）。
 *
 * 设计约束：
 * - 只依赖 node 内置模块，不引入第三方依赖（可在无 node_modules 的环境直接跑）。
 * - 每个索引文件由「AUTO 段（可重生成）+ 手写段（永不覆盖）」组成，AUTO 段用注释标记包起来。
 * - 先算指纹，指纹没变就不写盘、不打扰模型 —— 这是「自发更新不烧 token」的关键。
 * - 工具清单是机器级缓存（<dsh home>/env/tools.json），项目内 TOOLS.md 只放指针与摘要。
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

import { dshHome } from './home.ts'

export const AUTO_BEGIN = '<!-- AUTO:BEGIN 由 dsh-project-memory 自动生成；手写内容请放在 AUTO:END 之后 -->'
export const AUTO_END = '<!-- AUTO:END -->'

/** 索引文件本身：生成它们会改变根目录文件列表，必须排除在指纹之外（否则每次刷新都自触发）。 */
const INDEX_FILES = new Set(['NAVIGATION.md', 'SKILLS.md', 'TOOLS.md'])

/** 生成索引时跳过的重目录（可重建产物 / 依赖 / 版本库内部）。 */
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'build', 'dist', 'target', '.gradle', '__pycache__', '.dart_tool',
  '.cxx', 'obj', '.next', '.venv', '.idea', '.vscode', '.pnpm-store', 'bin', 'lib',
])

export interface IndexOptions {
  /** dsh home（默认 $DSH_HOME 或 ~/.dsh）。 */
  home?: string
  /** 每个顶层目录最多列出的子目录名。 */
  subdirsPerDir?: number
  /** 顶层目录最多列出条数。 */
  maxTopDirs?: number
  /** 机器级工具清单缓存的有效期（小时）。 */
  toolsTtlHours?: number
  /** 额外的技能根目录（除 <home>/skills 与 <cwd>/.dsh/skills）。 */
  skillRoots?: string[]
}

export interface IndexResult {
  kind: 'navigation' | 'skills' | 'tools'
  path: string
  changed: boolean
  /** 一行摘要，可直接注入 system prompt。 */
  summary: string
}

interface IndexState {
  /** cwd -> { navigation: fingerprint, skills: fingerprint } */
  fingerprints: Record<string, Record<string, string>>
  /** 上次工具探测时间（epoch ms）。 */
  toolsProbedAt: number
}

function sha1(text: string): string {
  return createHash('sha1').update(text).digest('hex').slice(0, 16)
}

function safeReaddir(path: string): string[] {
  try {
    return readdirSync(path).sort()
  } catch {
    return []
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function statePath(home: string): string {
  return join(home, 'dsh-project-memory.indexes.json')
}

function loadState(home: string): IndexState {
  try {
    const raw = JSON.parse(readFileSync(statePath(home), 'utf8')) as Partial<IndexState>
    return {
      fingerprints: typeof raw.fingerprints === 'object' && raw.fingerprints !== null ? raw.fingerprints : {},
      toolsProbedAt: typeof raw.toolsProbedAt === 'number' ? raw.toolsProbedAt : 0,
    }
  } catch {
    return { fingerprints: {}, toolsProbedAt: 0 }
  }
}

function saveState(home: string, state: IndexState): void {
  try {
    mkdirSync(home, { recursive: true })
    writeFileSync(statePath(home), JSON.stringify(state, null, 2), 'utf8')
  } catch {
    // 状态写失败不影响索引本身：下次指纹对不上只会多刷一次。
  }
}

/** 把内容写进文件的 AUTO 段；手写段保持原样。 */
function writeAutoSection(file: string, title: string, autoBody: string): boolean {
  const block = AUTO_BEGIN + '\n' + autoBody.trimEnd() + '\n' + AUTO_END
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : undefined
  if (existing === undefined) {
    const fresh = title + '\n\n' + block + '\n\n## 手写区（插件永不覆盖）\n\n- （在这里补充本项目特有的说明）\n'
    writeFileSync(file, fresh, 'utf8')
    return true
  }
  const begin = existing.indexOf(AUTO_BEGIN)
  const end = existing.indexOf(AUTO_END)
  let next: string
  if (begin >= 0 && end > begin) {
    next = existing.slice(0, begin) + block + existing.slice(end + AUTO_END.length)
  } else {
    next = existing.trimEnd() + '\n\n' + block + '\n'
  }
  if (next === existing) return false
  writeFileSync(file, next, 'utf8')
  return true
}

// ---------------------------------------------------------------- navigation

export interface NavSnapshot {
  fingerprint: string
  topDirs: Array<{ name: string; subdirs: string[]; subdirCount: number }>
  files: string[]
}

/** 只读一层：顶层目录 + 每个顶层目录的直接子目录名（不递归，避免百万文件级扫描）。 */
export function navSnapshot(cwd: string, opts: IndexOptions = {}): NavSnapshot {
  const limit = opts.subdirsPerDir ?? 12
  const maxTop = opts.maxTopDirs ?? 80
  const entries = safeReaddir(cwd)
  const topDirs: NavSnapshot['topDirs'] = []
  const files: string[] = []
  for (const name of entries) {
    if (name.startsWith('.')) continue
    const full = join(cwd, name)
    if (isDir(full)) {
      const subs = safeReaddir(full).filter(s => !s.startsWith('.'))
      topDirs.push({ name, subdirs: subs.slice(0, limit), subdirCount: subs.length })
    } else if (!INDEX_FILES.has(name)) {
      files.push(name)
    }
  }
  const shown = topDirs.slice(0, maxTop)
  const fingerprint = sha1(
    shown.map(d => d.name + ':' + d.subdirs.join(',')).join('|') + '#' + files.sort().join(','),
  )
  return { fingerprint, topDirs: shown, files: files.sort() }
}

export function renderNavigation(cwd: string, snap: NavSnapshot): string {
  const lines: string[] = []
  lines.push('## 目录树（实测快照 ' + new Date().toISOString().slice(0, 10) + '）')
  lines.push('')
  lines.push('项目根：`' + cwd + '`')
  lines.push('')
  if (snap.topDirs.length === 0) lines.push('- （空目录）')
  for (const dir of snap.topDirs) {
    const subs = dir.subdirs.length === 0 ? '' : '  →  ' + dir.subdirs.join(' · ') +
      (dir.subdirCount > dir.subdirs.length ? ' …共 ' + dir.subdirCount + ' 项' : '')
    lines.push('- `' + dir.name + '/`' + subs)
  }
  if (snap.files.length > 0) {
    lines.push('')
    lines.push('根文件：' + snap.files.map(f => '`' + f + '`').join(' · '))
  }
  lines.push('')
  lines.push('> 找东西顺序：本文件定位表 → 目标目录的 MEMORY.md → 该目录内的细节文件。')
  return lines.join('\n')
}

export function buildNavigation(cwd: string, opts: IndexOptions = {}): IndexResult {
  const target = resolve(cwd)
  const snap = navSnapshot(target, opts)
  const file = join(target, 'NAVIGATION.md')
  const changed = writeAutoSection(file, '# NAVIGATION.md — ' + basename(target) + ' 目录导航树', renderNavigation(target, snap))
  return {
    kind: 'navigation',
    path: file,
    changed,
    summary: 'NAVIGATION.md（' + snap.topDirs.length + ' 个顶层目录）',
  }
}

// ------------------------------------------------------------------- skills

export interface SkillEntry {
  name: string
  description: string
  /** registered = 已注册可 skill() 加载；project = 仅存在于项目 .dsh/skills；library = 其他库根。 */
  status: 'registered' | 'project' | 'library'
  path: string
}

function frontmatterField(text: string, field: string): string {
  const match = text.match(new RegExp('^' + field + ':\\s*(.+)$', 'm'))
  return match === null ? '' : match[1].trim().replace(/^["']|["']$/g, '')
}

function scanSkillRoot(root: string, status: SkillEntry['status']): SkillEntry[] {
  const out: SkillEntry[] = []
  for (const name of safeReaddir(root)) {
    const dir = join(root, name)
    if (!isDir(dir)) continue
    const skillFile = join(dir, 'SKILL.md')
    if (!existsSync(skillFile)) continue
    let text = ''
    try {
      text = readFileSync(skillFile, 'utf8').slice(0, 4000)
    } catch {
      text = ''
    }
    const description = frontmatterField(text, 'description') || frontmatterField(text, 'whenToUse')
    out.push({ name, description: description.slice(0, 120), status, path: dir })
  }
  return out
}

/**
 * 发现项目内（含子目录）的 .dsh/skills 根，最多下探 depth 层。
 * 目的：把散在各子项目里的技能库（例如 <cwd>/DSH/破译/.dsh/skills）也纳入清单，
 * 同时明确标注它们「未注册、不能 skill() 加载」。
 */
export function findNestedSkillRoots(cwd: string, depth = 3): string[] {
  const roots: string[] = []
  const walk = (dir: string, level: number): void => {
    if (level > depth) return
    for (const name of safeReaddir(dir)) {
      if (name.startsWith('.') && name !== '.dsh') continue
      if (SKIP_DIRS.has(name)) continue
      const full = join(dir, name)
      if (!isDir(full)) continue
      if (name === '.dsh') {
        const skills = join(full, 'skills')
        if (isDir(skills)) roots.push(skills)
        continue
      }
      walk(full, level + 1)
    }
  }
  walk(resolve(cwd), 1)
  return roots
}

export function collectSkills(cwd: string, opts: IndexOptions = {}): SkillEntry[] {
  const home = opts.home ?? dshHome()
  const seen = new Set<string>()
  const all: SkillEntry[] = []
  const ownRoot = join(resolve(cwd), '.dsh', 'skills')
  const roots: Array<[string, SkillEntry['status']]> = [[join(home, 'skills'), 'registered']]
  if (isDir(ownRoot)) roots.push([ownRoot, 'project'])
  for (const nested of findNestedSkillRoots(cwd)) {
    if (nested !== ownRoot) roots.push([nested, 'library'])
  }
  for (const extra of opts.skillRoots ?? []) roots.push([extra, 'library'])
  for (const [root, status] of roots) {
    for (const entry of scanSkillRoot(root, status)) {
      if (seen.has(entry.name)) continue
      seen.add(entry.name)
      all.push(entry)
    }
  }
  return all.sort((a, b) => a.name.localeCompare(b.name))
}

export function renderSkills(entries: SkillEntry[]): string {
  const registered = entries.filter(e => e.status === 'registered')
  const project = entries.filter(e => e.status === 'project')
  const library = entries.filter(e => e.status === 'library')
  const lines: string[] = []
  lines.push('## 技能清单（实测快照 ' + new Date().toISOString().slice(0, 10) + '）')
  lines.push('')
  lines.push('| 档位 | 数量 | 能否 skill() 加载 |')
  lines.push('|---|---:|---|')
  lines.push('| 已注册（本会话可用） | ' + registered.length + ' | ✅ 能 |')
  lines.push('| 项目 .dsh/skills（未注册） | ' + project.length + ' | ❌ 只能当文本读 |')
  lines.push('| 其他库根（未注册） | ' + library.length + ' | ❌ 只能当文本读 |')
  lines.push('')
  const table = (title: string, list: SkillEntry[], note: string, compact = false): void => {
    if (list.length === 0) return
    lines.push('### ' + title + '（' + list.length + '）')
    lines.push('')
    lines.push(note)
    lines.push('')
    // 大库只列名字（省体积）：200 条带描述会撑到 20KB+，名字清单 ~4KB 足够定位。
    if (compact && list.length > 30) {
      for (let i = 0; i < list.length; i += 8) {
        lines.push('- ' + list.slice(i, i + 8).map(entry => '`' + entry.name + '`').join(' · '))
      }
      lines.push('')
      return
    }
    for (const entry of list) {
      lines.push('- `' + entry.name + '` — ' + (entry.description === '' ? '（无描述）' : entry.description))
    }
    lines.push('')
  }
  table('已注册 · 可直接 skill() 加载', registered, '直接调用 `skill({ name })`。')
  table('项目级 · 未注册', project, '要真正可用需注册到 dsh home 的 skills 目录；否则只能按路径读 SKILL.md。')
  table('其他技能库', library, '库资产，非本会话能力；需要用时先注册或按路径读 SKILL.md。', true)
  return lines.join('\n')
}

export function buildSkills(cwd: string, opts: IndexOptions = {}): IndexResult {
  const target = resolve(cwd)
  const entries = collectSkills(target, opts)
  const file = join(target, 'SKILLS.md')
  const changed = writeAutoSection(file, '# SKILLS.md — ' + basename(target) + ' 技能清单', renderSkills(entries))
  const registered = entries.filter(e => e.status === 'registered').length
  return {
    kind: 'skills',
    path: file,
    changed,
    summary: 'SKILLS.md（可加载 ' + registered + ' / 库 ' + entries.length + '）',
  }
}

// -------------------------------------------------------------------- tools

export interface ToolEntry {
  name: string
  path: string
  version: string
  /** how = PATH 可直接调用；path = 需全路径；env = 需设环境变量。 */
  how: 'how' | 'path' | 'env'
}

const TOOL_CANDIDATES = [
  'java', 'javac', 'node', 'npm', 'pnpm', 'python', 'pip', 'go', 'git', 'adb', 'gradle',
  'ffmpeg', 'dotnet', 'flutter', 'dart', 'docker', 'jadx', 'frida', 'apktool', '7z', 'rg',
  'pwsh', 'code', 'wsl', 'nvidia-smi', 'curl', 'gh', 'winget',
]

const VERSION_ARGS: Record<string, string[]> = {
  java: ['-version'],
  node: ['-v'],
  python: ['--version'],
  go: ['version'],
  git: ['--version'],
  ffmpeg: ['-version'],
  dotnet: ['--version'],
  adb: ['version'],
  docker: ['--version'],
}

function runVersion(name: string, exe: string): string {
  const args = VERSION_ARGS[name]
  if (args === undefined) return ''
  try {
    const out = execFileSync(exe, args, { encoding: 'utf8', timeout: 8000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    const line = String(out).split('\n')[0].trim().slice(0, 60)
    // 版本行必须含数字，否则视为噪声（例如 dotnet 的加载失败提示）。
    return /[0-9]/.test(line) ? line : ''
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr
    return typeof stderr === 'string' && stderr !== '' ? stderr.split('\n')[0].trim().slice(0, 60) : ''
  }
}

/** PATH 探测：where.exe（Windows）/ which。 */
function whichAll(names: string[]): Record<string, string> {
  const found: Record<string, string> = {}
  const isWindows = process.platform === 'win32'
  for (const name of names) {
    try {
      const cmd = isWindows ? 'where.exe' : 'which'
      const out = execFileSync(cmd, [name], {
        encoding: 'utf8',
        timeout: 5000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      const first = String(out).split('\n')[0].trim()
      if (first !== '') found[name] = first
    } catch {
      // 不在 PATH：留给 env / 已知根目录继续找
    }
  }
  return found
}

function envTools(): Record<string, string> {
  const out: Record<string, string> = {}
  const envs: Array<[string, string]> = [
    ['JAVA_HOME', 'java'],
    ['ANDROID_HOME', 'adb'],
    ['ANDROID_SDK_ROOT', 'adb'],
    ['GOPATH', 'go'],
    ['FLUTTER_HOME', 'flutter'],
  ]
  for (const [env, name] of envs) {
    const value = process.env[env]
    if (typeof value !== 'string' || value === '' || out[name] !== undefined) continue
    out[name] = value
  }
  return out
}

/** 机器级工具缓存：<home>/env/tools.json，带 TTL。 */
export function probeTools(home: string = dshHome(), ttlHours = 24, force = false): {
  file: string
  tools: ToolEntry[]
  probedAt: number
  fresh: boolean
} {
  const file = join(home, 'env', 'tools.json')
  const state = loadState(home)
  const ageMs = Date.now() - state.toolsProbedAt
  if (!force && existsSync(file) && ageMs < ttlHours * 3600 * 1000) {
    try {
      const cached = JSON.parse(readFileSync(file, 'utf8')) as { tools?: ToolEntry[]; probedAt?: number }
      if (Array.isArray(cached.tools)) {
        return { file, tools: cached.tools, probedAt: cached.probedAt ?? state.toolsProbedAt, fresh: false }
      }
    } catch {
      // 缓存坏了就重探
    }
  }
  const onPath = whichAll(TOOL_CANDIDATES)
  const fromEnv = envTools()
  const tools: ToolEntry[] = []
  for (const name of TOOL_CANDIDATES) {
    const exe = onPath[name]
    if (exe !== undefined) {
      tools.push({ name, path: exe, version: runVersion(name, exe), how: 'how' })
      continue
    }
    const envPath = fromEnv[name]
    if (envPath !== undefined) {
      tools.push({ name, path: envPath, version: '', how: 'env' })
    }
  }
  const probedAt = Date.now()
  try {
    mkdirSync(join(home, 'env'), { recursive: true })
    writeFileSync(file, JSON.stringify({ probedAt, platform: process.platform, tools }, null, 2), 'utf8')
  } catch {
    // 写不了缓存也不影响返回
  }
  state.toolsProbedAt = probedAt
  saveState(home, state)
  return { file, tools, probedAt, fresh: true }
}

export function renderTools(tools: ToolEntry[], cacheFile: string, missing: string[]): string {
  const lines: string[] = []
  lines.push('## 工具清单（机器级缓存 ' + new Date().toISOString().slice(0, 10) + '）')
  lines.push('')
  lines.push('缓存文件：`' + cacheFile + '`（全项目共享，TTL 过期才重探）')
  lines.push('')
  lines.push('| 工具 | 版本 | 绝对路径 | 调用方式 |')
  lines.push('|---|---|---|---|')
  for (const tool of tools) {
    const howLabel = tool.how === 'how' ? 'PATH' : tool.how === 'env' ? 'ENV' : 'FULL'
    lines.push('| `' + tool.name + '` | ' + (tool.version === '' ? '—' : tool.version) + ' | `' + tool.path + '` | ' + howLabel + ' |')
  }
  if (missing.length > 0) {
    lines.push('')
    lines.push('**未找到（本身是结论，避免重复搜索）**：' + missing.map(m => '`' + m + '`').join(' · '))
  }
  lines.push('')
  lines.push('> 调用方式：PATH = 直接敲命令；ENV = 需经环境变量（JAVA_HOME 等）定位。')
  return lines.join('\n')
}

export function buildTools(cwd: string, opts: IndexOptions = {}): IndexResult {
  const home = opts.home ?? dshHome()
  const probe = probeTools(home, opts.toolsTtlHours ?? 24)
  const missing = TOOL_CANDIDATES.filter(name => !probe.tools.some(tool => tool.name === name))
  const file = join(resolve(cwd), 'TOOLS.md')
  const changed = writeAutoSection(file, '# TOOLS.md — ' + basename(resolve(cwd)) + ' 工具与环境清单', renderTools(probe.tools, probe.file, missing))
  return {
    kind: 'tools',
    path: file,
    changed,
    summary: 'TOOLS.md（' + probe.tools.length + ' 个可用 / ' + missing.length + ' 个未找到）',
  }
}

// ------------------------------------------------------------------ refresh

/** 结构指纹：目录树 + 技能数量。用于「只在变化时才提醒模型」。 */
export function structureFingerprint(cwd: string, opts: IndexOptions = {}): Record<string, string> {
  const target = resolve(cwd)
  const nav = navSnapshot(target, opts)
  const skills = collectSkills(target, opts)
  return {
    navigation: nav.fingerprint,
    skills: sha1(skills.map(s => s.name + ':' + s.status).join(',')),
  }
}

/** 是否与上次记录的结构指纹不同（不写盘，纯比较）。 */
export function structureChanged(cwd: string, opts: IndexOptions = {}): string[] {
  const home = opts.home ?? dshHome()
  const target = resolve(cwd)
  const state = loadState(home)
  const prev = state.fingerprints[target] ?? {}
  const now = structureFingerprint(target, opts)
  const changed: string[] = []
  for (const [kind, value] of Object.entries(now)) {
    if (prev[kind] !== value) changed.push(kind)
  }
  return changed
}

/**
 * 刷新三棵树索引。默认只重建指纹已变化的文件（force 时全部重建）。
 * 返回结果里 changed=false 表示「没变化、没写盘」。
 */
export function refreshIndexes(cwd: string, opts: IndexOptions = {}, force = false): IndexResult[] {
  const home = opts.home ?? dshHome()
  const target = resolve(cwd)
  const state = loadState(home)
  const before = structureFingerprint(target, opts)
  const prev = state.fingerprints[target] ?? {}
  const results: IndexResult[] = []
  const wanted: Array<'navigation' | 'skills'> = []
  const files: Record<'navigation' | 'skills', string> = {
    navigation: join(target, 'NAVIGATION.md'),
    skills: join(target, 'SKILLS.md'),
  }
  for (const kind of ['navigation', 'skills'] as const) {
    // 指纹变了要重建；文件缺失或 AUTO 段为空（被删/被重写）同样要重建，
    // 否则「删掉 NAVIGATION.md」这种情况会因为指纹没变而永远不重建。
    if (force || prev[kind] !== before[kind] || needsBuild(files[kind])) wanted.push(kind)
  }
  if (wanted.includes('navigation')) results.push(buildNavigation(target, opts))
  if (wanted.includes('skills')) results.push(buildSkills(target, opts))
  const toolsResult = buildTools(target, opts)
  if (toolsResult.changed || force) results.push(toolsResult)
  // probeTools 会单独写一次状态（toolsProbedAt）；这里必须重读再合并，
  // 否则用开头读到的旧副本覆盖回去，TTL 永远失效、每次会话都重探工具。
  const latest = loadState(home)
  latest.fingerprints[target] = before
  saveState(home, latest)
  return results
}

/** 索引文件缺失、或 AUTO 段是空的（文件被删/被重写）→ 必须重建。 */
function needsBuild(file: string): boolean {
  if (!existsSync(file)) return true
  try {
    const text = readFileSync(file, 'utf8')
    const begin = text.indexOf(AUTO_BEGIN)
    const end = text.indexOf(AUTO_END)
    if (begin < 0 || end <= begin) return true
    // 只看 AUTO 段内除首尾标记外是否还有内容
    return text.slice(begin + AUTO_BEGIN.length, end).trim() === ''
  } catch {
    return true
  }
}

/** 索引文件是否都已存在（用于会话开始时决定要不要建）。 */
export function indexesPresent(cwd: string): boolean {
  const target = resolve(cwd)
  return ['NAVIGATION.md', 'SKILLS.md', 'TOOLS.md'].every(name => existsSync(join(target, name)))
}

/** 一行 system prompt 摘要（≤160 字符）。 */
export function indexHint(cwd: string): string {
  const target = resolve(cwd)
  const parts: string[] = []
  if (existsSync(join(target, 'NAVIGATION.md'))) parts.push('NAVIGATION.md 目录树')
  if (existsSync(join(target, 'SKILLS.md'))) parts.push('SKILLS.md 技能清单')
  if (existsSync(join(target, 'TOOLS.md'))) parts.push('TOOLS.md 工具清单')
  if (parts.length === 0) return ''
  return '本工作区已有索引：' + parts.join(' · ') + '。找东西先看 NAVIGATION.md；不要为此扫全盘。'
}
