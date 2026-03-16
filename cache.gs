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
  return 'catalog:v3';
}

function eventsCacheKey() {
  return 'events:v3';
}

function schedulesCacheKey(eventId) {
  return eventId ? `schedules:v3:${eventId}` : 'schedules:v3:all';
}

function reservationsCacheKey(eventId) {
  return eventId ? `reservations:v3:${eventId}` : 'reservations:v3:all';
}

function dashboardCacheKey() {
  return 'admin-dashboard:v3';
}

function scheduleCountsCacheKey() {
  return 'schedule-counts:v1';
}

function reservationCountsCacheKey() {
  return 'reservation-counts:v1';
}

function eventDetailCacheKey(eventId) {
  return `event-detail:v3:${eventId}`;
}

function invalidateEventCaches(eventId) {
  deleteCacheKeys([
    catalogCacheKey(),
    eventsCacheKey(),
    dashboardCacheKey(),
    scheduleCountsCacheKey(),
    reservationCountsCacheKey(),
    schedulesCacheKey(),
    schedulesCacheKey(eventId),
    reservationsCacheKey(),
    reservationsCacheKey(eventId),
    eventDetailCacheKey(eventId),
  ]);
}
