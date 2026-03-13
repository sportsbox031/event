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
const SHEET_SETTINGS = '설정';

const EVENT_HEADERS = ['id', 'name', 'description', 'image', 'status', 'bookingOpen', 'videoUrl'];
const SCHEDULE_HEADERS = ['eventId', 'date'];
const RESERVATION_HEADERS = ['id', 'eventId', 'eventName', 'date', 'groupName', 'manager', 'contact', 'participants', 'status', 'createdAt'];
const SETTINGS_HEADERS = ['key', 'value'];
