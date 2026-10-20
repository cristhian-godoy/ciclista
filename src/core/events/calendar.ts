import type { Coordinate } from '../common/types';
import type { GeoJSONFeature } from '../graph/geojson';

/**
 * Single cycling calendar event entity in JSON format.
 */
export interface CyclingCalendarEvent {
  /**
   * Unique identifier of the event.
   */
  id: string;
  /**
   * Event title or summary.
   */
  summary: string;
  /**
   * Optional description or notes.
   */
  description?: string;
  /**
   * Event start time in ISO 8601 string format.
   */
  startDate: string;
  /**
   * Event end time in ISO 8601 string format.
   */
  endDate: string;
  /**
   * Geographic coordinates of event origin / gathering location.
   */
  location?: Coordinate;
  /**
   * Optional route GeoJSON reference (e.g. LineString or FeatureCollection).
   */
  routeGeoJSON?: GeoJSONFeature | GeoJSONFeature[];
  /**
   * Optional road or edge segment IDs associated with this event.
   */
  edgeIds?: string[];
  /**
   * Optional metadata tags.
   */
  tags?: string[];
}

/**
 * Root feed structure for JSON cycling calendar export/import.
 */
export interface CyclingCalendarFeed {
  version: '1.0';
  title: string;
  description?: string;
  generatedAt: string;
  events: CyclingCalendarEvent[];
}

/**
 * Generates a JSON calendar feed data structure compliant with the cycling calendar schema.
 *
 * @param events - List of cycling calendar events.
 * @param metadata - Optional title and description for the calendar feed.
 * @returns JSON-serializable calendar feed object.
 */
export function generateCalendarFeed(
  events: readonly CyclingCalendarEvent[],
  metadata?: { title?: string; description?: string },
): CyclingCalendarFeed {
  return {
    version: '1.0',
    title: metadata?.title ?? 'Ciclista Cycling Calendar',
    description: metadata?.description ?? 'Cycling events, group rides, and route blockages',
    generatedAt: new Date().toISOString(),
    events: events.map((event) => ({ ...event })),
  };
}

/**
 * Serializes a collection of calendar events into a JSON calendar feed string.
 *
 * @param events - List of cycling calendar events.
 * @param metadata - Optional calendar metadata.
 * @returns JSON string representing the feed.
 */
export function serializeCalendarFeed(
  events: readonly CyclingCalendarEvent[],
  metadata?: { title?: string; description?: string },
): string {
  const feed = generateCalendarFeed(events, metadata);
  return JSON.stringify(feed, null, 2);
}

/**
 * Validation result for calendar feed parsing.
 */
export interface CalendarParseResult {
  valid: boolean;
  feed?: CyclingCalendarFeed;
  errors: string[];
}

/**
 * Validates whether a given ISO 8601 date string is well-formed and valid.
 */
function isValidISODate(dateStr: unknown): boolean {
  if (typeof dateStr !== 'string') return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

/**
 * Parses and validates a raw JSON calendar feed string or object.
 *
 * @param rawJson - JSON string or parsed object representing a calendar feed.
 * @returns Validation result containing parsed feed or errors.
 */
export function parseCalendarFeed(rawJson: string | unknown): CalendarParseResult {
  const errors: string[] = [];

  let data: unknown;
  if (typeof rawJson === 'string') {
    try {
      data = JSON.parse(rawJson);
    } catch {
      return { valid: false, errors: ['Invalid JSON syntax'] };
    }
  } else {
    data = rawJson;
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { valid: false, errors: ['Feed root must be an object'] };
  }

  const obj = data as Record<string, unknown>;

  if (obj['version'] !== '1.0') {
    errors.push('Feed version must be "1.0"');
  }

  if (typeof obj['title'] !== 'string' || !obj['title'].trim()) {
    errors.push('Feed title must be a non-empty string');
  }

  if (!Array.isArray(obj['events'])) {
    errors.push('Feed events property must be an array');
    return { valid: false, errors };
  }

  const parsedEvents: CyclingCalendarEvent[] = [];

  obj['events'].forEach((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      errors.push(`Event at index ${index} must be an object`);
      return;
    }

    const eventObj = item as Record<string, unknown>;

    if (typeof eventObj['id'] !== 'string' || !eventObj['id'].trim()) {
      errors.push(`Event at index ${index} is missing a valid id`);
    }

    if (typeof eventObj['summary'] !== 'string' || !eventObj['summary'].trim()) {
      errors.push(`Event at index ${index} is missing a valid summary`);
    }

    if (!isValidISODate(eventObj['startDate'])) {
      errors.push(`Event at index ${index} has an invalid startDate`);
    }

    if (!isValidISODate(eventObj['endDate'])) {
      errors.push(`Event at index ${index} has an invalid endDate`);
    }

    if (
      isValidISODate(eventObj['startDate']) &&
      isValidISODate(eventObj['endDate']) &&
      new Date(eventObj['startDate'] as string).getTime() >
        new Date(eventObj['endDate'] as string).getTime()
    ) {
      errors.push(`Event at index ${index} startDate must not be after endDate`);
    }

    if (eventObj['location'] !== undefined) {
      const loc = eventObj['location'] as Record<string, unknown>;
      if (
        typeof loc !== 'object' ||
        loc === null ||
        typeof loc['lat'] !== 'number' ||
        typeof loc['lng'] !== 'number'
      ) {
        errors.push(`Event at index ${index} has an invalid location object`);
      }
    }

    parsedEvents.push(item as CyclingCalendarEvent);
  });

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    feed: {
      version: '1.0',
      title: obj['title'] as string,
      description: typeof obj['description'] === 'string' ? obj['description'] : undefined,
      generatedAt:
        typeof obj['generatedAt'] === 'string' ? obj['generatedAt'] : new Date().toISOString(),
      events: parsedEvents,
    },
    errors: [],
  };
}
