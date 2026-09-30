import type { BookedRange, ProductVariant } from "./types";

/** Inclusive date range as ISO strings (YYYY-MM-DD); ISO strings compare lexicographically. */
export interface DateRange {
  start: string;
  end: string;
}

function overlaps(range: DateRange, block: BookedRange): boolean {
  return block.start_date <= range.end && block.end_date >= range.start;
}

/**
 * Number of confirmed + admin-blocked bookings overlapping the range for a
 * product/size. Pending and rejected bookings never count.
 */
export function countBooked(
  blocks: BookedRange[],
  productId: string,
  size: string,
  range: DateRange | null,
): number {
  if (!range) return 0;
  return blocks.filter(
    (b) => b.product_id === productId && b.size === size && overlaps(range, b),
  ).length;
}

/** Remaining rentable units for a variant over the range (floor at 0). */
export function availableCount(
  variant: ProductVariant,
  blocks: BookedRange[],
  range: DateRange | null,
): number {
  const booked = countBooked(blocks, variant.product_id, variant.size, range);
  return Math.max(0, variant.total_stock - booked);
}

/** Sizes with at least one available unit for the range. */
export function getAvailableSizes(
  variants: ProductVariant[],
  blocks: BookedRange[],
  range: DateRange | null,
): string[] {
  return variants
    .filter((v) => availableCount(v, blocks, range) > 0)
    .map((v) => v.size);
}

/** A product is shown in the catalog when ≥1 size is available for the range. */
export function hasAvailableSize(
  variants: ProductVariant[],
  blocks: BookedRange[],
  range: DateRange | null,
): boolean {
  if (!range) return variants.length > 0;
  return variants.some((v) => availableCount(v, blocks, range) > 0);
}

/** Single-date availability (used by the product-detail calendar). */
export function isDateAvailable(
  variant: ProductVariant,
  blocks: BookedRange[],
  date: string,
): boolean {
  return availableCount(variant, blocks, { start: date, end: date }) > 0;
}
