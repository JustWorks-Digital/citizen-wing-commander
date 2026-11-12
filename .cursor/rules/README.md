# Cursor rules index

Living project rules for Citizen Wing Commander. Add new `.mdc` / `.md` rule files here as conventions emerge; keep this index updated.

| Rule | Purpose |
| --- | --- |
| [`rsi-theme.mdc`](./rsi-theme.mdc) | RSI / Spectrum visual language & token usage |
| [`no-bloat-content.mdc`](./no-bloat-content.mdc) | No scaffold filler or Spectrum/RSI product copy in UI |
| [`third-party-sources.mdc`](./third-party-sources.mdc) | Accepted external SC data sources (see registry YAML) |
| [`mcp-server.mdc`](./mcp-server.mdc) | MCP `/mcp` tools for ChatGPT checklist updates; playbook `docs/mcp-screenshot-hauling-playbook.md` |
| [`storybook-gate.mdc`](./storybook-gate.mdc) | Storybook required before UI commits |
| [`database.mdc`](./database.mdc) | Postgres + Drizzle schema & migrations |
| [`ai-progress.mdc`](./ai-progress.mdc) | Gitignored AI progress MD scratch files |
| [`naming.mdc`](./naming.mdc) | TypeScript/React/DB/token naming conventions |
| [`field-namespaces.mdc`](./field-namespaces.mdc) | Prefix related DB/JSON fields (`scuTotal`, `scuSplits`, …) so they group together |
| [`optional-transfers.mdc`](./optional-transfers.mdc) | Optional sibling actions as `T \| false` (e.g. `ScuTransfer` pickup/delivery) — not null or zero stubs |
| [`helper-namespaces.mdc`](./helper-namespaces.mdc) | Group related helpers under a namespace object (`cargoInventory.transferLedgerByStop`) instead of long flat names |
| [`general.mdc`](./general.mdc) | Catch-all project conventions |
| [`api-endpoints.mdc`](./api-endpoints.mdc) | Named API domains — no hardcoded URL strings at call sites |
| [`concise-answers.mdc`](./concise-answers.mdc) | Short answers by default; no verbose Q&A |
| [`readable-code-and-tests.mdc`](./readable-code-and-tests.mdc) | Principle-based naming, exact asserts, no jargon — for any new domain, not just cargo |
| [`railway-proactive.mdc`](./railway-proactive.mdc) | After push: watch Railway deploy, then finish production/MCP follow-through |
| [`cargo-placement.mdc`](./cargo-placement.mdc) | Ship bay packer rules (`cargoGridPlacementRules.ts`) |

Also see:

- [`.cursor/third-party-sources.yaml`](../third-party-sources.yaml) — living registry of accepted data APIs
- `CONTRIBUTING.md` — human-oriented workflow (Storybook gate, hooks)
- Project store docs (outside repo): theme/Storybook, data model, naming conventions
