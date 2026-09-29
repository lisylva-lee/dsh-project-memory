/**
 * Agent-workflow automation (policy file + board + per-task scratch spaces).
 *
 * Pure node, no harness services, so it is unit-testable: asset resolution,
 * idempotent per-project scaffolding, board summary extraction and the
 * per-turn checks used by the host half of the plugin.
 */
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Runtime-skill name registered by the plugin. */
export const WORKFLOW_SKILL_NAME = 'agent-workflow'
/** In-repo policy file (the WORKFLOW.md analogue). */
export const POLICY_FILE = 'AGENT_WORKFLOW.md'
/** In-repo status board. */
export const BOARD_FILE = 'STATUS.md'
/** Per-task scratch root. */
export const WORK_ROOT = '_work'

/** Absolute path of the bundled workflow assets (SKILL.md + templates + checks). */
export function packageWorkflowAssetsRoot(): string {
  return fileURLToPath(new URL('../../assets/workflow/', import.meta.url))
}

/** Default user skill root: ~/.dsh/skills/agent-workflow. */
export function defaultWorkflowSkillDir(home: string = homedir()): string {
  return join(home, '.dsh', 'skills', WORKFLOW_SKILL_NAME)
}

/** Resolve the workflow skill root: the user skill dir when present, else bundled assets. */
export function resolveWorkflowSkillDir(home: string = homedir()): string {
  const user = defaultWorkflowSkillDir(home)
  return existsSync(join(user, 'SKILL.md')) ? user : packageWorkflowAssetsRoot()
}

/** Resolve the workflow templates directory: the user skill's, else bundled. */
export function resolveWorkflowTemplateDir(home: string = homedir()): string {
  const user = defaultWorkflowSkillDir(home)
  if (existsSync(join(user, 'templates', POLICY_FILE))) return join(user, 'templates')
  return join(packageWorkflowAssetsRoot(), 'templates')
}

/** Load the workflow skill body: the user skill's SKILL.md, else the bundled copy. */
export function loadWorkflowSkillContent(home: string = homedir()): string {
  const user = defaultWorkflowSkillDir(home)
  const candidate = join(user, 'SKILL.md')
  return existsSync(candidate)
    ? readFileSync(candidate, 'utf8')
    : readFileSync(join(packageWorkflowAssetsRoot(), 'SKILL.md'), 'utf8')
}

/** Local-timezone "YYYY-MM-DD HH:MM" stamp used by run.log lines. */
export function localStamp(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
    ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes())
  )
}

/** Helper scripts copied into _work/. */
const WORK_SCRIPTS = ['new-task.sh', 'log.sh', 'sanitize-env.sh'] as const
/** Check scripts copied into _work/checks/. */
const WORK_CHECKS = ['check-evidence.sh', 'check-status.sh', 'check-tempfiles.sh'] as const

function copyIfMissing(src: string, dst: string, created: string[]): void {
  if (!existsSync(src) || existsSync(dst)) return
  mkdirSync(dirname(dst), { recursive: true })
  copyFileSync(src, dst)
  created.push(dst)
  try {
    chmodSync(dst, 0o755)
  } catch {
    /* not POSIX: ignore */
  }
}

/**
 * Idempotent per-project workflow scaffold: AGENT_WORKFLOW.md + STATUS.md +
 * _work/ (README, _template/**, helper scripts, checks). Never overwrites.
 * @returns the created paths (empty when nothing was created).
 */
export function ensureWorkflowInit(cwd: string, templateDir: string): string[] {
  const created: string[] = []
  if (typeof cwd !== 'string' || cwd === '') return created
  const target = resolve(cwd)
  try {
    if (!existsSync(target) || !statSync(target).isDirectory()) return created
  } catch {
    return created
  }
  try {
    copyIfMissing(join(templateDir, POLICY_FILE), join(target, POLICY_FILE), created)
    copyIfMissing(join(templateDir, BOARD_FILE), join(target, BOARD_FILE), created)
    const work = join(target, WORK_ROOT)
    mkdirSync(work, { recursive: true })
    copyIfMissing(join(templateDir, WORK_ROOT, 'README.md'), join(work, 'README.md'), created)
    const tplDir = join(templateDir, WORK_ROOT, '_template')
    if (existsSync(tplDir)) {
      const rels = ['README.md', 'notes.md', 'run.log', join('evidence', 'README.md')]
      for (const rel of rels) {
        copyIfMissing(join(tplDir, rel), join(work, '_template', rel), created)
      }
    }
    for (const name of WORK_SCRIPTS) {
      copyIfMissing(join(templateDir, WORK_ROOT, name), join(work, name), created)
    }
    for (const name of WORK_CHECKS) {
      copyIfMissing(join(templateDir, WORK_ROOT, 'checks', name), join(work, 'checks', name), created)
    }
  } catch {
    return created
  }
  return created
}

/**
 * Create one per-task scratch workspace from _work/_template (idempotent).
 * @returns the created paths (empty when the task dir already exists).
 */
export function createTaskWorkspace(
  cwd: string,
  taskId: string,
  title?: string,
  now: Date = new Date(),
): string[] {
  const created: string[] = []
  if (typeof cwd !== 'string' || cwd === '' || !/^[A-Za-z0-9._-]+$/.test(taskId)) return created
  const target = resolve(cwd)
  const work = join(target, WORK_ROOT)
  const dst = join(work, taskId)
  if (existsSync(dst)) return created
  const tpl = join(work, '_template')
  try {
    mkdirSync(join(dst, 'evidence'), { recursive: true })
    mkdirSync(join(dst, 'backup'), { recursive: true })
    mkdirSync(join(dst, 'archive'), { recursive: true })
    const label = title === undefined || title === '' ? taskId : title
    const render = (text: string) => text.replaceAll('<id>', taskId).replaceAll('<标题>', label)
    for (const rel of ['README.md', 'notes.md']) {
      const src = join(tpl, rel)
      if (!existsSync(src)) continue
      const out = join(dst, rel)
      writeFileSync(out, render(readFileSync(src, 'utf8')), 'utf8')
      created.push(out)
    }
    const evSrc = join(tpl, 'evidence', 'README.md')
    if (existsSync(evSrc)) {
      const out = join(dst, 'evidence', 'README.md')
      copyFileSync(evSrc, out)
      created.push(out)
    }
    const log = join(dst, 'run.log')
    const stamp = localStamp(now)
    writeFileSync(
      log,
      stamp + ' | 任务创建 | ' + label + ' (' + taskId + ')' + '\n' +
        stamp + ' | 依据 | AGENT_WORKFLOW.md 生命周期钩子（开工）' + '\n',
      'utf8',
    )
    created.push(log)
  } catch {
    return created
  }
  return created
}

/** One row of STATUS.md parsed into cells. */
export interface BoardRow {
  cells: string[]
}

/** Parse the markdown table rows of STATUS.md (header/separator skipped). */
export function parseBoard(text: string): BoardRow[] {
  const rows: BoardRow[] = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) continue
    const cells = trimmed
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map(cell => cell.trim())
    if (cells.length < 4) continue
    if (/^-{2,}$/.test(cells[0] ?? '')) continue
    if (cells[0] === '任务 id' || cells[0] === '时间' || cells[0] === '资产') continue
    rows.push({ cells })
  }
  return rows
}

/** Task rows (first cell looks like a task id or a date) that are not finished. */
export function unfinishedRows(text: string): BoardRow[] {
  return parseBoard(text).filter(row => {
    const id = row.cells[0] ?? ''
    if (!/^(\d{8}|\d{4}-\d{2}-\d{2})/.test(id)) return false
    const status = row.cells[2] ?? ''
    return !/完成|中止|取消|done/i.test(status)
  })
}

/** Compact board summary for prompt injection (undefined when nothing to show). */
export function readBoardSummary(cwd: string, maxLines: number = 10): string | undefined {
  try {
    const board = join(resolve(cwd), BOARD_FILE)
    if (!existsSync(board)) return undefined
    const rows = unfinishedRows(readFileSync(board, 'utf8'))
    if (rows.length === 0) return undefined
    const lines = rows.slice(0, maxLines).map(row => {
      const cells = row.cells
      const id = cells[0] ?? ''
      const title = cells[1] ?? ''
      const status = cells[2] ?? ''
      const next = cells[3] ?? ''
      const evidence = cells[4] ?? ''
      const need = cells[5] ?? ''
      const bits = ['-', id, title.slice(0, 40), '[' + status + ']']
      if (next !== '') bits.push('下一步=' + next.slice(0, 40))
      if (evidence !== '') bits.push('证据=' + evidence.slice(0, 40))
      if (need !== '' && need !== '无') bits.push('待用户=' + need.slice(0, 40))
      return bits.join(' ')
    })
    return lines.join('\n')
  } catch {
    return undefined
  }
}

/** A single workflow finding (kind + human-readable detail). */
export interface WorkflowFinding {
  kind: string
  detail: string
}

const TEMP_NAME = /^(_[A-Za-z0-9_-]+\.(png|jpg|jpeg|tmp)|nul|NUL|\.tmp)$/

/** Cheap, read-only per-turn checks over the project workflow state. */
export function checkWorkflow(cwd: string): WorkflowFinding[] {
  const findings: WorkflowFinding[] = []
  const target = resolve(cwd)
  try {
    const policyExists = existsSync(join(target, POLICY_FILE))
    const boardPath = join(target, BOARD_FILE)
    const boardExists = existsSync(boardPath)
    const work = join(target, WORK_ROOT)

    if (policyExists && !boardExists) {
      findings.push({ kind: 'board-missing', detail: BOARD_FILE + ' 缺失（AGENT_WORKFLOW.md 已在）' })
    }

    if (policyExists) {
      const missing: string[] = []
      const required = ['README.md', join('_template', 'README.md'), ...WORK_SCRIPTS]
      for (const rel of required) {
        if (!existsSync(join(work, rel))) missing.push(rel)
      }
      if (missing.length > 0) {
        findings.push({ kind: 'scaffold-incomplete', detail: WORK_ROOT + '/ 缺: ' + missing.join(', ') })
      }
    }

    if (boardExists) {
      const text = readFileSync(boardPath, 'utf8')
      for (const row of unfinishedRows(text)) {
        const cells = row.cells
        const id = cells[0] ?? ''
        const status = cells[2] ?? ''
        const need = cells[5] ?? ''
        if (/阻塞/.test(status) && (need === '' || need === '无')) {
          findings.push({ kind: 'blocked-without-reason', detail: id + ' 标记阻塞但未写「需要用户决定」' })
        }
        const taskDir = join(work, id)
        if (existsSync(taskDir)) {
          let files = 0
          try {
            files = readdirSync(join(taskDir, 'evidence')).filter(name => name !== 'README.md').length
          } catch {
            /* no evidence dir */
          }
          if (files === 0) {
            findings.push({
              kind: 'task-without-evidence',
              detail: id + ' 无证据文件（' + WORK_ROOT + '/' + id + '/evidence/）',
            })
          }
        }
      }
    }

    const strays: string[] = []
    try {
      for (const name of readdirSync(target)) {
        if (TEMP_NAME.test(name)) strays.push(name)
      }
    } catch {
      /* unreadable cwd */
    }
    if (strays.length > 0) {
      findings.push({ kind: 'stray-temp-files', detail: '项目根散落临时文件: ' + strays.slice(0, 5).join(', ') })
    }
  } catch {
    return findings
  }
  return findings
}
