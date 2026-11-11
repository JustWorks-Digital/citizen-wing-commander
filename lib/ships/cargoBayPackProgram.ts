/**
 * Cargo bay pack program (JSON DSL).
 *
 * Sorting UI / MCP emit a program of sorting **primitives** (`group`, `order`,
 * `stack`, `require`, `reserve`, …). The interpreter applies them to cargo +
 * bay context. UI presets compile into explicit primitive calls — they are not
 * the runtime API.
 */

export const cargoBayPackProgramVersion = 1 as const;

export type PackAxisDirection = "ascending" | "descending";

export type PackBayAlias = "front" | "middle" | "rear";

export type PackBayOrientationAxis = "low-x" | "high-x" | "low-y" | "high-y";

export type PackBaySize = {
  width: number;
  length: number;
  height: number;
};

export type PackBayOrientation = {
  towardShipFront: PackBayOrientationAxis;
  towardShipRear: PackBayOrientationAxis;
};

export type PackBay = {
  /** Stable numeric bay id for the engine. */
  id: number;
  /** Human label (UI / chat). */
  alias: PackBayAlias;
  size: PackBaySize;
  orientation: PackBayOrientation;
};

/** Closed set of primitive verbs the interpreter implements. */
export type PackPrimitiveCall =
  | "group"
  | "order"
  | "stack"
  | "require"
  | "reserve"
  | "bias-xy";

export type PackOrderTarget =
  | "groups"
  | "boxes-within-group"
  | "candidate-slots";

export type PackOrderBy =
  | "cargo-type"
  | "total-scu"
  | "box-scu"
  | "z"
  | "empty-cells-on-same-z"
  | "support-scu"
  | "delivery-rank"
  | "route-order";

export type PackGroupBy = "cargo-type" | "delivery-location";

export type PackStackPrefer = "same-cargo-type" | "same-delivery-location";
export type PackStackOver = "different-cargo-type" | "different-delivery-location";
export type PackStackAllow = "on-larger-support";
export type PackStackWhen =
  | "no-room-beside-same-type"
  | "would-orphan-stack";

export type PackRequireSupport = "covers-footprint";

export type PackBiasXyMode = "edges-first" | "center-first";

export type PackCallBase = {
  call: PackPrimitiveCall;
  /** Lower number = higher precedence. Fall through when the call does not apply. */
  priority: number;
};

export type PackGroupCall = PackCallBase & {
  call: "group";
  by: PackGroupBy;
};

export type PackOrderCall = PackCallBase & {
  call: "order";
  target: PackOrderTarget;
  by: PackOrderBy;
  direction: PackAxisDirection;
};

export type PackStackCall = PackCallBase & {
  call: "stack";
  prefer?: PackStackPrefer;
  over?: PackStackOver;
  larger?: "below";
  smaller?: "above";
  allow?: PackStackAllow;
  whenAny?: PackStackWhen[];
  forbidForeignSupport?: boolean;
  requireContiguity?: boolean;
};

export type PackRequireCall = PackCallBase & {
  call: "require";
  target: "candidate-slots";
  support: PackRequireSupport;
};

export type PackReserveCall = PackCallBase & {
  call: "reserve";
  target: "first-delivery-locations";
  count: number;
  placeAt: "bay-ends";
};

export type PackBiasXyCall = PackCallBase & {
  call: "bias-xy";
  by: "delivery-rank";
  mode: PackBiasXyMode;
};

export type PackCall =
  | PackGroupCall
  | PackOrderCall
  | PackStackCall
  | PackRequireCall
  | PackReserveCall
  | PackBiasXyCall;

export type CargoBayPackProgram = {
  version: typeof cargoBayPackProgramVersion;
  bays: PackBay[];
  /** Optional named recipes; bodies are the same primitive calls. */
  defines?: Record<string, PackCall[]>;
  pack: PackCall[];
};

export type CompilePackBaysInput = {
  bays: PackBay[];
};

export type CompilePackProgramInput = CompilePackBaysInput & {
  mode: "suggested" | "by-cargo-type" | "by-mission-location";
  missionPrioritized?: boolean;
  biasXyMode?: PackBiasXyMode | null;
};

/** Shared deck / support slot policy (explicit order/require — no nicknames). */
export const defaultSlotPolicyCalls: PackCall[] = [
  {
    call: "order",
    priority: 70,
    target: "candidate-slots",
    by: "z",
    direction: "ascending",
  },
  {
    call: "order",
    priority: 80,
    target: "candidate-slots",
    by: "empty-cells-on-same-z",
    direction: "descending",
  },
  {
    call: "require",
    priority: 90,
    target: "candidate-slots",
    support: "covers-footprint",
  },
  {
    call: "order",
    priority: 100,
    target: "candidate-slots",
    by: "support-scu",
    direction: "descending",
  },
];

/** Suggested: follow route-authored chronological placement. */
export function compileSuggestedPackProgram(
  input: CompilePackBaysInput,
): CargoBayPackProgram {
  return {
    version: cargoBayPackProgramVersion,
    bays: input.bays,
    pack: [
      {
        call: "order",
        priority: 10,
        target: "boxes-within-group",
        by: "route-order",
        direction: "ascending",
      },
      ...defaultSlotPolicyCalls,
    ],
  };
}

/** Cargo-type sorting preset as an explicit primitive program. */
export function compileCargoTypePackProgram(
  input: CompilePackBaysInput & {
    missionPrioritized?: boolean;
    biasXyMode?: PackBiasXyMode | null;
  },
): CargoBayPackProgram {
  const pack: PackCall[] = [
    { call: "group", priority: 10, by: "cargo-type" },
    {
      call: "order",
      priority: 20,
      target: "groups",
      by: "total-scu",
      direction: "descending",
    },
    {
      call: "order",
      priority: 30,
      target: "boxes-within-group",
      by: "box-scu",
      direction: "descending",
    },
    {
      call: "stack",
      priority: 40,
      prefer: "same-cargo-type",
      over: "different-cargo-type",
    },
    {
      call: "stack",
      priority: 50,
      larger: "below",
      smaller: "above",
    },
    {
      call: "stack",
      priority: 60,
      allow: "on-larger-support",
      whenAny: ["no-room-beside-same-type", "would-orphan-stack"],
    },
  ];

  if (input.missionPrioritized) {
    // Before box-scu so late deliveries land first (early unload ends on top).
    pack.push({
      call: "order",
      priority: 25,
      target: "boxes-within-group",
      by: "delivery-rank",
      direction: "descending",
    });
    if (input.biasXyMode) {
      pack.push({
        call: "bias-xy",
        priority: 65,
        by: "delivery-rank",
        mode: input.biasXyMode,
      });
    }
  }

  pack.push(...defaultSlotPolicyCalls);

  return {
    version: cargoBayPackProgramVersion,
    bays: input.bays,
    pack,
  };
}

/** Contract based: first N delivery locations exclusive at bay ends; rest by cargo type. */
export function compileContractBasedPackProgram(
  input: CompilePackBaysInput & { priorityLocationCount?: number },
): CargoBayPackProgram {
  const count = input.priorityLocationCount ?? 2;
  return {
    version: cargoBayPackProgramVersion,
    bays: input.bays,
    pack: [
      {
        call: "reserve",
        priority: 5,
        target: "first-delivery-locations",
        count,
        placeAt: "bay-ends",
      },
      { call: "group", priority: 10, by: "delivery-location" },
      {
        call: "stack",
        priority: 20,
        prefer: "same-delivery-location",
        over: "different-delivery-location",
        forbidForeignSupport: true,
        requireContiguity: true,
      },
      {
        call: "group",
        priority: 30,
        by: "cargo-type",
      },
      {
        call: "stack",
        priority: 40,
        prefer: "same-cargo-type",
        over: "different-cargo-type",
        forbidForeignSupport: true,
      },
      {
        call: "stack",
        priority: 50,
        larger: "below",
        smaller: "above",
      },
      ...defaultSlotPolicyCalls,
    ],
  };
}

/** UI / MCP: compile a preset into a full pack program. */
export function compilePackProgramForMode(
  input: CompilePackProgramInput,
): CargoBayPackProgram {
  switch (input.mode) {
    case "suggested":
      return compileSuggestedPackProgram(input);
    case "by-cargo-type":
      return compileCargoTypePackProgram({
        bays: input.bays,
        missionPrioritized: input.missionPrioritized,
        biasXyMode: input.biasXyMode,
      });
    case "by-mission-location":
      return compileContractBasedPackProgram(input);
    default: {
      const _exhaustive: never = input.mode;
      return _exhaustive;
    }
  }
}

/** Sort pack/define calls by priority ascending (stable for ties). */
export function sortPackCallsByPriority(calls: PackCall[]): PackCall[] {
  return [...calls].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return 0;
  });
}

/** Expand `defines` references if we later add `{ call: "use", name }` — today pack is flat. */
export function expandPackProgram(program: CargoBayPackProgram): PackCall[] {
  return sortPackCallsByPriority(program.pack);
}

/**
 * Derive which legacy placer path a program maps to.
 * Primitives remain the source of truth; this is the interpreter’s dispatch.
 */
export type DerivedPackStrategy = {
  kind: "suggested" | "by-cargo-type" | "by-mission-location";
  missionPrioritized: boolean;
  biasXyMode: PackBiasXyMode | null;
  priorityLocationCount: number;
  clusterSameCargoType: boolean;
  largerBelow: boolean;
  requireFullFootprint: boolean;
};

export function derivePackStrategy(program: CargoBayPackProgram): DerivedPackStrategy {
  const calls = expandPackProgram(program);
  const reserve = calls.find(
    (call): call is PackReserveCall =>
      call.call === "reserve" && call.target === "first-delivery-locations",
  );
  const groupCargoType = calls.some(
    (call) => call.call === "group" && call.by === "cargo-type",
  );
  const orderDeliveryRank = calls.some(
    (call) =>
      call.call === "order" &&
      call.target === "boxes-within-group" &&
      call.by === "delivery-rank",
  );
  const bias = calls.find(
    (call): call is PackBiasXyCall => call.call === "bias-xy",
  );
  const clusterSameCargoType = calls.some(
    (call) =>
      call.call === "stack" && call.prefer === "same-cargo-type",
  );
  const largerBelow = calls.some(
    (call) => call.call === "stack" && call.larger === "below",
  );
  const requireFullFootprint = calls.some(
    (call) =>
      call.call === "require" && call.support === "covers-footprint",
  );

  if (reserve) {
    return {
      kind: "by-mission-location",
      missionPrioritized: false,
      biasXyMode: null,
      priorityLocationCount: reserve.count,
      clusterSameCargoType,
      largerBelow,
      requireFullFootprint,
    };
  }

  if (groupCargoType) {
    return {
      kind: "by-cargo-type",
      missionPrioritized: orderDeliveryRank || Boolean(bias),
      biasXyMode: bias?.mode ?? null,
      priorityLocationCount: 0,
      clusterSameCargoType,
      largerBelow,
      requireFullFootprint,
    };
  }

  return {
    kind: "suggested",
    missionPrioritized: false,
    biasXyMode: null,
    priorityLocationCount: 0,
    clusterSameCargoType,
    largerBelow,
    requireFullFootprint,
  };
}
