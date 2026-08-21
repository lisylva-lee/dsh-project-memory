/**
 * The /api/dsh-project-memory route family: GET/PUT the plugin config and
 * PUT one session override. Every route carries the same loopback-only trust
 * fence as the dsh-ssh / dsh-desktop-launcher routes — this endpoint writes
 * files on the host machine, so LAN-exposed dsh web deployments must not
 * serve it.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { MemoryStore } from './store.ts';
/** Whether a request arrived over a loopback socket. */
export declare function isLoopbackRequest(req: IncomingMessage): boolean;
/** Write one JSON response. */
export declare function writeJson(res: ServerResponse, status: number, body: unknown): void;
/** Read and JSON-parse a bounded request body; null on failure. */
export declare function readJsonBody(req: IncomingMessage): Promise<unknown>;
/**
 * Build the config route family.
 * @param store - the config store.
 * @param onChange - invoked after a successful write (re-syncs plugin surfaces).
 * @returns the routes.
 */
export declare function makeRoutes(store: MemoryStore, onChange: () => void): WebRoute[];
