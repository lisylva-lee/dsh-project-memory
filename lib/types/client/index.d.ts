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
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type ProjectMemoryKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** project-memory surface copy. */
        'dsh-project-memory': ProjectMemoryKey;
    }
    interface SlotMap {
        /**
         * One family plugin card inside the Web UI Plugins group. Spelled here
         * with the same shape so this package can register without depending on
         * the sibling web-ui-settings package.
         */
        'web-ui.plugin.item': {
            kind: 'list';
            scope: 'root';
            owner: SettingsPluginItemOwnerProps;
        };
    }
}
/** Owner share of a plugin card (the section supplies nothing). */
export interface SettingsPluginItemOwnerProps {
    /** Marker field: card owner props are intentionally empty. */
    children?: never;
}
/** Required services. */
export declare const inject: string[];
/** Apply the browser half. */
export declare function apply(ctx: ClientContext): void;
