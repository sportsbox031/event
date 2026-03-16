const SPREADSHEET_ID = '19MeVM71T7xxjjGptoWa1UdEnnt6CBjUJdkihkLhcpKE';
const DEFAULT_ADMIN_ID = 'admin';
const DEFAULT_ADMIN_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
const LEGACY_ADMIN_HASH = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';
const APP_TZ = 'Asia/Seoul';
const CACHE_TTL_SECONDS = 120;
const CATALOG_PREFETCH_LIMIT = 180;

const SHEET_EVENTS = '이벤트';
const SHEET_SCHEDULES = '일정';
const SHEET_RESERVATIONS = '예약';
const SHEET_DOCUMENT_SUBMISSIONS = '서류제출';
const SHEET_SETTINGS = '설정';

const EVENT_HEADERS = ['id', 'name', 'description', 'image', 'status', 'bookingOpen', 'videoUrl', 'documentTemplateUrl'];
const SCHEDULE_HEADERS = ['eventId', 'date'];
const RESERVATION_HEADERS = ['id', 'eventId', 'eventName', 'date', 'groupName', 'manager', 'contact', 'participants', 'status', 'createdAt'];
const DOCUMENT_SUBMISSION_HEADERS = ['id', 'eventId', 'eventName', 'groupName', 'manager', 'contact', 'fileName', 'fileUrl', 'fileId', 'mimeType', 'createdAt'];
const SETTINGS_HEADERS = ['key', 'value'];

const DEFAULT_DOCUMENT_FOLDER_NAME = 'SportBox 제출서류';
const DEFAULT_HORSE_EVENT_TEMPLATE_URL = 'https://github.com/sportsbox031/event/blob/main/2026%20%EC%8A%A4%ED%8F%AC%EC%B8%A0%EB%B0%95%EC%8A%A4%20%EB%A7%88%EC%A3%BC(%E9%A6%AC%E8%B5%B0)%ED%95%98%EB%8A%94%20%EC%8A%B9%EB%A7%88%EA%B5%90%EC%8B%A4%20%EA%B3%B5%EA%B3%A0.hwpx';
