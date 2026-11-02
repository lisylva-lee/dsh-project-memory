/**
 * The project-memory plugin-config card, rendered as one page of the Plugins
 * settings section (settings.plugins.tab). Uses the family-shared card chrome
 * (PluginSettingsCard) and the shared BooleanField control, exactly like the
 * task-board / desktop-launcher cards — no custom styling. Unlike those
 * cards, the values are read/written through the plugin's own config routes
 * (~/.dsh/dsh-project-memory.json) instead of a settings namespace, so the
 * card adapts the route state onto the shared chrome's CardShell contract.
 */
import { type ReactElement } from 'react';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** Composed props of the card: the group slot's runtime share + this plugin's locale. */
export type SettingsCardProps = PropsRuntime<'settings.plugins.tab'> & PropsLocale<'dsh-project-memory'>;
/** The plugin-config card (family chrome, expanded: it is a whole settings page). */
export declare function SettingsCard(props: SettingsCardProps): ReactElement | null;
