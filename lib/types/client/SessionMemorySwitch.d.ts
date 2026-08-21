/**
 * Per-session memory switch, mounted in the official conversation.input.dock
 * band — a row under the conversation, above the composer. Task-board style:
 * collapsed to a compact disclosure row by default (label + state + chevron),
 * expanding reveals the hint and the switch. It reads the live config through
 * the host routes and writes the session override on toggle.
 */
import { type ReactElement } from 'react';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** Composed props: the dock's session/input owner share + this plugin's locale. */
export type SessionMemorySwitchProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'dsh-project-memory'>;
/** The dock row: collapsible disclosure with the session switch inside. */
export declare function SessionMemorySwitch(props: SessionMemorySwitchProps): ReactElement | null;
