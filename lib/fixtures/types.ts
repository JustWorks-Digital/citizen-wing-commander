/** Slim location row from Star Citizen Wiki starmap fixture. */
export type FixtureLocation = {
  id: string;
  slug: string;
  name: string;
  type: string | null;
  classification: string | null;
  system: string | null;
  parentName: string | null;
  parentType: string | null;
  /**
   * True when UEX reports an outdoor / external freight elevator
   * (`has_loading_dock`) at this place. Omitted / false → no UI icon.
   */
  hasOutdoorFreightElevator?: boolean;
};

/** Slim commodity row from UEX Corp fixture. */
export type FixtureCommodity = {
  id: number;
  code: string;
  slug: string;
  name: string;
  kind: string | null;
  /** Primary crate color name (UEX-style: red, blue, green, …). */
  color: string | null;
  /** Secondary crate color name. */
  color2: string | null;
  /** `uex-item` when from UEX items; otherwise kind-based crate fallback. */
  colorSource: "uex-item" | "kind-fallback";
  isAvailableLive: boolean;
  isIllegal: boolean;
};

/** Slim ship row from UEX Corp vehicles fixture (spaceships). */
export type FixtureShip = {
  id: number;
  slug: string;
  name: string;
  nameFull: string;
  manufacturer: string | null;
  /** Total cargo capacity in SCU. */
  cargoScu: number;
  isCargo: boolean;
  containerSizes: number[];
};

/** Mission contractor / org that posts contracts (MobiGlas “Contracted by”). */
export type FixtureContractor = {
  slug: string;
  name: string;
  /** Alternate spellings / short names used in OCR / UI. */
  aliases: string[];
};

export type FixtureFile<T> = {
  source: string;
  sourceLabel: string;
  fetchedAt: string;
  items: T[];
};
