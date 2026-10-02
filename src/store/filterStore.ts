import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductTier } from "../lib/types";
import type { DateRange } from "../lib/availability";

/**
 * Global catalog filter state (persisted so the booking modal on the product
 * page can pre-fill its dates from the range the user picked here).
 *
 * A date range is only "active" when BOTH start and end are filled —
 * otherwise the catalog shows every product.
 */
interface FilterState {
  startDate: string; // yyyy-MM-dd, "" = unset
  endDate: string; // yyyy-MM-dd, "" = unset
  tiers: ProductTier[];
  categoryIds: string[];
  sizes: string[];
  colors: string[];
  setDateRange: (start: string, end: string) => void;
  toggleTier: (tier: ProductTier) => void;
  toggleCategory: (id: string) => void;
  toggleSize: (size: string) => void;
  toggleColor: (color: string) => void;
  reset: () => void;
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      startDate: "",
      endDate: "",
      tiers: [],
      categoryIds: [],
      sizes: [],
      colors: [],
      setDateRange: (start, end) => set({ startDate: start, endDate: end }),
      toggleTier: (tier) =>
        set((s) => ({
          tiers: s.tiers.includes(tier)
            ? s.tiers.filter((t) => t !== tier)
            : [...s.tiers, tier],
        })),
      toggleCategory: (id) =>
        set((s) => ({
          categoryIds: s.categoryIds.includes(id)
            ? s.categoryIds.filter((c) => c !== id)
            : [...s.categoryIds, id],
        })),
      toggleSize: (size) =>
        set((s) => ({
          sizes: s.sizes.includes(size)
            ? s.sizes.filter((x) => x !== size)
            : [...s.sizes, size],
        })),
      toggleColor: (color) =>
        set((s) => ({
          colors: s.colors.includes(color)
            ? s.colors.filter((c) => c !== color)
            : [...s.colors, color],
        })),
      reset: () =>
        set({
          startDate: "",
          endDate: "",
          tiers: [],
          categoryIds: [],
          sizes: [],
          colors: [],
        }),
    }),
    { name: "rentfolio-filters" },
  ),
);

/** The active date range, or null when not fully set. */
export function activeDateRange(s: {
  startDate: string;
  endDate: string;
}): DateRange | null {
  return s.startDate && s.endDate
    ? { start: s.startDate, end: s.endDate }
    : null;
}

/** Number of active filter groups (used for the mobile filter badge). */
export function activeFilterCount(s: {
  startDate: string;
  endDate: string;
  tiers: string[];
  categoryIds: string[];
  sizes: string[];
  colors: string[];
}): number {
  let n = 0;
  if (s.startDate && s.endDate) n += 1;
  if (s.tiers.length) n += 1;
  if (s.categoryIds.length) n += 1;
  if (s.sizes.length) n += 1;
  if (s.colors.length) n += 1;
  return n;
}
