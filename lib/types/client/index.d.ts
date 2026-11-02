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
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type ProjectMemoryKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** project-memory surface copy. */
        'dsh-project-memory': ProjectMemoryKey;
    }
    interface SlotMap {
        /**
         * One page inside the Plugins settings section: the section owner renders
         * localized entry labels as tabs and mounts each contribution inside its
         * tab panel. Spelled here with the same shape so this package can register
         * without depending on the sibling ui-settings-plugins package.
         */
        'settings.plugins.tab': {
            kind: 'list';
            scope: 'root';
            owner: SettingsTabOwnerProps;
        };
    }
}
/** Owner share of a settings tab (the section supplies nothing). */
export interface SettingsTabOwnerProps {
    /** Marker field: tab owner props are intentionally empty. */
    children?: never;
}
/** Required services. */
export declare const inject: string[];
/** Apply the browser half. */
export declare function apply(ctx: ClientContext): void;
