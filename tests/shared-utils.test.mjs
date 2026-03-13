import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDate,
  normalizeDateString,
  toBoolean,
} from '../js/shared/date.mjs';
import {
  buildEventIndex,
  buildScheduleIndex,
  countBookableEvents,
  deriveEventStatus,
  summarizeDashboardRows,
} from '../js/shared/indexing.mjs';
import { createAdminTableMessage } from '../js/admin/view-state.mjs';

test('normalizeDateString returns yyyy-mm-dd for parseable values', () => {
  assert.equal(normalizeDateString('2026-03-13'), '2026-03-13');
  assert.equal(normalizeDateString('March 13, 2026'), '2026-03-13');
});

test('formatDate zero-pads month and day', () => {
  assert.equal(formatDate(new Date(2026, 2, 4)), '2026-03-04');
});

test('toBoolean normalizes mixed truthy string and numeric values', () => {
  assert.equal(toBoolean(true), true);
  assert.equal(toBoolean('true'), true);
  assert.equal(toBoolean(1), true);
  assert.equal(toBoolean('0'), false);
});

test('buildEventIndex and buildScheduleIndex return constant-time lookup structures', () => {
  const events = [{ id: 'evt1', name: 'A' }, { id: 'evt2', name: 'B' }];
  const schedules = [
    { eventId: 'evt1', date: '2026-03-13' },
    { eventId: 'evt1', date: '2026-03-20' },
    { eventId: 'evt2', date: '2026-04-01' },
  ];

  const eventIndex = buildEventIndex(events);
  const scheduleIndex = buildScheduleIndex(schedules);

  assert.equal(eventIndex.get('evt2').name, 'B');
  assert.equal(scheduleIndex.byEvent.get('evt1').dates.has('2026-03-20'), true);
  assert.equal(scheduleIndex.byDate.get('2026-04-01')[0].eventId, 'evt2');
});

test('summarizeDashboardRows computes counts without repeated client-side filtering', () => {
  const rows = summarizeDashboardRows(
    [{ id: 'evt1', name: 'A', bookingOpen: true }],
    [{ eventId: 'evt1', date: '2026-03-13' }, { eventId: 'evt1', date: '2026-03-14' }],
    [{ eventId: 'evt1' }, { eventId: 'evt1' }, { eventId: 'evt1' }],
  );

  assert.deepEqual(rows, [
    {
      id: 'evt1',
      name: 'A',
      status: '모집중',
      bookingOpen: true,
      scheduleCount: 2,
      reservationCount: 3,
    },
  ]);
});

test('deriveEventStatus maps booking state to only 모집중 or 준비중', () => {
  assert.equal(deriveEventStatus({ bookingOpen: true }), '모집중');
  assert.equal(deriveEventStatus({ bookingOpen: false }), '준비중');
  assert.equal(deriveEventStatus({ bookingOpen: 'true' }), '모집중');
});

test('countBookableEvents counts only 예약중 events', () => {
  const count = countBookableEvents([
    { id: 'evt1', bookingOpen: true, status: '준비중' },
    { id: 'evt2', bookingOpen: false, status: '모집중' },
    { id: 'evt3', bookingOpen: 'true', status: '모집마감' },
  ]);

  assert.equal(count, 2);
});

test('createAdminTableMessage renders a friendly loading row', () => {
  assert.equal(
    createAdminTableMessage(2, '일정을 확인하고 있습니다.'),
    '<tr><td colspan="2" style="text-align:center;color:#999;padding:40px;">일정을 확인하고 있습니다.</td></tr>',
  );
});
