/**
 * Session-size presets for the Vibes playlist builder.
 * Controls how big a generated playlist should be (by record count or target minutes).
 */
export const SESSION_SIZES = [
  { id: 'quick', label: 'A couple records', targetCount: 3, targetMinutes: null },
  { id: 'session', label: 'A listening session', targetCount: null, targetMinutes: 90 },
  { id: 'afternoon', label: 'All afternoon', targetCount: null, targetMinutes: 180 },
  { id: 'everything', label: 'Everything that fits', targetCount: 999, targetMinutes: null }
];

export default SESSION_SIZES;
