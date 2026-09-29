/**
 * dsh-project-memory — host half.
 *
 * 把「project-memory」人读版项目记忆技能做成插件，带全局开关 + 每会话开关：
 *
 *   - 全局 enabled（总闸，默认 true）：关闭时本插件的全部表面（运行时技能、
 *     指引注入、自动初始化、自动收尾）一并停用。
 *   - autoInit / autoMaintain / announceToAgent：细分开关。
 *   - 每会话覆盖（sessions.<id>.enabled）：只在总闸开启时生效，关掉某个会话
 *     即该会话不自动记忆。
 *   - agent/session-start 按会话 cwd 自动初始化 MEMORY.md + memory/_TEMPLATE.md
 *     + memory/YYYY-MM-DD.md（幂等，不覆盖已有文件）。
 *   - agent/turn-stopping 每轮有实际工具的 turn 结束时 steer 一步收尾引导：
 *     写/更新 memory/YYYY-MM-DD.md（背景/改动/结论/关联）并更新 MEMORY.md 索引
 *     （#标签 分类、日期倒序只加不删、摘要 ≤3 条）。
 *   - 通过 ctx.skills.register 把 project-memory 注册为运行时技能。
 *   - /api/dsh-project-memory/config + /session 路由：GUI 插件配置卡片与
 *     每会话开关读写 ~/.dsh/dsh-project-memory.json。
 */
import type { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-skill'
import type { AssembleContext } from '@deepseek-ai/dsh-system-prompt'
import { GUIDANCE, MAINTAIN_PROMPT, SKILL_DESCRIPTION, SKILL_WHEN_TO_USE } from './core/guidance.ts'
import {
  DEFAULT_WORKFLOW,
  MEMORY_OFF_GUIDANCE,
  WORKFLOW_OFF_GUIDANCE,
  type WorkflowConfig,
} from './core/contract.ts'
import {
  checkWorkflow,
  ensureWorkflowInit,
  loadWorkflowSkillContent,
  readBoardSummary,
  resolveWorkflowSkillDir,
  resolveWorkflowTemplateDir,
  WORKFLOW_SKILL_NAME,
} from './core/workflow.ts'
import {
  WORKFLOW_CHECK_PROMPT_PREFIX,
  WORKFLOW_GUIDANCE,
  WORKFLOW_SKILL_DESCRIPTION,
  WORKFLOW_SKILL_WHEN_TO_USE,
} from './core/workflow-guidance.ts'
import { ensureMemoryInit, loadSkillContent, resolveSkillDir, resolveTemplateDir } from './core/templates.ts'
import { runCompression } from './core/compress.ts'
import { makeRoutes } from './routes.ts'
import { MemoryStore } from './store.ts'

/** Stable cordis plugin name. */
export const name = 'project-memory'

/** Services required before the plugin surfaces can mount. */
export const inject = ['skills', 'systemPrompt', 'webServer']

/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 150

/** Composition-entry fallbacks (the GUI-edited file wins once it exists). */
interface CompositionDefaults {
  enabled: boolean
  autoInit: boolean
  autoMaintain: boolean
  announceToAgent: boolean
  autoCompress: boolean
  compressInterval: number
  workflow: WorkflowConfig
}

function resolveDefaults(config: Record<string, unknown> | undefined): CompositionDefaults {
  const rawWorkflow = (config as { workflow?: Record<string, unknown> } | undefined)?.workflow
  return {
    enabled: typeof config?.enabled === 'boolean' ? config.enabled : true,
    autoInit: typeof config?.autoInit === 'boolean' ? config.autoInit : true,
    autoMaintain: typeof config?.autoMaintain === 'boolean' ? config.autoMaintain : true,
    announceToAgent: typeof config?.announceToAgent === 'boolean' ? config.announceToAgent : true,
    autoCompress: typeof config?.autoCompress === 'boolean' ? config.autoCompress : true,
    compressInterval: typeof config?.compressInterval === 'number' && Number.isInteger(config.compressInterval) && config.compressInterval >= 1
      ? config.compressInterval
      : 5,
    workflow: {
      enabled: typeof rawWorkflow?.enabled === 'boolean' ? rawWorkflow.enabled : DEFAULT_WORKFLOW.enabled,
      autoScaffold: typeof rawWorkflow?.autoScaffold === 'boolean' ? rawWorkflow.autoScaffold : DEFAULT_WORKFLOW.autoScaffold,
      turnCheck: typeof rawWorkflow?.turnCheck === 'boolean' ? rawWorkflow.turnCheck : DEFAULT_WORKFLOW.turnCheck,
      boardInject: typeof rawWorkflow?.boardInject === 'boolean' ? rawWorkflow.boardInject : DEFAULT_WORKFLOW.boardInject,
    },
  }
}

/** Scan the tail of a session log for one turn's tool activity. */
export function turnActivity(events: readonly unknown[], turn: number): { worked: boolean } {
  let worked = false
  const candidates = [...events].reverse() as Array<{ type?: string; data?: { turn?: unknown } }>
  for (const event of candidates) {
    const data = event?.data
    if (data === undefined || typeof data.turn !== 'number') continue
    if (data.turn < turn) break
    if (data.turn !== turn) continue
    if (event.type === 'tool/call') worked = true
  }
  return { worked }
}

/** Subagent sessions (and any nested delegation) never get auto-init/maintain. */
export function isSubagentSession(agent: { session?: { header?: { origin?: string; delegationDepth?: number } } } | undefined): boolean {
  const header = agent?.session?.header
  return header?.origin === 'subagent' || (header?.delegationDepth ?? 0) > 0
}

/** Apply the host half. */
export function apply(ctx: Context, config?: Record<string, unknown>): void {
  const store = new MemoryStore()
  const defaults = resolveDefaults(config)

  /** Resolve the live config: the GUI-edited file over the composition defaults. */
  const resolve = () => {
    const file = store.load()
    return {
      enabled: file?.enabled ?? defaults.enabled,
      autoInit: file?.autoInit ?? defaults.autoInit,
      autoMaintain: file?.autoMaintain ?? defaults.autoMaintain,
      announceToAgent: file?.announceToAgent ?? defaults.announceToAgent,
      autoCompress: file?.autoCompress ?? defaults.autoCompress,
      compressInterval: file?.compressInterval ?? defaults.compressInterval,
      sessions: file?.sessions ?? {},
      counts: file?.counts ?? {},
      workflow: file?.workflow ?? defaults.workflow,
    }
  }

  /**
   * Effective per-session automation: the global switch is a hard master;
   * the per-session override (default on) refines it per session.
   */
  const sessionActive = (sessionId: string | undefined): boolean => {
    const value = resolve()
    if (!value.enabled) return false
    if (sessionId === undefined) return value.enabled
    return value.sessions[sessionId]?.enabled ?? true
  }

  /**
   * Effective per-session compression: the global autoCompress is a hard gate;
   * the per-session compressEnabled override (default on) refines it.
   */
  const sessionCompressActive = (sessionId: string | undefined): boolean => {
    const value = resolve()
    if (!value.enabled || !value.autoCompress) return false
    if (sessionId === undefined) return true
    return value.sessions[sessionId]?.compressEnabled ?? true
  }

  /**
   * Effective per-session workflow automation: the workflow master switch is a
   * hard gate; the per-session override (default on) refines it per session.
   */
  const sessionWorkflowActive = (sessionId: string | undefined): boolean => {
    const value = resolve()
    if (!value.enabled || !value.workflow.enabled) return false
    if (sessionId === undefined) return true
    return value.sessions[sessionId]?.workflowEnabled ?? true
  }

  let disposeSkill: (() => void) | undefined
  let disposeSection: (() => void) | undefined
  let disposeWorkflowSkill: (() => void) | undefined
  let disposeWorkflowSection: (() => void) | undefined

  const sync = (): void => {
    if (disposeSkill !== undefined) { disposeSkill(); disposeSkill = undefined }
    if (disposeSection !== undefined) { disposeSection(); disposeSection = undefined }
    if (disposeWorkflowSkill !== undefined) { disposeWorkflowSkill(); disposeWorkflowSkill = undefined }
    if (disposeWorkflowSection !== undefined) { disposeWorkflowSection(); disposeWorkflowSection = undefined }
    const value = resolve()
    if (!value.enabled) return

    if (value.announceToAgent) {
      disposeSection = ctx.systemPrompt.section({
        name: 'plugin:dsh-project-memory',
        order: SECTION_ORDER,
        text: (context: AssembleContext) => {
          const live = resolve()
          const header = context.agent?.session?.header as { id?: string } | undefined
          const id = header?.id
          if (id !== undefined && live.sessions[id]?.enabled === false) return MEMORY_OFF_GUIDANCE
          return GUIDANCE
        },
      })
    }

    disposeSkill = ctx.skills.register({
      name: 'project-memory',
      description: SKILL_DESCRIPTION,
      whenToUse: SKILL_WHEN_TO_USE,
      content: loadSkillContent(),
      resourceBase: { kind: 'directory', path: resolveSkillDir() },
      source: 'plugin:dsh-project-memory',
    })

    if (!value.workflow.enabled) return

    if (value.workflow.boardInject) {
      disposeWorkflowSection = ctx.systemPrompt.section({
        name: 'plugin:dsh-agent-workflow',
        order: SECTION_ORDER + 1,
        text: (context: AssembleContext) => {
          const live = resolve()
          if (!live.enabled || !live.workflow.enabled) return ''
          const header = context.agent?.session?.header as { id?: string; cwd?: string } | undefined
          const id = header?.id
          if (id !== undefined && live.sessions[id]?.workflowEnabled === false) return WORKFLOW_OFF_GUIDANCE
          const cwd = header?.cwd
          const board = typeof cwd === 'string' && cwd !== '' ? readBoardSummary(cwd) : undefined
          return board === undefined ? WORKFLOW_GUIDANCE : WORKFLOW_GUIDANCE + '\n当前看板（未完成项）：\n' + board
        },
      })
    }

    disposeWorkflowSkill = ctx.skills.register({
      name: WORKFLOW_SKILL_NAME,
      description: WORKFLOW_SKILL_DESCRIPTION,
      whenToUse: WORKFLOW_SKILL_WHEN_TO_USE,
      content: loadWorkflowSkillContent(),
      resourceBase: { kind: 'directory', path: resolveWorkflowSkillDir() },
      source: 'plugin:dsh-agent-workflow',
    })
  }

  // Config routes are always mounted (the GUI needs them to re-enable the
  // plugin); every other surface is gated by the live config.
  ctx.effect(
    () => {
      const disposers = makeRoutes(store, sync).map(route => ctx.webServer.register(route))
      return () => { for (const dispose of disposers) dispose() }
    },
    'dsh-project-memory: routes',
  )

  // Session-start auto-init and turn-end auto-maintain are registered once
  // and gated live, so toggling the config never churns listeners.
  ctx.on('agent/session-start', (payload) => {
    try {
      const agent = payload?.agent
      if (!agent || isSubagentSession(agent)) return
      const header = agent.session?.header
      const cwd = header?.cwd
      if (typeof cwd !== 'string' || cwd === '') return
      const sessionId = header?.id
      const value = resolve()
      if (!value.enabled) return

      // Auto-init the human-readable memory templates (idempotent).
      if (value.autoInit && sessionActive(sessionId)) {
        const created = ensureMemoryInit(cwd, resolveTemplateDir())
        if (created.length > 0) {
          ctx.logger?.info?.('dsh-project-memory: initialized memory in ' + cwd + ': ' + created.join(', '))
        }
      }

      // Auto-scaffold the agent workflow (policy + board + _work/), idempotent.
      if (value.workflow.enabled && value.workflow.autoScaffold && sessionWorkflowActive(sessionId)) {
        const scaffolded = ensureWorkflowInit(cwd, resolveWorkflowTemplateDir())
        if (scaffolded.length > 0) {
          ctx.logger?.info?.(
            'dsh-agent-workflow: scaffolded workflow in ' + cwd + ': ' + scaffolded.length + ' files',
          )
        }
      }

      // Compression: count sessions per project; at the interval, compress.
      if (sessionCompressActive(sessionId)) {
        const next = (value.counts[cwd] ?? 0) + 1
        if (next >= value.compressInterval) {
          const results = runCompression(cwd)
          store.setCount(cwd, 0)
          ctx.logger?.info?.(
            'dsh-project-memory: compressed memory in ' + cwd +
            ': MEMORY.md=' + results.index + ', memory/=' + results.daily.compressed + ' files',
          )
        } else {
          store.setCount(cwd, next)
        }
      }
    } catch (error) {
      ctx.logger?.warn?.('dsh-project-memory: session-start init/compress failed: ' + String(error))
    }
  })

  const gate = new Map<string, Set<number>>()
  ctx.on('agent/turn-stopping', (payload) => {
    try {
      const value = resolve()
      if (!value.enabled || !value.autoMaintain) return
      const agent = payload?.agent
      if (!agent || isSubagentSession(agent)) return
      if (payload.signal?.aborted) return
      // `Session.events` was replaced by the explicit log accessors in the
      // 0.1.5 cohort: snapshotEvents() materializes the whole current log.
      const events = agent.session?.snapshotEvents() ?? []
      const turn = payload.turn ?? -1
      if (!turnActivity(events, turn).worked) return
      const sessionId = agent.session?.header?.id
      if (!sessionActive(sessionId)) return
      const agentId = agent.id ?? sessionId ?? 'unknown'
      let steered = gate.get(agentId)
      if (steered === undefined) {
        steered = new Set<number>()
        gate.set(agentId, steered)
      }
      if (steered.has(turn)) return
      steered.add(turn)
      for (const t of [...steered]) if (t < turn - 100) steered.delete(t)
      agent.steer?.(createUserMessage({
        content: [{ type: 'text', text: MAINTAIN_PROMPT }],
        source: { kind: 'plugin', plugin: 'dsh-project-memory' },
      }))
    } catch (error) {
      ctx.logger?.warn?.('dsh-project-memory: auto-maintain steer failed: ' + String(error))
    }
  })

  // Workflow self-check steer: only fires when the checks find a missing item,
  // in its own listener + try/catch so a workflow failure can never affect the
  // memory half.
  const workflowGate = new Map<string, Set<number>>()
  ctx.on('agent/turn-stopping', (payload) => {
    try {
      const value = resolve()
      if (!value.enabled || !value.workflow.enabled || !value.workflow.turnCheck) return
      const agent = payload?.agent
      if (!agent || isSubagentSession(agent)) return
      if (payload.signal?.aborted) return
      const events = agent.session?.snapshotEvents() ?? []
      const turn = payload.turn ?? -1
      if (!turnActivity(events, turn).worked) return
      const sessionId = agent.session?.header?.id
      if (!sessionWorkflowActive(sessionId)) return
      const cwd = agent.session?.header?.cwd
      if (typeof cwd !== 'string' || cwd === '') return
      const findings = checkWorkflow(cwd)
      if (findings.length === 0) return
      const agentId = agent.id ?? sessionId ?? 'unknown'
      let steered = workflowGate.get(agentId)
      if (steered === undefined) {
        steered = new Set<number>()
        workflowGate.set(agentId, steered)
      }
      if (steered.has(turn)) return
      steered.add(turn)
      for (const t of [...steered]) if (t < turn - 100) steered.delete(t)
      const text =
        WORKFLOW_CHECK_PROMPT_PREFIX + '\n' +
        findings.map(finding => '- ' + finding.detail).join('\n') + '\n' +
        '若已处理请忽略；未处理请补齐（证据进 _work/<任务>/evidence/、更新 STATUS.md、临时文件归位），' +
        '然后回复一句话说明处理结果。'
      agent.steer?.(createUserMessage({
        content: [{ type: 'text', text }],
        source: { kind: 'plugin', plugin: 'dsh-agent-workflow' },
      }))
    } catch (error) {
      ctx.logger?.warn?.('dsh-agent-workflow: workflow check steer failed: ' + String(error))
    }
  })

  // Initial registration from the composition entry.
  sync()

  ctx.effect(() => () => {
    if (disposeSkill !== undefined) disposeSkill()
    if (disposeSection !== undefined) disposeSection()
    if (disposeWorkflowSkill !== undefined) disposeWorkflowSkill()
    if (disposeWorkflowSection !== undefined) disposeWorkflowSection()
  }, 'dsh-project-memory: teardown')
}