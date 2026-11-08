import { appApi } from "@/lib/api/appRoutes";

export type CatalogShip = {
  id: number;
  slug: string;
  name: string;
  nameFull: string;
  manufacturer: string | null;
  cargoScu: number;
  isCargo: boolean;
  containerSizes: number[];
};

export async function fetchSelectableShips(): Promise<CatalogShip[]> {
  const response = await fetch(appApi.ships, { cache: "no-store" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `Failed to load ships (${response.status})`);
  }
  const body = (await response.json()) as { ships: CatalogShip[] };
  return body.ships ?? [];
}
