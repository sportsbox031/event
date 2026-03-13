function getCache() {
  return CacheService.getScriptCache();
}

function readCache(key) {
  const raw = getCache().get(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function writeCache(key, value, ttlSeconds) {
  getCache().put(key, JSON.stringify(value), ttlSeconds || CACHE_TTL_SECONDS);
  return value;
}

function deleteCacheKeys(keys) {
  if (!keys || !keys.length) return;
  getCache().removeAll(keys);
}

function catalogCacheKey() {
  return 'catalog:v2';
}

function eventsCacheKey() {
  return 'events:v2';
}

function schedulesCacheKey(eventId) {
  return eventId ? `schedules:v2:${eventId}` : 'schedules:v2:all';
}

function reservationsCacheKey(eventId) {
  return eventId ? `reservations:v2:${eventId}` : 'reservations:v2:all';
}

function dashboardCacheKey() {
  return 'admin-dashboard:v2';
}

function eventDetailCacheKey(eventId) {
  return `event-detail:v2:${eventId}`;
}

function invalidateEventCaches(eventId) {
  deleteCacheKeys([
    catalogCacheKey(),
    eventsCacheKey(),
    dashboardCacheKey(),
    schedulesCacheKey(),
    schedulesCacheKey(eventId),
    reservationsCacheKey(),
    reservationsCacheKey(eventId),
    eventDetailCacheKey(eventId),
  ]);
}
