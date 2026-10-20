import { describe, expect, it } from 'vitest';

import {
  type CyclingCalendarEvent,
  generateCalendarFeed,
  parseCalendarFeed,
  serializeCalendarFeed,
} from './calendar';

describe('Cycling Calendar Feed Core', () => {
  const sampleEvents: CyclingCalendarEvent[] = [
    {
      id: 'event-critical-mass',
      summary: 'Munich Critical Mass',
      description: 'Monthly social bike ride through central Munich',
      startDate: '2026-10-30T18:00:00Z',
      endDate: '2026-10-30T21:00:00Z',
      location: { lat: 48.137, lng: 11.575 },
      edgeIds: ['edge-1', 'edge-2'],
      tags: ['group-ride', 'social'],
      routeGeoJSON: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [11.575, 48.137],
            [11.58, 48.14],
          ],
        },
        properties: {},
      },
    },
  ];

  it('generates a valid calendar feed conforming to 1.0 schema', () => {
    const feed = generateCalendarFeed(sampleEvents, {
      title: 'October Cycling Events',
      description: 'Curated cycling events and rides',
    });

    expect(feed.version).toBe('1.0');
    expect(feed.title).toBe('October Cycling Events');
    expect(feed.description).toBe('Curated cycling events and rides');
    expect(feed.events).toHaveLength(1);
    expect(feed.events[0]?.summary).toBe('Munich Critical Mass');
    expect(feed.generatedAt).toBeDefined();
  });

  it('serializes calendar feed into formatted JSON string', () => {
    const jsonStr = serializeCalendarFeed(sampleEvents);
    expect(typeof jsonStr).toBe('string');
    const parsed = JSON.parse(jsonStr);
    expect(parsed.version).toBe('1.0');
    expect(parsed.events).toHaveLength(1);
  });

  it('parses and validates a valid JSON calendar string', () => {
    const jsonStr = serializeCalendarFeed(sampleEvents);
    const result = parseCalendarFeed(jsonStr);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.feed).toBeDefined();
    expect(result.feed?.events[0]?.id).toBe('event-critical-mass');
    expect(result.feed?.events[0]?.location).toEqual({ lat: 48.137, lng: 11.575 });
  });

  it('rejects invalid JSON syntax', () => {
    const result = parseCalendarFeed('{ invalid json ...');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid JSON syntax');
  });

  it('validates schema requirements: version, title, event objects, and dates', () => {
    // Missing version and title
    const invalidFeed = {
      version: '2.0',
      title: '',
      events: [
        {
          id: '',
          summary: '',
          startDate: 'invalid-date',
          endDate: '2020-01-01T00:00:00Z',
        },
      ],
    };

    const result = parseCalendarFeed(invalidFeed);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Feed version must be "1.0"');
    expect(result.errors).toContain('Feed title must be a non-empty string');
    expect(result.errors).toContain('Event at index 0 is missing a valid id');
    expect(result.errors).toContain('Event at index 0 is missing a valid summary');
    expect(result.errors).toContain('Event at index 0 has an invalid startDate');
  });

  it('rejects events where startDate is chronologically after endDate', () => {
    const feed = {
      version: '1.0',
      title: 'Time Travel Ride',
      events: [
        {
          id: 'event-1',
          summary: 'Backwards Ride',
          startDate: '2026-10-31T20:00:00Z',
          endDate: '2026-10-31T18:00:00Z',
        },
      ],
    };

    const result = parseCalendarFeed(feed);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Event at index 0 startDate must not be after endDate');
  });
});
