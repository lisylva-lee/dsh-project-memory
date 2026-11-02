/**
 * Browser-half entry for dsh-project-memory — runs inside the dsh web GUI.
 *
 * Registers the locale dictionaries and two surfaces:
 *   - the plugin-config page in the Plugins settings section (settings.plugins.tab);
 *   - the per-session memory switch in the conversation dock
 *     (conversation.input.dock) — a row under every session.
 *
 * Failure policy: registration failures are logged, never thrown — an
 * external plugin must not take the GUI down.
 */
// The client context is the plain cordis Context; the former
// `@deepseek-ai/dsh-client-runtime/client` facade is gone in the 0.1.5+ cohort.
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: declares the `slots` service this half consumes (ctx.slots).
import type {} from './slots.ts'
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
     * One page inside the Plugins settings section: the section owner renders
     * localized entry labels as tabs and mounts each contribution inside its
     * tab panel. Spelled here with the same shape so this package can register
     * without depending on the sibling ui-settings-plugins package.
     */
    'settings.plugins.tab': { kind: 'list'; scope: 'root'; owner: SettingsTabOwnerProps }
  }
}

/** Owner share of a settings tab (the section supplies nothing). */
export interface SettingsTabOwnerProps {
  /** Marker field: tab owner props are intentionally empty. */
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

    // Plugin-config page: 设置 → 插件 → 「项目记忆 (project-memory)」.
    scope.slots.inject('settings.plugins.tab', () =>
      scope.slots.register({
        name: 'settings.plugins.tab',
        id: 'project-memory',
        order: 20,
        label: () => ctx.locale.bind(NS)('settings.title'),
        locale: NS,
      }, SettingsCard))
  })
}
