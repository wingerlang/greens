import type { FeedEvent, FeedEventType } from "../../models/feedTypes.ts";

/**
 * Feed Aggregator Service
 *
 * Bundles repeated events to prevent feed spam:
 * - Multiple HYDRATION events → "Drank X liters"
 * - Multiple NUTRITION_MEAL events → "3 meals logged"
 * - Keeps MILESTONE events separate (they're special)
 */

interface AggregationConfig {
  // Time window for bundling events (in hours)
  hydrationWindowHours: number;
  mealWindowHours: number;
  // Minimum count before bundling
  minCountToBundle: number;
}

const DEFAULT_CONFIG: AggregationConfig = {
  hydrationWindowHours: 4,
  mealWindowHours: 24,
  minCountToBundle: 3,
};

/**
 * Aggregate feed events - bundle similar events together
 */
export function aggregateFeedEvents(
  events: FeedEvent[],
  config: AggregationConfig = DEFAULT_CONFIG,
): FeedEvent[] {
  if (events.length === 0) return [];

  // Sort by timestamp (newest first)
  const sorted = [...events].sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Group events by user and type for aggregation
  const result: FeedEvent[] = [];
  const processed = new Set<string>();

  for (const event of sorted) {
    if (processed.has(event.id)) continue;

    // MILESTONE events are never aggregated
    if (event.type === "MILESTONE") {
      result.push(event);
      processed.add(event.id);
      continue;
    }

    // Try to bundle HYDRATION events
    if (event.type === "HYDRATION") {
      const bundled = bundleHydrationEvents(event, sorted, config, processed);
      result.push(bundled);
      continue;
    }

    // Try to bundle NUTRITION_MEAL events
    if (event.type === "NUTRITION_MEAL") {
      const bundled = bundleMealEvents(event, sorted, config, processed);
      result.push(bundled);
      continue;
    }

    // Other events pass through unchanged
    result.push(event);
    processed.add(event.id);
  }

  return result;
}

/**
 * Bundle multiple hydration events into one
 */
function bundleHydrationEvents(
  anchor: FeedEvent,
  allEvents: FeedEvent[],
  config: AggregationConfig,
  processed: Set<string>,
): FeedEvent {
  const windowMs = config.hydrationWindowHours * 60 * 60 * 1000;
  const anchorTime = new Date(anchor.timestamp).getTime();

  // Find all hydration events from same user within time window
  const related = allEvents.filter((e) =>
    e.type === "HYDRATION" &&
    e.userId === anchor.userId &&
    !processed.has(e.id) &&
    Math.abs(new Date(e.timestamp).getTime() - anchorTime) <= windowMs
  );

  // Not enough to bundle
  if (related.length < config.minCountToBundle) {
    processed.add(anchor.id);
    return anchor;
  }

  // Mark all as processed
  related.forEach((e) => processed.add(e.id));

  // Calculate totals
  let totalMl = 0;
  for (const event of related) {
    const payload = event.payload as any;
    if (payload.amountMl) {
      totalMl += payload.amountMl;
    }
  }

  // Create bundled event
  const bundled: FeedEvent = {
    ...anchor,
    id: anchor.id, // Keep anchor's ID
    title: `Drack ${(totalMl / 1000).toFixed(1)} liter vatten`,
    summary:
      `${related.length} gånger under ${config.hydrationWindowHours} timmar`,
    aggregatedFrom: related.map((e) => e.id),
    payload: {
      type: "HYDRATION",
      amountMl: totalMl,
      totalDayMl: totalMl,
    },
    metrics: [
      { label: "Totalt", value: `${(totalMl / 1000).toFixed(1)}L`, icon: "💧" },
      { label: "Gånger", value: related.length, icon: "🔄" },
    ],
  };

  return bundled;
}

/**
 * Bundle multiple meal events into one (daily summary)
 */
function bundleMealEvents(
  anchor: FeedEvent,
  allEvents: FeedEvent[],
  config: AggregationConfig,
  processed: Set<string>,
): FeedEvent {
  const windowMs = config.mealWindowHours * 60 * 60 * 1000;
  const anchorTime = new Date(anchor.timestamp).getTime();

  // Find all meal events from same user within time window
  const related = allEvents.filter((e) =>
    e.type === "NUTRITION_MEAL" &&
    e.userId === anchor.userId &&
    !processed.has(e.id) &&
    Math.abs(new Date(e.timestamp).getTime() - anchorTime) <= windowMs
  );

  // Not enough to bundle
  if (related.length < config.minCountToBundle) {
    processed.add(anchor.id);
    return anchor;
  }

  // Mark all as processed
  related.forEach((e) => processed.add(e.id));

  // Calculate totals
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const event of related) {
    const payload = event.payload as any;
    if (payload.calories) totalCalories += payload.calories;
    if (payload.protein) totalProtein += payload.protein;
    if (payload.carbs) totalCarbs += payload.carbs;
    if (payload.fat) totalFat += payload.fat;
  }

  // Create bundled event
  const bundled: FeedEvent = {
    ...anchor,
    id: anchor.id,
    title: `${related.length} måltider loggade`,
    summary: `Totalt ${Math.round(totalCalories)} kcal`,
    aggregatedFrom: related.map((e) => e.id),
    payload: {
      type: "NUTRITION_MEAL",
      mealType: "bundled",
      calories: totalCalories,
      protein: totalProtein,
      carbs: totalCarbs,
      fat: totalFat,
    },
    metrics: [
      {
        label: "Kalorier",
        value: Math.round(totalCalories),
        unit: "kcal",
        icon: "🔥",
      },
      {
        label: "Protein",
        value: Math.round(totalProtein),
        unit: "g",
        icon: "💪",
      },
      { label: "Måltider", value: related.length, icon: "🍽️" },
    ],
  };

  return bundled;
}

/**
 * Check if two events are on the same day
 */
function isSameDay(date1: string, date2: string): boolean {
  return date1.split("T")[0] === date2.split("T")[0];
}

/**
 * Group events by day for timeline display
 */
export function groupEventsByDay(
  events: FeedEvent[],
): Map<string, FeedEvent[]> {
  const groups = new Map<string, FeedEvent[]>();

  for (const event of events) {
    const day = event.timestamp.split("T")[0];
    if (!groups.has(day)) {
      groups.set(day, []);
    }
    groups.get(day)!.push(event);
  }

  return groups;
}

/**
 * Get a human-readable time description
 */
export function getRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "Just nu";
  if (minutes < 60) return `${minutes} min sedan`;
  if (hours < 24) return `${hours}h sedan`;
  if (days === 1) return "Igår";
  if (days < 7) return `${days} dagar sedan`;

  return new Date(timestamp).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
  });
}
