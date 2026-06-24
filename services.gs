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

  const settings = readSettings();
  const payload = {
    events: events,
    scheduleIndex: scheduleIndex,
    sectionSettings: {
      showPreparing: String(settings.show_preparing_section) !== 'false',
      showEnded: String(settings.show_ended_section) !== 'false',
    },
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
    var rawStatus = String(event.status || '');
    var status = (rawStatus === '종료됨' || rawStatus === '모집마감') ? '종료됨' : '준비중';
    return {
      id: event.id,
      name: event.name,
      status: status,
      bookingOpen: event.bookingOpen,
      scheduleCount: scheduleCounts[event.id] || 0,
      reservationCount: reservationCounts[event.id] || 0,
    };
  });

  const settings = readSettings();
  const payload = {
    events: events,
    rows: rows,
    sectionSettings: {
      showPreparing: String(settings.show_preparing_section) !== 'false',
      showEnded: String(settings.show_ended_section) !== 'false',
    },
  };
  return writeCache(dashboardCacheKey(), payload);
}

function getEventDetail(eventId) {
  var cacheKey = eventDetailCacheKey(eventId);
  var cached = readCache(cacheKey);
  if (cached) return cached;

  var events = readEvents();
  var eventRecord = null;
  for (var i = 0; i < events.length; i += 1) {
    if (events[i].id === eventId) {
      eventRecord = events[i];
      break;
    }
  }

  var payload = {
    event: eventRecord,
    schedules: readSchedules(eventId),
    reservations: readReservations(eventId),
    documentSubmissions: readDocumentSubmissions(eventId)
  };

  return writeCache(cacheKey, payload);
}

function saveEventService(data) {
  return withScriptLock(function() {
    // Determine image URL (upload if new file provided)
    var imageUrl = String(data.image || 'images/hero-bg.png').trim();
    if (data.imageBase64 && data.imageFileName) {
      var imageUpload = uploadPublicFileToDrive({
        fileName: String(data.imageFileName),
        mimeType: String(data.imageMimeType || 'image/jpeg'),
        base64: String(data.imageBase64),
        folderName: '스포츠박스 이벤트 이미지',
      });
      imageUrl = imageUpload.directUrl;
    }

    // Determine document template URL (upload if new file provided)
    var docTemplateUrl = String(data.documentTemplateUrl || '').trim();
    if (data.documentTemplateBase64 && data.documentTemplateFileName) {
      var docUpload = uploadPublicFileToDrive({
        fileName: String(data.documentTemplateFileName),
        mimeType: String(data.documentTemplateMimeType || 'application/octet-stream'),
        base64: String(data.documentTemplateBase64),
        folderName: '스포츠박스 서류양식',
      });
      docTemplateUrl = docUpload.downloadUrl;
    }

    // 진행상황(status)과 예약상태(bookingOpen)는 완전히 독립적
    var rawStatus = String(data.status || '').trim();
    var status = (rawStatus === '종료됨' || rawStatus === '모집마감') ? '종료됨' : '준비중';
    var bookingOpen = toBoolean(data.bookingOpen);

    var eventRecord = {
      id: data.id || ('evt_' + Date.now()),
      name: String(data.name || '').trim(),
      description: String(data.description || '').trim(),
      image: imageUrl,
      status: status,
      bookingOpen: bookingOpen,
      videoUrl: String(data.videoUrl || '').trim(),
      documentTemplateUrl: docTemplateUrl,
    };

    if (!eventRecord.name) {
      return errorResponse('Missing name');
    }

    upsertEventRecord(eventRecord);
    invalidateEventCaches(eventRecord.id);
    return successResponse(eventRecord);
  });
}

function saveSettingsService(data) {
  return withScriptLock(function() {
    var allowed = ['show_preparing_section', 'show_ended_section'];
    for (var i = 0; i < allowed.length; i++) {
      var key = allowed[i];
      if (key in data) {
        updateSettingValue(key, String(data[key]));
      }
    }
    deleteCacheKeys([catalogCacheKey(), dashboardCacheKey()]);
    return successResponse(true);
  });
}

function uploadPublicFileToDrive(options) {
  var folderName = options.folderName || DEFAULT_DOCUMENT_FOLDER_NAME;
  var folder;
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }

  var originalName = String(options.fileName || 'file').trim() || 'file';
  var uniqueName = originalName;
  if (folder.getFilesByName(uniqueName).hasNext()) {
    var parts = splitFileName(originalName);
    var suffix = 2;
    while (folder.getFilesByName(parts.base + ' (' + suffix + ')' + parts.extension).hasNext()) {
      suffix += 1;
    }
    uniqueName = parts.base + ' (' + suffix + ')' + parts.extension;
  }

  var blob = Utilities.newBlob(
    Utilities.base64Decode(options.base64),
    options.mimeType,
    uniqueName,
  );
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileId = file.getId();
  return {
    fileId: fileId,
    directUrl: 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + fileId,
    viewUrl: file.getUrl(),
  };
}

function submitDocumentService(data) {
  return withScriptLock(function() {
    const eventId = String(data.eventId || '').trim();
    const fileName = String(data.fileName || '').trim();
    const mimeType = String(data.mimeType || '').trim();
    const base64 = String(data.base64 || '').trim();

    if (!eventId || !fileName || !mimeType || !base64) {
      return errorResponse('Invalid payload');
    }

    const eventRecord = readEvents().filter(function(item) {
      return item.id === eventId;
    })[0] || null;
    if (!eventRecord) {
      return errorResponse('Event not found');
    }

    const submission = {
      id: `doc_${Date.now()}`,
      eventId: eventId,
      eventName: String(data.eventName || eventRecord.name || '').trim(),
      groupName: String(data.groupName || '').trim(),
      manager: String(data.manager || '').trim(),
      contact: String(data.contact || '').trim(),
      fileName: fileName,
      mimeType: mimeType,
      createdAt: String(data.createdAt || createTimestamp()),
    };

    const upload = saveBase64FileToDrive({
      eventName: eventRecord.name,
      groupName: submission.groupName,
      manager: submission.manager,
      fileName: submission.fileName,
      mimeType: submission.mimeType,
      base64: base64,
    });

    submission.fileUrl = upload.fileUrl;
    submission.fileId = upload.fileId;

    insertDocumentSubmissionRecord(submission);
    invalidateEventCaches(eventId);
    return successResponse({
      id: submission.id,
      fileUrl: submission.fileUrl,
      fileId: submission.fileId,
    });
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
      createdAt: createTimestamp(),
    };

    if (!reservation.groupName || !reservation.manager || reservation.participants < 1) {
      return errorResponse('Invalid reservation');
    }

    insertReservationRecord(reservation);
    invalidateEventCaches(eventId);
    return successResponse({ id: reservation.id });
  });
}

function updateReservationService(data) {
  return withScriptLock(function() {
    var reservationId = String(data.id || '').trim();
    var eventId = String(data.eventId || '').trim();
    var date = normalizeDateValue(data.date);
    if (!reservationId || !eventId || !date) return errorResponse('Invalid payload');

    var reservation = {
      id: reservationId,
      eventId: eventId,
      eventName: String(data.eventName || ''),
      date: date,
      groupName: String(data.groupName || '').trim(),
      manager: String(data.manager || '').trim(),
      contact: String(data.contact || '').trim(),
      participants: Number(data.participants || 0),
      status: String(data.status || '대기'),
      createdAt: String(data.createdAt || createTimestamp())
    };

    if (!reservation.groupName || !reservation.manager || reservation.participants < 1) {
      return errorResponse('Invalid reservation');
    }

    var updated = updateReservationRecord(reservation);
    if (!updated) return errorResponse('Not found');

    invalidateEventCaches(eventId);
    return successResponse(updated);
  });
}

function deleteReservationService(data) {
  return withScriptLock(function() {
    var reservationId = String(data.id || '').trim();
    var eventId = String(data.eventId || '').trim();
    if (!reservationId) return errorResponse('Missing reservation id');

    var result = removeReservationRecord(reservationId, eventId);
    if (!result.success) return result;

    invalidateEventCaches(eventId);
    return result;
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

function saveBase64FileToDrive(options) {
  const folder = getDocumentDriveFolder();
  const uniqueFileName = buildUniqueDriveFileName(folder, String(options.fileName || 'document'));
  const blob = Utilities.newBlob(
    Utilities.base64Decode(options.base64),
    options.mimeType,
    uniqueFileName,
  );
  const file = folder.createFile(blob);
  file.setDescription(
    options.groupName || options.manager
      ? `${options.eventName} 제출서류 / ${options.groupName} / ${options.manager}`
      : `${options.eventName} 제출서류`,
  );

  return {
    fileId: file.getId(),
    fileUrl: file.getUrl(),
  };
}

function buildUniqueDriveFileName(folder, fileName) {
  const originalName = String(fileName || 'document').trim() || 'document';
  if (!folder.getFilesByName(originalName).hasNext()) {
    return originalName;
  }

  const parts = splitFileName(originalName);
  let suffix = 2;

  while (folder.getFilesByName(`${parts.base} (${suffix})${parts.extension}`).hasNext()) {
    suffix += 1;
  }

  return `${parts.base} (${suffix})${parts.extension}`;
}

function splitFileName(fileName) {
  const match = String(fileName || '').match(/^(.*?)(\.[^.]*)?$/);
  return {
    base: String(match && match[1] ? match[1] : 'document') || 'document',
    extension: String(match && match[2] ? match[2] : ''),
  };
}

function getDocumentDriveFolder() {
  const settings = readSettings();
  const configuredId = String(settings.document_drive_folder_id || '').trim();

  if (configuredId) {
    return DriveApp.getFolderById(configuredId);
  }

  const folders = DriveApp.getFoldersByName(DEFAULT_DOCUMENT_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder(DEFAULT_DOCUMENT_FOLDER_NAME);
}

function migrateLegacyAdminPassword() {
  ensureSettingsDefaults();
  const settings = readSettings();
  if (String(settings.admin_pw || '') === LEGACY_ADMIN_HASH) {
    updateSettingValue('admin_pw', DEFAULT_ADMIN_HASH);
  }
}
