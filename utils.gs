function jsonOutput(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function successResponse(data) {
  return { success: true, data: data };
}

function errorResponse(message) {
  return { success: false, error: message };
}

function normalizeDateValue(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return Utilities.formatDate(date, APP_TZ, 'yyyy-MM-dd');
    }
  }

  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, APP_TZ, 'yyyy-MM-dd');
  }

  return '';
}

function toBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function sanitizeContact(value) {
  const raw = value == null ? '' : String(value);
  return raw.startsWith("'") ? raw : "'" + raw;
}

function createTimestamp() {
  return Utilities.formatDate(new Date(), APP_TZ, 'yyyy-MM-dd HH:mm:ss');
}

function parseTimestampValue(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;

  if (Object.prototype.toString.call(value) === '[object Date]') {
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
  }

  var raw = String(value).trim();
  if (!raw) return Number.MAX_SAFE_INTEGER;

  var standard = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (standard) {
    return new Date(
      Number(standard[1]),
      Number(standard[2]) - 1,
      Number(standard[3]),
      Number(standard[4]),
      Number(standard[5]),
      Number(standard[6] || 0)
    ).getTime();
  }

  var korean = raw.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (korean) {
    var hours = Number(korean[5]);
    if (korean[4] === '오전' && hours === 12) hours = 0;
    if (korean[4] === '오후' && hours < 12) hours += 12;
    return new Date(
      Number(korean[1]),
      Number(korean[2]) - 1,
      Number(korean[3]),
      hours,
      Number(korean[6]),
      Number(korean[7] || 0)
    ).getTime();
  }

  var parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? Number.MAX_SAFE_INTEGER : parsed.getTime();
}

function withScriptLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function buildRowObject(headers, row) {
  const object = {};
  headers.forEach(function(header, index) {
    object[header] = row[index];
  });
  return object;
}

function mapCountBy(items, key) {
  return items.reduce(function(accumulator, item) {
    const id = String(item[key] || '');
    if (!id) return accumulator;
    accumulator[id] = (accumulator[id] || 0) + 1;
    return accumulator;
  }, {});
}
