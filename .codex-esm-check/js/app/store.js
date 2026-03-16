import { apiGet } from '../shared/http.js';
import {
  buildEventIndex,
  buildScheduleIndex,
  normalizeEventRecord,
  normalizeScheduleRecord,
  scheduleIndexFromPayload,
} from '../shared/indexing.mjs';
import { formatDate } from '../shared/date.mjs';

const fallbackEvents = [
  {
    id: 'evt1',
    name: '마주(馬走)하는 승마교실',
    description:
      '말과 함께하는 특별한 체험! 전문 강사의 안전한 지도 아래 승마의 기초부터 배워보세요.',
    image: 'images/horse-riding-event.png',
    status: '모집중',
    bookingOpen: false,
    videoUrl: '',
    documentTemplateUrl:
      'https://github.com/sportsbox031/event/blob/main/2026%20%EC%8A%A4%ED%8F%AC%EC%B8%A0%EB%B0%95%EC%8A%A4%20%EB%A7%88%EC%A3%BC(%E9%A6%AC%E8%B5%B0)%ED%95%98%EB%8A%94%20%EC%8A%B9%EB%A7%88%EA%B5%90%EC%8B%A4%20%EA%B3%B5%EA%B3%A0.hwpx',
  },
  {
    id: 'evt2',
    name: '설래(雪來)는 스키교실',
    description: '겨울 스포츠의 꽃, 스키! 초보자도 쉽게 배울 수 있는 맞춤형 스키 교실입니다.',
    image: 'images/skiing-event.png',
    status: '모집중',
    bookingOpen: false,
    videoUrl: 'https://www.youtube.com/watch?v=g8ZcvhQWQ_0',
    documentTemplateUrl: '',
  },
];

function buildMockSchedules(eventId) {
  const today = new Date();
  const mockSchedules = [];

  for (let day = 5; day <= 28; day += 3) {
    const date = new Date(today.getFullYear(), today.getMonth(), day);
    if (date >= today) {
      mockSchedules.push({ eventId, date: formatDate(date) });
    }
  }

  for (let day = 3; day <= 25; day += 4) {
    const date = new Date(today.getFullYear(), today.getMonth() + 1, day);
    mockSchedules.push({ eventId, date: formatDate(date) });
  }

  return mockSchedules;
}

const state = {
  events: [],
  eventIndex: new Map(),
  scheduleIndex: buildScheduleIndex([]),
  catalogPromise: null,
  scheduleRequests: new Map(),
  currentEventId: null,
  actionEventId: null,
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  calendarFixedMonth: null,
};

function setCatalog(events, scheduleIndex) {
  state.events = events;
  state.eventIndex = buildEventIndex(events);
  state.scheduleIndex = scheduleIndex;
}

function ingestCatalog(payload) {
  const events = Array.isArray(payload?.events)
    ? payload.events.map(normalizeEventRecord)
    : fallbackEvents.map(normalizeEventRecord);

  let scheduleIndex = buildScheduleIndex([]);

  if (payload?.scheduleIndex && typeof payload.scheduleIndex === 'object') {
    scheduleIndex = scheduleIndexFromPayload(payload.scheduleIndex);
  } else if (Array.isArray(payload?.schedules)) {
    scheduleIndex = buildScheduleIndex(payload.schedules.map(normalizeScheduleRecord));
  }

  setCatalog(events, scheduleIndex);
}

export async function loadCatalog() {
  if (!state.catalogPromise) {
    state.catalogPromise = (async () => {
      try {
        const payload = await apiGet('getCatalog');
        ingestCatalog(payload);
      } catch (error) {
        console.error('Failed to load catalog:', error);
        const fallbackSchedules = fallbackEvents.flatMap((event) => buildMockSchedules(event.id));
        setCatalog(
          fallbackEvents.map(normalizeEventRecord),
          buildScheduleIndex(fallbackSchedules),
        );
      }

      return {
        events: state.events,
        scheduleIndex: state.scheduleIndex,
      };
    })();
  }

  return state.catalogPromise;
}

export async function ensureSchedules(eventId) {
  const existing = state.scheduleIndex.byEvent.get(eventId);
  if (existing) {
    return existing;
  }

  if (state.scheduleRequests.has(eventId)) {
    return state.scheduleRequests.get(eventId);
  }

  const request = (async () => {
    try {
      const payload = await apiGet('getSchedules', { eventId });
      const normalized = Array.isArray(payload) ? payload.map(normalizeScheduleRecord) : [];
      const merged = [...flattenScheduleIndex(state.scheduleIndex), ...normalized];
      state.scheduleIndex = buildScheduleIndex(merged);
    } catch (error) {
      console.error('Failed to load schedules:', error);
      const merged = [
        ...flattenScheduleIndex(state.scheduleIndex),
        ...buildMockSchedules(eventId).map(normalizeScheduleRecord),
      ];
      state.scheduleIndex = buildScheduleIndex(merged);
    } finally {
      state.scheduleRequests.delete(eventId);
    }

    return state.scheduleIndex.byEvent.get(eventId) ?? { list: [], dates: new Set() };
  })();

  state.scheduleRequests.set(eventId, request);
  return request;
}

function flattenScheduleIndex(scheduleIndex) {
  return [...scheduleIndex.byEvent.values()].flatMap((entry) => entry.list);
}

export function getEvent(eventId) {
  return state.eventIndex.get(eventId) ?? null;
}

export function getEvents() {
  return state.events;
}

export function getScheduleEntry(eventId) {
  return state.scheduleIndex.byEvent.get(eventId) ?? { list: [], dates: new Set() };
}

export function setCurrentEvent(eventId) {
  state.currentEventId = eventId;
}

export function getCurrentEventId() {
  return state.currentEventId;
}

export function setActionEvent(eventId) {
  state.actionEventId = eventId;
}

export function getActionEventId() {
  return state.actionEventId;
}

export function setCalendarState(year, month, fixedMonth = null) {
  state.calendarYear = year;
  state.calendarMonth = month;
  state.calendarFixedMonth = fixedMonth;
}

export function getCalendarState() {
  return {
    year: state.calendarYear,
    month: state.calendarMonth,
    fixedMonth: state.calendarFixedMonth,
  };
}

export function shiftCalendarMonth(direction) {
  if (state.calendarFixedMonth) return getCalendarState();

  state.calendarMonth += direction;
  if (state.calendarMonth < 0) {
    state.calendarMonth = 11;
    state.calendarYear -= 1;
  } else if (state.calendarMonth > 11) {
    state.calendarMonth = 0;
    state.calendarYear += 1;
  }

  return getCalendarState();
}

export function invalidateSchedules(eventId) {
  const remaining = flattenScheduleIndex(state.scheduleIndex).filter(
    (item) => item.eventId !== eventId,
  );
  state.scheduleIndex = buildScheduleIndex(remaining);
}
