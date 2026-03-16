// Z-FLOW Build version — single source of truth for SW cache-busting.
// To release a new version: update ZFLOW_BUILD below. The SW cache name
// is derived from this value so stale caches are evicted automatically.
const ZFLOW_BUILD = 'v63.6';
if (typeof window !== 'undefined') window.ZFLOW_BUILD = ZFLOW_BUILD;
