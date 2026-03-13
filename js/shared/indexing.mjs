import { normalizeDateString, toBoolean } from './date.mjs';

export function normalizeEventRecord(record = {}) {
  return {
    id: String(record.id ?? ''),
    name: String(record.name ?? ''),
    description: String(record.description ?? ''),
    image: String(record.image ?? ''),
    status: String(record.status ?? ''),
    bookingOpen: toBoolean(record.bookingOpen),
    videoUrl: String(record.videoUrl ?? ''),
  };
}

export function normalizeScheduleRecord(record = {}) {
  const date = normalizeDateString(record.date);
  return {
    eventId: String(record.eventId ?? ''),
    date,
  };
}

export function normalizeReservationRecord(record = {}) {
  return {
    id: String(record.id ?? ''),
    eventId: String(record.eventId ?? ''),
    eventName: String(record.eventName ?? ''),
    date: normalizeDateString(record.date),
    groupName: String(record.groupName ?? ''),
    manager: String(record.manager ?? ''),
    contact: String(record.contact ?? ''),
    participants: Number(record.participants ?? 0),
    status: String(record.status ?? ''),
    createdAt: String(record.createdAt ?? ''),
  };
}

export function buildEventIndex(events = []) {
  return new Map(events.map((event) => [event.id, event]));
}

export function buildScheduleIndex(schedules = []) {
  const byEvent = new Map();
  const byDate = new Map();

  for (const rawRecord of schedules) {
    const record = normalizeScheduleRecord(rawRecord);
    if (!record.eventId || !record.date) continue;

    if (!byEvent.has(record.eventId)) {
      byEvent.set(record.eventId, { list: [], dates: new Set() });
    }

    const bucket = byEvent.get(record.eventId);
    if (!bucket.dates.has(record.date)) {
      bucket.list.push(record);
      bucket.dates.add(record.date);
    }

    if (!byDate.has(record.date)) {
      byDate.set(record.date, []);
    }
    byDate.get(record.date).push(record);
  }

  for (const entry of byEvent.values()) {
    entry.list.sort((left, right) => left.date.localeCompare(right.date));
  }

  return { byEvent, byDate };
}

export function scheduleIndexFromPayload(scheduleIndex = {}) {
  const flattened = [];

  for (const [eventId, dates] of Object.entries(scheduleIndex)) {
    for (const date of dates || []) {
      flattened.push({ eventId, date });
    }
  }

  return buildScheduleIndex(flattened);
}

export function summarizeDashboardRows(events = [], schedules = [], reservations = []) {
  const scheduleCounts = new Map();
  const reservationCounts = new Map();

  for (const schedule of schedules) {
    const eventId = String(schedule.eventId ?? '');
    if (!eventId) continue;
    scheduleCounts.set(eventId, (scheduleCounts.get(eventId) ?? 0) + 1);
  }

  for (const reservation of reservations) {
    const eventId = String(reservation.eventId ?? '');
    if (!eventId) continue;
    reservationCounts.set(eventId, (reservationCounts.get(eventId) ?? 0) + 1);
  }

  return events.map((event) => ({
    id: String(event.id ?? ''),
    name: String(event.name ?? ''),
    status: String(event.status ?? ''),
    scheduleCount: scheduleCounts.get(String(event.id ?? '')) ?? 0,
    reservationCount: reservationCounts.get(String(event.id ?? '')) ?? 0,
  }));
}
