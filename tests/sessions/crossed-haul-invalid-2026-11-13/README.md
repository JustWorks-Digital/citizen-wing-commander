# Crossed haul — invalid route backup

Canonical **session fixture pack** for live session `4b6fff2c-aa42-428c-ab43-3e8ec291ca41` (2026-11-13).

Opposite-direction Covalex S4DC05 ↔ Shubin SM0-* contracts were merged so stop 1 delivers cargo that is only picked up later.

## Files

| File | Contents |
| --- | --- |
| `meta.json` | Source id, notes, asset allowlist |
| `session.json` | Full `SessionChecklist` |
| `expectations.json` | Locked domain asserts for Vitest |
| `trip-cargo-issues.json` | Full `validateChecklistTripCargo` dump (optional detail) |
| `domain.test.ts` | Pack regression tests |
| `assets/` | Curated screenshots (none for this pack) |

## Load

```ts
import { loadSessionFixture } from "@/tests/sessions/loadSessionFixture";
const pack = loadSessionFixture("crossed-haul-invalid-2026-11-13");
```

Compat re-export: `@/lib/fixtures/sessions/crossedHaulInvalid`.

## Restore into local app

```bash
npm run fixtures:restore-crossed-haul-invalid
```
