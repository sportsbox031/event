# Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the public site, admin dashboard, and Apps Script backend to reduce hot-path latency, cut repeated work, and improve maintainability without changing user-facing behavior.

**Architecture:** Split browser code into focused ES modules, move aggregate calculations and caching to the backend, and expose summary/detail endpoints that match the public and admin usage patterns. Use indexed collections on the client and cached sheet repositories plus write locks on the backend.

**Tech Stack:** Static HTML/CSS/JavaScript, Google Apps Script, Google Sheets, browser Fetch API, Node for lightweight local verification

---

## Chunk 1: Public App Refactor

### Task 1: Create shared browser utilities

**Files:**
- Create: `js/shared/config.js`
- Create: `js/shared/date.mjs`
- Create: `js/shared/http.js`

- [ ] Step 1: Add pure helpers for API URL access, date normalization, and JSON requests
- [ ] Step 2: Export them as browser ES modules
- [ ] Step 3: Keep them browser-safe and Node-importable where possible

### Task 2: Normalize public state and rendering

**Files:**
- Create: `js/app/store.js`
- Create: `js/app/render.js`
- Create: `js/app/main.js`
- Modify: `index.html`

- [ ] Step 1: Write failing tests for date/index helpers used by the public app
- [ ] Step 2: Implement normalized state with `Map`, `Set`, and in-flight request reuse
- [ ] Step 3: Move DOM rendering into pure-ish helper functions
- [ ] Step 4: Replace inline handlers in HTML and generated markup with module-owned event delegation
- [ ] Step 5: Verify public flow manually and with helper tests

## Chunk 2: Admin Dashboard Refactor

### Task 3: Reduce admin N+1 work and overfetching

**Files:**
- Create: `js/admin/main.js`
- Modify: `admin.html`

- [ ] Step 1: Replace three full-table startup calls with dashboard summary endpoint
- [ ] Step 2: Fetch detail payload lazily per selected event
- [ ] Step 3: Migrate admin inline handlers to delegated module listeners and maintain local fallback behavior for API failure cases
- [ ] Step 4: Verify booking toggle, schedule add/delete, and form save flows manually

## Chunk 3: Apps Script Backend Split

### Task 4: Add modular repositories and services

**Files:**
- Create: `config.gs`
- Create: `utils.gs`
- Create: `sheets.gs`
- Create: `cache.gs`
- Create: `repositories.gs`
- Create: `services.gs`
- Modify: `code.gs`

- [ ] Step 1: Move constants and helpers into dedicated modules
- [ ] Step 2: Add cache helpers and targeted invalidation
- [ ] Step 3: Add catalog, dashboard, and detail service endpoints
- [ ] Step 4: Wrap mutating operations in script locks, cascade delete related rows, and batch writes where possible
- [ ] Step 5: Keep legacy-compatible array endpoints while adding the new aggregate contract

## Chunk 4: Verification

### Task 5: Add lightweight verification

**Files:**
- Create: `tests/shared-utils.test.mjs`

- [ ] Step 1: Write direct Node tests for pure helper behavior
- [ ] Step 2: Run the test file and confirm zero failures
- [ ] Step 3: Review browser entrypoints for broken references after module conversion and inline-handler removal
- [ ] Step 4: Document the Apps Script root-file deployment order and rollback path
