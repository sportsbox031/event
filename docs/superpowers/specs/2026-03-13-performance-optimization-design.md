# Performance Optimization Design

**Scope**

Optimize the public reservation flow, the admin dashboard, and the Google Apps Script backend while preserving current user-facing behavior. Internal API shapes may change to support fewer requests, smaller payloads, and cleaner boundaries.

**Current Problems**

- The public app keeps all behavior in [js/app.js](C:\Users\pkmlo\OneDrive\Desktop\AI관련자료\event\js\app.js), mixing state, fetch logic, and DOM work.
- Calendar rendering performs repeated linear searches through schedules for each day cell.
- The card hover effect listens on `document` and recalculates transforms for every card on every mousemove.
- The admin dashboard loads events, schedules, and reservations as three separate full-table requests, then computes per-event counts on the client.
- The Apps Script backend reads full sheets repeatedly and performs multi-step writes cell-by-cell, increasing execution time.
- The backend has no cache invalidation strategy and no write locking for concurrent mutations.

**Selected Approach**

Use a balanced refactor:

- Split frontend code into small ES modules with explicit responsibilities.
- Introduce aggregate backend endpoints for public bootstrap data and admin dashboard/detail data.
- Replace repeated array scans with indexed `Map`/`Set` structures.
- Add short-lived cache entries in Apps Script and invalidate them on writes.
- Guard write operations with `LockService` to reduce race conditions.

**Frontend Architecture**

- `js/shared/config.js`: API URL and common request settings.
- `js/shared/date.mjs`: date parsing and formatting helpers used by both public and admin code.
- `js/shared/http.js`: GET/POST wrapper with consistent JSON handling and timeouts.
- `js/app/store.js`: public app state, normalized event lookup maps, schedule cache, and in-flight request dedupe.
- `js/app/render.js`: event list, calendar, and modal rendering helpers.
- `js/app/main.js`: bootstrap, event listeners, modal flow, prefetching, and lightweight interaction orchestration.
- `js/admin/main.js`: admin bootstrap, dashboard rendering, detail fetching, form actions, and local fallbacks.
- `index.html` and `admin.html`: remove inline handlers and switch to delegated module-owned events.

**Backend Architecture**

- `config.gs`: constants, sheet names, cache keys, TTL, and action names.
- `utils.gs`: response helpers, date normalization, hashing helpers, payload sanitation.
- `sheets.gs`: spreadsheet access and header bootstrapping helpers.
- `cache.gs`: script cache read/write helpers and invalidation.
- `repositories.gs`: event/schedule/reservation/settings repository functions.
- `services.gs`: public catalog, admin dashboard, event detail, and mutation services.
- `code.gs`: `doGet`, `doPost`, and menu entrypoints.

These root `.gs` files are the source of truth for the Apps Script deployment. The rollout path is: copy files into the Apps Script project, redeploy the web app, then publish the updated static frontend that consumes the new aggregate endpoints.

**Data Flow**

- Public page loads via a single `getCatalog` action returning `events` and a bounded `scheduleIndex`.
- `getCatalog` only preloads all schedules when the total schedule volume is below a payload budget; otherwise it includes booking-open event schedules only and the client lazily requests the rest per event.
- Event modal prefetch reuses already indexed schedule data instead of refetching when possible.
- Admin dashboard loads a summary payload with event rows plus schedule and reservation counts.
- Admin detail view loads schedules and reservations only for the selected event.
- Writes invalidate only the affected cache keys.
- Deleting an event cascades to schedules and reservations for that event so summary and detail caches cannot drift.

**Performance Targets**

- Keep public initial load at one request while preventing payload blow-up through schedule prefetch budgeting.
- Make calendar availability lookup constant time per day cell using `Set`.
- Remove document-wide per-frame card recalculation and limit hover work to the active card.
- Reduce admin dashboard payload and client-side recomputation by returning server-side aggregates.
- Reduce repeated full-sheet reads via short TTL cache and targeted invalidation.

**Error Handling**

- Public and admin clients keep local fallback behavior when remote calls fail.
- Backend keeps legacy array-style GET endpoints for inexpensive compatibility and adds new aggregate endpoints for the refactored frontend.
- Aggregate endpoints may return richer objects, but the rollout order keeps old clients working until the static frontend is redeployed.
- Write operations fail fast on invalid input and duplicate schedule insertion.

**Verification Plan**

- Add lightweight Node-based tests for pure normalization and indexing helpers.
- Run the test file directly with `node`.
- Manually verify public bootstrap, calendar open, reservation submission fallback, admin dashboard load, event detail load, schedule add/delete, booking toggle flow, and Apps Script multi-file deployment wiring.
- Exercise duplicate schedule insertion and concurrent mutation protection by validating locked write paths and cache invalidation after mutation.
