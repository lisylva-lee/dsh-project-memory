/**
 * Frozen browser platform modules for the DSH shell this plugin targets.
 *
 * Seeding, bundling externals and the client-bundle purity gate all consume
 * this list so their module identities cannot drift. It mirrors the shell's
 * frozen table (`staticModules` in `dsh-web-frontend`), verified against the
 * 0.2.0-rc.2 dist (unchanged since 0.1.5-rc.1):
 *   react, react/jsx-runtime, react-dom, react-dom/client, cordis,
 *   dsh-client-store, dsh-client-ui-slots, dsh-client-ui-primitives,
 *   dsh-client-ui-dockkit
 *
 * Everything else a client bundle imports must either inline (wire/type layers)
 * or be declared under `dsh.client.external` and answered by a dynamic package
 * row. `@deepseek-ai/dsh-client-runtime` is NOT part of this table: the store
 * engine it used to carry was rehomed into `dsh-client-store`.
 * @module dsh-project-memory/build/web-platform
 */

/** The module specifiers the shell shares into the frozen module table. */
export const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
] as const
