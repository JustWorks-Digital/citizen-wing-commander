# Cursor rules index

Living project rules for Citizen Wing Commander. Add new `.mdc` / `.md` rule files here as conventions emerge; keep this index updated.

| Rule | Purpose |
| --- | --- |
| [`rsi-theme.mdc`](./rsi-theme.mdc) | RSI / Spectrum visual language & token usage |
| [`no-bloat-content.mdc`](./no-bloat-content.mdc) | No scaffold filler or Spectrum/RSI product copy in UI |
| [`third-party-sources.mdc`](./third-party-sources.mdc) | Accepted external SC data sources (see registry YAML) |
| [`mcp-server.mdc`](./mcp-server.mdc) | MCP `/mcp` tools for ChatGPT checklist updates |
| [`storybook-gate.mdc`](./storybook-gate.mdc) | Storybook required before UI commits |
| [`database.mdc`](./database.mdc) | Postgres + Drizzle schema & migrations |
| [`ai-progress.mdc`](./ai-progress.mdc) | Gitignored AI progress MD scratch files |
| [`naming.mdc`](./naming.mdc) | TypeScript/React/DB/token naming conventions |
| [`general.mdc`](./general.mdc) | Catch-all project conventions |
| [`api-endpoints.mdc`](./api-endpoints.mdc) | Named API domains — no hardcoded URL strings at call sites |
| [`concise-answers.mdc`](./concise-answers.mdc) | Short answers by default; no verbose Q&A |

Also see:

- [`.cursor/third-party-sources.yaml`](../third-party-sources.yaml) — living registry of accepted data APIs
- `CONTRIBUTING.md` — human-oriented workflow (Storybook gate, hooks)
- Project store docs (outside repo): theme/Storybook, data model, naming conventions
