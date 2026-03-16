export function toBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeDateString(value) {
  if (!value) return '';

  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return formatDate(parsed);
}

export function formatTimestamp(value, locale = 'ko-KR') {
  if (!value) {
    return new Date().toLocaleString(locale);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString(locale);
}
