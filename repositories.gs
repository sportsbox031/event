function readEvents() {
  const cached = readCache(eventsCacheKey());
  if (cached) return cached;

  const sheet = ensureSheet(SHEET_EVENTS, EVENT_HEADERS);
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1).map(function(row) {
    const eventId = String(row[0] || '');
    const documentTemplateUrl = String(row[7] || '');
    return {
      id: eventId,
      name: String(row[1] || ''),
      description: String(row[2] || ''),
      image: String(row[3] || ''),
      status: String(row[4] || ''),
      bookingOpen: toBoolean(row[5]),
      videoUrl: String(row[6] || ''),
      documentTemplateUrl: documentTemplateUrl || (eventId === 'evt1' ? DEFAULT_HORSE_EVENT_TEMPLATE_URL : ''),
    };
  }).filter(function(item) {
    return item.id;
  });

  return writeCache(eventsCacheKey(), rows);
}

function readSchedules(eventId) {
  const cacheKey = schedulesCacheKey(eventId);
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const sheet = ensureSheet(SHEET_SCHEDULES, SCHEDULE_HEADERS);
  const data = sheet.getDataRange().getValues();
  let rows = data.slice(1).map(function(row) {
    return {
      eventId: String(row[0] || ''),
      date: normalizeDateValue(row[1]),
    };
  }).filter(function(item) {
    return item.eventId && item.date;
  });

  if (eventId) {
    rows = rows.filter(function(item) {
      return item.eventId === eventId;
    });
  }

  rows.sort(function(left, right) {
    return left.date.localeCompare(right.date);
  });

  return writeCache(cacheKey, rows);
}

function readScheduleCounts() {
  const cacheKey = scheduleCountsCacheKey();
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const sheet = ensureSheet(SHEET_SCHEDULES, SCHEDULE_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return writeCache(cacheKey, {});
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const counts = {};
  values.forEach(function(row) {
    const eventId = String(row[0] || '');
    if (!eventId) return;
    counts[eventId] = (counts[eventId] || 0) + 1;
  });

  return writeCache(cacheKey, counts);
}

function readReservations(eventId) {
  const cacheKey = reservationsCacheKey(eventId);
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const sheet = ensureSheet(SHEET_RESERVATIONS, RESERVATION_HEADERS);
  const data = sheet.getDataRange().getValues();
  let rows = data.slice(1).map(function(row) {
    return {
      id: String(row[0] || ''),
      eventId: String(row[1] || ''),
      eventName: String(row[2] || ''),
      date: normalizeDateValue(row[3]),
      groupName: String(row[4] || ''),
      manager: String(row[5] || ''),
      contact: String(row[6] || ''),
      participants: Number(row[7] || 0),
      status: String(row[8] || ''),
      createdAt: String(row[9] || ''),
    };
  }).filter(function(item) {
    return item.id && item.eventId;
  });

  if (eventId) {
    rows = rows.filter(function(item) {
      return item.eventId === eventId;
    });
  }

  rows.sort(function(left, right) {
    return String(right.createdAt).localeCompare(String(left.createdAt));
  });

  return writeCache(cacheKey, rows);
}

function readDocumentSubmissions(eventId) {
  const sheet = ensureSheet(SHEET_DOCUMENT_SUBMISSIONS, DOCUMENT_SUBMISSION_HEADERS);
  const data = sheet.getDataRange().getValues();
  let rows = data.slice(1).map(function(row) {
    return {
      id: String(row[0] || ''),
      eventId: String(row[1] || ''),
      eventName: String(row[2] || ''),
      groupName: String(row[3] || ''),
      manager: String(row[4] || ''),
      contact: String(row[5] || ''),
      fileName: String(row[6] || ''),
      fileUrl: String(row[7] || ''),
      fileId: String(row[8] || ''),
      mimeType: String(row[9] || ''),
      createdAt: String(row[10] || ''),
    };
  }).filter(function(item) {
    return item.id && item.eventId;
  });

  if (eventId) {
    rows = rows.filter(function(item) {
      return item.eventId === eventId;
    });
  }

  rows.sort(function(left, right) {
    return String(right.createdAt).localeCompare(String(left.createdAt));
  });

  return rows;
}

function readReservationCounts() {
  const cacheKey = reservationCountsCacheKey();
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const sheet = ensureSheet(SHEET_RESERVATIONS, RESERVATION_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return writeCache(cacheKey, {});
  }

  const values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  const counts = {};
  values.forEach(function(row) {
    const eventId = String(row[0] || '');
    if (!eventId) return;
    counts[eventId] = (counts[eventId] || 0) + 1;
  });

  return writeCache(cacheKey, counts);
}

function readSettings() {
  ensureSettingsDefaults();
  const sheet = ensureSheet(SHEET_SETTINGS, SETTINGS_HEADERS);
  const data = sheet.getDataRange().getValues();

  return data.slice(1).reduce(function(settings, row) {
    settings[row[0]] = row[1];
    return settings;
  }, {});
}

function upsertEventRecord(eventRecord) {
  const sheet = ensureSheet(SHEET_EVENTS, EVENT_HEADERS);
  const data = sheet.getDataRange().getValues();
  const payload = [
    eventRecord.id,
    eventRecord.name,
    eventRecord.description,
    eventRecord.image,
    eventRecord.status,
    toBoolean(eventRecord.bookingOpen),
    eventRecord.videoUrl || '',
    eventRecord.documentTemplateUrl || '',
  ];

  for (let index = 1; index < data.length; index += 1) {
    if (String(data[index][0]) === eventRecord.id) {
      sheet.getRange(index + 1, 1, 1, payload.length).setValues([payload]);
      return eventRecord;
    }
  }

  sheet.appendRow(payload);
  return eventRecord;
}

function deleteEventRecord(eventId) {
  const eventsSheet = ensureSheet(SHEET_EVENTS, EVENT_HEADERS);
  const schedulesSheet = ensureSheet(SHEET_SCHEDULES, SCHEDULE_HEADERS);
  const reservationsSheet = ensureSheet(SHEET_RESERVATIONS, RESERVATION_HEADERS);

  deleteRowsByValue(eventsSheet, 1, eventId);
  deleteRowsByValue(schedulesSheet, 1, eventId);
  deleteRowsByValue(reservationsSheet, 2, eventId);
}

function insertScheduleRecord(scheduleRecord) {
  const sheet = ensureSheet(SHEET_SCHEDULES, SCHEDULE_HEADERS);
  const schedules = readSchedules(scheduleRecord.eventId);

  const duplicate = schedules.some(function(item) {
    return item.date === scheduleRecord.date;
  });
  if (duplicate) {
    return errorResponse('Duplicate schedule');
  }

  sheet.appendRow([scheduleRecord.eventId, scheduleRecord.date]);
  return successResponse(scheduleRecord);
}

function removeScheduleRecord(eventId, date) {
  const sheet = ensureSheet(SHEET_SCHEDULES, SCHEDULE_HEADERS);
  const deleted = deleteRowsByMatch(sheet, function(row) {
    return String(row[0] || '') === eventId && normalizeDateValue(row[1]) === date;
  });

  return deleted ? successResponse(true) : errorResponse('Not found');
}

function insertReservationRecord(record) {
  const sheet = ensureSheet(SHEET_RESERVATIONS, RESERVATION_HEADERS);
  sheet.appendRow([
    record.id,
    record.eventId,
    record.eventName,
    record.date,
    record.groupName,
    record.manager,
    sanitizeContact(record.contact),
    record.participants,
    record.status,
    record.createdAt,
  ]);
  return record;
}

function insertDocumentSubmissionRecord(record) {
  const sheet = ensureSheet(SHEET_DOCUMENT_SUBMISSIONS, DOCUMENT_SUBMISSION_HEADERS);
  sheet.appendRow([
    record.id,
    record.eventId,
    record.eventName,
    record.groupName,
    record.manager,
    sanitizeContact(record.contact),
    record.fileName,
    record.fileUrl,
    record.fileId,
    record.mimeType,
    record.createdAt,
  ]);
  return record;
}

function updateSettingValue(key, value) {
  const sheet = ensureSheet(SHEET_SETTINGS, SETTINGS_HEADERS);
  const data = sheet.getDataRange().getValues();

  for (let index = 1; index < data.length; index += 1) {
    if (String(data[index][0]) === key) {
      sheet.getRange(index + 1, 2).setValue(value);
      return;
    }
  }

  sheet.appendRow([key, value]);
}

function deleteRowsByValue(sheet, columnIndex, value) {
  deleteRowsByMatch(sheet, function(row) {
    return String(row[columnIndex - 1] || '') === value;
  });
}

function deleteRowsByMatch(sheet, predicate) {
  const data = sheet.getDataRange().getValues();
  const rowsToDelete = [];

  for (let index = 1; index < data.length; index += 1) {
    if (predicate(data[index])) {
      rowsToDelete.push(index + 1);
    }
  }

  for (let i = rowsToDelete.length - 1; i >= 0; i -= 1) {
    sheet.deleteRow(rowsToDelete[i]);
  }

  return rowsToDelete.length > 0;
}
