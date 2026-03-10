// ===== Configuration =====
const API_URL = 'https://script.google.com/macros/s/AKfycbxNR2RzyTRNtffOKePyAp964PikCRzEqzpA2KPJmQfUAnx0pjCiQBdUkxfh5_OsqlZi/exec';

// ===== State =====
let events = [];
let schedules = [];
let currentEventId = null;
let actionEventId = null;
let calendarYear = 2026;
let calendarMonth = 2;
let calendarFixedMonth = null;
let schedulesCache = {};
let prefetchPromise = null;

function toBoolean(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
}

function normalizeDateString(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    return formatDate(parsed);
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    renderEventsLoading();
    loadEvents();
    initScrollAnimations();
});

// ===== Scroll Animations =====
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.event-card, .section-header').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(40px)';
        el.style.transition = 'all 0.8s cubic-bezier(0.23, 1, 0.32, 1)';
        observer.observe(el);
    });

    const style = document.createElement('style');
    style.textContent = `.animate-in { opacity: 1 !important; transform: translateY(0) !important; }`;
    document.head.appendChild(style);
}

// ===== Data Loading =====
async function loadEvents() {
    renderEventsLoading();
    if (API_URL) {
        try {
            const res = await fetch(`${API_URL}?action=getEvents`);
            const data = await res.json();
            events = data
                .map(e => ({ ...e, bookingOpen: toBoolean(e.bookingOpen), videoUrl: String(e.videoUrl ?? '') }))
                .filter(e => e.status === '모집중');
        } catch (e) {
            console.error('API Error:', e);
            events = getMockEvents();
        }
    } else {
        events = getMockEvents();
    }
    renderEvents();
    const statEl = document.getElementById('statEvents');
    if (statEl) statEl.textContent = events.length;
}

function renderEventsLoading() {
    const carousel = document.getElementById('eventsCarousel');
    if (!carousel) return;
    carousel.innerHTML = `
        <div class="loading-block">
            <span class="loading-spinner" aria-hidden="true"></span>
            <span>이벤트를 불러오는 중...</span>
        </div>
    `;
}

async function loadSchedules(eventId) {
    // 캐시에 있으면 바로 반환
    if (schedulesCache[eventId]) {
        schedules = schedulesCache[eventId];
        return;
    }

    if (API_URL) {
        try {
            const res = await fetch(`${API_URL}?action=getSchedules&eventId=${eventId}`);
            const raw = await res.json();
            schedules = (Array.isArray(raw) ? raw : [])
                .map(item => ({ ...item, date: normalizeDateString(item.date) }))
                .filter(item => item.date);
        } catch (e) {
            console.error('API Error:', e);
            schedules = getMockSchedules(eventId);
        }
    } else {
        schedules = getMockSchedules(eventId);
    }

    // 캐시 저장
    schedulesCache[eventId] = schedules;
}

// ===== Mock Data =====
function getMockEvents() {
    return [
        {
            id: 'evt1',
            name: '마주(馬走)하는 승마교실',
            description: '말과 함께하는 특별한 체험! 전문 강사의 안전한 지도 아래 승마의 기초부터 배워보세요.',
            image: 'images/horse-riding.svg',
            status: '모집중',
            bookingOpen: false,
            videoUrl: ''
        },
        {
            id: 'evt2',
            name: '설래(雪來)는 스키교실',
            description: '겨울 스포츠의 꽃, 스키! 초보자도 쉽게 배울 수 있는 맞춤형 스키 교실입니다.',
            image: 'images/skiing.svg',
            status: '모집중',
            bookingOpen: false,
            videoUrl: 'https://www.youtube.com/watch?v=g8ZcvhQWQ_0'
        }
    ];
}

function getMockSchedules(eventId) {
    const today = new Date();
    const mockSchedules = [];
    for (let i = 5; i <= 28; i += 3) {
        const d = new Date(today.getFullYear(), today.getMonth(), i);
        if (d >= today) {
            mockSchedules.push({
                eventId: eventId,
                date: formatDate(d)
            });
        }
    }
    for (let i = 3; i <= 25; i += 4) {
        const d = new Date(today.getFullYear(), today.getMonth() + 1, i);
        mockSchedules.push({
            eventId: eventId,
            date: formatDate(d)
        });
    }
    return mockSchedules;
}

// ===== Render Events =====
function renderEvents() {
    const carousel = document.getElementById('eventsCarousel');
    if (events.length === 0) {
        carousel.innerHTML = `
            <div class="loading-block">
                <span>현재 모집중인 이벤트가 없습니다.</span>
            </div>
        `;
        return;
    }
    carousel.innerHTML = events.map((evt, i) => `
        <div class="event-card" onclick="openEventActionModal('${evt.id}')" style="animation-delay: ${i * 0.15}s">
            <div class="event-card-image">
                <img src="${evt.image}" alt="${evt.name}" onerror="this.style.display='none'">
                <span class="event-card-badge ${evt.status === '모집마감' ? 'closed' : evt.status === '준비중' ? 'preparing' : ''}">${evt.status}</span>
            </div>
            <div class="event-card-body">
                <h3 class="event-card-title">${evt.name}</h3>
                <p class="event-card-desc">${evt.description}</p>
                <div class="event-card-arrow">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17l9.2-9.2M17 17V7.8H7.8"/></svg>
                </div>
            </div>
        </div>
    `).join('');

    setTimeout(() => initScrollAnimations(), 100);
}

function openEventActionModal(eventId) {
    const evt = events.find(e => e.id === eventId);
    if (!evt) return;

    actionEventId = eventId;
    document.getElementById('actionEventTitle').textContent = evt.name;
    document.getElementById('actionEventDesc').textContent = evt.description;

    const videoBtn = document.getElementById('btnWatchVideo');
    const hasVideo = !!evt.videoUrl;
    videoBtn.disabled = !hasVideo;
    videoBtn.textContent = hasVideo ? '영상으로 확인하기' : '등록된 영상이 없습니다';

    // 예약하기 누르기 전에 일정 미리 로드
    if (evt.bookingOpen) {
        prefetchPromise = loadSchedules(eventId);
    }

    document.getElementById('eventActionModal').classList.add('active');
}

function closeEventActionModal() {
    document.getElementById('eventActionModal').classList.remove('active');
    actionEventId = null;
}

function openEventVideo() {
    const evt = events.find(e => e.id === actionEventId);
    if (!evt || !evt.videoUrl) {
        alert('등록된 영상 링크가 없습니다.');
        return;
    }
    window.open(evt.videoUrl, '_blank', 'noopener');
}

function startReservationFromAction() {
    const eventId = actionEventId;
    document.getElementById('eventActionModal').classList.remove('active');
    if (!eventId) return;
    actionEventId = null;
    openCalendarModal(eventId);
}

// ===== Calendar Loading Skeleton =====
function showCalendarSkeleton() {
    const calBody = document.getElementById('calBody');
    let html = '';
    for (let i = 0; i < 35; i++) {
        html += `<div class="cal-day skeleton-day"><div class="skeleton-pulse"></div></div>`;
    }
    calBody.innerHTML = html;
}

// ===== Calendar Modal =====
async function openCalendarModal(eventId) {
    currentEventId = eventId;
    const evt = events.find(e => e.id === eventId);
    if (!evt) return;
    if (!evt.bookingOpen) {
        alert('예약기간이 아닙니다.');
        return;
    }

    document.getElementById('calendarEventTitle').textContent = evt.name;
    document.getElementById('calendarEventDesc').textContent = evt.description;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    calendarYear = today.getFullYear();
    calendarMonth = today.getMonth();
    calendarFixedMonth = null;

    // 모달 먼저 열고 스켈레톤 표시
    document.getElementById('calendarModal').classList.add('active');
    document.getElementById('calMonth').textContent = `${calendarYear}년 ${calendarMonth + 1}월`;
    showCalendarSkeleton();

    // prefetch가 있으면 재사용, 없으면 새로 로드
    if (prefetchPromise) {
        await prefetchPromise;
        prefetchPromise = null;
    } else {
        await loadSchedules(eventId);
    }

    // 이벤트 일정이 있는 월로 달력을 고정해서 해당 월만 표시
    if (schedules.length > 0) {
        const scheduleDates = schedules
            .map(item => new Date(`${item.date}T00:00:00`))
            .filter(date => !Number.isNaN(date.getTime()))
            .sort((a, b) => a.getTime() - b.getTime());

        if (scheduleDates.length > 0) {
            const nearest = scheduleDates.find(date => date >= today) || scheduleDates[0];
            calendarYear = nearest.getFullYear();
            calendarMonth = nearest.getMonth();
            calendarFixedMonth = { year: calendarYear, month: calendarMonth };
        }
    }

    renderCalendar();
}

function closeCalendarModal() {
    document.getElementById('calendarModal').classList.remove('active');
}

function renderCalendar() {
    const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    document.getElementById('calMonth').textContent = `${calendarYear}년 ${monthNames[calendarMonth]}`;
    const prevBtn = document.getElementById('calPrev');
    const nextBtn = document.getElementById('calNext');
    const locked = !!calendarFixedMonth;
    prevBtn.disabled = locked;
    nextBtn.disabled = locked;

    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const prevDays = new Date(calendarYear, calendarMonth, 0).getDate();
    const today = new Date();
    today.setHours(0,0,0,0);

    let html = '';

    for (let i = firstDay - 1; i >= 0; i--) {
        html += `<div class="cal-day other">${prevDays - i}</div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = formatDate(new Date(calendarYear, calendarMonth, d));
        const schedule = schedules.find(s => s.date === dateStr);
        const dateObj = new Date(calendarYear, calendarMonth, d);
        const isToday = dateObj.getTime() === today.getTime();
        const isPast = dateObj < today;

        let cls = 'cal-day';
        if (isToday) cls += ' today';

        if (schedule && !isPast) {
            cls += ' available';
            html += `<div class="${cls}" onclick="openReservationModal('${dateStr}')">${d}</div>`;
        } else {
            html += `<div class="${cls}">${d}</div>`;
        }
    }

    const totalCells = firstDay + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
        html += `<div class="cal-day other">${i}</div>`;
    }

    document.getElementById('calBody').innerHTML = html;
}

document.getElementById('calPrev').addEventListener('click', () => {
    if (calendarFixedMonth) return;
    calendarMonth--;
    if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
    renderCalendar();
});

document.getElementById('calNext').addEventListener('click', () => {
    if (calendarFixedMonth) return;
    calendarMonth++;
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
    renderCalendar();
});

// ===== Reservation Modal =====
function openReservationModal(dateStr) {
    const evt = events.find(e => e.id === currentEventId);

    document.getElementById('reservationEventName').textContent = evt ? evt.name : '';
    document.getElementById('resDate').value = dateStr;
    document.getElementById('resGroup').value = '';
    document.getElementById('resManager').value = '';
    document.getElementById('resContact').value = '';
    document.getElementById('resCount').value = '';
    document.getElementById('resError').textContent = '';
    document.getElementById('resError').style.display = 'none';

    document.getElementById('reservationModal').classList.add('active');
}

function closeReservationModal() {
    document.getElementById('reservationModal').classList.remove('active');
}

async function submitReservation(e) {
    e.preventDefault();
    const count = parseInt(document.getElementById('resCount').value);
    const errEl = document.getElementById('resError');
    if (!count || count < 1) {
        errEl.textContent = '참여인원을 1명 이상 입력하세요.';
        errEl.style.display = 'block';
        return;
    }
    errEl.style.display = 'none';

    const btn = document.getElementById('btnSubmitRes');
    btn.disabled = true;
    btn.textContent = '처리중...';

    const data = {
        eventId: currentEventId,
        eventName: events.find(ev => ev.id === currentEventId)?.name || '',
        date: document.getElementById('resDate').value,
        groupName: document.getElementById('resGroup').value,
        manager: document.getElementById('resManager').value,
        contact: document.getElementById('resContact').value,
        participants: count,
        status: '대기',
        createdAt: new Date().toLocaleString('ko-KR')
    };

    if (API_URL) {
        try {
            await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action: 'addReservation', data })
            });
        } catch (e) {
            console.error('API Error:', e);
        }
    } else {
        const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
        data.id = 'res_' + Date.now();
        reservations.push(data);
        localStorage.setItem('reservations', JSON.stringify(reservations));
    }

    btn.disabled = false;
    btn.textContent = '예약하기';
    delete schedulesCache[currentEventId];
    closeReservationModal();
    closeCalendarModal();

    document.getElementById('successModal').classList.add('active');
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.remove('active');
}

// ===== Utility =====
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
        }
    });
});

// ===== Header scroll effect =====
window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (header) {
        header.classList.toggle('scrolled', window.scrollY > 50);
    }
});

// ===== Card tilt effect =====
document.addEventListener('mousemove', (e) => {
    document.querySelectorAll('.event-card').forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 25;
            const rotateY = (centerX - x) / 25;
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px) scale(1.01)`;
        } else {
            card.style.transform = '';
        }
    });
});
