/**
 * Standalone tsdown config for the project-memory plugin.
 *
 * Uses this repository's own client-bundle preset (`./build/tsdown.client.ts`) —
 * no monorepo import — which emits the node half from `src` (tsdown compiles TS
 * directly) and the browser half as a loader closure factory. Type declarations
 * ship from `lib/types` (tsc, see `tsconfig.build.json`).
 */
import { clientBundle } from './build/tsdown.client.ts'

export default clientBundle('@lisylva-lee/dsh-project-memory', ['src/index.ts'], {
  libExternal: ['@deepseek-ai/dsh-llm'],
})
