# Crossed haul — invalid route backup

Snapshot of live session `4b6fff2c-aa42-428c-ab43-3e8ec291ca41` (local, 2026-11-13).

## Why

Opposite-direction Covalex S4DC05 ↔ Shubin SM0-* contracts were merged so **stop 1 delivers cargo that is only picked up later**. Used for trip-cargo validation / repair tests and as a regression reference.

## Files

| File | Contents |
| --- | --- |
| `session.json` | Full `SessionChecklistModel` (24 missions, 14 stops) |
| `trip-cargo-issues.json` | `validateChecklistTripCargo` output at snapshot time (31 issues) |

## Load in tests

```ts
import { crossedHaulInvalidSession } from "@/lib/fixtures/sessions/crossedHaulInvalid";
```

## Restore live session (after Repair route)

```bash
npm run fixtures:restore-crossed-haul-invalid
```

PUTs `session.json` to local `/api/checklist` (override host with `APP_BASE_URL`).
