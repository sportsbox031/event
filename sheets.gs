function openSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(name) {
  return openSpreadsheet().getSheetByName(name);
}

function ensureSheet(name, headers) {
  const spreadsheet = openSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    sheet.appendRow(headers);
    return sheet;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  headers.forEach(function(header, index) {
    if (currentHeaders[index] !== header) {
      sheet.getRange(1, index + 1).setValue(header);
    }
  });

  return sheet;
}

function initSheets() {
  const eventsSheet = ensureSheet(SHEET_EVENTS, EVENT_HEADERS);
  const schedulesSheet = ensureSheet(SHEET_SCHEDULES, SCHEDULE_HEADERS);
  ensureSheet(SHEET_RESERVATIONS, RESERVATION_HEADERS);
  ensureSheet(SHEET_DOCUMENT_SUBMISSIONS, DOCUMENT_SUBMISSION_HEADERS);
  const settingsSheet = ensureSheet(SHEET_SETTINGS, SETTINGS_HEADERS);

  if (eventsSheet.getLastRow() === 1) {
    eventsSheet.getRange(2, 1, 2, EVENT_HEADERS.length).setValues([
      ['evt1', '마주(馬走)하는 승마교실', '말과 함께하는 특별한 체험! 전문 강사의 안전한 지도 아래 승마의 기초부터 배워보세요.', 'images/horse-riding.svg', '모집중', false, '', DEFAULT_HORSE_EVENT_TEMPLATE_URL],
      ['evt2', '설래(雪來)는 스키교실', '겨울 스포츠의 꽃, 스키! 초보자도 쉽게 배울 수 있는 맞춤형 스키 교실입니다.', 'images/skiing.svg', '모집중', false, 'https://www.youtube.com/watch?v=g8ZcvhQWQ_0', ''],
    ]);
  }
  ensureDefaultEventDocumentLinks(eventsSheet);

  if (schedulesSheet.getLastRow() === 0) {
    schedulesSheet.appendRow(SCHEDULE_HEADERS);
  }

  if (settingsSheet.getLastRow() === 1) {
    settingsSheet.getRange(2, 1, 2, 2).setValues([
      ['admin_id', DEFAULT_ADMIN_ID],
      ['admin_pw', DEFAULT_ADMIN_HASH],
    ]);
  } else {
    ensureSettingsDefaults();
  }
}

function ensureSettingsDefaults() {
  const sheet = ensureSheet(SHEET_SETTINGS, SETTINGS_HEADERS);
  const data = sheet.getDataRange().getValues();
  const keys = data.slice(1).map(function(row) { return row[0]; });

  if (keys.indexOf('admin_id') === -1) {
    sheet.appendRow(['admin_id', DEFAULT_ADMIN_ID]);
  }

  if (keys.indexOf('admin_pw') === -1) {
    sheet.appendRow(['admin_pw', DEFAULT_ADMIN_HASH]);
  }

  if (keys.indexOf('document_drive_folder_id') === -1) {
    sheet.appendRow(['document_drive_folder_id', '']);
  }
}

function ensureDefaultEventDocumentLinks(eventsSheet) {
  const data = eventsSheet.getDataRange().getValues();
  for (let index = 1; index < data.length; index += 1) {
    const eventId = String(data[index][0] || '');
    const currentTemplateUrl = String(data[index][7] || '').trim();
    if (eventId === 'evt1' && !currentTemplateUrl) {
      eventsSheet.getRange(index + 1, 8).setValue(DEFAULT_HORSE_EVENT_TEMPLATE_URL);
    }
  }
}
