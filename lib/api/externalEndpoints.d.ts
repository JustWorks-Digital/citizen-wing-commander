declare module "@/lib/api/externalEndpoints.mjs" {
  export const scWikiApi: {
    locations: string;
    commodities: string;
  };

  export const scToolsWikiApi: {
    mediaWiki: string;
    commodityIconsCategory: string;
  };

  export const rsiStarmapApi: {
    base: string;
    starSystem: (code: string) => string;
    celestialObject: (code: string) => string;
  };

  export const uexApi: {
    base: string;
    commodities: string;
    items: string;
    vehicles: string;
    terminals: string;
    starSystems: string;
  };
}
