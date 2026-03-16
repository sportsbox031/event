import { apiGet, apiPost } from '../shared/http.js';
import { createAdminTableMessage } from './view-state.mjs';
import { formatTimestamp, normalizeDateString, toBoolean } from '../shared/date.mjs';
import {
  buildEventIndex,
  deriveEventStatus,
  normalizeEventRecord,
  normalizeReservationRecord,
  normalizeScheduleRecord,
  summarizeDashboardRows,
} from '../shared/indexing.mjs';

const state = {
  events: [],
  eventIndex: new Map(),
  dashboardRows: [],
  currentDetailEventId: null,
  currentTab: 'schedules',
  detailCache: new Map(),
  bookingToggleLoading: false,
  bookingToggleTarget: null,
};

const dom = {};

export function initAdmin() {
  cacheDom();
  bindEvents();

  if (sessionStorage.getItem('admin_logged_in') === 'true') {
    void showDashboard();
  }
}

function cacheDom() {
  dom.loginScreen = document.getElementById('loginScreen');
  dom.adminDashboard = document.getElementById('adminDashboard');
  dom.loginForm = document.getElementById('loginForm');
  dom.loginId = document.getElementById('loginId');
  dom.loginPw = document.getElementById('loginPw');
  dom.loginError = document.getElementById('loginError');
  dom.loginSubmitBtn = document.getElementById('loginSubmitBtn');
  dom.openPasswordModalBtn = document.getElementById('openPasswordModalBtn');
  dom.logoutBtn = document.getElementById('logoutBtn');
  dom.openEventCreateBtn = document.getElementById('openEventCreateBtn');
  dom.eventTableBody = document.getElementById('eventTableBody');
  dom.viewEventList = document.getElementById('viewEventList');
  dom.viewEventDetail = document.getElementById('viewEventDetail');
  dom.backToEventListBtn = document.getElementById('backToEventListBtn');
  dom.detailEventTitle = document.getElementById('detailEventTitle');
  dom.bookingToggleWrap = document.getElementById('bookingToggleWrap');
  dom.scheduleTableBody = document.getElementById('scheduleTableBody');
  dom.reservationTableBody = document.getElementById('reservationTableBody');
  dom.documentTableBody = document.getElementById('documentTableBody');
  dom.tabButtons = [...document.querySelectorAll('.tab-btn')];
  dom.tabSchedules = document.getElementById('tabSchedules');
  dom.tabReservations = document.getElementById('tabReservations');
  dom.tabDocuments = document.getElementById('tabDocuments');
  dom.scheduleDate = document.getElementById('scheduleDate');
  dom.addScheduleBtn = document.getElementById('addScheduleBtn');
  dom.eventFormModal = document.getElementById('eventFormModal');
  dom.eventForm = document.getElementById('eventForm');
  dom.eventFormTitle = document.getElementById('eventFormTitle');
  dom.eventFormId = document.getElementById('eventFormId');
  dom.eventFormName = document.getElementById('eventFormName');
  dom.eventFormDesc = document.getElementById('eventFormDesc');
  dom.eventFormImage = document.getElementById('eventFormImage');
  dom.eventFormVideo = document.getElementById('eventFormVideo');
  dom.eventFormDocumentTemplate = document.getElementById('eventFormDocumentTemplate');
  dom.eventFormSubmitBtn = document.getElementById('eventFormSubmitBtn');
  dom.passwordModal = document.getElementById('passwordModal');
  dom.passwordForm = document.getElementById('passwordForm');
  dom.pwCurrent = document.getElementById('pwCurrent');
  dom.pwNew = document.getElementById('pwNew');
  dom.pwConfirm = document.getElementById('pwConfirm');
  dom.pwError = document.getElementById('pwError');
  dom.passwordSubmitBtn = document.getElementById('passwordSubmitBtn');
}

function bindEvents() {
  dom.loginForm.addEventListener('submit', handleLogin);
  dom.openPasswordModalBtn.addEventListener('click', openPasswordModal);
  dom.logoutBtn.addEventListener('click', handleLogout);
  dom.openEventCreateBtn.addEventListener('click', () => openEventFormModal());
  dom.backToEventListBtn.addEventListener('click', () => void backToEventList());
  dom.addScheduleBtn.addEventListener('click', () => void addSchedule(dom.addScheduleBtn));
  dom.eventForm.addEventListener('submit', saveEvent);
  dom.passwordForm.addEventListener('submit', changePassword);

  dom.eventTableBody.addEventListener('click', handleEventTableClick);
  dom.scheduleTableBody.addEventListener('click', handleScheduleTableClick);
  dom.bookingToggleWrap.addEventListener('click', handleBookingToggleClick);
  dom.tabButtons.forEach((button) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });

  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
      if (event.target !== overlay) return;
      overlay.classList.remove('active');
    });
  });

  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => {
      const modal = document.getElementById(button.getAttribute('data-close-modal'));
      modal?.classList.remove('active');
    });
  });
}

function renderEventTableLoading() {
  dom.eventTableBody.innerHTML = `
    <tr>
      <td colspan="6">
        <div class="loading-block table-loading">
          <span class="loading-spinner" aria-hidden="true"></span>
          <span>이벤트 목록을 불러오는 중...</span>
        </div>
      </td>
    </tr>
  `;
}

async function handleLogin(event) {
  event.preventDefault();
  dom.loginError.textContent = '';
  setButtonLoading(dom.loginSubmitBtn, true, '처리중...');

  const id = dom.loginId.value.trim();
  const hash = await hashPassword(dom.loginPw.value);

  try {
    const result = await apiPost('adminLogin', { id, hash });
    const dashboardPayload = result.data?.dashboard ?? null;
    const resolvedAdminId = result.data?.adminId ?? id;
    sessionStorage.setItem('admin_logged_in', 'true');
    sessionStorage.setItem('admin_id', resolvedAdminId);
    setButtonLoading(dom.loginSubmitBtn, false);
    showDashboard(dashboardPayload);
    return;
  } catch (error) {
    console.error(error);
    dom.loginError.textContent =
      error?.message === 'Invalid credentials'
        ? '아이디 또는 비밀번호가 올바르지 않습니다.'
        : '로그인 서버 연결에 실패했습니다.';
    setButtonLoading(dom.loginSubmitBtn, false);
    return;
  }
}

function handleLogout() {
  sessionStorage.removeItem('admin_logged_in');
  sessionStorage.removeItem('admin_id');
  location.reload();
}

function showDashboard(initialDashboard = null) {
  dom.loginScreen.style.display = 'none';
  dom.adminDashboard.style.display = 'block';
  renderEventTableLoading();
  if (initialDashboard) {
    applyDashboardPayload(initialDashboard);
    renderEventTable();
    return;
  }

  void loadDashboard();
}

async function loadDashboard() {
  try {
    const payload = await apiGet('getAdminDashboard');
    applyDashboardPayload(payload);
  } catch (error) {
    console.error('Admin dashboard load failed:', error);
    const fallback = getLocalDashboardFallback();
    state.events = fallback.events;
    state.eventIndex = buildEventIndex(fallback.events);
    state.dashboardRows = fallback.rows;
  }

  renderEventTable();
}

function applyDashboardPayload(payload) {
  state.events = (payload.events ?? []).map(normalizeEventRecord);
  state.eventIndex = buildEventIndex(state.events);
  state.dashboardRows = Array.isArray(payload.rows)
    ? payload.rows
    : summarizeDashboardRows(
        state.events,
        payload.schedules ?? [],
        payload.reservations ?? [],
      );
}

function getLocalDashboardFallback() {
  const events = getStoredEvents().map(normalizeEventRecord);
  const schedules = getStoredSchedules().map(normalizeScheduleRecord);
  const reservations = getStoredReservations().map(normalizeReservationRecord);

  return {
    events,
    rows: summarizeDashboardRows(events, schedules, reservations),
    schedules,
    reservations,
  };
}

function renderEventTable() {
  dom.eventTableBody.innerHTML = state.dashboardRows
    .map((row, index) => {
      const event = state.eventIndex.get(row.id);
      const statusClass =
        row.bookingOpen
          ? 'status-open'
          : 'status-preparing';

      return `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${escapeHtml(event?.name ?? row.name)}</strong></td>
          <td><span class="status-badge ${statusClass}">${escapeHtml(row.status)}</span></td>
          <td>${row.scheduleCount}개</td>
          <td>${row.reservationCount}건</td>
          <td>
            <button type="button" class="btn-sm btn-detail" data-action="detail" data-event-id="${escapeHtml(row.id)}">상세</button>
            <button type="button" class="btn-sm btn-edit" data-action="edit" data-event-id="${escapeHtml(row.id)}">수정</button>
            <button type="button" class="btn-sm btn-delete" data-action="delete" data-event-id="${escapeHtml(row.id)}">삭제</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

function handleEventTableClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const { action, eventId } = button.dataset;
  if (action === 'detail') {
    void openEventDetail(eventId);
  } else if (action === 'edit') {
    openEventFormModal(eventId);
  } else if (action === 'delete') {
    void deleteEvent(eventId, button);
  }
}

async function openEventDetail(eventId) {
  state.currentDetailEventId = eventId;
  const eventRecord = state.eventIndex.get(eventId);
  if (!eventRecord) return;

  dom.viewEventList.style.display = 'none';
  dom.viewEventDetail.style.display = 'block';
  dom.detailEventTitle.textContent = eventRecord.name;
  switchTab('schedules');
  renderDetailLoadingState();

  const detail = await getEventDetail(eventId);
  renderBookingToggle();
  renderSchedules(detail.schedules);
  renderReservations(detail.reservations);
  renderDocumentSubmissions(detail.documentSubmissions);
}

function renderDetailLoadingState() {
  dom.scheduleTableBody.innerHTML = createAdminTableMessage(2, '일정을 확인하고 있습니다.');
  dom.reservationTableBody.innerHTML = createAdminTableMessage(7, '신청 내역 데이터를 가져오고 있습니다.');
  dom.documentTableBody.innerHTML = createAdminTableMessage(7, '제출 서류 데이터를 가져오고 있습니다.');
}

async function getEventDetail(eventId) {
  if (state.detailCache.has(eventId)) {
    return state.detailCache.get(eventId);
  }

  try {
    const payload = await apiGet('getEventDetail', { eventId });
    const detail = {
      event: normalizeEventRecord(payload.event),
      schedules: (payload.schedules ?? []).map(normalizeScheduleRecord),
      reservations: (payload.reservations ?? []).map(normalizeReservationRecord),
      documentSubmissions: Array.isArray(payload.documentSubmissions) ? payload.documentSubmissions : [],
    };
    state.detailCache.set(eventId, detail);
    return detail;
  } catch (error) {
    console.error('Detail endpoint failed, using local fallback:', error);
    const fallback = {
      event: state.eventIndex.get(eventId),
      schedules: getStoredSchedules()
        .map(normalizeScheduleRecord)
        .filter((item) => item.eventId === eventId),
      reservations: getStoredReservations()
        .map(normalizeReservationRecord)
        .filter((item) => item.eventId === eventId),
      documentSubmissions: getStoredDocumentSubmissions().filter((item) => item.eventId === eventId),
    };
    state.detailCache.set(eventId, fallback);
    return fallback;
  }
}

function renderBookingToggle() {
  const eventRecord = state.eventIndex.get(state.currentDetailEventId);
  if (!eventRecord) return;

  const isOpen = Boolean(eventRecord.bookingOpen);
  const isStarting = state.bookingToggleLoading && state.bookingToggleTarget === true;
  const isStopping = state.bookingToggleLoading && state.bookingToggleTarget === false;

  dom.bookingToggleWrap.innerHTML = `
    <div class="booking-toggle">
      <span class="status-badge ${isOpen ? 'status-open' : 'status-closed'}">${isOpen ? '예약중' : '예약종료'}</span>
      <button type="button" class="btn-sm btn-success" data-action="booking" data-open="true" ${isOpen || state.bookingToggleLoading ? 'disabled' : ''}>${isStarting ? '처리중...' : '예약 시작'}</button>
      <button type="button" class="btn-sm btn-delete" data-action="booking" data-open="false" ${!isOpen || state.bookingToggleLoading ? 'disabled' : ''}>${isStopping ? '처리중...' : '예약 종료'}</button>
    </div>
  `;
}

function handleBookingToggleClick(event) {
  const button = event.target.closest('[data-action="booking"]');
  if (!button) return;
  void setBookingOpen(button.dataset.open === 'true');
}

async function setBookingOpen(open) {
  if (state.bookingToggleLoading) return;

  const eventRecord = state.eventIndex.get(state.currentDetailEventId);
  if (!eventRecord) return;

  state.bookingToggleLoading = true;
  state.bookingToggleTarget = open;
  updateEventRecord({ ...eventRecord, bookingOpen: open });
  renderBookingToggle();

  try {
    const result = await apiPost('saveEvent', {
      ...eventRecord,
      bookingOpen: open,
    });
    if (!result.success) throw new Error('saveEvent failed');
  } catch (error) {
    console.error(error);
    updateEventRecord(eventRecord);
    alert('예약 상태 변경에 실패했습니다.');
  } finally {
    state.bookingToggleLoading = false;
    state.bookingToggleTarget = null;
    renderBookingToggle();
    renderEventTable();
  }
}

function switchTab(tab) {
  state.currentTab = tab;
  dom.tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  dom.tabSchedules.style.display = tab === 'schedules' ? 'block' : 'none';
  dom.tabReservations.style.display = tab === 'reservations' ? 'block' : 'none';
  dom.tabDocuments.style.display = tab === 'documents' ? 'block' : 'none';
}

async function backToEventList() {
  dom.viewEventDetail.style.display = 'none';
  dom.viewEventList.style.display = 'block';
  state.currentDetailEventId = null;
  await loadDashboard();
}

function openEventFormModal(eventId = '') {
  const eventRecord = eventId ? state.eventIndex.get(eventId) : null;

  dom.eventFormTitle.textContent = eventRecord ? '이벤트 수정' : '이벤트 등록';
  dom.eventFormId.value = eventId;
  dom.eventFormName.value = eventRecord?.name ?? '';
  dom.eventFormDesc.value = eventRecord?.description ?? '';
  dom.eventFormImage.value = eventRecord?.image ?? '';
  dom.eventFormVideo.value = eventRecord?.videoUrl ?? '';
  dom.eventFormDocumentTemplate.value = eventRecord?.documentTemplateUrl ?? '';
  dom.eventFormModal.classList.add('active');
}

async function saveEvent(event) {
  event.preventDefault();
  setButtonLoading(dom.eventFormSubmitBtn, true, '저장중...');

  const eventId = dom.eventFormId.value.trim();
  const payload = {
    id: eventId || undefined,
    name: dom.eventFormName.value.trim(),
    description: dom.eventFormDesc.value.trim(),
    image: dom.eventFormImage.value.trim() || 'images/hero-bg.png',
    videoUrl: dom.eventFormVideo.value.trim(),
    documentTemplateUrl: dom.eventFormDocumentTemplate.value.trim(),
    bookingOpen: eventId ? Boolean(state.eventIndex.get(eventId)?.bookingOpen) : false,
  };

  try {
    const result = await apiPost('saveEvent', payload);
    if (!result.success) throw new Error(result.error ?? 'saveEvent failed');
    dom.eventFormModal.classList.remove('active');
    state.detailCache.delete(eventId);
    await loadDashboard();
  } catch (error) {
    console.error(error);
    alert('이벤트 저장에 실패했습니다.');
  } finally {
    setButtonLoading(dom.eventFormSubmitBtn, false);
  }
}

async function deleteEvent(eventId, button) {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  setButtonLoading(button, true, '삭제중...');

  try {
    const result = await apiPost('deleteEvent', { id: eventId });
    if (!result.success) throw new Error(result.error ?? 'deleteEvent failed');
    state.detailCache.delete(eventId);
    await loadDashboard();
  } catch (error) {
    console.error(error);
    alert('이벤트 삭제에 실패했습니다.');
    setButtonLoading(button, false);
  }
}

async function addSchedule(button) {
  const date = dom.scheduleDate.value;
  if (!date) {
    alert('날짜를 선택하세요.');
    return;
  }

  setButtonLoading(button, true, '추가중...');

  try {
    const result = await apiPost('addSchedule', {
      eventId: state.currentDetailEventId,
      date,
    });
    if (!result.success) throw new Error(result.error ?? 'addSchedule failed');

    const detail = await getEventDetail(state.currentDetailEventId);
    detail.schedules = [...detail.schedules, { eventId: state.currentDetailEventId, date }]
      .map(normalizeScheduleRecord)
      .sort((left, right) => left.date.localeCompare(right.date));
    state.detailCache.set(state.currentDetailEventId, detail);
    incrementDashboardCount(state.currentDetailEventId, 'scheduleCount', 1);
    dom.scheduleDate.value = '';
    renderSchedules(detail.schedules);
    renderEventTable();
  } catch (error) {
    console.error(error);
    alert(error.message === 'Duplicate schedule' ? '이미 등록된 날짜입니다.' : '일정 저장에 실패했습니다.');
  } finally {
    setButtonLoading(button, false);
  }
}

function renderSchedules(schedules) {
  const sorted = [...schedules].sort((left, right) => left.date.localeCompare(right.date));
  if (!sorted.length) {
    dom.scheduleTableBody.innerHTML = createAdminTableMessage(2, '등록된 일정이 없습니다.');
    return;
  }

  dom.scheduleTableBody.innerHTML = sorted
    .map(
      (schedule) => `
        <tr>
          <td>${escapeHtml(schedule.date)}</td>
          <td><button type="button" class="btn-sm btn-delete" data-action="delete-schedule" data-date="${escapeHtml(schedule.date)}">삭제</button></td>
        </tr>
      `,
    )
    .join('');
}

function handleScheduleTableClick(event) {
  const button = event.target.closest('[data-action="delete-schedule"]');
  if (!button) return;
  void deleteSchedule(button.dataset.date, button);
}

async function deleteSchedule(date, button) {
  if (!confirm('이 일정을 삭제하시겠습니까?')) return;
  setButtonLoading(button, true, '삭제중...');

  try {
    const result = await apiPost('deleteSchedule', {
      eventId: state.currentDetailEventId,
      date,
    });
    if (!result.success) throw new Error(result.error ?? 'deleteSchedule failed');

    const detail = await getEventDetail(state.currentDetailEventId);
    detail.schedules = detail.schedules.filter((item) => item.date !== date);
    state.detailCache.set(state.currentDetailEventId, detail);
    incrementDashboardCount(state.currentDetailEventId, 'scheduleCount', -1);
    renderSchedules(detail.schedules);
    renderEventTable();
  } catch (error) {
    console.error(error);
    alert('일정 삭제에 실패했습니다.');
    setButtonLoading(button, false);
  }
}

function renderReservations(reservations) {
  const sorted = [...reservations].sort((left, right) =>
    String(right.createdAt).localeCompare(String(left.createdAt)),
  );

  if (!sorted.length) {
    dom.reservationTableBody.innerHTML = createAdminTableMessage(7, '신청 내역이 없습니다.');
    return;
  }

  dom.reservationTableBody.innerHTML = sorted
    .map(
      (reservation, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(reservation.date)}</td>
          <td>${escapeHtml(reservation.groupName)}</td>
          <td>${escapeHtml(reservation.manager)}</td>
          <td>${escapeHtml(reservation.contact)}</td>
          <td>${escapeHtml(String(reservation.participants))}명</td>
          <td>${escapeHtml(reservation.createdAt)}</td>
        </tr>
      `,
    )
    .join('');
}

function renderDocumentSubmissions(documentSubmissions) {
  const sorted = [...documentSubmissions].sort((left, right) =>
    String(right.createdAt).localeCompare(String(left.createdAt)),
  );

  if (!sorted.length) {
    dom.documentTableBody.innerHTML = createAdminTableMessage(7, '제출된 서류가 없습니다.');
    return;
  }

  dom.documentTableBody.innerHTML = sorted
    .map(
      (submission, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(submission.groupName)}</td>
          <td>${escapeHtml(submission.manager)}</td>
          <td>${escapeHtml(submission.contact)}</td>
          <td>${escapeHtml(submission.fileName)}</td>
          <td>${escapeHtml(submission.createdAt)}</td>
          <td>${renderDocumentLink(submission)}</td>
        </tr>
      `,
    )
    .join('');
}

function renderDocumentLink(submission) {
  if (!submission.fileUrl) {
    return '<span class="status-badge status-closed">링크 없음</span>';
  }

  return `
    <a
      class="btn-sm btn-detail"
      href="${escapeHtml(submission.fileUrl)}"
      target="_blank"
      rel="noopener noreferrer"
    >파일 열기</a>
  `;
}

function openPasswordModal() {
  dom.pwCurrent.value = '';
  dom.pwNew.value = '';
  dom.pwConfirm.value = '';
  dom.pwError.textContent = '';
  dom.passwordModal.classList.add('active');
}

async function changePassword(event) {
  event.preventDefault();
  dom.pwError.textContent = '';
  setButtonLoading(dom.passwordSubmitBtn, true, '변경중...');

  if (dom.pwNew.value !== dom.pwConfirm.value) {
    dom.pwError.textContent = '새 비밀번호가 일치하지 않습니다.';
    setButtonLoading(dom.passwordSubmitBtn, false);
    return;
  }

  if (dom.pwNew.value.length < 4) {
    dom.pwError.textContent = '비밀번호는 4자 이상이어야 합니다.';
    setButtonLoading(dom.passwordSubmitBtn, false);
    return;
  }

  try {
    const result = await apiPost('changePassword', {
      id: sessionStorage.getItem('admin_id') || 'admin',
      currentHash: await hashPassword(dom.pwCurrent.value),
      newHash: await hashPassword(dom.pwNew.value),
    });

    if (!result.success) {
      dom.pwError.textContent = '현재 비밀번호가 올바르지 않습니다.';
      return;
    }

    dom.passwordModal.classList.remove('active');
    alert('비밀번호가 변경되었습니다.');
  } catch (error) {
    console.error(error);
    dom.pwError.textContent = '비밀번호 변경 중 오류가 발생했습니다.';
  } finally {
    setButtonLoading(dom.passwordSubmitBtn, false);
  }
}

function updateEventRecord(nextEvent) {
  state.events = state.events.map((item) => (item.id === nextEvent.id ? nextEvent : item));
  state.eventIndex = buildEventIndex(state.events);
}

function incrementDashboardCount(eventId, key, amount) {
  state.dashboardRows = state.dashboardRows.map((row) =>
    row.id === eventId ? { ...row, [key]: Math.max(0, (row[key] ?? 0) + amount) } : row,
  );
}

function setButtonLoading(button, loading, loadingText = '처리중...') {
  if (!button) return;
  if (!button.dataset.defaultText) {
    button.dataset.defaultText = button.textContent;
  }
  button.disabled = loading;
  button.textContent = loading ? loadingText : button.dataset.defaultText;
}

async function hashPassword(password) {
  const encoded = new TextEncoder().encode(password);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function getStoredEvents() {
  const stored = JSON.parse(localStorage.getItem('admin_events') || 'null');
  if (stored) return stored;
  return [
    {
      id: 'evt1',
      name: '마주(馬走)하는 승마교실',
      description:
        '말과 함께하는 특별한 체험! 전문 강사의 안전한 지도 아래 승마의 기초부터 배워보세요.',
      image: 'images/horse-riding.svg',
      status: deriveEventStatus({ bookingOpen: false }),
      bookingOpen: false,
      videoUrl: '',
      documentTemplateUrl:
        'https://github.com/sportsbox031/event/blob/main/2026%20%EC%8A%A4%ED%8F%AC%EC%B8%A0%EB%B0%95%EC%8A%A4%20%EB%A7%88%EC%A3%BC(%E9%A6%AC%E8%B5%B0)%ED%95%98%EB%8A%94%20%EC%8A%B9%EB%A7%88%EA%B5%90%EC%8B%A4%20%EA%B3%B5%EA%B3%A0.hwpx',
    },
    {
      id: 'evt2',
      name: '설래(雪來)는 스키교실',
      description: '겨울 스포츠의 꽃, 스키! 초보자도 쉽게 배울 수 있는 맞춤형 스키 교실입니다.',
      image: 'images/skiing.svg',
      status: deriveEventStatus({ bookingOpen: false }),
      bookingOpen: false,
      videoUrl: 'https://www.youtube.com/watch?v=g8ZcvhQWQ_0',
      documentTemplateUrl: '',
    },
  ];
}

function getStoredSchedules() {
  const map = JSON.parse(localStorage.getItem('admin_schedules') || '{}');
  return Object.entries(map).flatMap(([eventId, list]) =>
    (list || []).map((item) => ({ eventId, ...item })),
  );
}

function getStoredReservations() {
  return JSON.parse(localStorage.getItem('reservations') || '[]').map((item) => ({
    ...item,
    date: normalizeDateString(item.date),
    createdAt: item.createdAt || formatTimestamp(new Date().toISOString()),
  }));
}

function getStoredDocumentSubmissions() {
  return JSON.parse(localStorage.getItem('document_submissions') || '[]').map((item) => ({
    id: String(item.id || ''),
    eventId: String(item.eventId || ''),
    eventName: String(item.eventName || ''),
    groupName: String(item.groupName || ''),
    manager: String(item.manager || ''),
    contact: String(item.contact || ''),
    fileName: String(item.fileName || ''),
    fileUrl: String(item.fileUrl || ''),
    fileId: String(item.fileId || ''),
    mimeType: String(item.mimeType || ''),
    createdAt: String(item.createdAt || formatTimestamp(new Date().toISOString())),
  }));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
