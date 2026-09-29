/**
 * Unit tests for the agent-workflow surface: scaffolding, per-task workspaces,
 * board parsing/checks and the workflow config round-trip.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, describe, expect, it } from 'vitest'
import {
  checkWorkflow,
  createTaskWorkspace,
  ensureWorkflowInit,
  parseBoard,
  readBoardSummary,
  resolveWorkflowTemplateDir,
  unfinishedRows,
} from '../src/core/workflow.ts'
import { DEFAULT_WORKFLOW } from '../src/core/contract.ts'
import { MemoryStore, normalizeConfig, toWorkflow } from '../src/store.ts'

const dirs: string[] = []

function makeDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-workflow-'))
  dirs.push(dir)
  return dir
}

afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

const BOARD = [
  '# STATUS.md',
  '',
  '| 任务 id | 标题 | 状态 | 当前 / 下一步 | 证据指针 | 需要用户决定 |',
  '|---|---|---|---|---|---|',
  '| 20260101-done | 已完成的事 | 完成 | — | _work/20260101-done/evidence/ | 无 |',
  '| 20260102-blocked | 被卡住的事 | 阻塞（等用户） | 等确认 | 无 | 是否继续 |',
  '| 20260103-active | 进行中的事 | 进行中 | 写测试 | _work/20260103-active/evidence/ | 无 |',
].join('\n')

describe('workflow scaffolding', () => {
  it('copies policy, board, scripts and checks once (idempotent)', () => {
    const cwd = makeDir()
    const first = ensureWorkflowInit(cwd, resolveWorkflowTemplateDir())
    expect(first.length).toBeGreaterThan(6)
    const required = ['AGENT_WORKFLOW.md', 'STATUS.md', '_work/README.md', '_work/new-task.sh', '_work/log.sh', '_work/sanitize-env.sh', '_work/checks/check-evidence.sh', '_work/_template/README.md']
    for (const rel of required) expect(existsSync(join(cwd, rel)), rel).toBe(true)
    expect(ensureWorkflowInit(cwd, resolveWorkflowTemplateDir())).toEqual([])
  })

  it('never overwrites an existing policy file', () => {
    const cwd = makeDir()
    writeFileSync(join(cwd, 'AGENT_WORKFLOW.md'), 'MINE', 'utf8')
    ensureWorkflowInit(cwd, resolveWorkflowTemplateDir())
    expect(readFileSync(join(cwd, 'AGENT_WORKFLOW.md'), 'utf8')).toBe('MINE')
  })

  it('ignores a missing or invalid cwd instead of throwing', () => {
    expect(ensureWorkflowInit('', resolveWorkflowTemplateDir())).toEqual([])
    const missing = join(tmpdir(), 'dsh-does-not-exist-' + Date.now())
    expect(ensureWorkflowInit(missing, resolveWorkflowTemplateDir())).toEqual([])
  })
})

describe('task workspace', () => {
  it('creates the task tree, renders placeholders and logs the creation', () => {
    const cwd = makeDir()
    ensureWorkflowInit(cwd, resolveWorkflowTemplateDir())
    const created = createTaskWorkspace(cwd, '20260104-demo', '演示任务', new Date(2026, 0, 4, 9, 30))
    expect(created.length).toBeGreaterThan(3)
    const notes = readFileSync(join(cwd, '_work', '20260104-demo', 'notes.md'), 'utf8')
    expect(notes).toContain('20260104-demo')
    expect(notes).not.toContain('<id>')
    const log = readFileSync(join(cwd, '_work', '20260104-demo', 'run.log'), 'utf8')
    expect(log).toContain('2026-01-04 09:30')
    expect(existsSync(join(cwd, '_work', '20260104-demo', 'evidence'))).toBe(true)
    expect(createTaskWorkspace(cwd, '20260104-demo')).toEqual([])
  })

  it('rejects an unsafe task id', () => {
    const cwd = makeDir()
    ensureWorkflowInit(cwd, resolveWorkflowTemplateDir())
    expect(createTaskWorkspace(cwd, '../escape')).toEqual([])
    expect(createTaskWorkspace(cwd, 'a/b')).toEqual([])
  })
})

describe('board parsing and checks', () => {
  it('parses rows and keeps only unfinished task rows', () => {
    const rows = parseBoard(BOARD)
    expect(rows.length).toBeGreaterThanOrEqual(3)
    const open = unfinishedRows(BOARD).map(row => row.cells[0])
    expect(open).toEqual(['20260102-blocked', '20260103-active'])
  })

  it('summarizes the board for prompt injection', () => {
    const cwd = makeDir()
    writeFileSync(join(cwd, 'STATUS.md'), BOARD, 'utf8')
    const summary = readBoardSummary(cwd)
    expect(summary).toBeDefined()
    if (summary === undefined) return
    expect(summary).toContain('20260103-active')
    expect(summary).toContain('待用户=是否继续')
    expect(summary).not.toContain('20260101-done')
  })

  it('reports a missing board when the policy file exists', () => {
    const cwd = makeDir()
    writeFileSync(join(cwd, 'AGENT_WORKFLOW.md'), 'x', 'utf8')
    const kinds = checkWorkflow(cwd).map(finding => finding.kind)
    expect(kinds).toContain('board-missing')
    expect(kinds).toContain('scaffold-incomplete')
  })

  it('reports blocked-without-reason, missing evidence and stray temp files', () => {
    const cwd = makeDir()
    ensureWorkflowInit(cwd, resolveWorkflowTemplateDir())
    writeFileSync(join(cwd, 'STATUS.md'), BOARD.replace('是否继续', '无'), 'utf8')
    mkdirSync(join(cwd, '_work', '20260103-active', 'evidence'), { recursive: true })
    writeFileSync(join(cwd, '_n_x3.png'), 'x', 'utf8')
    const kinds = checkWorkflow(cwd).map(finding => finding.kind)
    expect(kinds).toContain('blocked-without-reason')
    expect(kinds).toContain('task-without-evidence')
    expect(kinds).toContain('stray-temp-files')
  })

  it('is clean for a freshly scaffolded project', () => {
    const cwd = makeDir()
    ensureWorkflowInit(cwd, resolveWorkflowTemplateDir())
    const kinds = checkWorkflow(cwd).map(finding => finding.kind)
    expect(kinds).not.toContain('scaffold-incomplete')
    expect(kinds).not.toContain('board-missing')
  })
})

describe('workflow config', () => {
  it('fills workflow defaults for legacy documents and partial patches', () => {
    expect(normalizeConfig({}).workflow).toEqual(DEFAULT_WORKFLOW)
    expect(normalizeConfig({ workflow: { turnCheck: false } }).workflow).toEqual({ ...DEFAULT_WORKFLOW, turnCheck: false })
    expect(toWorkflow('nonsense')).toEqual(DEFAULT_WORKFLOW)
  })

  it('round-trips workflow switches and per-session overrides through the store', () => {
    const cwd = makeDir()
    const store = new MemoryStore(join(cwd, 'config.json'))
    const patched = store.updateGlobal({ workflow: { boardInject: false } })
    expect(patched.workflow.boardInject).toBe(false)
    expect(patched.workflow.turnCheck).toBe(true)
    expect(store.load()?.workflow.boardInject).toBe(false)
    const session = store.setSessionWorkflow('session-1', false)
    expect(session.sessions['session-1']?.workflowEnabled).toBe(false)
    const cleared = store.setSessionWorkflow('session-1', null)
    expect(cleared.sessions['session-1']).toBeUndefined()
  })
})
