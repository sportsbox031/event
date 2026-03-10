/**
 * 경기도체육회 스포츠박스 - 스포츠이벤트 예약시스템 백엔드
 * Google Apps Script (code.gs)
 *
 * 사용법:
 * 1. Google Sheets에서 확장 프로그램 > Apps Script 열기
 * 2. 이 코드를 붙여넣기
 * 3. 배포 > 새 배포 > 웹 앱으로 배포
 * 4. 액세스 권한: "모든 사용자"로 설정
 * 5. 배포된 URL을 app.js와 admin.js의 API_URL에 입력
 */

const SPREADSHEET_ID = '19MeVM71T7xxjjGptoWa1UdEnnt6CBjUJdkihkLhcpKE'; // 구글 시트 ID를 여기에 입력하세요
const DEFAULT_ADMIN_ID = 'admin';
const DEFAULT_ADMIN_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'; // SHA-256(admin123)
const LEGACY_ADMIN_HASH = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3'; // SHA-256(123)
const APP_TZ = 'Asia/Seoul';

// ===== Sheet Names =====
const SHEET_EVENTS = '이벤트';
const SHEET_SCHEDULES = '일정';
const SHEET_RESERVATIONS = '예약';
const SHEET_SETTINGS = '설정';

// ===== Initialize Sheets =====
function initSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 이벤트 시트
  let evtSheet = ss.getSheetByName(SHEET_EVENTS);
  if (!evtSheet) {
    evtSheet = ss.insertSheet(SHEET_EVENTS);
    evtSheet.appendRow(['id', 'name', 'description', 'image', 'status', 'bookingOpen', 'videoUrl']);
    // 기본 데이터
    evtSheet.appendRow(['evt1', '마주(馬走)하는 승마교실', '말과 함께하는 특별한 체험! 전문 강사의 안전한 지도 아래 승마의 기초부터 배워보세요.', 'images/horse-riding.svg', '모집중', false, '']);
    evtSheet.appendRow(['evt2', '설래(雪來)는 스키교실', '겨울 스포츠의 꽃, 스키! 초보자도 쉽게 배울 수 있는 맞춤형 스키 교실입니다.', 'images/skiing.svg', '모집중', false, 'https://www.youtube.com/watch?v=g8ZcvhQWQ_0']);
  } else {
    const headers = evtSheet.getRange(1, 1, 1, evtSheet.getLastColumn()).getValues()[0];
    if (headers.indexOf('bookingOpen') === -1) {
      evtSheet.getRange(1, headers.length + 1).setValue('bookingOpen');
      const lastRow = evtSheet.getLastRow();
      if (lastRow > 1) {
        evtSheet.getRange(2, headers.length + 1, lastRow - 1, 1).setValue(false);
      }
    }
    const latestHeaders = evtSheet.getRange(1, 1, 1, evtSheet.getLastColumn()).getValues()[0];
    if (latestHeaders.indexOf('videoUrl') === -1) {
      evtSheet.getRange(1, latestHeaders.length + 1).setValue('videoUrl');
      const lastRow = evtSheet.getLastRow();
      if (lastRow > 1) {
        evtSheet.getRange(2, latestHeaders.length + 1, lastRow - 1, 1).setValue('');
      }
    }
  }

  // 일정 시트
  let schSheet = ss.getSheetByName(SHEET_SCHEDULES);
  if (!schSheet) {
    schSheet = ss.insertSheet(SHEET_SCHEDULES);
    schSheet.appendRow(['eventId', 'date']);
  } else {
    const schHeaders = schSheet.getRange(1, 1, 1, schSheet.getLastColumn()).getValues()[0];
    const capacityIdx = schHeaders.findIndex(h => h === 'minParticipants' || h === 'capacity');
    if (capacityIdx !== -1) {
      schSheet.deleteColumn(capacityIdx + 1);
    }
    if (schSheet.getRange(1, 1).getValue() !== 'eventId') schSheet.getRange(1, 1).setValue('eventId');
    if (schSheet.getRange(1, 2).getValue() !== 'date') schSheet.getRange(1, 2).setValue('date');
  }

  // 예약 시트
  let resSheet = ss.getSheetByName(SHEET_RESERVATIONS);
  if (!resSheet) {
    resSheet = ss.insertSheet(SHEET_RESERVATIONS);
    resSheet.appendRow(['id', 'eventId', 'eventName', 'date', 'groupName', 'manager', 'contact', 'participants', 'status', 'createdAt']);
  }

  // 설정 시트
  let setSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!setSheet) {
    setSheet = ss.insertSheet(SHEET_SETTINGS);
    setSheet.appendRow(['key', 'value']);
    setSheet.appendRow(['admin_pw', DEFAULT_ADMIN_HASH]);
    setSheet.appendRow(['admin_id', DEFAULT_ADMIN_ID]);
  } else {
    const settings = getSettings();
    if (!settings.admin_id) {
      setSheet.appendRow(['admin_id', DEFAULT_ADMIN_ID]);
    }
    if (!settings.admin_pw) {
      setSheet.appendRow(['admin_pw', DEFAULT_ADMIN_HASH]);
    }
  }
}

// ===== GET Handler =====
function doGet(e) {
  const action = e.parameter.action;
  let result;

  switch(action) {
    case 'getEvents':
      result = getEvents();
      break;
    case 'getSchedules':
      result = getSchedules(e.parameter.eventId);
      break;
    case 'getReservations':
      result = getReservations(e.parameter.eventId);
      break;
    case 'getSettings':
      result = getSettings();
      break;
    default:
      result = { error: 'Unknown action' };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== POST Handler =====
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid JSON' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const action = body.action;
  const data = body.data;
  let result;

  switch(action) {
    case 'addReservation':
      result = addReservation(data);
      break;
    case 'saveEvent':
      result = saveEvent(data);
      break;
    case 'deleteEvent':
      result = deleteEvent(data.id);
      break;
    case 'addSchedule':
      result = addSchedule(data);
      break;
    case 'deleteSchedule':
      result = deleteSchedule(data.eventId, data.date);
      break;
    case 'changePassword':
      result = changePassword(data.id, data.currentHash, data.newHash);
      break;
    case 'adminLogin':
      result = adminLogin(data.id, data.hash);
      break;
    default:
      result = { error: 'Unknown action' };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== Event Functions =====
function getEvents() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_EVENTS);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  return data.slice(1).map(row => ({
    id: row[0],
    name: row[1],
    description: row[2],
    image: row[3],
    status: row[4],
    bookingOpen: row[5] === true || row[5] === 'true' || row[5] === 1 || row[5] === '1',
    videoUrl: row[6] || (row[0] === 'evt2' ? 'https://www.youtube.com/watch?v=g8ZcvhQWQ_0' : '')
  }));
}

function saveEvent(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_EVENTS);
  if (sheet.getRange(1, 6).getValue() !== 'bookingOpen') {
    sheet.getRange(1, 6).setValue('bookingOpen');
  }
  if (sheet.getRange(1, 7).getValue() !== 'videoUrl') {
    sheet.getRange(1, 7).setValue('videoUrl');
  }
  const allData = sheet.getDataRange().getValues();

  if (data.id) {
    // Update existing
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][0] === data.id) {
        sheet.getRange(i + 1, 2).setValue(data.name);
        sheet.getRange(i + 1, 3).setValue(data.description);
        sheet.getRange(i + 1, 4).setValue(data.image);
        sheet.getRange(i + 1, 5).setValue(data.status);
        sheet.getRange(i + 1, 6).setValue(data.bookingOpen === true || data.bookingOpen === 'true');
        sheet.getRange(i + 1, 7).setValue(data.videoUrl || '');
        return { success: true, message: 'Updated' };
      }
    }
    // If not found, add new
    sheet.appendRow([data.id, data.name, data.description, data.image, data.status, data.bookingOpen === true || data.bookingOpen === 'true', data.videoUrl || '']);
  } else {
    // Add new
    const newId = 'evt_' + new Date().getTime();
    sheet.appendRow([newId, data.name, data.description, data.image, data.status, data.bookingOpen === true || data.bookingOpen === 'true', data.videoUrl || '']);
    data.id = newId;
  }

  return { success: true, data: data };
}

function deleteEvent(id) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_EVENTS);
  const allData = sheet.getDataRange().getValues();

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0] === id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Not found' };
}

// ===== Schedule Functions =====
function getSchedules(eventId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SCHEDULES);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  let results = data.slice(1)
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      obj.date = normalizeDateValue(obj.date);
      return obj;
    });

  if (eventId) {
    results = results.filter(s => s.eventId === eventId);
  }

  return results;
}

function addSchedule(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SCHEDULES);

  const targetDate = normalizeDateValue(data.date);
  if (!targetDate) return { error: 'Invalid date' };

  // Check duplicate
  const allData = sheet.getDataRange().getValues();
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0] === data.eventId && normalizeDateValue(allData[i][1]) === targetDate) {
      return { error: 'Duplicate schedule' };
    }
  }

  sheet.appendRow([data.eventId, targetDate]);
  return { success: true };
}

function deleteSchedule(eventId, date) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SCHEDULES);
  const allData = sheet.getDataRange().getValues();

  const targetDate = normalizeDateValue(date);
  if (!targetDate) return { error: 'Invalid date' };

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0] === eventId && normalizeDateValue(allData[i][1]) === targetDate) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Not found' };
}

// ===== Reservation Functions =====
function getReservations(eventId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_RESERVATIONS);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  let results = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    obj.date = normalizeDateValue(obj.date);
    return obj;
  });

  if (eventId) {
    results = results.filter(r => r.eventId === eventId);
  }

  return results;
}

function addReservation(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_RESERVATIONS);

  const id = 'res_' + new Date().getTime();
  const rawContact = data.contact == null ? '' : String(data.contact);
  const safeContact = rawContact.startsWith("'") ? rawContact : "'" + rawContact;
  sheet.appendRow([
    id,
    data.eventId,
    data.eventName,
    data.date,
    data.groupName,
    data.manager,
    safeContact,
    data.participants,
    data.status || '대기',
    data.createdAt || new Date().toLocaleString('ko-KR')
  ]);

  return { success: true, id: id };
}

// ===== Settings =====
function getSettings() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) return {};

  const data = sheet.getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < data.length; i++) {
    settings[data[i][0]] = data[i][1];
  }
  return settings;
}

function adminLogin(id, hash) {
  migrateLegacyAdminPassword();
  const settings = getSettings();
  const adminId = settings.admin_id || DEFAULT_ADMIN_ID;
  const adminHash = settings.admin_pw || DEFAULT_ADMIN_HASH;

  if (!id || !hash) {
    return { success: false, error: 'Missing credentials' };
  }

  if (id !== adminId || hash !== adminHash) {
    return { success: false, error: 'Invalid credentials' };
  }

  return { success: true };
}

function changePassword(id, currentHash, newHash) {
  migrateLegacyAdminPassword();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  const data = sheet.getDataRange().getValues();
  const settings = getSettings();
  const adminId = settings.admin_id || DEFAULT_ADMIN_ID;
  const adminHash = settings.admin_pw || DEFAULT_ADMIN_HASH;

  if (!id || !currentHash || !newHash) {
    return { success: false, error: 'Invalid payload' };
  }

  if (id !== adminId) {
    return { success: false, error: 'Invalid admin id' };
  }

  if (currentHash !== adminHash) {
    return { success: false, error: 'Current password mismatch' };
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'admin_pw') {
      sheet.getRange(i + 1, 2).setValue(newHash);
      return { success: true };
    }
  }

  sheet.appendRow(['admin_pw', newHash]);
  return { success: true };
}

function migrateLegacyAdminPassword() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SETTINGS);
    sheet.appendRow(['key', 'value']);
    sheet.appendRow(['admin_id', DEFAULT_ADMIN_ID]);
    sheet.appendRow(['admin_pw', DEFAULT_ADMIN_HASH]);
    return;
  }

  const data = sheet.getDataRange().getValues();
  let idRow = -1;
  let pwRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'admin_id') idRow = i + 1;
    if (data[i][0] === 'admin_pw') pwRow = i + 1;
  }

  if (idRow === -1) {
    sheet.appendRow(['admin_id', DEFAULT_ADMIN_ID]);
  }
  if (pwRow === -1) {
    sheet.appendRow(['admin_pw', DEFAULT_ADMIN_HASH]);
    return;
  }

  const currentHash = String(sheet.getRange(pwRow, 2).getValue() || '');
  if (currentHash === LEGACY_ADMIN_HASH) {
    sheet.getRange(pwRow, 2).setValue(DEFAULT_ADMIN_HASH);
  }
}

function normalizeDateValue(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]') {
    const dt = new Date(value);
    if (!isNaN(dt.getTime())) {
      return Utilities.formatDate(dt, APP_TZ, 'yyyy-MM-dd');
    }
  }

  const raw = String(value).trim();
  if (!raw) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, APP_TZ, 'yyyy-MM-dd');
  }

  return raw;
}

// ===== Menu for Setup =====
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('스포츠박스')
    .addItem('시트 초기화', 'initSheets')
    .addToUi();
}
