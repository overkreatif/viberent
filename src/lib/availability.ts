import type { BookedRange, ProductVariant } from "./types";

/** Inclusive date range as ISO strings (YYYY-MM-DD); ISO strings compare lexicographically. */
export interface DateRange {
  start: string;
  end: string;
}

function nextDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/**
 * Peak number of pending, confirmed, or admin-blocked bookings occupying a
 * product/size on any single day in the selected range. Rejected bookings do
 * not consume inventory.
 */
export function countBooked(
  blocks: BookedRange[],
  productId: string,
  size: string,
  range: DateRange | null,
): number {
  if (!range) return 0;
  const events = new Map<string, number>();
  for (const booking of blocks) {
    if (
      booking.product_id !== productId ||
      booking.size !== size ||
      booking.end_date < range.start ||
      booking.start_date > range.end
    ) {
      continue;
    }
    const start = booking.start_date < range.start ? range.start : booking.start_date;
    const end = booking.end_date > range.end ? range.end : booking.end_date;
    events.set(start, (events.get(start) ?? 0) + 1);
    const dayAfterEnd = nextDate(end);
    events.set(dayAfterEnd, (events.get(dayAfterEnd) ?? 0) - 1);
  }

  let active = 0;
  let peak = 0;
  for (const date of [...events.keys()].sort()) {
    active += events.get(date) ?? 0;
    peak = Math.max(peak, active);
  }
  return peak;
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
