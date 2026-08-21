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
