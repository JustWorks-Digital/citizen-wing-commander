# Hurston Covalex — invalid trip plan (reference)

Canonical **invalid trip plan** fixture for manual testing, MCP soft `tripPlanValid` feedback, and Repair.

Source session: `053d7767-d209-41e5-bd37-5373e1284044`  
Trip: **Hurston Covalex — local+stellar** (start Port Tressler).

Stop 2 (HDPC-Farnesway) delivers iron / processed food (and related cargo) before those commodities are aboard; later HDMS stops also shortfall. UI shows **Invalid trip plan**; `validateChecklistTripCargo` → `ok: false` (11 issues).

## Files

| File | Contents |
| --- | --- |
| `meta.json` | Source id, notes |
| `session.json` | Full `SessionChecklist` |
| `expectations.json` | Locked domain asserts |
| `trip-cargo-issues.json` | Full `validateChecklistTripCargo` dump |
| `domain.test.ts` | Pack regression tests |

## Load

```ts
import { loadSessionFixture } from "@/tests/sessions/loadSessionFixture";
const pack = loadSessionFixture("hurston-covalex-invalid-2026-11-17");
```

Compat re-export: `@/lib/fixtures/sessions/invalidTripPlan`.

## Restore into local app

```bash
npm run fixtures:restore-invalid-trip
```

Opens as a new upsert of the fixture session id (or use the source trip if it still exists):

http://localhost:3000/sessions/053d7767-d209-41e5-bd37-5373e1284044
