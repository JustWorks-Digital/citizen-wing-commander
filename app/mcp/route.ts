import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  toolAddMissionNote,
  toolApplyHaulingContractsIntake,
  toolClearHaulingScreenshots,
  toolCreateHaulingSession,
  toolCreateMission,
  toolGetHaulingChecklist,
  toolGetHaulingIntakePlaybook,
  toolGetHaulingScreenshot,
  toolGetMission,
  toolGetSessionCargoGrid,
  toolListHaulingScreenshots,
  toolListHaulingSessions,
  toolListMissions,
  toolRecordMissionRun,
  toolReplaceHaulingChecklist,
  toolSearchCommodities,
  toolSearchLocations,
  toolSearchShips,
  toolSetActiveHaulingSession,
  toolSetSessionStartLocation,
  toolSetLegCompleted,
  toolSetSessionName,
  toolSetSessionShips,
  toolStoreHaulingScreenshot,
} from "@/lib/mcp/tools";

const distanceUnitSchema = z.enum(["m", "km", "Mm", "Gm"]);

const sessionIdSchema = z
  .string()
  .uuid()
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
  legKind: z.enum(["pickup", "delivery", "both"]),
  location: z
    .string()
    .describe("Star Citizen location name or fixture slug (e.g. Area18)"),
  cargo: z.array(cargoLineSchema).optional().default([]),
  shipStorageLocation: shipStorageSchema.describe(
    "Default cargo bay zone for the leg (used when cargo lines omit shipStorageLocation).",
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
          sessionId: z.string().uuid(),
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
      "get_hauling_intake_playbook",
      {
        title: "Get hauling intake playbook",
        description:
          "Use this first when ingesting mission screenshots or contract text. Returns the screenshot→route→replace_hauling_checklist playbook (extract fields, fixture resolution, merge/optimize stops, bay zoning).",
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
          "Use this when the user attaches a MobiGlas / contract screenshot. Saves the image into the server temp store (.data/mcp-screenshots) and returns a logical path to reference from transcripts. Pass raw base64 or a data:image/...;base64 URL. Do not commit screenshots into the repo.",
        inputSchema: z.object({
          imageBase64: z
            .string()
            .min(1)
            .describe("Raw base64 bytes or data:image/...;base64,... URL"),
          filename: z
            .string()
            .optional()
            .describe("Optional filename (e.g. 01-stims-everus-lorville.png)"),
          batchId: z
            .string()
            .optional()
            .describe(
              "Optional batch folder id (e.g. hurston-covalex-2026-11-08). Defaults to default.",
            ),
          contractId: z
            .string()
            .optional()
            .describe("Optional contract id to associate (e.g. contract-01-stims)"),
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
      title: z.string(),
      contractor: z.string().optional(),
      rewardAuec: z.number().nonnegative().optional(),
      from: z.array(z.string()).min(1),
      to: z.array(z.string()).min(1),
      cargo: z.array(intakeCargoSchema).min(1),
      maxContainerScu: z.number().int().positive().optional(),
      pickupSplits: z.record(z.string(), z.array(intakeCargoSchema)).optional(),
    });

    server.registerTool(
      "apply_hauling_contracts_intake",
      {
        title: "Apply hauling contracts intake",
        description:
          "Use this to apply accepted hauling_contracts_intake JSON (from screenshots). Pass contracts; optionally pass optimized legs (same shape as replace_hauling_checklist). Without legs, the server auto-merges contracts into stops. Resets the session timer by default.",
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
      "get_session_cargo_grid",
      {
        title: "Get session cargo grid",
        description:
          "Use this before planning bay packing. Returns bay width/length/height in 1-SCU cells, zone layout (front/middle/rear), coordinate axes, and placement-rule summaries. Defaults to the session’s ships; pass ship to look up one sketch by name/slug. Do not invent grid sizes.",
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
      "create_mission",
      {
        title: "Create mission",
        description:
          "Use this to create or update a catalog mission (not the live checklist). Pass type (default hauling). For hauling include offerLocation, from/to, cargo, optional screenshot path and maxContainerScu. Upserts by fingerprint. Other mission types will be added later.",
        inputSchema: z.object({
          type: z
            .enum(["hauling"])
            .optional()
            .default("hauling")
            .describe("Mission kind. Currently only hauling is implemented."),
          title: z.string().min(1),
          contractor: z.string().optional(),
          rewardAuec: z.number().nonnegative().optional(),
          offerLocation: z
            .string()
            .optional()
            .describe(
              "Where the mission was offered / screenshot taken (availability context).",
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
            .describe("Hauling: cargo lines"),
          maxContainerScu: z.number().int().positive().optional(),
          latestScreenshotPath: z
            .string()
            .optional()
            .describe("Logical path from store_hauling_screenshot / UI upload"),
          extras: z.record(z.string(), z.unknown()).optional(),
        }),
        annotations: { destructiveHint: false },
      },
      async (input) => toolCreateMission(input),
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
      "get_mission",
      {
        title: "Get mission",
        description:
          "Use this to fetch one catalog mission plus its player notes.",
        inputSchema: z.object({
          missionId: z.string().uuid(),
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
          missionId: z.string().uuid(),
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
          missionId: z.string().uuid(),
          durationMs: z.number().int().nonnegative(),
          offerLocation: z.string().optional(),
          deliverySessionId: z.string().uuid().optional(),
        }),
        annotations: { destructiveHint: false },
      },
      async (input) => toolRecordMissionRun(input),
    );
  },
  {
    serverInfo: {
      name: "citizen-wing-commander",
      version: "0.1.0",
    },
    instructions: [
      "Citizen Wing Commander manages hauling session checklists.",
      "Before ingesting screenshots or contract text, call get_hauling_intake_playbook and follow it.",
      "When the user attaches contract screenshots, call store_hauling_screenshot (base64) so files land in the ephemeral .data/mcp-screenshots store; reference returned logical paths from mobiglas transcripts. Do not put screenshot binaries in git.",
      "Extract every Accepted contract into hauling_contracts_intake JSON (contracts with from/to/cargo).",
      "Call list_hauling_sessions to see open tabs and activeSessionId. Pass sessionId on write tools to target a specific tab; omit to use the active session.",
      "Prefer building an optimized legs[] route, then call apply_hauling_contracts_intake with contracts + legs (and startLocation / sessionId when known). If legs are omitted, the server auto-merges contracts into stops.",
      "Set or clear the route origin with set_session_start_location (fuzzy names OK after search_locations). Users can also set it in the web UI.",
      "You may also call replace_hauling_checklist with legs only. Confirm with get_hauling_checklist.",
      "Before proposing cargo bay packing, call get_session_cargo_grid and respect its cell sizes, zones, axes, and placementRules. Do not invent grids.",
      "To save missions for later planning (not the live checklist), call create_mission (type=hauling today) with offerLocation + from/to/cargo; use add_mission_note and record_mission_run for notes and timing. Browse with list_missions / get_mission.",
      "Location, commodity, and ship names must match fixtures. Prefer fixture names over inventing labels.",
      "shipStorageLocation must be front, middle, or rear. On both stops, set per-cargo shipStorageLocation so pickup/delivery bay zones can differ and render as separate colored lines.",
      "After writes, the web UI polls the same multi-session checklist store.",
    ].join(" "),
  },
);

export { handler as GET, handler as POST, handler as DELETE };
