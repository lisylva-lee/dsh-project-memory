/**
 * Browser-half entry for dsh-project-memory — runs inside the dsh web GUI.
 *
 * Registers the locale dictionaries and two surfaces:
 *   - the plugin-config card in the Web UI Plugins group (web-ui.plugin.item);
 *   - the per-session memory switch in the conversation dock
 *     (conversation.input.dock) — a row under every session.
 *
 * Failure policy: registration failures are logged, never thrown — an
 * external plugin must not take the GUI down.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the ui-slots SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ui-conversation SlotMap merge (conversation.input.dock).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { NS, dictionaries, type ProjectMemoryKey } from './locales.ts'
import { SettingsCard } from './SettingsCard.tsx'
import { SessionMemorySwitch } from './SessionMemorySwitch.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** project-memory surface copy. */
    'dsh-project-memory': ProjectMemoryKey
  }

  interface SlotMap {
    /**
     * One family plugin card inside the Web UI Plugins group. Spelled here
     * with the same shape so this package can register without depending on
     * the sibling web-ui-settings package.
     */
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of a plugin card (the section supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

/** Required services. */
export const inject = ['slots', 'locale']

/** Apply the browser half. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, dictionaries), 'dsh-project-memory: dictionaries')

  ctx.inject(['slots'], (scope: ClientContext) => {
    // Per-session switch: a row under every conversation, above the composer.
    scope.slots.inject('conversation.input.dock', () =>
      scope.slots.register({
        name: 'conversation.input.dock',
        id: 'project-memory-session-switch',
        order: 100,
        locale: NS,
      }, SessionMemorySwitch))

    // Plugin-config card in 设置 → 插件配置.
    scope.slots.inject('web-ui.plugin.item', () =>
      scope.slots.register({
        name: 'web-ui.plugin.item',
        id: 'project-memory',
        order: 110,
        locale: NS,
      }, SettingsCard))
  })
}
