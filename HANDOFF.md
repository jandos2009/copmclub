# HANDOFF — платформа сайтов компьютерных клубов (KZ)

Обновлено: 2026-11-25. Проект: `C:\Users\jando\src\sait` (единая мультитенантная платформа на базе старого `sait`).

## Что это

Один Express + Prisma + Postgres (Supabase), обслуживает несколько компьютерных клубов по тарифам:

| Тариф | Возможности | Стиль/настройки из готового сайта |
|---|---|---|
| economy | инфа, меню, цены, турниры. Брони НЕТ | `sait-economy`: светло-зелёный, `--accent:#16a34a` |
| standard | + онлайн-бронь по времени (списком, без карты, лимит 5 активных броней) | `sait-standard`: тёмно-оранжевый, `--accent:#f5a524`, 3 зала 15/10/9 мест |
| lux | + карта зала по координатам + бронь на несколько мест (друзья) | исходный люкс-дизайн пользователя `public/club.html`, `--accent:#00d4aa` |

Метаданные тарифов (заголовки, преимущества, требования, настройки, турниры, правила, взносы) теперь берутся из `lib/plans.js` и готовых сайтов пользователя. Цены новых клубов: 150/250/400 ₽ (standard/comfort/VIP), взносы 300/400/200/500 ₽. Исторические демо-клубы остались с ценами 700/1000/1500 ₸ — валюта в UI пока не унифицирована.

Тенант определяется `?club=slug`, поддоменом (`slug.example.com`) или заголовком `X-Club`. Без slug берётся первый клуб по id.

Каталог клубов — `/clubs.html`. Владелец подаёт заявку через `/apply.html`, суперадмин обрабатывает её в `/menu.html` → вкладка «Админка» → «Заявки на клубы». После одобрения создаётся клуб, зал/места/меню/цены/турниры, заявитель становится админом этого клуба (нужен повторный вход, чтобы обновить роль в сессии).

## Стек и структура

- Node 22, Express 5, express-session (кастомный PrismaStore, сессии в БД), bcryptjs, helmet, Prisma 6, **Postgres (Supabase)**.
- Frontend: статические `public/*.html`, без сборки.

```
sait/
  app.js              # все роуты
  lib/db.js           # prisma client
  lib/time.js         # parseDateOnly/parseTime/buildDateTime/dayEnd/hhmm
  lib/plans.js        # economy/standard/lux -> features + настройки/Styles из готовых сайтов
  lib/tenancy.js      # resolveClub, isStaff, canManageClub
  lib/booking.js      # seatsWithOccupancy, createBooking (мьютекс + транзакция + EXCLUDE)
  lib/prices.js       # текущие цены из PriceHistory, setPrice
  lib/session-store.js # PrismaSessionStore (сессии в таблице Session)
  lib/ratelimit.js    # in-memory лимитер по IP/пользователю
  lib/club-init.js    # зал/места/цены/меню/турниры для нового клуба
  prisma/schema.prisma
  prisma/seed.js      # 3 демо-клуба + админы
  public/clubs.html   # каталог клубов: поиск, фильтр по тарифу, переход на сайт
  public/apply.html   # заявка владельца на подключение клуба + статусы заявок
  public/extra.css    # все новые стили страниц/редактора/тарифных карточек; исходный style.css не тронут
  public/plan-themes.css # CSS-переменные и unified-nav по тарифам (economy/standard/lux)
  public/nav.js       # единая навигация по тарифам на всех страницах (#unifiedNav)
  public/club.html    # публичная страница клуба, люкс-дизайн пользователя сохранён полностью; shows plan info
  public/menu.html    # основной UI lux-тарифа + админка + заявки + редактор карты + панель тарифа
  public/index.html   # регистрация (поддерживает ?next=)
  public/login.html   # вход (поддерживает ?next=)
  public/terms.html   # пользовательское соглашение (демо-шаблон с плейсхолдерами)
  public/privacy.html # политика конфиденциальности (демо-шаблон с плейсхолдерами)
```

## Запуск

```powershell
cd C:\Users\jando\src\sait
npm install
npx prisma migrate deploy
npm run seed
npm start            # http://localhost:3000
```

`.env` (в gitignore) требует:
```
DATABASE_URL="postgresql://postgres.<ref>:<пароль>@aws-0-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<ref>:<пароль>@aws-0-eu-north-1.pooler.supabase.com:5432/postgres"
```

Supabase: прямой хост `db.<ref>.supabase.co` в этой сети IPv6-only (P1001), поэтому используем pooler (IPv4). Пароль со спецсимволами должен быть URL-encoded. project-ref текущей dev-базы: `legvkzhklkwrieaeutav`.

Внимание: порт 3000 может быть занят старым процессом. Найти и перезапустить:
`Get-NetTCPConnection -LocalPort 3000 -State Listen | Select OwningProcess`
Для проверок использовать `$env:PORT=3100` (или Start-Job с другим портом).

## Демо-данные и доступы

Клубы: `nexus-lux`, `nexus-standard`, `nexus-economy` (34 места, меню 8 позиций, цены 700/1000/1500 ₸, 4 турнира).

Логины (пароль всех `admin12345`, переопределяется `ADMIN_PASSWORD`):
- `admin` — superadmin (clubId = null)
- `luxadmin` — admin, nexus-lux
- `stdadmin` — admin, nexus-standard
- `ecadmin` — admin, nexus-economy

## Модель данных

- `Club(slug unique, plan, address, phone, email, hours, description)`
- `Hall(clubId, name, width, height)` — unique(clubId,name)
- `Seat(clubId, hallId, name, zone, status free|maintenance, x, y)` — unique(clubId,name)
- `Booking(clubId, userId, groupId, start, end, status active)` + `BookingSeat(unique(seatId,bookingId), start, end)`, EXCLUDE USING gist (seatId WITH =, tsrange(start,end) WITH &&) — защита от двойной брони на уровне БД; `btree_gist` в схеме `extensions`.
- `PriceHistory(clubId, zone, price, validFrom)` — текущая цена = последняя с validFrom <= now
- `MenuItem(clubId, category, name, price, available)`
- `Tournament(clubId, title, game, description, start, entryFee)`
- `Session(id, data, expiresAt)` — сессии express-session
- `User(login unique, password, role user|admin|owner|superadmin, clubId nullable)`
- `ClubApplication(userId, clubName, slug, city, address, phone, email, plan, siteUrl, message, status pending|approved|rejected, reviewNote, clubId, createdAt, reviewedAt)` — уникальность slug и одной pending-заявки на пользователя проверяет API; slug не может пересекаться с `Club.slug`.

## API

Публичные (все принимают `?club=slug`):
- `GET /api/plans` — публичные метаданные тарифов (настройки, требования, взносы, цвета)
- `GET /api/clubs` — список клубов + `planInfo`
- `GET /api/club` — инфо + `features:{booking,seatMap,groupBooking}` + `planInfo`
- `GET /api/halls`, `GET /seats`, `GET /seats/:id`, `GET /prices`, `GET /menu`, `GET /tournaments`
- `GET /seats/:id/schedule?date=YYYY-MM-DD` (нужен логин)
- `POST /seats/:id/book` body `{date,start,end,seats?:[id]}` (standard/lux; группа только lux; макс 10 мест, макс 5 активных броней)
- `GET /bookings/mine`, `DELETE /bookings/:id`
- `GET /me`, `POST /login`, `POST /register`, `POST /logout`

Админ (admin своего клуба, superadmin — любого):
- `PUT /admin/club` (name,address,phone,email,hours,description)
- `PUT /admin/plan` (только superadmin)
- `POST/PUT/DELETE /admin/halls/:id`
- `POST/PUT/DELETE /seats/:id` (+ x,y,zone,hallId)
- `PUT /admin/prices` `{standard,comfort,vip}` → пишет в историю
- `GET /admin/prices/history`
- `GET/POST/PUT/DELETE /admin/menu/:id`
- `POST/DELETE /admin/tournaments/:id`, `GET /admin/bookings`
- `POST /admin/clubs` (superadmin) — создать клуб

Заявки на подключение:
- `POST /api/applications` (логин) — подать заявку `{clubName,slug,city,address,phone,email,plan,siteUrl,message}`
- `GET /api/applications/mine` (логин) — статусы своих заявок
- `GET /api/applications` (superadmin) — все заявки
- `POST /api/applications/:id/approve` (superadmin) — создать клуб + контент, повысить заявителя до admin
- `POST /api/applications/:id/reject` (superadmin) body `{note}` — отклонить с причиной

## Что проверено

- Мультитенантность: админ клуба A не может менять клуб B (403).
- Тарифы: economy-бронь 403, группа на standard 403, группа на lux 201.
- Конфликт времени: повторная бронь того же места/слота → 409.
- История цен: смена цены пишется новой строкой, `/prices` отдаёт актуальную.
- `club.html` 200, `/admin/menu` 8 позиций, правка часов клуба сохраняется.
- Rate limit: 11-я неудачная попытка входа → 429 с `Retry-After` (лимит 10/15 мин на IP).
- Сессии живут в БД и выживают рестарт сервера (проверено: `/me` 200 после перезапуска).
- Helmet: CSP (unsafe-inline только для script/style, без inline-обработчиков в HTML), nosniff, SAMEORIGIN, no-referrer.
- Postgres (Supabase pooler): миграция + seed + все сценарии брони/тарифов/мультитенантности прошли; тестовые пользователи удалены.
- EXCLUDE-constraint проверен напрямую: две пересекающиеся записи `BookingSeat` на одно место дают ошибку 23P01; API возвращает 409.
- `/health` отдаёт `{"status":"ok",uptime}` при живой БД, иначе 503; логирование запросов пишет метод/путь/статус/время в stdout.
- Каталог/заявки: полный цикл из 26 проверок прошёл (0 FAIL) — подача, дубликат pending → 409, доступ к чужим заявкам → 403, одобрение создаёт клуб + 34 места + 8 меню + 3 цены, владелец после релогина admin своего клуба и не видит чужую админку, повторное одобрение → 409, reject виден владельцу, занятый slug → 409. Тестовые клубы/пользователи удалены.
- Редактор карты в `menu.html` переписан: перемещение по `seatId`, сетка из `data-grid-width/height`, сохранение через `PUT /seats/:id`; синтаксис inline-JS всех изменённых HTML проверен `node --check`.
- `public/style.css` возвращён к исходной версии пользователя (`git diff` пуст); все добавленные стили вынесены в `public/extra.css` и подключены в `menu.html`, `clubs.html`, `apply.html`, `index.html`, `login.html`. Дизайн `club.html` (люкс) и его комментарии восстановлены в исходном виде.
- Тарифы из готовых сайтов: `GET /api/plans` отдаёт 3 тарифа с уникальными заголовками/преимуществами/требованиями/настройками; `/api/club` и `/api/clubs` добавляют `planInfo`; `body[data-plan]` и блок «Тариф и возможности» работают в `club.html`; единая навигация `#unifiedNav` подключена на 4 страницах.
- Новый клуб через заявку получает 3 зала (Стандарт/Комфорт/VIP), 34 места, цены 150/250/400 ₽, 4 турнира со взносами 300/400/200/500 ₽ и меню 8 позиций — проверено полным циклом, тестовые данные удалены.
- Права тарифа: `PUT /admin/plan` — аноним 401, админ клуба 403, суперадмин 200; неверный тариф 400; клуб после смены/отката возвращается в исходное состояние.
- Повторный аудит после тарифных правок: 23 проверки (публичные данные без секретов, 401/403 матрица, изоляция клубов, HttpOnly/SameSite=Lax, helmet nosniff/SAMEORIGIN/no-referrer, валидация тарифа) — 0 FAIL.
- Синтаксис всех изменённых JS и inline-скриптов HTML проверен `node --check` — 0 ошибок (дубль `const info` в `clubs.html` найден и исправлен).
- Исправлена загрузка `club.html` для гостя: `/me` возвращает 401, но теперь он не прерывает рендер (`fetchApi('/me', true)`); выход использует существующий роут `/logout`, а не `/api/logout`.
- Тарифы теперь реально гейтят UI в `menu.html`: economy — только вкладка «Клуб» (карта и список брони скрыты), standard — вкладка «Свободные места» со списком и тем же модальным бронированием, lux — карта клуба. `body[data-plan]` выставляется на всех страницах, поэтому цвета `plan-themes.css` тоже меняются по тарифу.
- Перетаскивание мест в редакторе карты переведено на pointer capture: `dragPointerId`, `dragContainer`, `setPointerCapture`, обработка `pointerup/pointercancel/lostpointercapture/blur` и проверка `event.buttons`. Драг больше не срывается при уходе курсора с места; сохранение — одно на завершение.
- Юридические страницы: `terms.html` и `privacy.html` отдают 200, используют общий стиль/навигацию, адаптив проверен на 390px; в тексте есть явные плейсхолдеры для юрлица, БИН/ИИН, адреса и email. Политика описывает реальные данные приложения: логин + bcrypt-хеш, брони, заявки, IP для rate-limit, cookie `sid` на 30 дней, Supabase eu-north-1.

## Следующие шаги (приоритет)

1. **Postgres/Supabase — готово**: `provider = "postgresql"`, `directUrl`, миграции `20261119062128_init_postgres` и `20261119070000_booking_exclusion`, seed применён. Проверено: economy 403, standard 200, конфликт 409, группа standard 403, группа lux 201, cross-tenant 403.
2. **Бронь — готово**: EXCLUDE-constraint на уровне БД (`btree_gist` + `tsrange`) защищает и между инстансами; мьютекс в `lib/booking.js` нужен только для понятного сообщения 409.
3. **Каталог и заявки — готово**: `/clubs.html`, `/apply.html`, API заявок, панель суперадмина в `/menu.html`, автозаполнение клуба через `lib/club-init.js`.
4. **Редактор карты — готово**: перетаскивание мест мышью в `menu.html` с сохранением через `PUT /seats/:id`.
5. **Прод-гигиена (осталось)**: rate limit сейчас in-memory (на несколько инстансов — Redis/Upstash); CSRF-токены при межподдоменных запросах.
6. **Деплой**: Cloudflare Pages (статика) + Render (API) + Supabase, либо VPS Nginx + pm2 + certbot.

Юридические страницы готовы как демо-шаблон: `terms.html` и `privacy.html` лежат в `public/`. Перед публикацией заполнить плейсхолдеры (юрлицо/ИП, БИН/ИИН, адрес, email) и проверить текст у юриста.

## Как демонстрировать и проверять безопасность

Поднять сервер: `npm start` в `C:\Users\jando\src\sait`. Открыть в браузере `http://localhost:3000/clubs.html` (каталог + сравнение тарифов), `/apply.html` (заявка владельца с подсказками тарифов), `/club.html?club=nexus-lux|nexus-standard|nexus-economy` (стиль/блок тарифа по `data-plan`), `/menu.html?club=nexus-lux` (основной UI + админка + редактор карты + панель «Тариф, настройки и требования» для суперадмина), `/terms.html` и `/privacy.html` (юридические документы). Единая навигация `#unifiedNav` появляется на всех страницах. Демо-логины из раздела выше, пароль `admin12345`.

Демо заявки: зарегистрировать нового пользователя → `/apply.html` → войти `admin` → `/menu.html?club=nexus-lux` → «Админка» → «Заявки на клубы» → одобрить → перелогиниться владельцем → его клуб появится в `/clubs.html`. После проверки удалить тестовый клуб и пользователя.

Проверки:
- Тарифы: зайти `nexus-economy` и попробовать забронировать → 403; на `nexus-standard` бронь 201; группа на standard → 403; группа на lux → 201.
- Изоляция клубов: войти `stdadmin`, открыть `admin/menu?club=nexus-lux` → 403; `admin/menu?club=nexus-standard` → 200.
- Двойная бронь: два пользователя выбирают одно место и время → второй получает 409.
- Сессии: войти, перезапустить сервер, обновить `/me` → данные остаются.
- Rate limit: 11 неверных логинов подряд → 429 + `Retry-After`.
- Заголовки: в DevTools → Network → Headers ответа `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
- XSS: в поле меню ввести `<img src=x onerror=alert(1)>` — должно отобразиться текстом (проверка `textContent`).
- Права: войти `stdadmin`, попробовать `PUT /admin/prices?club=nexus-lux` → 403; `luxadmin` → 200. попытка сменить тариф — только `admin`.
- IDOR: взять id места/позиции из lux и запросить с `?club=nexus-standard` от `stdadmin` → 404; чужую бронь `DELETE /bookings/:id` → 403.
- Куки: в DevTools → Application → Cookies — `sid` с `HttpOnly`, `SameSite=Lax`; после входа значение меняется (защита от fixation).
 - Заявки: обычный пользователь получает 403 на `GET /api/applications` и на approve/reject; владелец видит только `/api/applications/mine`; суперадмин видит все. Повторная pending-заявка и занятый slug — 409.
 - Тарифы: `GET /api/plans` открыт всем и не содержит секретов; `PUT /admin/plan` меняет только суперадмин, админ клуба получает 403, неверный тариф — 400.
 - XSS в тарифных блоках: данные `/api/plans` и `planInfo` выводятся через `textContent`; `innerHTML` в `club.html` собирается только из числовых id/width/height.

### Результат аудита 2026-11-19

Прогнана матрица ~50 проверок для ролей: аноним, обычный пользователь ×2, админы `nexus-standard` / `nexus-lux` / `nexus-economy`, суперадмин. Нарушений прав и утечек секретов (паролей, `SESSION_SECRET`, `DATABASE_URL`) — 0. Подтверждено:
- эскалация через поля `role`/`clubId` при регистрации игнорируется;
- подмена клуба через `X-Club` / `Host` не открывает чужую админку;
- SQL-инъекция в логине → 401; битый JSON → 400 (исправлено с 500);
- сессии в БД, `sid` меняется при входе, logout интервалидит сессию;
- все кросс-клубные admin/IDOR-запросы → 403/404; economy → 403, lux group → 201, двойная бронь → 409 (включая EXCLUDE на БД).
- заявки: обычный/user-роль не видит список и не может одобрить/отклонить (403); суперадмин — 200; одобрение создаёт изолированный клуб и не даёт прав на чужие клубы; slug/pending-дубликаты — 409.

Проверочные пользователи, клубы и брони удалены; цены и тарифы восстановлены.

## Известные ограничения

- Защита от двойной брони — EXCLUDE-constraint в Postgres + мьютекс/проверка в транзакции для понятного ответа 409.
- CSRF-токенов нет; смягчение — `SameSite=Lax` + `HttpOnly` + HTTPS/secure в проде. Для запросов между поддоменами нужен явный CSRF-токен.
- Rate limiter хранит счётчики в памяти процесса (сбрасывается при рестарте, не общий для инстансов).
- `terms.html` и `privacy.html` — демо-шаблоны: юридические реквизиты не заполнены, текст требует проверки юристом.
- После одобрения заявки роль в текущей сессии остаётся `user`; владельцу нужно выйти/войти заново (или это можно будет сделать автоматически при следующем логине).
- Старая SQLite-база `prisma/dev.db` больше не используется (осталась в папке, в gitignore).

## Рабочие правила для следующей модели

- Новый код без комментариев, русские тексты/ошибки в UI. Исходные файлы пользователя (`style.css`, люкс-дизайн `club.html`) не переписывать: новые стили класть в `extra.css` или `plan-themes.css`, комментарии в `club.html` сохранены как были. Валюта: демо-клубы исторически ₸, настройки готовых сайтов и новые клубы — ₽; перед unify нужно уточнить у пользователя.
- Не ломать существующие URL API (на них завязан `menu.html`).
- Любые данные от админа выводить через `textContent`, не `innerHTML` (защита от stored XSS).
- Перед коммитом: `npx prisma migrate deploy`, `npm run seed`, затем проверка сценариев economy/standard/lux.
- Git: коммитить только когда пользователь явно попросит.
