// ===== Configuration =====
const API_URL = 'https://script.google.com/macros/s/AKfycbxNR2RzyTRNtffOKePyAp964PikCRzEqzpA2KPJmQfUAnx0pjCiQBdUkxfh5_OsqlZi/exec';

// ===== State =====
let adminEvents = [];
let adminSchedules = [];
let adminReservations = [];
let currentDetailEventId = null;
let bookingToggleLoading = false;
let bookingToggleTarget = null;

// ===== Helpers =====
function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function toBoolean(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
}

function normalizeDateString(value) {
    if (!value) return '';
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;

    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function setButtonLoading(button, loading, loadingText = '처리중...') {
    if (!button) return;
    if (!button.dataset.defaultText) {
        button.dataset.defaultText = button.textContent;
    }
    button.disabled = !!loading;
    button.textContent = loading ? loadingText : button.dataset.defaultText;
}

async function apiGet(action, params = {}) {
    const query = new URLSearchParams({ action, ...params });
    const res = await fetch(`${API_URL}?${query.toString()}`);
    return res.json();
}

async function apiPost(action, data = {}) {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action, data })
    });
    return res.json();
}

function getDefaultEvents() {
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

function getStoredEvents() {
    const stored = JSON.parse(localStorage.getItem('admin_events') || 'null');
    return stored || getDefaultEvents();
}

function saveStoredEvents() {
    localStorage.setItem('admin_events', JSON.stringify(adminEvents));
}

function getStoredSchedules() {
    const map = JSON.parse(localStorage.getItem('admin_schedules') || '{}');
    return Object.entries(map).flatMap(([eventId, list]) => {
        return (list || []).map(item => ({ eventId, ...item }));
    });
}

function saveStoredSchedules() {
    const map = {};
    adminSchedules.forEach(s => {
        if (!map[s.eventId]) map[s.eventId] = [];
        map[s.eventId].push({ date: s.date });
    });
    localStorage.setItem('admin_schedules', JSON.stringify(map));
}

function getStoredReservations() {
    return JSON.parse(localStorage.getItem('reservations') || '[]');
}

async function hashPassword(pw) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function ensureLocalAdmin() {
    if (!localStorage.getItem('admin_id')) {
        localStorage.setItem('admin_id', 'admin');
    }
    if (!localStorage.getItem('admin_pw')) {
        const hash = await hashPassword('admin123');
        localStorage.setItem('admin_pw', hash);
    }
}

// ===== Login =====
async function handleLogin(e) {
    e.preventDefault();
    const id = document.getElementById('loginId').value.trim();
    const pw = document.getElementById('loginPw').value;
    const errorEl = document.getElementById('loginError');
    const submitBtn = document.getElementById('loginSubmitBtn');
    errorEl.textContent = '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '처리중...';
    }

    const hash = await hashPassword(pw);
    let success = false;
    if (API_URL) {
        try {
            const result = await apiPost('adminLogin', { id, hash });
            success = !!result.success;
        } catch (err) {
            console.error(err);
            errorEl.textContent = '로그인 서버 연결에 실패했습니다.';
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = '로그인';
            }
            return;
        }
    } else {
        await ensureLocalAdmin();
        const storedId = localStorage.getItem('admin_id');
        const storedPw = localStorage.getItem('admin_pw');
        success = id === storedId && hash === storedPw;
    }

    if (!success) {
        errorEl.textContent = '아이디 또는 비밀번호가 올바르지 않습니다.';
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '로그인';
        }
        return;
    }

    sessionStorage.setItem('admin_logged_in', 'true');
    sessionStorage.setItem('admin_id', id);
    await showDashboard();
}

function handleLogout() {
    sessionStorage.removeItem('admin_logged_in');
    sessionStorage.removeItem('admin_id');
    location.reload();
}

async function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    renderEventTableLoading();
    await loadAdminData();
}

// ===== Password Change =====
function openPasswordModal() {
    document.getElementById('passwordModal').classList.add('active');
    document.getElementById('pwCurrent').value = '';
    document.getElementById('pwNew').value = '';
    document.getElementById('pwConfirm').value = '';
    document.getElementById('pwError').textContent = '';
}

function closePasswordModal() {
    document.getElementById('passwordModal').classList.remove('active');
}

async function changePassword(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('passwordSubmitBtn');
    setButtonLoading(submitBtn, true, '변경중...');

    const current = document.getElementById('pwCurrent').value;
    const newPw = document.getElementById('pwNew').value;
    const confirm = document.getElementById('pwConfirm').value;
    const errEl = document.getElementById('pwError');
    errEl.textContent = '';

    if (newPw !== confirm) {
        errEl.textContent = '새 비밀번호가 일치하지 않습니다.';
        setButtonLoading(submitBtn, false);
        return;
    }
    if (newPw.length < 4) {
        errEl.textContent = '비밀번호는 4자 이상이어야 합니다.';
        setButtonLoading(submitBtn, false);
        return;
    }

    const adminId = sessionStorage.getItem('admin_id') || 'admin';
    const currentHash = await hashPassword(current);
    const newHash = await hashPassword(newPw);

    if (API_URL) {
        try {
            const result = await apiPost('changePassword', { id: adminId, currentHash, newHash });
            if (!result.success) {
                errEl.textContent = '현재 비밀번호가 올바르지 않습니다.';
                setButtonLoading(submitBtn, false);
                return;
            }
        } catch (err) {
            console.error(err);
            errEl.textContent = '비밀번호 변경 중 오류가 발생했습니다.';
            setButtonLoading(submitBtn, false);
            return;
        }
    } else {
        await ensureLocalAdmin();
        if (currentHash !== localStorage.getItem('admin_pw')) {
            errEl.textContent = '현재 비밀번호가 올바르지 않습니다.';
            setButtonLoading(submitBtn, false);
            return;
        }
        localStorage.setItem('admin_pw', newHash);
    }

    setButtonLoading(submitBtn, false);
    closePasswordModal();
    alert('비밀번호가 변경되었습니다.');
}

// ===== Data Loading =====
async function loadAdminData() {
    renderEventTableLoading();
    if (API_URL) {
        const [eventsResult, schedulesResult, reservationsResult] = await Promise.allSettled([
            apiGet('getEvents'),
            apiGet('getSchedules'),
            apiGet('getReservations')
        ]);

        if (eventsResult.status === 'fulfilled' && Array.isArray(eventsResult.value)) {
            adminEvents = eventsResult.value.map(item => ({
                ...item,
                id: String(item.id ?? ''),
                bookingOpen: toBoolean(item.bookingOpen),
                videoUrl: String(item.videoUrl ?? '')
            }));
        } else {
            console.error('Failed to load events', eventsResult.status === 'rejected' ? eventsResult.reason : eventsResult.value);
            adminEvents = getStoredEvents();
        }

        if (schedulesResult.status === 'fulfilled' && Array.isArray(schedulesResult.value)) {
            adminSchedules = schedulesResult.value.map(item => ({
                ...item,
                eventId: String(item.eventId ?? ''),
                date: normalizeDateString(item.date)
            })).filter(item => item.date);
        } else {
            console.error('Failed to load schedules', schedulesResult.status === 'rejected' ? schedulesResult.reason : schedulesResult.value);
            adminSchedules = getStoredSchedules();
        }

        if (reservationsResult.status === 'fulfilled' && Array.isArray(reservationsResult.value)) {
            adminReservations = reservationsResult.value.map(item => ({
                ...item,
                date: normalizeDateString(item.date)
            }));
        } else {
            console.error('Failed to load reservations', reservationsResult.status === 'rejected' ? reservationsResult.reason : reservationsResult.value);
            adminReservations = getStoredReservations();
        }
    } else {
        adminEvents = getStoredEvents();
        adminSchedules = getStoredSchedules();
        adminReservations = getStoredReservations();
    }

    renderEventTable();
}

function renderEventTableLoading() {
    const tbody = document.getElementById('eventTableBody');
    if (!tbody) return;
    tbody.innerHTML = `
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

// ===== Event Management =====
function renderEventTable() {
    const tbody = document.getElementById('eventTableBody');

    tbody.innerHTML = adminEvents.map((evt, i) => {
        const evtSchedules = adminSchedules.filter(s => s.eventId === evt.id);
        const evtReservations = adminReservations.filter(r => r.eventId === evt.id);
        const statusClass = evt.status === '모집중' ? 'status-open' : evt.status === '모집마감' ? 'status-closed' : 'status-preparing';

        return `<tr>
            <td>${i + 1}</td>
            <td><strong>${escapeHtml(evt.name)}</strong></td>
            <td><span class="status-badge ${statusClass}">${escapeHtml(evt.status)}</span></td>
            <td>${evtSchedules.length}개</td>
            <td>${evtReservations.length}건</td>
            <td>
                <button class="btn-sm btn-detail" onclick="openEventDetail('${escapeHtml(evt.id)}')">상세</button>
                <button class="btn-sm btn-edit" onclick="openEventFormModal('${escapeHtml(evt.id)}')">수정</button>
                <button class="btn-sm btn-delete" onclick="deleteEvent('${escapeHtml(evt.id)}', this)">삭제</button>
            </td>
        </tr>`;
    }).join('');
}

function openEventFormModal(eventId) {
    const modal = document.getElementById('eventFormModal');
    const isEdit = !!eventId;

    document.getElementById('eventFormTitle').textContent = isEdit ? '이벤트 수정' : '이벤트 등록';
    document.getElementById('eventFormId').value = eventId || '';

    if (isEdit) {
        const evt = adminEvents.find(item => item.id === eventId);
        if (!evt) return;
        document.getElementById('eventFormName').value = evt.name;
        document.getElementById('eventFormDesc').value = evt.description;
        document.getElementById('eventFormImage').value = evt.image || '';
        document.getElementById('eventFormVideo').value = evt.videoUrl || '';
        document.getElementById('eventFormStatus').value = evt.status;
    } else {
        document.getElementById('eventFormName').value = '';
        document.getElementById('eventFormDesc').value = '';
        document.getElementById('eventFormImage').value = '';
        document.getElementById('eventFormVideo').value = '';
        document.getElementById('eventFormStatus').value = '모집중';
    }

    modal.classList.add('active');
}

function closeEventFormModal() {
    document.getElementById('eventFormModal').classList.remove('active');
}

async function saveEvent(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('eventFormSubmitBtn');
    setButtonLoading(submitBtn, true, '저장중...');

    const id = document.getElementById('eventFormId').value;
    const payload = {
        name: document.getElementById('eventFormName').value.trim(),
        description: document.getElementById('eventFormDesc').value.trim(),
        image: document.getElementById('eventFormImage').value.trim() || 'images/hero-bg.png',
        videoUrl: document.getElementById('eventFormVideo').value.trim(),
        status: document.getElementById('eventFormStatus').value,
        bookingOpen: id ? !!adminEvents.find(item => item.id === id)?.bookingOpen : false
    };

    if (API_URL) {
        try {
            await apiPost('saveEvent', id ? { ...payload, id } : payload);
            await loadAdminData();
        } catch (err) {
            console.error(err);
            alert('이벤트 저장에 실패했습니다.');
            setButtonLoading(submitBtn, false);
            return;
        }
    } else {
        if (id) {
            const idx = adminEvents.findIndex(item => item.id === id);
            if (idx !== -1) adminEvents[idx] = { ...adminEvents[idx], ...payload };
        } else {
            adminEvents.push({ id: `evt_${Date.now()}`, ...payload });
        }
        saveStoredEvents();
        renderEventTable();
    }

    setButtonLoading(submitBtn, false);
    closeEventFormModal();
}

async function deleteEvent(eventId, btnEl) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setButtonLoading(btnEl, true, '삭제중...');

    if (API_URL) {
        try {
            await apiPost('deleteEvent', { id: eventId });
            await loadAdminData();
        } catch (err) {
            console.error(err);
            alert('이벤트 삭제에 실패했습니다.');
            setButtonLoading(btnEl, false);
        }
        return;
    }

    adminEvents = adminEvents.filter(item => item.id !== eventId);
    saveStoredEvents();
    renderEventTable();
    setButtonLoading(btnEl, false);
}

// ===== Event Detail =====
function openEventDetail(eventId) {
    currentDetailEventId = eventId;
    const evt = adminEvents.find(item => item.id === eventId);
    if (!evt) return;

    document.getElementById('viewEventList').style.display = 'none';
    document.getElementById('viewEventDetail').style.display = 'block';
    document.getElementById('detailEventTitle').textContent = evt.name;
    renderBookingToggle();

    switchTab('schedules');
    renderSchedules();
    renderReservations();
}

function renderBookingToggle() {
    const wrap = document.getElementById('bookingToggleWrap');
    const evt = adminEvents.find(item => item.id === currentDetailEventId);
    if (!wrap || !evt) return;

    const isOpen = !!evt.bookingOpen;
    const isStarting = bookingToggleLoading && bookingToggleTarget === true;
    const isStopping = bookingToggleLoading && bookingToggleTarget === false;
    wrap.innerHTML = `
        <div class="booking-toggle">
            <span class="status-badge ${isOpen ? 'status-open' : 'status-closed'}">${isOpen ? '예약중' : '예약종료'}</span>
            <button class="btn-sm btn-success" onclick="setBookingOpen(true)" ${isOpen || bookingToggleLoading ? 'disabled' : ''}>${isStarting ? '처리중...' : '예약 시작'}</button>
            <button class="btn-sm btn-delete" onclick="setBookingOpen(false)" ${!isOpen || bookingToggleLoading ? 'disabled' : ''}>${isStopping ? '처리중...' : '예약 종료'}</button>
        </div>
    `;
}

async function setBookingOpen(open) {
    if (bookingToggleLoading) return;

    const evt = adminEvents.find(item => item.id === currentDetailEventId);
    if (!evt) return;

    const prevOpen = !!evt.bookingOpen;
    const updated = { ...evt, bookingOpen: !!open };
    bookingToggleLoading = true;
    bookingToggleTarget = !!open;

    const idx = adminEvents.findIndex(item => item.id === currentDetailEventId);
    if (idx !== -1) {
        adminEvents[idx] = updated;
    }
    renderBookingToggle();
    renderEventTable();

    if (API_URL) {
        try {
            const result = await apiPost('saveEvent', updated);
            if (!result.success) {
                throw new Error('saveEvent failed');
            }
        } catch (err) {
            console.error(err);
            if (idx !== -1) {
                adminEvents[idx] = { ...evt, bookingOpen: prevOpen };
            }
            alert('예약 상태 변경에 실패했습니다.');
        }
    } else {
        saveStoredEvents();
    }

    bookingToggleLoading = false;
    bookingToggleTarget = null;
    renderBookingToggle();
    renderEventTable();
}

async function backToEventList() {
    document.getElementById('viewEventDetail').style.display = 'none';
    document.getElementById('viewEventList').style.display = 'block';
    await loadAdminData();
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.getElementById('tabSchedules').style.display = tab === 'schedules' ? 'block' : 'none';
    document.getElementById('tabReservations').style.display = tab === 'reservations' ? 'block' : 'none';
}

function switchMenu(menu) {
    document.querySelectorAll('.admin-sidebar li').forEach(li => {
        li.classList.toggle('active', li.dataset.menu === menu);
    });
}

// ===== Schedules =====
async function addSchedule(btnEl) {
    setButtonLoading(btnEl, true, '추가중...');
    const date = document.getElementById('scheduleDate').value;

    if (!date) {
        alert('날짜를 선택하세요.');
        setButtonLoading(btnEl, false);
        return;
    }

    const exists = adminSchedules.some(s => s.eventId === currentDetailEventId && s.date === date);
    if (exists) {
        alert('이미 등록된 날짜입니다.');
        setButtonLoading(btnEl, false);
        return;
    }

    const payload = { eventId: currentDetailEventId, date };

    if (API_URL) {
        try {
            const result = await apiPost('addSchedule', payload);
            if (!result.success) {
                alert('일정 저장에 실패했습니다.');
                setButtonLoading(btnEl, false);
                return;
            }
            adminSchedules.push(payload);
            adminSchedules.sort((a, b) => a.date.localeCompare(b.date));
            renderEventTable();
        } catch (err) {
            console.error(err);
            alert('일정 저장 중 오류가 발생했습니다.');
            setButtonLoading(btnEl, false);
            return;
        }
    } else {
        adminSchedules.push(payload);
        adminSchedules.sort((a, b) => a.date.localeCompare(b.date));
        saveStoredSchedules();
    }

    setButtonLoading(btnEl, false);
    document.getElementById('scheduleDate').value = '';
    renderSchedules();
}

function renderSchedules() {
    const tbody = document.getElementById('scheduleTableBody');
    const list = adminSchedules
        .filter(s => s.eventId === currentDetailEventId)
        .sort((a, b) => a.date.localeCompare(b.date));

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:#999;padding:40px;">등록된 일정이 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(s => `
        <tr>
            <td>${escapeHtml(s.date)}</td>
            <td><button class="btn-sm btn-delete" onclick="deleteSchedule('${escapeHtml(s.date)}', this)">삭제</button></td>
        </tr>
    `).join('');
}

async function deleteSchedule(date, btnEl) {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    setButtonLoading(btnEl, true, '삭제중...');

    if (API_URL) {
        try {
            await apiPost('deleteSchedule', { eventId: currentDetailEventId, date });
            adminSchedules = adminSchedules.filter(s => !(s.eventId === currentDetailEventId && s.date === date));
            renderEventTable();
        } catch (err) {
            console.error(err);
            alert('일정 삭제에 실패했습니다.');
            setButtonLoading(btnEl, false);
            return;
        }
    } else {
        adminSchedules = adminSchedules.filter(s => !(s.eventId === currentDetailEventId && s.date === date));
        saveStoredSchedules();
    }

    setButtonLoading(btnEl, false);
    renderSchedules();
}

// ===== Reservations =====
function renderReservations() {
    const tbody = document.getElementById('reservationTableBody');
    const list = adminReservations
        .filter(item => item.eventId === currentDetailEventId)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#999;padding:40px;">신청 내역이 없습니다.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map((r, i) => {
        return `<tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(r.date)}</td>
            <td>${escapeHtml(r.groupName)}</td>
            <td>${escapeHtml(r.manager)}</td>
            <td>${escapeHtml(r.contact)}</td>
            <td>${escapeHtml(r.participants)}명</td>
            <td>${escapeHtml(r.createdAt)}</td>
        </tr>`;
    }).join('');
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.querySelector('#loginScreen form');
    const loginId = document.getElementById('loginId');
    const loginPw = document.getElementById('loginPw');
    [loginId, loginPw].forEach(input => {
        if (!input || !loginForm) return;
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (typeof loginForm.requestSubmit === 'function') {
                    loginForm.requestSubmit();
                } else {
                    loginForm.dispatchEvent(new Event('submit', { cancelable: true }));
                }
            }
        });
    });

    if (sessionStorage.getItem('admin_logged_in') === 'true') {
        await showDashboard();
    }
});

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
        }
    });
});
