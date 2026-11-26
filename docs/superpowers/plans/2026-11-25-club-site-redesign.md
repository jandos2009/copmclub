# Club Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перевести витрину клубов и личный кабинет на спокойную светлую/тёмную тему «Городской сервис» с выбором акцента и фона.

**Architecture:** Новый изолированный слой `theme.css` + `theme.js` даёт токены и настройки, не затрагивая старые `style.css`/`extra.css` на `menu.html` и `club.html`. `clubs.html` и `profile.html` получают собственные CSS/JS, данные берут из существующих API и нового `GET /api/me/bookings`.

**Tech Stack:** Express 5, Prisma 6, статический HTML/CSS/JS без сборки, Playwright для проверки.

**Spec:** `docs/superpowers/specs/2026-11-25-club-site-redesign-design.md`

## Global Constraints

- Не добавлять комментарии в код.
- Не менять API `menu.html` и структуру `club.html`.
- Пользовательские данные выводить через `textContent`, не `innerHTML`.
- Все новые страницы должны работать без сборки и внешних шрифтов.
- Контраст текста и кнопок — WCAG AA.
- Настройки вида хранить в `localStorage`: `club-theme`, `club-accent`, `club-bg`.
- Фото — локальный `public/assets/club-bg.jpg` с подписью автора в футере/на странице.

## Review Focus

- Повторное открытие страницы не должно показывать вспышку светлой темы при сохранённой тёмной.
- `prefers-color-scheme` меняется при `system`, но ручной выбор не должен сбрасываться.
- Фото не должно ухудшать читаемость hero на 360 px.
- `/api/me/bookings` не должен отдавать брони другого пользователя.
- Отмена брони из кабинета не должна затрагивать чужие брони.

---

### Task 1: Theme foundation and photo

**Files:**
- Create: `public/theme.css`
- Create: `public/theme.js`
- Create: `public/assets/club-bg.jpg`

**Interfaces:**
- Produces: `window.CityTheme = { apply, setTheme, setAccent, setBackground, get }`; HTML attributes `data-theme`, `data-accent`, `data-bg` on `<html>`.

- [ ] **Step 1: Add the photo**

Download the Unsplash image to `public/assets/club-bg.jpg` (source URL in the spec). Verify the file is a valid JPEG and at least 1600 px wide.

- [ ] **Step 2: Write `theme.css`**

Define `:root` light tokens, `html[data-theme="dark"]` overrides, accent overrides for `green|amber|blue`, background rules, base typography, buttons, inputs, cards, focus states, `.topbar`, `.brand`, `.settings`, `.hero`, `.hero-photo`, `.container`, `.section`, `.grid`, `.badge`, `.empty-state`, `.footer`.

- [ ] **Step 3: Write `theme.js`**

Read storage, resolve `system` via `matchMedia`, set attributes before paint, bind `[data-set-theme]`, `[data-set-accent]`, `[data-set-bg]`, listen for system changes. No inline event handlers.

- [ ] **Step 4: Verify**

Open a blank HTML page that includes both files; check light/dark, all accents, photo/plain, and that settings survive reload.

---

### Task 2: Club list redesign

**Files:**
- Modify: `public/clubs.html`
- Create: `public/clubs.js`
- Create: `public/assets/club-bg.jpg` (from Task 1)

**Interfaces:**
- Consumes: `GET /api/clubs`, `GET /api/plans`, `GET /me`.
- Produces: filter state `activePlan`, search query.

- [ ] **Step 1: Replace `clubs.html` markup**

Add `theme.css`, `theme.js`, hero, settings, auth-aware links, search/filter card, `#clubsList`, `#clubsEmpty`, `#planCards`, CTA. Keep `/apply.html` links.

- [ ] **Step 2: Move rendering to `clubs.js`**

Render club cards in this order: badge + name, address, hours, phone, advantages, actions. Use `--plan-accent` only for the badge/accent line. Do not use plan surface colors for the card body.

- [ ] **Step 3: Add auth-aware header**

Fetch `/me`; if 200, replace «Войти» with «Кабинет» linking `/profile.html`; if role is admin/owner/superadmin, add «Панель» linking `/menu.html`.

- [ ] **Step 4: Verify**

`/clubs.html` returns 200; search and filters work; card order is correct; mobile 390 px has no horizontal scroll.

---

### Task 3: Personal cabinet API and page

**Files:**
- Modify: `app.js` (after `/bookings/mine`)
- Modify: `public/profile.html`
- Create: `public/profile.js`

**Interfaces:**
- Consumes: `GET /me`, `GET /api/me/bookings`, `GET /api/applications/mine`, `POST /logout`, `DELETE /bookings/:id`.
- Produces: booking rows with `booking.club.name`, `booking.club.slug`, `booking.seats[].seat.name`, `booking.start`, `booking.end`.

- [ ] **Step 1: Add `GET /api/me/bookings`**

Use `requireAuth`; query all active future bookings for `req.session.userId` across clubs; include `club` and `seats.seat`; order by `start` ascending.

- [ ] **Step 2: Replace `profile.html`**

Add theme files, topbar, greeting, stats, «Мои брони», «Мои заявки», «Настройки вида», logout, footer.

- [ ] **Step 3: Write `profile.js`**

Load `/me`, redirect to `/login.html?next=/profile.html` on 401, load bookings and applications in parallel, render empty states, format dates with `Intl.DateTimeFormat('ru-RU')`, cancel booking after `confirm`, reload.

- [ ] **Step 4: Verify**

No session → redirect; with session → data; cancel removes row; applications show status; mobile layout works.

---

### Task 4: Auth and legal pages alignment

**Files:**
- Modify: `public/login.html`
- Modify: `public/index.html`
- Modify: `public/apply.html`
- Modify: `public/terms.html`
- Modify: `public/privacy.html`

**Interfaces:**
- Consumes: existing `/login`, `/register`, `/api/applications`.
- Produces: shared `body.city` pages using `theme.css` + `theme.js`.

- [ ] **Step 1: Add theme files and shared topbar**

Keep existing form names and redirect logic. Add visible labels, settings control, and consistent footer.

- [ ] **Step 2: Restyle legal pages**

Replace old `legal-page` styles with `city.css` classes or shared tokens; keep the demo warning and placeholder details.

- [ ] **Step 3: Verify**

All pages return 200; registration/login redirects still work; legal links from registration work; mobile layout works.

---

### Task 5: End-to-end verification and publish

**Files:**
- Modify: `HANDOFF.md`
- Modify: `TASKS.md`

- [ ] **Step 1: Start server**

Run `npm start` (or existing dev process) and check `/health`.

- [ ] **Step 2: Playwright pass**

At 1440×900 and 390×844: `/clubs.html`, `/profile.html`, `/login.html`, `/terms.html`. Check light/dark, 3 accents, photo/plain, no console errors, no horizontal scroll.

- [ ] **Step 3: API checks**

`GET /api/me/bookings` without cookie → 401; with demo session → JSON array. `DELETE /bookings/:id` with another user → 403.

- [ ] **Step 4: Update docs and commit**

Record what changed in `HANDOFF.md` and mark the redesign task in `TASKS.md`. Commit and push to `copmclub`.
