export type ProjectUnitTypeRow = {
  type: string;
  count: number;
  carpetArea?: string;
  minPrice?: number;
  maxPrice?: number;
};

export type ProjectUnitsInfo = {
  units: ProjectUnitTypeRow[];
};

export type ProjectBlocksInfo = {
  numberOfBlocks?: number;
  floorsPerBlock?: number;
  unitsPerFloor?: number;
  notes?: string;
};

export type ProjectGalleryItem = {
  id: string;
  name: string;
  placeholder?: boolean;
};

export type ProjectGalleryInfo = {
  items: ProjectGalleryItem[];
};

export const DEFAULT_UNITS_INFO: ProjectUnitsInfo = {
  units: [
    { type: "1BHK", count: 0, carpetArea: "", minPrice: undefined, maxPrice: undefined },
    { type: "2BHK", count: 0, carpetArea: "", minPrice: undefined, maxPrice: undefined },
    { type: "3BHK", count: 0, carpetArea: "", minPrice: undefined, maxPrice: undefined },
  ],
};

export const DEFAULT_BLOCKS_INFO: ProjectBlocksInfo = {
  numberOfBlocks: undefined,
  floorsPerBlock: undefined,
  unitsPerFloor: undefined,
  notes: "",
};

export const COMMON_AMENITIES = [
  "Pool",
  "Gym",
  "Clubhouse",
  "Parking",
  "Garden",
  "Play Area",
  "Security",
  "Power Backup",
  "Lift",
  "CCTV",
] as const;

export function normalizeUnitsInfo(value: ProjectUnitsInfo | null | undefined): ProjectUnitsInfo {
  if (!value?.units?.length) {
    return { units: DEFAULT_UNITS_INFO.units.map((unit) => ({ ...unit })) };
  }
  return {
    units: value.units.map((unit) => ({
      type: unit.type,
      count: unit.count ?? 0,
      carpetArea: unit.carpetArea ?? "",
      minPrice: unit.minPrice,
      maxPrice: unit.maxPrice,
    })),
  };
}

export function normalizeBlocksInfo(
  value: ProjectBlocksInfo | null | undefined,
): ProjectBlocksInfo {
  return {
    numberOfBlocks: value?.numberOfBlocks,
    floorsPerBlock: value?.floorsPerBlock,
    unitsPerFloor: value?.unitsPerFloor,
    notes: value?.notes ?? "",
  };
}

export function normalizeGalleryInfo(
  value: ProjectGalleryInfo | null | undefined,
): ProjectGalleryInfo {
  return { items: value?.items ?? [] };
}
