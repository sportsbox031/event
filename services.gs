function getCatalog() {
  const cached = readCache(catalogCacheKey());
  if (cached) return cached;

  const events = readEvents();
  const openEventIds = events.filter(function(item) {
    return item.bookingOpen;
  }).map(function(item) {
    return item.id;
  });
  const allSchedules = readSchedules();

  let scheduleIndex = {};
  if (allSchedules.length <= CATALOG_PREFETCH_LIMIT) {
    scheduleIndex = allSchedules.reduce(function(index, schedule) {
      if (!index[schedule.eventId]) index[schedule.eventId] = [];
      index[schedule.eventId].push(schedule.date);
      return index;
    }, {});
  } else {
    scheduleIndex = allSchedules.reduce(function(index, schedule) {
      if (openEventIds.indexOf(schedule.eventId) === -1) return index;
      if (!index[schedule.eventId]) index[schedule.eventId] = [];
      index[schedule.eventId].push(schedule.date);
      return index;
    }, {});
  }

  const payload = {
    events: events,
    scheduleIndex: scheduleIndex,
    meta: {
      scheduleMode: allSchedules.length <= CATALOG_PREFETCH_LIMIT ? 'all' : 'bookingOpenOnly',
    },
  };

  return writeCache(catalogCacheKey(), payload);
}

function getEvents() {
  return readEvents();
}

function getSchedules(eventId) {
  return readSchedules(eventId);
}

function getReservations(eventId) {
  return readReservations(eventId);
}

function getSettings() {
  return readSettings();
}

function getAdminDashboard() {
  const cached = readCache(dashboardCacheKey());
  if (cached) return cached;

  const events = readEvents();
  const scheduleCounts = readScheduleCounts();
  const reservationCounts = readReservationCounts();

  const rows = events.map(function(event) {
    return {
      id: event.id,
      name: event.name,
      status: event.bookingOpen ? '모집중' : '준비중',
      bookingOpen: event.bookingOpen,
      scheduleCount: scheduleCounts[event.id] || 0,
      reservationCount: reservationCounts[event.id] || 0,
    };
  });

  const payload = { events: events, rows: rows };
  return writeCache(dashboardCacheKey(), payload);
}

function getEventDetail(eventId) {
  const cacheKey = eventDetailCacheKey(eventId);
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const eventRecord = readEvents().filter(function(item) {
    return item.id === eventId;
  })[0] || null;

  const payload = {
    event: eventRecord,
    schedules: readSchedules(eventId),
    reservations: readReservations(eventId),
  };

  return writeCache(cacheKey, payload);
}

function saveEventService(data) {
  return withScriptLock(function() {
    const bookingOpen = toBoolean(data.bookingOpen);
    const eventRecord = {
      id: data.id || `evt_${Date.now()}`,
      name: String(data.name || '').trim(),
      description: String(data.description || '').trim(),
      image: String(data.image || 'images/hero-bg.png').trim(),
      status: bookingOpen ? '모집중' : '준비중',
      bookingOpen: bookingOpen,
      videoUrl: String(data.videoUrl || '').trim(),
    };

    if (!eventRecord.name) {
      return errorResponse('Missing name');
    }

    upsertEventRecord(eventRecord);
    invalidateEventCaches(eventRecord.id);
    return successResponse(eventRecord);
  });
}

function deleteEventService(eventId) {
  return withScriptLock(function() {
    if (!eventId) return errorResponse('Missing event id');
    deleteEventRecord(eventId);
    invalidateEventCaches(eventId);
    return successResponse(true);
  });
}

function addScheduleService(data) {
  return withScriptLock(function() {
    const eventId = String(data.eventId || '');
    const date = normalizeDateValue(data.date);
    if (!eventId || !date) return errorResponse('Invalid payload');

    const result = insertScheduleRecord({ eventId: eventId, date: date });
    invalidateEventCaches(eventId);
    return result;
  });
}

function deleteScheduleService(data) {
  return withScriptLock(function() {
    const eventId = String(data.eventId || '');
    const date = normalizeDateValue(data.date);
    if (!eventId || !date) return errorResponse('Invalid payload');

    const result = removeScheduleRecord(eventId, date);
    invalidateEventCaches(eventId);
    return result;
  });
}

function addReservationService(data) {
  return withScriptLock(function() {
    const eventId = String(data.eventId || '');
    const date = normalizeDateValue(data.date);
    if (!eventId || !date) return errorResponse('Invalid payload');

    const reservation = {
      id: `res_${Date.now()}`,
      eventId: eventId,
      eventName: String(data.eventName || ''),
      date: date,
      groupName: String(data.groupName || '').trim(),
      manager: String(data.manager || '').trim(),
      contact: String(data.contact || '').trim(),
      participants: Number(data.participants || 0),
      status: String(data.status || '대기'),
      createdAt: String(data.createdAt || createTimestamp()),
    };

    if (!reservation.groupName || !reservation.manager || reservation.participants < 1) {
      return errorResponse('Invalid reservation');
    }

    insertReservationRecord(reservation);
    invalidateEventCaches(eventId);
    return successResponse({ id: reservation.id });
  });
}

function adminLoginService(data) {
  migrateLegacyAdminPassword();
  const settings = readSettings();
  const adminId = settings.admin_id || DEFAULT_ADMIN_ID;
  const adminHash = settings.admin_pw || DEFAULT_ADMIN_HASH;

  if (!data.id || !data.hash) return errorResponse('Missing credentials');
  if (String(data.id) !== String(adminId) || String(data.hash) !== String(adminHash)) {
    return errorResponse('Invalid credentials');
  }

  return successResponse({
    adminId: adminId,
    dashboard: getAdminDashboard(),
  });
}

function changePasswordService(data) {
  return withScriptLock(function() {
    migrateLegacyAdminPassword();
    const settings = readSettings();
    const adminId = settings.admin_id || DEFAULT_ADMIN_ID;
    const adminHash = settings.admin_pw || DEFAULT_ADMIN_HASH;

    if (!data.id || !data.currentHash || !data.newHash) {
      return errorResponse('Invalid payload');
    }

    if (String(data.id) !== String(adminId) || String(data.currentHash) !== String(adminHash)) {
      return errorResponse('Current password mismatch');
    }

    updateSettingValue('admin_pw', String(data.newHash));
    return successResponse(true);
  });
}

function migrateLegacyAdminPassword() {
  ensureSettingsDefaults();
  const settings = readSettings();
  if (String(settings.admin_pw || '') === LEGACY_ADMIN_HASH) {
    updateSettingValue('admin_pw', DEFAULT_ADMIN_HASH);
  }
}
