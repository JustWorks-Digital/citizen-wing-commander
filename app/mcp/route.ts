import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  toolAddMissionNote,
  toolApplyHaulingContractsIntake,
  toolClearHaulingScreenshots,
  toolCreateHaulingSession,
  toolBackfillCatalogMissionVariants,
  toolCreateMission,
  toolGetAiProfile,
  toolGetHaulingChecklist,
  toolGetHaulingIntakePlaybook,
  toolGetHaulingScreenshot,
  toolGetMission,
  toolCompileCargoBayPackProgram,
  toolGetSessionCargoGrid,
  toolGetShipBayPreferences,
  toolPlanStopOccupancyWithPackProgram,
  toolListHaulingScreenshots,
  toolListHaulingSessions,
  toolListMissions,
  toolListShipBayPreferences,
  toolRecordMissionRun,
  toolRenameCatalogScreenshots,
  toolReplaceHaulingChecklist,
  toolSearchCommodities,
  toolSearchContractors,
  toolInsertQuantumTravel,
  toolListLocationShops,
  toolSearchLocations,
  toolSearchShips,
  toolSetActiveHaulingSession,
  toolSetQuantumTravelReason,
  toolSetSessionStartLocation,
  toolSetLegCompleted,
  toolSetMissionScreenshots,
  toolSetSessionName,
  toolSetSessionShips,
  toolStoreHaulingScreenshot,
  toolUpdateShipBayPreferences,
} from "@/lib/mcp/tools";

const distanceUnitSchema = z.enum(["m", "km", "Mm", "Gm"]);

/** Prefer plain string over z.uuid() — Zod's uuid JSON Schema pattern is huge and bloats tools/list. */
const uuidString = z.string().min(1).describe("UUID string");

const sessionIdSchema = uuidString
  .optional()
  .describe(
    "Target hauling session UUID from list_hauling_sessions / UI tabs. Omit to use the active session.",
  );

const shipStorageSchema = z
  .enum(["front", "middle", "rear"])
  .describe("Cargo bay zone: front (bow), middle, or rear (aft).");

const cargoLineSchema = z.object({
  commodity: z
    .string()
    .describe("Commodity name, code, or fixture slug (e.g. Ice, AGRI, scrap)"),
  scu: z.number().int().nonnegative(),
  role: z
    .enum(["pickup", "delivery"])
    .optional()
    .describe(
      "Required on legKind both: whether this cargo line is picked up or delivered at the stop.",
    ),
  shipStorageLocation: shipStorageSchema
    .optional()
    .describe(
      "Bay zone for this cargo line. Required on legKind both when pickup and delivery use different zones; otherwise falls back to the leg shipStorageLocation.",
    ),
});

const legSchema = z.object({
  id: z.string().optional().describe("Stable row id; auto-generated if omitted"),
  legKind: z.enum(["pickup", "delivery", "both", "quantum"]),
  location: z
    .string()
    .describe("Star Citizen location name or fixture slug (e.g. Area18)"),
  quantumToLocation: z
    .string()
    .optional()
    .describe(
      "Required when legKind is quantum: destination location name or slug.",
    ),
  reasonShop: z
    .string()
    .optional()
    .describe(
      "Optional shop reason for quantum legs (name or slug, e.g. Platinum Bay, cargo-center). Prefer list_location_shops for the destination.",
    ),
  cargo: z.array(cargoLineSchema).optional().default([]),
  shipStorageLocation: shipStorageSchema
    .optional()
    .default("front")
    .describe(
      "Default cargo bay zone for the leg (used when cargo lines omit shipStorageLocation). Defaults to front for quantum legs.",
    ),
  distanceToNext: z
    .object({
      value: z.number(),
      unit: distanceUnitSchema,
    })
    .nullable()
    .optional(),
  isCompleted: z.boolean().optional().default(false),
});

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_hauling_sessions",
      {
        title: "List hauling sessions",
        description:
          "Use this to list open hauling session tabs and the active sessionId before targeting writes.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => toolListHaulingSessions(),
    );

    server.registerTool(
      "create_hauling_session",
      {
        title: "Create hauling session",
        description:
          "Use this to open a new empty hauling session tab (same as the UI + control). Returns the new sessionId for MCP targeting.",
        inputSchema: z.object({
          sessionName: z.string().optional(),
          activate: z
            .boolean()
            .optional()
            .describe("When true (default), make the new session active."),
        }),
        annotations: { destructiveHint: false },
      },
      async (input) => toolCreateHaulingSession(input),
    );

    server.registerTool(
      "set_active_hauling_session",
      {
        title: "Set active hauling session",
        description:
          "Use this to switch which session tab is active (UI focus + default MCP target when sessionId is omitted).",
        inputSchema: z.object({
          sessionId: uuidString,
        }),
        annotations: { idempotentHint: true },
      },
      async ({ sessionId }) => toolSetActiveHaulingSession(sessionId),
    );

    server.registerTool(
      "get_hauling_checklist",
      {
        title: "Get hauling checklist",
        description:
          "Use this when you need a Citizen Wing Commander hauling checklist session (legs, cargo, completion). Pass sessionId to target a tab; omit for the active session.",
        inputSchema: z.object({
          sessionId: sessionIdSchema,
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ sessionId }) => toolGetHaulingChecklist(sessionId),
    );

    server.registerTool(
      "get_ai_profile",
      {
        title: "Get AI profile",
        description:
          "Use this early in a conversation (or whenever you lose product context). Returns the standing Citizen Wing Commander AI brief: what Star Citizen is, why the UI is hard, how to help the player generally (not only hauling), tone, and how to use sessions/catalog/bay tools. Specialized jobs still need their own playbooks (e.g. get_hauling_intake_playbook).",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => toolGetAiProfile(),
    );

    server.registerTool(
      "get_hauling_intake_playbook",
      {
        title: "Get hauling intake playbook",
        description:
          "Use this first when ingesting mission screenshots or contract text. Returns the screenshot→route playbook, including the rule that user-attached images must be stored and linked (screenshots[] / latestScreenshotPath); omit only for text-only intake.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => toolGetHaulingIntakePlaybook(),
    );

    server.registerTool(
      "store_hauling_screenshot",
      {
        title: "Store hauling screenshot",
        description:
          "Use this whenever the user attaches a MobiGlas / contract screenshot. Prefer fileUrl (http/https the MCP server can download) or filePath when the host can read it — ChatGPT /mnt/data paths are NOT reachable by a remote MCP server. Keep imageBase64 as fallback when you can encode bytes. Saves into .data/mcp-screenshots and returns logicalPath. Pass sessionId (batch folder = session UUID). When missionId is set, stores and auto-attaches logicalPath onto that session mission (append by default). Otherwise use the returned path in contracts[].screenshots / set_mission_screenshots / create_mission latestScreenshotPath.",
        inputSchema: z
          .object({
            fileUrl: z
              .string()
              .optional()
              .describe(
                "Preferred for ChatGPT: publicly reachable http(s) image URL. Server downloads, validates, and stores it. Do not pass /mnt/data paths here.",
              ),
            filePath: z
              .string()
              .optional()
              .describe(
                "Local path readable by the MCP host, or an http(s) URL. ChatGPT sandbox paths like /mnt/data/... are rejected — use fileUrl instead.",
              ),
            imageBase64: z
              .string()
              .optional()
              .describe(
                "Fallback: raw base64 bytes or data:image/...;base64,... URL when fileUrl/filePath are unavailable.",
              ),
            filename: z
              .string()
              .optional()
              .describe("Optional filename (e.g. 01-stims-everus-lorville.png)"),
            sessionId: sessionIdSchema.describe(
              "Session UUID — used as screenshot batchId and as the attach target when missionId is set.",
            ),
            batchId: z
              .string()
              .optional()
              .describe(
                "Screenshot batch folder. Prefer sessionId. Defaults to sessionId or default.",
              ),
            missionId: z
              .string()
              .optional()
              .describe(
                "When set, auto-attach the stored logicalPath onto this session mission (after store).",
              ),
            attachMode: z
              .enum(["append", "replace"])
              .optional()
              .describe(
                "With missionId: append (default) or replace mission.screenshots.",
              ),
            contractId: z
              .string()
              .optional()
              .describe(
                "Optional contract id to associate (e.g. contract-01-stims)",
              ),
          }),
        annotations: { destructiveHint: false },
      },
      async (input) => toolStoreHaulingScreenshot(input),
    );

    server.registerTool(
      "list_hauling_screenshots",
      {
        title: "List hauling screenshots",
        description:
          "Use this to list screenshots in the MCP/UI screenshot store for a batch. App uploads use the session UUID as batchId.",
        inputSchema: z.object({
          batchId: z
            .string()
            .optional()
            .describe("Batch folder id — use sessionId for UI-uploaded shots"),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ batchId }) => toolListHaulingScreenshots(batchId),
    );

    server.registerTool(
      "get_hauling_screenshot",
      {
        title: "Get hauling screenshot",
        description:
          "Use this to retrieve a screenshot (base64 + data URL) that was uploaded via the web UI or store_hauling_screenshot. Pass logicalPath from list_hauling_screenshots, or batchId + filename.",
        inputSchema: z.object({
          logicalPath: z
            .string()
            .optional()
            .describe("Logical path like <batchId>/<filename>"),
          batchId: z.string().optional(),
          filename: z.string().optional(),
        }),
        annotations: { readOnlyHint: true },
      },
      async (input) => toolGetHaulingScreenshot(input),
    );

    server.registerTool(
      "clear_hauling_screenshots",
      {
        title: "Clear hauling screenshots",
        description:
          "Use this to delete screenshots for a batch from .data/mcp-screenshots.",
        inputSchema: z.object({
          batchId: z.string().optional(),
        }),
        annotations: { destructiveHint: true },
      },
      async ({ batchId }) => toolClearHaulingScreenshots(batchId),
    );

    server.registerTool(
      "set_mission_screenshots",
      {
        title: "Set mission screenshots",
        description:
          "Use this to attach or replace screenshot logical paths on an existing session mission without rewriting the route/checklist. Preferred recovery when apply_hauling_contracts_intake returned screenshotsMissing: true. Call store_hauling_screenshot first (batchId = sessionId), then pass the returned logicalPath(s) here.",
        inputSchema: z.object({
          missionId: z
            .string()
            .min(1)
            .describe("Session mission id from get_hauling_checklist (e.g. contract-1)"),
          screenshots: z
            .array(z.string())
            .describe(
              "Logical paths from store_hauling_screenshot (`<sessionId>/<filename>`). Pass [] to clear.",
            ),
          sessionId: sessionIdSchema,
        }),
        annotations: { idempotentHint: true },
      },
      async (input) => toolSetMissionScreenshots(input),
    );

    server.registerTool(
      "set_session_name",
      {
        title: "Set session name",
        description:
          "Use this when renaming a hauling session tab. Pass sessionId to target a tab; omit for the active session.",
        inputSchema: z.object({
          sessionName: z.string().min(1),
          sessionId: sessionIdSchema,
        }),
        annotations: { idempotentHint: true },
      },
      async ({ sessionName, sessionId }) =>
        toolSetSessionName(sessionName, sessionId),
    );

    server.registerTool(
      "set_session_start_location",
      {
        title: "Set session start location",
        description:
          "Use this when the user or chat sets where the crew begins the hauling run (route origin). Prefer search_locations first when the name is ambiguous. Pass an empty location string to clear. Pass sessionId to target a tab.",
        inputSchema: z.object({
          location: z
            .string()
            .describe(
              "Location name or fixture slug (e.g. Everus Harbor). Empty string clears the start point.",
            ),
          sessionId: sessionIdSchema,
        }),
        annotations: { idempotentHint: true },
      },
      async ({ location, sessionId }) =>
        toolSetSessionStartLocation(
          location.trim() ? location : null,
          sessionId,
        ),
    );

    server.registerTool(
      "replace_hauling_checklist",
      {
        title: "Replace hauling checklist",
        description:
          "Use this after reading mission screenshots or contract text to fully replace a session checklist with structured legs. Prefer search_locations / search_commodities first when names are ambiguous. Pass sessionId to target a tab; omit for the active session.",
        inputSchema: z.object({
          sessionId: sessionIdSchema,
          sessionName: z.string().optional(),
          ships: z
            .array(z.string())
            .optional()
            .describe(
              "Optional ship names/slugs for the crew (e.g. C2 Hercules, Freelancer MAX).",
            ),
          legs: z.array(legSchema).min(1),
          resetTimer: z
            .boolean()
            .optional()
            .describe("When true, restart session startedAt / clear completedAt."),
        }),
        annotations: { destructiveHint: true },
      },
      async (input) => toolReplaceHaulingChecklist(input),
    );

    const intakeCargoSchema = z.object({
      commodity: z.string(),
      scu: z.number().int().nonnegative(),
    });

    const intakeContractSchema = z.object({
      id: z
        .string()
        .optional()
        .describe("Stable contract/mission id (e.g. contract-1). Prefer setting this."),
      title: z.string(),
      contractor: z.string().optional(),
      rewardAuec: z.number().nonnegative().optional(),
      from: z.array(z.string()).min(1),
      to: z.array(z.string()).min(1),
      cargo: z.array(intakeCargoSchema).min(1),
      maxContainerScu: z.number().int().positive().optional(),
      pickupSplits: z.record(z.string(), z.array(intakeCargoSchema)).optional(),
      screenshots: z
        .array(z.string())
        .optional()
        .describe(
          "Logical paths from store_hauling_screenshot (`<batchId>/<filename>`). Strongly expected whenever the user attached images; omit only for text-only intake. Missing paths still apply but return screenshotsMissing — then use set_mission_screenshots.",
        ),
      transcript: z
        .string()
        .optional()
        .describe("Optional path to mobiglas transcript JSON relative to the batch."),
    });

    server.registerTool(
      "apply_hauling_contracts_intake",
      {
        title: "Apply hauling contracts intake",
        description:
          "Use this to apply accepted hauling_contracts_intake JSON. When the user attached images, each contract MUST include screenshots[] logical paths from store_hauling_screenshot (omit screenshots only for text-only intake). Optionally pass optimized legs (same shape as replace_hauling_checklist). Without legs, the server auto-merges contracts into stops. Still succeeds if screenshots are missing, but returns screenshotsMissing: true — then call set_mission_screenshots. Resets the session timer by default.",
        inputSchema: z.object({
          kind: z.literal("hauling_contracts_intake").optional(),
          version: z.literal(1).optional(),
          sessionId: sessionIdSchema,
          sessionName: z.string().min(1),
          ships: z.array(z.string()).optional(),
          startLocation: z
            .string()
            .nullable()
            .optional()
            .describe(
              "Optional route origin (location name/slug). Prefer search_locations first.",
            ),
          contracts: z.array(intakeContractSchema).min(1),
          notes: z.string().optional(),
          legs: z
            .array(legSchema)
            .min(1)
            .optional()
            .describe(
              "Optional pre-optimized route. Prefer this when you already merged stops geographically.",
            ),
          resetTimer: z.boolean().optional().default(true),
        }),
        annotations: { destructiveHint: true },
      },
      async (input) =>
        toolApplyHaulingContractsIntake({
          kind: "hauling_contracts_intake",
          version: 1,
          sessionId: input.sessionId,
          sessionName: input.sessionName,
          ships: input.ships,
          startLocation: input.startLocation,
          contracts: input.contracts,
          notes: input.notes,
          legs: input.legs,
          resetTimer: input.resetTimer,
        }),
    );

    server.registerTool(
      "set_session_ships",
      {
        title: "Set session ships",
        description:
          "Use this when the user or crew tells you which ship(s) they are flying for a hauling session. Prefer search_ships first when the name is ambiguous. Pass sessionId to target a tab.",
        inputSchema: z.object({
          ships: z
            .array(z.string())
            .min(1)
            .describe("One or more ship names or fixture slugs"),
          sessionId: sessionIdSchema,
        }),
        annotations: { idempotentHint: true },
      },
      async ({ ships, sessionId }) => toolSetSessionShips(ships, sessionId),
    );

    server.registerTool(
      "set_leg_completed",
      {
        title: "Set leg completed",
        description:
          "Use this to mark a checklist leg done or not done by row id from get_hauling_checklist. Pass sessionId when targeting a non-active tab.",
        inputSchema: z.object({
          rowId: z.string(),
          isCompleted: z.boolean(),
          sessionId: sessionIdSchema,
        }),
        annotations: { idempotentHint: true },
      },
      async (input) => toolSetLegCompleted(input),
    );

    server.registerTool(
      "search_locations",
      {
        title: "Search locations",
        description:
          "Use this to resolve Star Citizen starmap location names to fixture slugs before writing checklist legs.",
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().int().min(1).max(25).optional().default(10),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ query, limit }) => toolSearchLocations(query, limit),
    );

    server.registerTool(
      "list_location_shops",
      {
        title: "List location shops",
        description:
          "Use this before setting a quantum-travel Reason. Returns shops/facilities at a station (Platinum Bay, Cargo Center, Casaba Outlet, …) from UEX terminal fixtures.",
        inputSchema: z.object({
          location: z
            .string()
            .min(1)
            .describe("Location name or slug (destination station)"),
          query: z
            .string()
            .optional()
            .describe("Optional filter (e.g. Platinum, Cargo)"),
          limit: z.number().int().min(1).max(100).optional().default(40),
        }),
        annotations: { readOnlyHint: true },
      },
      async (input) => toolListLocationShops(input),
    );

    server.registerTool(
      "insert_quantum_travel",
      {
        title: "Insert quantum travel",
        description:
          "Use this to add a quantum travel row (from → to + shop Reason) after a checklist stop, or after session start. Prefer list_location_shops for reasonShop. Pass afterRowId=route-start to insert at the front.",
        inputSchema: z.object({
          to: z.string().min(1).describe("Destination location name or slug"),
          reasonShop: z
            .string()
            .min(1)
            .describe("Shop reason name or slug (e.g. Platinum Bay)"),
          from: z
            .string()
            .optional()
            .describe(
              "Optional origin location; defaults from afterRowId presence / session start",
            ),
          afterRowId: z
            .string()
            .optional()
            .describe(
              "Insert after this row id. Use route-start (default) to insert before the first stop.",
            ),
          sessionId: sessionIdSchema,
        }),
        annotations: { destructiveHint: false },
      },
      async (input) => toolInsertQuantumTravel(input),
    );

    server.registerTool(
      "set_quantum_travel_reason",
      {
        title: "Set quantum travel reason",
        description:
          "Use this to set or clear the shop Reason on an existing quantum travel row (rowId from get_hauling_checklist). Pass reasonShop empty/null to clear.",
        inputSchema: z.object({
          rowId: z.string().min(1),
          reasonShop: z
            .string()
            .nullable()
            .describe("Shop name/slug, or null/empty to clear"),
          sessionId: sessionIdSchema,
        }),
        annotations: { idempotentHint: true },
      },
      async (input) => toolSetQuantumTravelReason(input),
    );

    server.registerTool(
      "search_commodities",
      {
        title: "Search commodities",
        description:
          "Use this to resolve cargo type names to fixture slugs before writing checklist legs.",
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().int().min(1).max(25).optional().default(10),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ query, limit }) => toolSearchCommodities(query, limit),
    );

    server.registerTool(
      "search_ships",
      {
        title: "Search ships",
        description:
          "Use this to resolve Star Citizen ship names to fixture slugs and cargo SCU before set_session_ships.",
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().int().min(1).max(25).optional().default(10),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ query, limit }) => toolSearchShips(query, limit),
    );

    server.registerTool(
      "search_contractors",
      {
        title: "Search contractors",
        description:
          "Use this to resolve mission contractor / org names (MobiGlas “Contracted by”) to fixture/DB slugs before create_mission.",
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().int().min(1).max(25).optional().default(10),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ query, limit }) => toolSearchContractors(query, limit),
    );

    server.registerTool(
      "get_session_cargo_grid",
      {
        title: "Get session cargo grid",
        description:
          "Use this before planning bay packing. Returns bay width/length/height in 1-SCU cells, zone layout (front/middle/rear), coordinate axes, placement-rule summaries, and per-ship bay organization preferences (DB overrides committed file). Defaults to the session’s ships; pass ship to look up one sketch by name/slug. Do not invent grid sizes.",
        inputSchema: z.object({
          sessionId: sessionIdSchema,
          ship: z
            .string()
            .optional()
            .describe(
              "Optional ship name or slug (e.g. C2 Hercules). When set, returns that sketch instead of session ships.",
            ),
        }),
        annotations: { readOnlyHint: true },
      },
      async (input) => toolGetSessionCargoGrid(input),
    );

    server.registerTool(
      "compile_cargo_bay_pack_program",
      {
        title: "Compile cargo bay pack program",
        description:
          "Use this to get the JSON pack-program DSL for a Sorting preset (suggested / by-cargo-type / by-mission-location). The program is explicit group/order/stack/require/reserve/bias-xy primitives with priorities — not opaque mode names. Pass the result (or a custom equivalent) to plan_stop_occupancy_with_pack_program.",
        inputSchema: z.object({
          sessionId: sessionIdSchema,
          ship: z
            .string()
            .optional()
            .describe("Optional ship name/slug when not using the session ship."),
          mode: z
            .enum(["suggested", "by-cargo-type", "by-mission-location"])
            .optional()
            .default("by-cargo-type"),
          missionPrioritized: z
            .boolean()
            .optional()
            .default(false)
            .describe("Cargo type only: bias by upcoming delivery rank (ship must support bias)."),
        }),
        annotations: { readOnlyHint: true },
      },
      async (input) => toolCompileCargoBayPackProgram(input),
    );

    server.registerTool(
      "plan_stop_occupancy_with_pack_program",
      {
        title: "Plan stop occupancy with pack program",
        description:
          "Use this to pack the focused (or given) checklist stop using a pack-program DSL document. Omit program to compile from mode. Returns placed boxes/cells for comparison with the UI bay grid.",
        inputSchema: z.object({
          sessionId: sessionIdSchema,
          rowId: z
            .string()
            .optional()
            .describe("Checklist row id; omit for next incomplete stop."),
          mode: z
            .enum(["suggested", "by-cargo-type", "by-mission-location"])
            .optional()
            .default("by-cargo-type"),
          missionPrioritized: z.boolean().optional().default(false),
          program: z
            .record(z.string(), z.unknown())
            .optional()
            .describe(
              "Full CargoBayPackProgram JSON (version, bays, pack). When set, overrides mode compilation.",
            ),
        }),
        annotations: { readOnlyHint: true },
      },
      async (input) =>
        toolPlanStopOccupancyWithPackProgram({
          ...input,
          program: input.program as
            | import("@/lib/ships/cargoBayPackProgram").CargoBayPackProgram
            | undefined,
        }),
    );

    server.registerTool(
      "list_ship_bay_preferences",
      {
        title: "List ship bay preferences",
        description:
          "Use this to see per-ship cargo bay organization preferences. Database rows override the committed file fixture for the same ship.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => toolListShipBayPreferences(),
    );

    server.registerTool(
      "get_ship_bay_preferences",
      {
        title: "Get ship bay preferences",
        description:
          "Use this before packing a specific hull. Returns bay organization preferences for one ship (database wins over file defaults).",
        inputSchema: z.object({
          ship: z
            .string()
            .describe("Ship name or slug (e.g. C2 Hercules, c2-hercules-starlifter)"),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ ship }) => toolGetShipBayPreferences(ship),
    );

    server.registerTool(
      "update_ship_bay_preferences",
      {
        title: "Update ship bay preferences",
        description:
          "Use this when you learn a better way to organize a ship's bay. Writes to the database only (committed file fixture is unchanged and may differ). Prefer appendNotes/appendGuidelines to accumulate knowledge over time.",
        inputSchema: z.object({
          ship: z.string().describe("Ship name or slug"),
          notes: z
            .string()
            .optional()
            .describe("Freeform packing guidance for this hull"),
          appendNotes: z
            .boolean()
            .optional()
            .describe(
              "When true with notes, append to existing notes instead of replacing",
            ),
          preferredZoneOrder: z
            .array(z.enum(["front", "middle", "rear"]))
            .optional()
            .describe("Preferred bay zone order for organizing cargo"),
          preferredRuleIds: z
            .array(
              z.enum([
                "prefer-flat-layers",
                "prefer-flat-stable-support",
                "prefer-back-when-full-height",
              ]),
            )
            .optional(),
          commodityZoneHints: z
            .record(z.string(), z.enum(["front", "middle", "rear"]))
            .optional()
            .describe("Map commodity slug → preferred bay zone"),
          guidelines: z
            .array(z.string())
            .optional()
            .describe("Replace the guidelines list"),
          appendGuidelines: z
            .array(z.string())
            .optional()
            .describe("Append guideline bullets without clearing existing ones"),
        }),
      },
      async (input) => toolUpdateShipBayPreferences(input),
    );

    server.registerTool(
      "create_mission",
      {
        title: "Create mission",
        description:
          "Use this to create or update a catalog mission (not the live checklist). Pass type (default hauling). For hauling prefer scuSplits[] (per-stop commodity+SCU); optional objectives[] as screenshot-style text bullets (derived from scuSplits when omitted). from/to/cargo can be omitted and derived. Optional contractor (prefer search_contractors), offerLocation, offerStarSystem (Stanton/Pyro/Nyx — no default), latestScreenshotPath from store_hauling_screenshot (strongly expected when the user attached an image; omit only for text-only), scuMaxContainerSize, category, variantOf. Same SCU upserts by fingerprint (aUEC-only diffs update the same row). Different SCU creates a linked variant (auto family match or variantOf). Missing latestScreenshotPath still saves but returns screenshotsMissing: true — fix with store_hauling_screenshot then re-create_mission.",
        inputSchema: z.object({
          type: z
            .enum(["hauling"])
            .optional()
            .default("hauling")
            .describe("Mission kind. Currently only hauling is implemented."),
          title: z.string().min(1),
          rank: z
            .enum([
              "Trainee",
              "Rookie",
              "Junior",
              "Member",
              "Experienced",
              "Senior",
              "Master",
            ])
            .optional()
            .describe(
              "Hauling career rank (no “Rank” suffix). Extracted from title when omitted.",
            ),
          contractor: z
            .string()
            .optional()
            .describe(
              "Contractor name or slug (MobiGlas Contracted by). Prefer search_contractors first.",
            ),
          rewards: z
            .array(
              z.discriminatedUnion("kind", [
                z.object({
                  kind: z.literal("auec"),
                  amount: z.number().nonnegative(),
                }),
                z.object({
                  kind: z.literal("blueprint"),
                  name: z.string().min(1),
                  slug: z.string().optional().nullable(),
                }),
              ]),
            )
            .optional()
            .describe(
              "Payout lines (auec and/or blueprint). Prefer this over rewardAuec.",
            ),
          rewardAuec: z
            .number()
            .nonnegative()
            .optional()
            .describe("Deprecated: use rewards [{ kind: auec, amount }]"),
          offerLocation: z
            .string()
            .optional()
            .describe(
              "Where the mission was offered / screenshot taken (availability context).",
            ),
          offerStarSystem: z
            .string()
            .optional()
            .describe(
              "Star system where the offer was seen (Stanton / Pyro / Nyx). No default — set explicitly.",
            ),
          from: z
            .array(z.string())
            .optional()
            .describe("Hauling: pickup locations"),
          to: z
            .array(z.string())
            .optional()
            .describe("Hauling: delivery locations"),
          cargo: z
            .array(
              z.object({
                commodity: z.string(),
                scu: z.number().int().nonnegative(),
              }),
            )
            .optional()
            .describe("Hauling: aggregated cargo lines (derived from scuSplits when omitted)"),
          scuSplits: z
            .array(
              z.object({
                kind: z.enum(["deliver", "collect"]).optional().default("deliver"),
                from: z.string().describe("Pickup location for this split"),
                to: z.string().describe("Delivery location for this split"),
                commodity: z.string(),
                scu: z.number().int().nonnegative(),
              }),
            )
            .optional()
            .describe(
              "Hauling: structured per-stop SCU amounts (sibling of scuTotal). Prefer for multi-stop contracts.",
            ),
          scuLocationSplits: z
            .object({
              from: z.record(z.string(), z.number().int().nonnegative()),
              to: z.record(z.string(), z.number().int().nonnegative()),
            })
            .optional()
            .describe(
              "Hauling: SCU totals per location slug — { from: {slug:scu}, to: {slug:scu} }. Derived from scuSplits when omitted.",
            ),
          objectives: z
            .array(z.string())
            .optional()
            .describe(
              "Hauling: screenshot-style Primary Objectives bullets (plain text). Derived from scuSplits when omitted.",
            ),
          category: z
            .enum([
              "Hauling - Local",
              "Hauling - Planetary",
              "Hauling - Stellar",
              "Hauling - Interstellar",
              "Local",
              "Planetary",
              "Stellar",
              "Interstellar",
            ])
            .optional()
            .describe(
              "MobiGlas Category (Local / Planetary / Stellar / Interstellar).",
            ),
          scuMaxContainerSize: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Largest allowed crate size in SCU"),
          variantOf: uuidString
            .optional()
            .describe(
              "Catalog mission id to join as an SCU variant (same contract, different totals/screenshots).",
            ),
          latestScreenshotPath: z
            .string()
            .optional()
            .describe(
              "Logical path from store_hauling_screenshot / UI upload. Strongly expected when the user attached an image; omit only for text-only. Missing path returns screenshotsMissing — re-call create_mission after store_hauling_screenshot.",
            ),
          extras: z.record(z.string(), z.unknown()).optional(),
        }),
        annotations: { destructiveHint: false },
      },
      async (input) => toolCreateMission(input),
    );

    server.registerTool(
      "backfill_catalog_mission_variants",
      {
        title: "Backfill catalog mission variants",
        description:
          "Use this after deploying variant groups to recompute family keys and merge existing SCU-variant catalog rows that share title/rank/contractor/offer/route/commodities.",
        inputSchema: z.object({}),
        annotations: { destructiveHint: false },
      },
      async () => toolBackfillCatalogMissionVariants(),
    );

    server.registerTool(
      "list_missions",
      {
        title: "List missions",
        description:
          "Use this to browse catalog missions. Optionally filter by offerLocation.",
        inputSchema: z.object({
          offerLocation: z.string().optional(),
          type: z.enum(["hauling"]).optional(),
          limit: z.number().int().min(1).max(200).optional().default(50),
        }),
        annotations: { readOnlyHint: true },
      },
      async (input) => toolListMissions(input),
    );

    server.registerTool(
      "rename_catalog_screenshots",
      {
        title: "Rename catalog screenshots",
        description:
          "Use this to rename catalog mission source screenshots on disk to the descriptive contract filename convention (title/SCU/reward/id/route/cargo), and update latestScreenshotPath. Shared files are copied. Pass dryRun to preview.",
        inputSchema: z.object({
          dryRun: z.boolean().optional().default(false),
          limit: z.number().int().min(1).max(500).optional().default(500),
          cleanupDuplicates: z
            .boolean()
            .optional()
            .default(true)
            .describe(
              "Delete fingerprint-upsert duplicate rows whose screenshot filename embeds a different mission id",
            ),
        }),
        annotations: { destructiveHint: true },
      },
      async (input) => toolRenameCatalogScreenshots(input),
    );

    server.registerTool(
      "get_mission",
      {
        title: "Get mission",
        description:
          "Use this to fetch one catalog mission plus its player notes.",
        inputSchema: z.object({
          missionId: uuidString,
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ missionId }) => toolGetMission(missionId),
    );

    server.registerTool(
      "add_mission_note",
      {
        title: "Add mission note",
        description:
          "Use this to store a player note (good/bad/neutral) about a catalog mission for future planning.",
        inputSchema: z.object({
          missionId: uuidString,
          body: z.string().min(1),
          sentiment: z.enum(["good", "bad", "neutral"]).optional(),
        }),
        annotations: { destructiveHint: false },
      },
      async (input) => toolAddMissionNote(input),
    );

    server.registerTool(
      "record_mission_run",
      {
        title: "Record mission run",
        description:
          "Use this after a completed run to update total/average mission time for a catalog mission.",
        inputSchema: z.object({
          missionId: uuidString,
          durationMs: z.number().int().nonnegative(),
          offerLocation: z.string().optional(),
          deliverySessionId: uuidString.optional(),
        }),
        annotations: { destructiveHint: false },
      },
      async (input) => toolRecordMissionRun(input),
    );
  },
  {
    serverInfo: {
      name: "citizen-wing-commander",
      // Bump when tool schemas change so MCP clients invalidate cached tools/list.
      version: "0.2.5",
    },
    instructions: [
      "Citizen Wing Commander is a Star Citizen companion (hauling sessions, catalog, cargo bay) — call get_ai_profile early for tone, product purpose, and how to help the player (general game help + tools; not hauling-only).",
      "Before ingesting screenshots or contract text, call get_hauling_intake_playbook and follow it.",
      "Quantum travel: list_location_shops for destination shop Reasons (Platinum Bay, Cargo Center, …); insert_quantum_travel or set_quantum_travel_reason to write reasonShop on quantum legs.",
      "Screenshot rule: if the user attached images, you MUST call store_hauling_screenshot. Prefer fileUrl (http/https the MCP server can download) or filePath when the host can read it; imageBase64 remains a fallback. ChatGPT /mnt/data paths are not reachable by remote MCP — do not pass them. Pass sessionId (= batch). Optional missionId stores+attaches in one call. Otherwise put returned logicalPath on contracts[].screenshots / create_mission latestScreenshotPath / set_mission_screenshots. Omit screenshots only for text-only intake. Never invent paths. Do not put screenshot binaries in git.",
      "Extract every Accepted contract into hauling_contracts_intake JSON (contracts with from/to/cargo and screenshots[] when images existed).",
      "Call list_hauling_sessions to see open tabs and activeSessionId. Pass sessionId on write tools to target a specific tab; omit to use the active session.",
      "Prefer building an optimized legs[] route, then call apply_hauling_contracts_intake with contracts + legs (and startLocation / sessionId when known). If legs are omitted, the server auto-merges contracts into stops.",
      "If apply_hauling_contracts_intake or create_mission returns screenshotsMissing: true and the user had images, fix immediately: store_hauling_screenshot with sessionId + missionId (fileUrl preferred) or set_mission_screenshots / re-create_mission with latestScreenshotPath. Prefer attach-after over rebuilding the route.",
      "Set or clear the route origin with set_session_start_location (fuzzy names OK after search_locations). Users can also set it in the web UI.",
      "You may also call replace_hauling_checklist with legs only. Confirm with get_hauling_checklist.",
      "Before proposing cargo bay packing, call get_session_cargo_grid and respect its cell sizes, zones, axes, and placementRules. Do not invent grids. For Sorting DSL: compile_cargo_bay_pack_program (preset→JSON primitives) then plan_stop_occupancy_with_pack_program (optional custom program).",
      "To save missions for later planning (not the live checklist), call create_mission (type=hauling today) with offerLocation + from/to/cargo (+ latestScreenshotPath when an image existed); use add_mission_note and record_mission_run for notes and timing. Browse with list_missions / get_mission.",
      "Location, commodity, and ship names must match fixtures. Prefer fixture names over inventing labels.",
      "shipStorageLocation must be front, middle, or rear. On both stops, set per-cargo shipStorageLocation so pickup/delivery bay zones can differ and render as separate colored lines.",
      "After writes, the web UI polls the same multi-session checklist store.",
    ].join(" "),
  },
);

export { handler as GET, handler as POST, handler as DELETE };
