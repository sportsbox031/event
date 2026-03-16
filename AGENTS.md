# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

경기도체육회 스포츠박스 (Gyeonggi Sports Association SportBox) - a sports event reservation system. Users browse events, view schedules on a calendar, and submit reservations. Admins manage events, schedules, and view reservation records.

## Architecture

**Frontend** (static HTML/CSS/JS, no build tools or framework):
- `index.html` + `js/app.js` — Public-facing event listing, calendar, and reservation flow
- `admin.html` + `js/admin.js` — Admin dashboard (login, event CRUD, schedule management, reservation viewing)
- `css/style.css` — Single stylesheet for both pages; uses CSS custom properties (`--primary`, `--secondary`, etc.) and glassmorphism design

**Backend** — Google Apps Script (`code.gs`):
- Deployed as a web app; frontend communicates via `doGet`/`doPost` handlers
- Data stored in Google Sheets with 4 sheets: `이벤트`, `일정`, `예약`, `설정`
- `API_URL` constant in both `app.js` and `admin.js` points to the deployed Apps Script URL

**Data flow**: Frontend → fetch (GET with `?action=` params, POST with JSON body `{action, data}`) → Apps Script → Google Sheets

## Key Patterns

- **Dual mode**: Both `app.js` and `admin.js` have fallback to `localStorage`/mock data when `API_URL` is empty, enabling local development without the backend
- **Auth**: Admin login uses SHA-256 hashed passwords (via `crypto.subtle.digest`), compared server-side against the `설정` sheet. Session tracked with `sessionStorage`
- **Date handling**: `normalizeDateValue()` in `code.gs` and `normalizeDateString()` in JS handle date format normalization to `yyyy-MM-dd`
- **Event status**: Three states — `모집중` (recruiting), `모집마감` (closed), `준비중` (preparing). Public page only shows `모집중` events
- **Booking toggle**: `bookingOpen` flag on each event controls whether users can access the calendar/reservation flow
- **XSS prevention**: `admin.js` uses `escapeHtml()` for all user-generated content rendered in HTML

## Development

No build step required. Open `index.html` or `admin.html` directly in a browser. Set `API_URL` to empty string `''` in `js/app.js` and `js/admin.js` to use local mock/localStorage mode.

To deploy backend changes, paste `code.gs` into Google Apps Script editor and redeploy as a web app.

## Language

All UI text is in Korean. Variable names and code comments mix Korean and English.
