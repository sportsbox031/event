import { formatDate } from '../shared/date.mjs';

export function renderEventsLoading(container) {
  container.innerHTML = `
    <div class="loading-block">
      <span class="loading-spinner" aria-hidden="true"></span>
      <span>이벤트를 불러오는 중...</span>
    </div>
  `;
}

export function renderEvents(container, events) {
  if (!events.length) {
    container.innerHTML = `
      <div class="loading-block">
        <span>현재 모집중인 이벤트가 없습니다.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = events
    .map(
      (event, index) => `
        <article class="event-card reveal-init" data-event-id="${escapeAttribute(event.id)}" style="animation-delay:${index * 0.08}s">
          <div class="event-card-image">
            <img src="${escapeAttribute(event.image)}" alt="${escapeAttribute(event.name)}" loading="lazy">
            <span class="event-card-badge ${getBadgeClass(event.bookingOpen)}">${escapeHtml(getEventBadgeLabel(event.bookingOpen))}</span>
          </div>
          <div class="event-card-body">
            <h3 class="event-card-title">${escapeHtml(event.name)}</h3>
            <p class="event-card-desc">${escapeHtml(event.description)}</p>
            <div class="event-card-arrow" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17l9.2-9.2M17 17V7.8H7.8"/></svg>
            </div>
          </div>
        </article>
      `,
    )
    .join('');
}

function getBadgeClass(bookingOpen) {
  return bookingOpen ? '' : 'preparing';
}

function getEventBadgeLabel(bookingOpen) {
  return bookingOpen ? '모집중' : '준비중';
}

export function renderCalendarSkeleton(container) {
  container.innerHTML = Array.from(
    { length: 35 },
    () => `<div class="cal-day skeleton-day"><div class="skeleton-pulse"></div></div>`,
  ).join('');
}

export function renderCalendar({
  body,
  monthLabel,
  prevButton,
  nextButton,
  year,
  month,
  availableDates,
  fixedMonth,
}) {
  monthLabel.textContent = `${year}년 ${month + 1}월`;
  const locked = Boolean(fixedMonth);
  prevButton.disabled = locked;
  nextButton.disabled = locked;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  let html = '';

  for (let offset = firstDay - 1; offset >= 0; offset -= 1) {
    html += `<div class="cal-day other">${prevDays - offset}</div>`;
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dateStr = formatDate(date);
    const isToday = date.getTime() === today.getTime();
    const isPast = date < today;
    const isAvailable = !isPast && availableDates.has(dateStr);
    const classes = ['cal-day'];

    if (isToday) classes.push('today');
    if (isAvailable) classes.push('available');

    if (isAvailable) {
      html += `<button type="button" class="${classes.join(' ')}" data-date="${dateStr}">${day}</button>`;
    } else {
      html += `<div class="${classes.join(' ')}">${day}</div>`;
    }
  }

  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let day = 1; day <= remaining; day += 1) {
    html += `<div class="cal-day other">${day}</div>`;
  }

  body.innerHTML = html;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
