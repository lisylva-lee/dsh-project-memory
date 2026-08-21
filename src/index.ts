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
import { MEMORY_OFF_GUIDANCE } from './core/contract.ts'
import { ensureMemoryInit, loadSkillContent, resolveSkillDir, resolveTemplateDir } from './core/templates.ts'
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
}

function resolveDefaults(config: Record<string, unknown> | undefined): CompositionDefaults {
  return {
    enabled: typeof config?.enabled === 'boolean' ? config.enabled : true,
    autoInit: typeof config?.autoInit === 'boolean' ? config.autoInit : true,
    autoMaintain: typeof config?.autoMaintain === 'boolean' ? config.autoMaintain : true,
    announceToAgent: typeof config?.announceToAgent === 'boolean' ? config.announceToAgent : true,
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
      sessions: file?.sessions ?? {},
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

  let disposeSkill: (() => void) | undefined
  let disposeSection: (() => void) | undefined

  const sync = (): void => {
    if (disposeSkill !== undefined) { disposeSkill(); disposeSkill = undefined }
    if (disposeSection !== undefined) { disposeSection(); disposeSection = undefined }
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
      const value = resolve()
      if (!value.enabled || !value.autoInit) return
      const agent = payload?.agent
      if (!agent || isSubagentSession(agent)) return
      const header = agent.session?.header
      const cwd = header?.cwd
      if (typeof cwd !== 'string' || cwd === '') return
      if (!sessionActive(header?.id)) return
      const created = ensureMemoryInit(cwd, resolveTemplateDir())
      if (created.length > 0) {
        ctx.logger?.info?.('dsh-project-memory: initialized memory in ' + cwd + ': ' + created.join(', '))
      }
    } catch (error) {
      ctx.logger?.warn?.('dsh-project-memory: session-start init failed: ' + String(error))
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
      const events = agent.session?.events ?? []
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

  // Initial registration from the composition entry.
  sync()

  ctx.effect(() => () => {
    if (disposeSkill !== undefined) disposeSkill()
    if (disposeSection !== undefined) disposeSection()
  }, 'dsh-project-memory: teardown')
}
