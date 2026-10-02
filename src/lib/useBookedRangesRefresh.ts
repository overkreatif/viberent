import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { BookedRange } from "./types";
import { supabase } from "./supabase";

export function useBookedRangesRefresh(
  setRanges: Dispatch<SetStateAction<BookedRange[]>>,
) {
  useEffect(() => {
    if (!supabase) return;

    const client = supabase;
    let active = true;
    let fetching = false;
    const refresh = async () => {
      if (!active || fetching || document.visibilityState === "hidden") return;
      fetching = true;
      try {
        const { data, error } = await client.rpc("get_booked_ranges");
        if (active && !error) setRanges((data ?? []) as BookedRange[]);
      } catch {
        // Keep the last successful availability data during transient failures.
      } finally {
        fetching = false;
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const channel = client
      .channel("availability-inventory")
      .on("broadcast", { event: "inventory_changed" }, () => void refresh())
      .subscribe();
    const interval = window.setInterval(() => void refresh(), 30_000);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void client.removeChannel(channel);
    };
  }, [setRanges]);
}