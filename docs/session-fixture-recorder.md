# Session fixtures + UI recorder

## Fixture packs

Curated live-session snapshots live under `tests/sessions/<slug>/`:

| File | Role |
| --- | --- |
| `meta.json` | Source session id, notes, asset allowlist |
| `session.json` | `SessionChecklist` |
| `expectations.json` | Locked domain asserts |
| `trace.json` | Optional UI action trace |
| `assets/` | Only screenshots needed for tests |
| `domain.test.ts` | Vitest for this pack |

Capture from production:

```bash
npm run session:capture-fixture -- <sessionId|tripUrl> [--slug=name] [--assets=referenced|none]
```

Load in tests: `loadSessionFixture(slug)` from `tests/sessions/loadSessionFixture.ts`.

Packs: `crossed-haul-invalid-2026-11-13`, `microtech-5-experienced-local-hauls-2026-11-16`.

## Playwright (product-surface folders)

```
e2e/session/             # name / trip open / recent-related
e2e/mission-checklist/   # stop progress, completion summary, reorder stops
e2e/contracts/           # contracts list + Source (UI only; MCP is Vitest)
e2e/cargo/               # cargo bays
```

```bash
npm run test:e2e
```

Import `test` / `expect` from `e2e/test.ts` (not `@playwright/test` directly). By default that fixture **fails the test** if the page emits `console.error` or an uncaught `pageerror`.

Toggle fail-on-console:

| Source | Example |
| --- | --- |
| `.env` / `.env.local` | `PLAYWRIGHT_FAIL_ON_CONSOLE=0` |
| Env on CLI | `PLAYWRIGHT_FAIL_ON_CONSOLE=0 npm run test:e2e` |
| Flag via npm script | `npm run test:e2e -- --no-fail-on-console` / `--fail-on-console` |

Use `npm run test:e2e` (not bare `npx playwright test`) so the custom flags are accepted. Flags set env and win over `.env`. Default is on.

Local default: starts `npm run dev`, seeds the fixture via `PUT /api/checklist`, opens `/sessions/<id>`.

Opt-in against production (read-only, **no seed**):

```bash
PLAYWRIGHT_BASE_URL=https://your-prod-host npm run test:e2e -- --grep-invert seed
```

Seed helpers refuse non-local hosts.

## Recorder (UI)

**Capability gate:** `SESSION_RECORDER_ENABLED=1` unlocks the host in production. In development the host is on unless set to `0`.

**User control:** floating panel — Record / Stop / Clear / Export. Listeners run only while recording. State persists in `sessionStorage` across client navigations. `?record=1` auto-starts when the gate allows it.

Export downloads `trace.json` (and copies to clipboard when permitted). Drop it into the pack, then convert to a Playwright spec (hand or AI) using locators from `testId` / role+name.

### Example conversion prompt

> Given this `trace.json`, write a Playwright test under `e2e/` that seeds `tests/sessions/<slug>/session.json` locally, then replays clicks/fills using `getByTestId` when `testId` is set, else `getByRole`. Assert the final URL and one visible landmark.
