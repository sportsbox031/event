import { apiPost } from '../shared/http.js';
import { formatTimestamp } from '../shared/date.mjs';
import {
  ensureSchedules,
  getActionEventId,
  getCalendarState,
  getCurrentEventId,
  getEvent,
  getEvents,
  getScheduleEntry,
  invalidateSchedules,
  loadCatalog,
  setActionEvent,
  setCalendarState,
  setCurrentEvent,
  shiftCalendarMonth,
} from './store.js';
import { renderCalendar, renderCalendarSkeleton, renderEvents, renderEventsLoading } from './render.js';

const dom = {};
let revealObserver = null;
let hoverState = null;

export async function initApp() {
  cacheDom();
  bindStaticEvents();
  renderEventsLoading(dom.eventsCarousel);
  setupRevealObserver();
  setupHeaderScroll();
  setupCardHover();

  const { events } = await loadCatalog();
  renderEvents(dom.eventsCarousel, events);
  dom.statEvents.textContent = String(events.length);
  observeRevealTargets();
}

function cacheDom() {
  dom.header = document.querySelector('.header');
  dom.eventsCarousel = document.getElementById('eventsCarousel');
  dom.statEvents = document.getElementById('statEvents');
  dom.eventActionModal = document.getElementById('eventActionModal');
  dom.actionEventTitle = document.getElementById('actionEventTitle');
  dom.actionEventDesc = document.getElementById('actionEventDesc');
  dom.btnWatchVideo = document.getElementById('btnWatchVideo');
  dom.btnStartReservation = document.getElementById('btnStartReservation');
  dom.calendarModal = document.getElementById('calendarModal');
  dom.calendarEventTitle = document.getElementById('calendarEventTitle');
  dom.calendarEventDesc = document.getElementById('calendarEventDesc');
  dom.calMonth = document.getElementById('calMonth');
  dom.calPrev = document.getElementById('calPrev');
  dom.calNext = document.getElementById('calNext');
  dom.calBody = document.getElementById('calBody');
  dom.reservationModal = document.getElementById('reservationModal');
  dom.reservationForm = document.getElementById('reservationForm');
  dom.reservationEventName = document.getElementById('reservationEventName');
  dom.resDate = document.getElementById('resDate');
  dom.resGroup = document.getElementById('resGroup');
  dom.resManager = document.getElementById('resManager');
  dom.resContact = document.getElementById('resContact');
  dom.resCount = document.getElementById('resCount');
  dom.resError = document.getElementById('resError');
  dom.btnSubmitRes = document.getElementById('btnSubmitRes');
  dom.successModal = document.getElementById('successModal');
}

function bindStaticEvents() {
  dom.eventsCarousel.addEventListener('click', handleEventCardClick);
  dom.btnWatchVideo.addEventListener('click', openEventVideo);
  dom.btnStartReservation.addEventListener('click', startReservationFromAction);
  dom.calPrev.addEventListener('click', () => {
    shiftCalendarMonth(-1);
    paintCalendar();
  });
  dom.calNext.addEventListener('click', () => {
    shiftCalendarMonth(1);
    paintCalendar();
  });
  dom.calBody.addEventListener('click', handleCalendarClick);
  dom.reservationForm.addEventListener('submit', submitReservation);

  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (event) => {
      if (event.target !== overlay) return;
      overlay.classList.remove('active');
    });
  });

  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => {
      const modalId = button.getAttribute('data-close-modal');
      const modal = document.getElementById(modalId);
      modal?.classList.remove('active');
    });
  });
}

function handleEventCardClick(event) {
  const card = event.target.closest('.event-card');
  if (!card) return;
  openEventActionModal(card.dataset.eventId);
}

function handleCalendarClick(event) {
  const dayButton = event.target.closest('[data-date]');
  if (!dayButton) return;
  openReservationModal(dayButton.dataset.date);
}

function setupRevealObserver() {
  revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          revealObserver.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.1 },
  );
}

function observeRevealTargets() {
  document.querySelectorAll('.section-header, .event-card').forEach((element) => {
    element.classList.add('reveal-init');
    revealObserver.observe(element);
  });
}

function setupHeaderScroll() {
  let ticking = false;

  const updateHeader = () => {
    dom.header.classList.toggle('scrolled', window.scrollY > 50);
    ticking = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateHeader);
    },
    { passive: true },
  );

  updateHeader();
}

function setupCardHover() {
  const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (isTouchDevice) return;

  hoverState = {
    activeCard: null,
    frameId: 0,
    pointerX: 0,
    pointerY: 0,
  };

  dom.eventsCarousel.addEventListener('pointermove', (event) => {
    const card = event.target.closest('.event-card');
    if (!card) return;

    hoverState.activeCard = card;
    hoverState.pointerX = event.clientX;
    hoverState.pointerY = event.clientY;

    if (hoverState.frameId) return;
    hoverState.frameId = window.requestAnimationFrame(applyCardTilt);
  });

  dom.eventsCarousel.addEventListener('pointerleave', resetCardTilt);
}

function applyCardTilt() {
  hoverState.frameId = 0;
  const card = hoverState.activeCard;
  if (!card) return;

  const rect = card.getBoundingClientRect();
  const x = hoverState.pointerX - rect.left;
  const y = hoverState.pointerY - rect.top;

  if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
    card.style.transform = '';
    return;
  }

  const rotateX = (y - rect.height / 2) / 25;
  const rotateY = (rect.width / 2 - x) / 25;
  card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px) scale(1.01)`;
}

function resetCardTilt() {
  if (!hoverState?.activeCard) return;
  hoverState.activeCard.style.transform = '';
  hoverState.activeCard = null;
}

function openEventActionModal(eventId) {
  const event = getEvent(eventId);
  if (!event) return;

  setActionEvent(eventId);
  dom.actionEventTitle.textContent = event.name;
  dom.actionEventDesc.textContent = event.description;
  dom.btnWatchVideo.disabled = !event.videoUrl;
  dom.btnWatchVideo.textContent = event.videoUrl ? '영상으로 확인하기' : '등록된 영상이 없습니다';
  dom.eventActionModal.classList.add('active');

  if (event.bookingOpen) {
    void ensureSchedules(eventId);
  }
}

function openEventVideo() {
  const event = getEvent(getActionEventId());
  if (!event?.videoUrl) {
    alert('등록된 영상 링크가 없습니다.');
    return;
  }

  window.open(event.videoUrl, '_blank', 'noopener');
}

function startReservationFromAction() {
  const eventId = getActionEventId();
  dom.eventActionModal.classList.remove('active');
  if (!eventId) return;

  setActionEvent(null);
  void openCalendarModal(eventId);
}

async function openCalendarModal(eventId) {
  const event = getEvent(eventId);
  if (!event) return;
  if (!event.bookingOpen) {
    alert('예약기간이 아닙니다.');
    return;
  }

  setCurrentEvent(eventId);
  dom.calendarEventTitle.textContent = event.name;
  dom.calendarEventDesc.textContent = event.description;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  setCalendarState(today.getFullYear(), today.getMonth(), null);
  dom.calendarModal.classList.add('active');
  renderCalendarSkeleton(dom.calBody);

  const scheduleEntry = await ensureSchedules(eventId);
  const scheduleDates = [...scheduleEntry.dates]
    .map((date) => new Date(`${date}T00:00:00`))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());

  if (scheduleDates.length) {
    const nearest = scheduleDates.find((date) => date >= today) ?? scheduleDates[0];
    setCalendarState(nearest.getFullYear(), nearest.getMonth(), {
      year: nearest.getFullYear(),
      month: nearest.getMonth(),
    });
  }

  paintCalendar();
}

function paintCalendar() {
  const { year, month, fixedMonth } = getCalendarState();
  const scheduleEntry = getScheduleEntry(getCurrentEventId());

  renderCalendar({
    body: dom.calBody,
    monthLabel: dom.calMonth,
    prevButton: dom.calPrev,
    nextButton: dom.calNext,
    year,
    month,
    availableDates: scheduleEntry.dates,
    fixedMonth,
  });
}

function openReservationModal(date) {
  const event = getEvent(getCurrentEventId());
  dom.reservationEventName.textContent = event?.name ?? '';
  dom.resDate.value = date;
  dom.resGroup.value = '';
  dom.resManager.value = '';
  dom.resContact.value = '';
  dom.resCount.value = '';
  dom.resError.textContent = '';
  dom.resError.style.display = 'none';
  dom.reservationModal.classList.add('active');
}

async function submitReservation(event) {
  event.preventDefault();

  const participantCount = Number.parseInt(dom.resCount.value, 10);
  if (!participantCount || participantCount < 1) {
    dom.resError.textContent = '참여인원을 1명 이상 입력하세요.';
    dom.resError.style.display = 'block';
    return;
  }

  dom.resError.style.display = 'none';
  dom.btnSubmitRes.disabled = true;
  dom.btnSubmitRes.textContent = '처리중...';

  const currentEventId = getCurrentEventId();
  const currentEvent = getEvent(currentEventId);
  const payload = {
    eventId: currentEventId,
    eventName: currentEvent?.name ?? '',
    date: dom.resDate.value,
    groupName: dom.resGroup.value.trim(),
    manager: dom.resManager.value.trim(),
    contact: dom.resContact.value.trim(),
    participants: participantCount,
    status: '대기',
    createdAt: formatTimestamp(new Date().toISOString()),
  };

  try {
    await apiPost('addReservation', payload);
  } catch (error) {
    console.error('Reservation request failed, storing locally:', error);
    const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
    reservations.push({ ...payload, id: `res_${Date.now()}` });
    localStorage.setItem('reservations', JSON.stringify(reservations));
  }

  dom.btnSubmitRes.disabled = false;
  dom.btnSubmitRes.textContent = '예약하기';
  invalidateSchedules(currentEventId);
  dom.reservationModal.classList.remove('active');
  dom.calendarModal.classList.remove('active');
  dom.successModal.classList.add('active');
}
