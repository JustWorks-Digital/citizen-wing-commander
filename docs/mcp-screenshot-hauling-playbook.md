# Screenshot → hauling checklist playbook

For Cursor, ChatGPT, Gemini, or any MCP client connected to Citizen Wing Commander (`/mcp`).

Use this when the user pastes or uploads **Accepted** contract screenshots (or contract text) and wants the shared checklist / route updated.

## Goal

1. Extract every accepted hauling contract into **`hauling_contracts_intake`** JSON (`lib/missions/haulingIntake.ts`). Example batch: `lib/fixtures/hauling-intake/`.
2. Resolve names against fixtures (`search_locations`, `search_commodities`, `search_ships`).
3. **Merge** contracts into an **optimized stop order** (not one row per mission) as `SessionChecklistModel`.
4. Write with **`apply_hauling_contracts_intake`** (preferred: contracts + optimized `legs`) or `replace_hauling_checklist` / local `PUT /api/checklist`.
5. Confirm with `get_hauling_checklist`.

### Accepted intake JSON

```json
{
  "kind": "hauling_contracts_intake",
  "version": 1,
  "sessionName": "Hurston Covalex run",
  "ships": [],
  "contracts": [
    {
      "title": "Junior Rank - Direct Medium Cargo Haul",
      "contractor": "Covalex Independent Contractors",
      "rewardAuec": 56750,
      "from": ["HDPC-Cassillo"],
      "to": ["Everus Harbor"],
      "cargo": [{ "commodity": "Waste", "scu": 58 }],
      "maxContainerScu": 8
    }
  ]
}
```

Multi-pickup contracts use `from: [...]` plus optional `pickupSplits` when totals are shared across sites.

## Screenshot intake checklist

Open every Accepted contract detail pane (not just the sidebar list).

Per contract, capture:

| Field | Where in UI | Notes |
| --- | --- | --- |
| Rank / title | Header | e.g. Junior Rank – Direct Medium Cargo Haul |
| Reward | Header / list | Optional; for session naming only |
| Pickup location(s) | Details + objectives | Freight elevator sites |
| Delivery location(s) | Details + objectives | |
| Commodity + SCU | Primary objectives | Prefer exact labels: `Iron (Ore)`, `Quartz (Raw)` |
| Max container SCU | Details text | Optional context |
| Multi-stop | “any order” / multiple Collect lines | Split cargo across pickup rows when totals are shared |

**Coverage rule:** Sidebar count (e.g. Accepted 9/10) must match detail screenshots. If a contract was only scrolled past in the list, ask for that detail shot or skip it and say so.

Ignore unrelated screenshots (chat UIs, guides, etc.).

## Fixture resolution (required)

Never invent location / commodity / ship labels.

```
search_locations({ query })
search_commodities({ query })
search_ships({ query })   # only if ship is known from user/UI
```

Use returned **names** (or slugs) in `replace_hauling_checklist` / `set_session_ships`.

Common Hurston mappings:

| Contract text | Prefer |
| --- | --- |
| Everus Harbor above Hurston | Everus Harbor |
| Teasa Spaceport in Lorville | Lorville |
| HDPC-Cassillo / Farnesway | HDPC-Cassillo / HDPC-Farnesway |
| HDMS-Lathan / Bezdek on Arial | HDMS-Lathan / HDMS-Bezdek |
| Iron (Ore) / Quartz (Raw) | those exact fixture names |
| Stims, Tin, Silicon, Tungsten, Quartz | exact fixture names |

## Route optimization rules

Optimize **geography**, not contract order.

1. Cluster by body: moon outposts (Arial) → Hurston surface HDPCs → Everus (orbit) → remaining surface drops → city spaceport last when it only receives.
2. Visit a stop **once** when possible. If a site both supplies and receives different cargo at different times (need cargo from Everus first), allow a second visit.
3. At hubs (e.g. Everus), use `legKind: "both"` with per-line `role: "pickup" | "delivery"`.
4. Merge same-stop same-direction cargo from multiple contracts into one row’s `cargo[]`.
5. Multi-site pickups that share a total SCU (e.g. Lathan + Bezdek for 4 SCU iron): split totals across sites when exact per-site amounts are unknown; note the split in the session name or tool message.
6. `shipStorageLocation` (and per-cargo overrides on `both` stops): group by destination bay — e.g. city drops `front`, HDPC drops `middle`, moon/small `rear`.
7. `distanceToNext`: fill when known/reasonable; `null` on the final stop.

## `replace_hauling_checklist` shape

```json
{
  "sessionName": "Hurston Covalex run",
  "ships": ["C2 Hercules"],
  "legs": [
    {
      "legKind": "pickup",
      "location": "HDMS-Lathan",
      "shipStorageLocation": "rear",
      "cargo": [{ "commodity": "Iron (Ore)", "scu": 2 }],
      "distanceToNext": { "value": 200, "unit": "km" },
      "isCompleted": false
    },
    {
      "legKind": "both",
      "location": "Everus Harbor",
      "shipStorageLocation": "front",
      "cargo": [
        {
          "commodity": "Iron (Ore)",
          "scu": 85,
          "role": "delivery",
          "shipStorageLocation": "middle"
        },
        {
          "commodity": "Stims",
          "scu": 96,
          "role": "pickup",
          "shipStorageLocation": "front"
        }
      ],
      "distanceToNext": { "value": 12, "unit": "Mm" }
    }
  ]
}
```

Rules:

- `legs` currently requires **≥ 1** row (empty clear is via checklist API / future clear tool).
- On `legKind: "both"`, every cargo line needs `role`.
- Prefer different `shipStorageLocation` on pickup vs delivery lines so the table shows separate colored bay lines.
- After write: `get_hauling_checklist` and sanity-check stop order, SCU totals, and fixture names.

## Table / UI expectations

The web checklist is one row per **stop**, not per contract:

- Location badge + leg kind (pickup / delivery / both)
- Cargo lines with SCU (merged commodities)
- Ship storage zone(s)
- Distance to next
- Completion checkbox

Do not create parallel rows that only restate the same stop for a second contract—merge cargo into that stop.

## Iteration tips

- Keep a short extract table (contract → cargo → from → to) before routing.
- When the user sends a new zip/batch: re-extract all Accepted details, rebuild the full route, then `replace_hauling_checklist` (full replace, not patch).
- Call `get_hauling_intake_playbook` on the MCP server if available so remote clients load this same text.
