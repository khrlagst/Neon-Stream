# Neon Stream — Single-run Development Tasks

## Overview
This document lists the precise tasks to convert the existing single-file web player into a modular, production-ready PWA with a backend for library sync, long-term metadata indexing, smarter recommendations, and improved accessibility and mobile support. The goal: complete this development in a single, well-ordered run.

## High-level Run Plan (ordered)
1. Split `neon_player.html` into modular assets (HTML/CSS/JS).
2. Create a dedicated metadata index layer for very large libraries and initial index generation.
3. Create a backend service and move playlist, stats, and library sync to it.
4. Implement background library indexing and incremental updates on the backend.
5. Add recommendations engine and automated playlist generation (backend + front-end hooks).
6. Turn the app into a PWA (manifest, service worker, caching, offline fallback).
7. Improve accessibility and keyboard navigation; make UI mobile-responsive.
8. Add import/export for playlists, ratings, and settings (JSON/CSV).
9. Add tests (integration & accessibility), CI config, and deployment documentation.

## Task Details and Subtasks
- Split HTML into modular assets:
  - Create `index.html`, `css/styles.css`, `js/app.js`, `js/ui.js`, `js/player.js`.
  - Move inline styles into `styles.css` and inline scripts into the JS modules.
  - Use semantic markup and ARIA where appropriate.
  - Deliverable: modular repo structure and working app served from `index.html`.

- Metadata index layer for large libraries:
  - Design `metadata/index` format (sharded JSON or SQLite/LevelDB on backend).
  - Add tools to import existing library and produce an initial index (fields: id, title, artist, album, duration, tags, fingerprint).
  - Deliverable: `metadata/index` accessible via backend API with pagination and search endpoints.

- Backend service (playlist, stats, library sync):
  - Minimal API endpoints: `/api/library`, `/api/playlist`, `/api/stats`, `/api/import`, `/api/export`, `/api/recommend`.
  - Tech suggestion: Node.js + Express + SQLite/Postgres (or lightweight Rust/Go service).
  - Auth: local/session-based or simple token for first iteration.
  - Move persistent state (playlists, ratings, playback history) to backend.

- Background indexing & incremental updates:
  - Implement background worker on backend to scan shared storage and update the metadata index incrementally.
  - Provide endpoints to queue re-index, check progress, and fetch deltas.
  - Use changefeeds or file-watcher hooks where available.

- Recommendations & automated playlists:
  - Implement basic collaborative/ML-lite recommender (item-based or simple heuristics: recent plays, ratings, tags).
  - Endpoint `/api/recommend` to return suggestions and `/api/generate-playlist` to auto-create playlists.
  - Front-end: UI to accept suggestions and save generated playlists.

- PWA conversion:
  - Add `manifest.json`, icons, and `service-worker.js`.
  - Implement caching strategy: shell resources cached, metadata fetched from backend, offline fallback for basic playback of previously-cached tracks.
  - Register service worker in `app.js` and show install prompt UI.

- Accessibility, keyboard navigation, and mobile responsiveness:
  - Follow WCAG AA: contrast, labels, focus states, skip links.
  - Keyboard-only flows for main actions (play/pause, next/prev, library search, playlist manage).
  - Responsive layouts using CSS Grid/Flexbox; test on small viewports.

- Import/Export:
  - Implement `POST /api/import` and `GET /api/export` (support JSON and CSV).
  - Front-end: import modal with mapping UI and export button for playlists/ratings/settings.

- Tests, CI, and docs:
  - Add CI workflow (GitHub Actions) running lint, build, and tests.
  - Add integration tests for API and an accessibility test run (axe-core or pa11y).
  - Write `README.md` deployment section.

## Files to add or change (suggested)
- `index.html` — main entry
- `css/styles.css` — styles and responsive rules
- `js/app.js` — app bootstrap, SW registration
- `js/player.js` — player logic (audio handling, events)
- `js/ui.js` — UI controls, keyboard handlers
- `manifest.json` — PWA manifest
- `service-worker.js` — caching & offline logic
- `backend/` — service code, `package.json`, and DB schema
- `metadata/` — index schema and sample index generator
- `tests/` — integration & accessibility tests

## Single-run commands (example quick-run)
Run these locally to scaffold and start both frontend and backend for development:

```bash
# from repo root
mkdir -p css js backend metadata tests
# create files scaffold (or run provided scaffolding script)
# start backend (example Node):
cd backend && npm init -y && npm install express sqlite3 && node server.js &
# start a simple static server for frontend (Python3):
cd .. && python3 -m http.server 8000
# visit http://localhost:8000
```

## Acceptance Criteria
- App loads from `index.html`, functions offline for previously-cached content, and is installable as a PWA.
- Library index supports efficient search and pagination for very large sets (>100k items) via backend.
- Playlists, ratings, and playback stats persist to backend and sync correctly across sessions.
- Background indexing updates metadata incrementally without blocking API.
- Recommendations endpoint returns relevant suggestions and front-end can generate playlists.
- Accessibility checks pass basic AXE rules; keyboard navigation works end-to-end.
- Import/export works and round-trips sample playlists and settings.

## Notes & Next Steps
- Choose backend technology now (Node/Express recommended for fastest iteration).
- Decide on DB choice: SQLite for local dev, Postgres for production scale.
- If you want, I can implement the first step now (split `neon_player.html` into assets and scaffold the repo).

---
Generated for: single-run development to modernize the Neon Stream player.
