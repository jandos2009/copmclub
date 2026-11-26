require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');

const { prisma } = require('./lib/db');
const { planFeatures, planInfo, allPlans, isValidPlan } = require('./lib/plans');
const { resolveClub, isStaff, canManageClub } = require('./lib/tenancy');
const { seatsWithOccupancy, createBooking } = require('./lib/booking');
const { listCurrentPrices, currentPrices, setPrice, ZONES } = require('./lib/prices');
const { DAY_MS, parseDateOnly, parseTime, buildDateTime, dayEnd, hhmm } = require('./lib/time');
const { PrismaSessionStore } = require('./lib/session-store');
const { createRateLimiter } = require('./lib/ratelimit');
const { initializeClubContent } = require('./lib/club-init');

const app = express();

const ALLOWED_STATUSES = ['free', 'maintenance'];
const ALLOWED_ZONES = ZONES;
const MAX_GROUP_SEATS = 10;
const MAX_UPCOMING_BOOKINGS = 5;

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    console.log(req.method, req.originalUrl.split('?')[0], res.statusCode, (Date.now() - started) + 'ms');
  });
  next();
});

app.use(express.json());

const sessionStore = new PrismaSessionStore({ ttlMs: 30 * 24 * 60 * 60 * 1000 });
sessionStore.startCleanup();

app.use(session({
  name: 'sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000
  }
}));

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Слишком много попыток входа. Попробуйте позже.'
});
const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Слишком много регистраций с этого адреса. Попробуйте позже.'
});
const bookingLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  key: (req) => 'book:' + (req.session.userId || req.ip),
  message: 'Слишком много бронирований. Попробуйте позже.'
});

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()) });
  } catch (error) {
    res.status(503).json({ status: 'error' });
  }
});

app.use(express.static('public'));

function fail(res, status, message) {
  return res.status(status).json({ message });
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return fail(res, 401, 'Нужно войти в аккаунт');
  next();
}

function requireStaff(req, res, next) {
  if (!req.session.userId) return fail(res, 401, 'Нужно войти в аккаунт');
  if (!isStaff(req.session)) return fail(res, 403, 'Доступно только администратору');
  next();
}

function requireClubAdmin(req, res, next) {
  if (!req.session.userId) return fail(res, 401, 'Нужно войти в аккаунт');
  if (!canManageClub(req.session, req.club.id)) {
    return fail(res, 403, 'Нет доступа к этому клубу');
  }
  next();
}

function requireSuperadmin(req, res, next) {
  if (!req.session.userId) return fail(res, 401, 'Нужно войти в аккаунт');
  if (req.session.role !== 'superadmin') return fail(res, 403, 'Только для владельца платформы');
  next();
}

function intParam(value) {
  const number = parseInt(value, 10);
  return Number.isNaN(number) ? null : number;
}

function publicClub(club) {
  return {
    id: club.id,
    slug: club.slug,
    name: club.name,
    plan: club.plan,
    planInfo: planInfo(club.plan),
    features: planFeatures(club.plan),
    address: club.address,
    phone: club.phone,
    email: club.email,
    hours: club.hours,
    description: club.description
  };
}

app.get('/api/plans', (req, res) => {
  res.json(allPlans());
});

app.get('/api/clubs', async (req, res, next) => {
  try {
    const clubs = await prisma.club.findMany({
      orderBy: { name: 'asc' },
      select: { slug: true, name: true, address: true, phone: true, hours: true, plan: true }
    });
    res.json(clubs.map((club) => ({ ...club, planInfo: planInfo(club.plan) })));
  } catch (error) {
    next(error);
  }
});

app.get('/api/companies', async (req, res, next) => {
  try {
    const total = await prisma.club.count();
    res.json({ clubs: total });
  } catch (error) {
    next(error);
  }
});

function applicationView(application) {
  return {
    id: application.id,
    clubName: application.clubName,
    slug: application.slug,
    city: application.city,
    address: application.address,
    phone: application.phone,
    email: application.email,
    plan: application.plan,
    siteUrl: application.siteUrl,
    message: application.message,
    status: application.status,
    reviewNote: application.reviewNote,
    clubId: application.clubId,
    createdAt: application.createdAt,
    reviewedAt: application.reviewedAt,
    user: application.user ? { login: application.user.login } : undefined
  };
}

app.post('/api/applications', requireAuth, async (req, res, next) => {
  try {
    const clubName = String(req.body.clubName || '').trim().slice(0, 80);
    const slug = String(req.body.slug || '').trim().toLowerCase();
    const city = String(req.body.city || '').trim().slice(0, 80);
    const address = String(req.body.address || '').trim().slice(0, 160);
    const phone = String(req.body.phone || '').trim().slice(0, 40);
    const email = String(req.body.email || '').trim().slice(0, 120);
    const plan = String(req.body.plan || 'economy');
    const siteUrl = String(req.body.siteUrl || '').trim().slice(0, 200);
    const message = String(req.body.message || '').trim().slice(0, 500);

    if (!clubName || !city || !address || !phone || !email) {
      return fail(res, 400, 'Заполните название, город, адрес, телефон и email');
    }
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) {
      return fail(res, 400, 'Адрес сайта: латиница, цифры и дефис, от 2 до 41 символа');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail(res, 400, 'Укажите корректный email');
    }
    if (!isValidPlan(plan)) return fail(res, 400, 'Неверный тариф');

    const occupied = await prisma.club.findUnique({ where: { slug } });
    if (occupied) return fail(res, 409, 'Этот адрес уже занят');

    const pending = await prisma.clubApplication.findFirst({
      where: {
        status: 'pending',
        OR: [{ slug }, { userId: req.session.userId }]
      }
    });
    if (pending) {
      return fail(res, 409, 'У вас уже есть заявка на рассмотрении или этот адрес уже запрошен');
    }

    const application = await prisma.clubApplication.create({
      data: { userId: req.session.userId, clubName, slug, city, address, phone, email, plan, siteUrl, message }
    });
    res.status(201).json(applicationView(application));
  } catch (error) {
    next(error);
  }
});

app.get('/api/applications/mine', requireAuth, async (req, res, next) => {
  try {
    const applications = await prisma.clubApplication.findMany({
      where: { userId: req.session.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(applications.map(applicationView));
  } catch (error) {
    next(error);
  }
});

app.get('/api/applications', requireSuperadmin, async (req, res, next) => {
  try {
    const applications = await prisma.clubApplication.findMany({
      include: { user: { select: { login: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(applications.map(applicationView));
  } catch (error) {
    next(error);
  }
});

app.post('/api/applications/:id/approve', requireSuperadmin, async (req, res, next) => {
  try {
    const id = intParam(req.params.id);
    if (id === null) return fail(res, 400, 'Неверный id');

    const application = await prisma.clubApplication.findUnique({ where: { id } });
    if (!application) return fail(res, 404, 'Заявка не найдена');
    if (application.status !== 'pending') return fail(res, 409, 'Заявка уже рассмотрена');

    const occupied = await prisma.club.findUnique({ where: { slug: application.slug } });
    if (occupied) return fail(res, 409, 'Этот адрес уже занят');

    const club = await prisma.club.create({
      data: {
        slug: application.slug,
        name: application.clubName,
        plan: application.plan,
        address: application.city + (application.address ? ', ' + application.address : ''),
        phone: application.phone,
        email: application.email,
        hours: '10:00 - 02:00',
        description: application.message.slice(0, 300)
      }
    });

    await initializeClubContent(club);
    await prisma.user.update({
      where: { id: application.userId },
      data: { role: 'admin', clubId: club.id }
    });
    await prisma.clubApplication.update({
      where: { id },
      data: { status: 'approved', clubId: club.id, reviewedAt: new Date(), reviewNote: '' }
    });

    res.status(201).json({
      message: 'Сайт создан. Владельцу нужно заново войти в аккаунт.',
      club: publicClub(club)
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/applications/:id/reject', requireSuperadmin, async (req, res, next) => {
  try {
    const id = intParam(req.params.id);
    if (id === null) return fail(res, 400, 'Неверный id');

    const application = await prisma.clubApplication.findUnique({ where: { id } });
    if (!application) return fail(res, 404, 'Заявка не найдена');
    if (application.status !== 'pending') return fail(res, 409, 'Заявка уже рассмотрена');

    const note = String(req.body.note || '').trim().slice(0, 300) || 'Заявка отклонена';
    await prisma.clubApplication.update({
      where: { id },
      data: { status: 'rejected', reviewNote: note, reviewedAt: new Date() }
    });
    res.json({ message: 'Заявка отклонена' });
  } catch (error) {
    next(error);
  }
});

app.use(resolveClub);

app.get('/api/club', (req, res) => {
  res.json(publicClub(req.club));
});

app.get('/api/halls', async (req, res, next) => {
  try {
    const halls = await prisma.hall.findMany({
      where: { clubId: req.club.id },
      orderBy: { id: 'asc' },
      select: { id: true, name: true, width: true, height: true }
    });
    res.json(halls);
  } catch (error) {
    next(error);
  }
});

app.get('/me', (req, res) => {
  if (!req.session.userId) return fail(res, 401, 'Вы не вошли');
  res.json({
    userId: req.session.userId,
    login: req.session.login,
    role: req.session.role || 'user',
    clubId: req.session.clubId || null
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sid');
    res.json({ message: 'Вы вышли' });
  });
});

app.get('/seats', async (req, res, next) => {
  try {
    res.json(await seatsWithOccupancy(req.club.id));
  } catch (error) {
    next(error);
  }
});

app.get('/seats/:id', async (req, res, next) => {
  try {
    const id = intParam(req.params.id);
    if (id === null) return fail(res, 400, 'Неверный id');
    const seat = await prisma.seat.findFirst({ where: { id, clubId: req.club.id } });
    if (!seat) return fail(res, 404, 'Место не найдено');
    res.json(seat);
  } catch (error) {
    next(error);
  }
});

app.get('/seats/:id/schedule', requireAuth, async (req, res, next) => {
  try {
    const id = intParam(req.params.id);
    if (id === null) return fail(res, 400, 'Неверный id');

    const dateOnly = parseDateOnly(req.query.date);
    if (!dateOnly) return fail(res, 400, 'Неверная дата');

    const seat = await prisma.seat.findFirst({ where: { id, clubId: req.club.id } });
    if (!seat) return fail(res, 404, 'Место не найдено');

    const start = dateOnly;
    const end = dayEnd(dateOnly);
    const bookings = await prisma.bookingSeat.findMany({
      where: {
        seatId: id,
        booking: { status: 'active', start: { lt: end }, end: { gt: start } }
      },
      include: { booking: true },
      orderBy: { booking: { start: 'asc' } }
    });

    const intervals = bookings.map(({ booking }) => {
      const clipStart = booking.start < start ? start : booking.start;
      const clipEnd = booking.end > end ? end : booking.end;
      const endIsDayEnd = clipEnd.getTime() === end.getTime();
      const mine = booking.userId === req.session.userId;

      return {
        id: mine ? booking.id : null,
        mine,
        start: hhmm(clipStart),
        end: hhmm(clipEnd, endIsDayEnd),
        fullStart: hhmm(booking.start),
        fullEnd: hhmm(booking.end),
        continuesFrom: booking.start < start,
        continuesNext: booking.end > end
      };
    });

    res.json({ date: req.query.date, maintenance: seat.status === 'maintenance', intervals });
  } catch (error) {
    next(error);
  }
});

app.post('/seats/:id/book', requireAuth, bookingLimiter, async (req, res, next) => {
  try {
    const features = planFeatures(req.club.plan);
    if (!features.booking) {
      return fail(res, 403, 'На этом тарифе онлайн-бронирование недоступно');
    }

    const id = intParam(req.params.id);
    if (id === null) return fail(res, 400, 'Неверный id');

    const seatIds = Array.isArray(req.body.seats) && req.body.seats.length
      ? [...new Set(req.body.seats.map((value) => intParam(value)).filter((value) => value !== null))]
      : [id];

    if (seatIds.length > MAX_GROUP_SEATS) return fail(res, 400, 'Слишком много мест в одной брони');
    if (seatIds.length > 1 && !features.groupBooking) {
      return fail(res, 403, 'Бронь на несколько мест доступна только на тарифе lux');
    }

    const dateOnly = parseDateOnly(req.body.date);
    const startTime = parseTime(req.body.start);
    const endTime = parseTime(req.body.end);
    if (!dateOnly || !startTime || !endTime) return fail(res, 400, 'Укажите корректные дату и время');

    const startAt = buildDateTime(dateOnly, startTime);
    let endAt = buildDateTime(dateOnly, endTime);
    if (endAt <= startAt) endAt = new Date(endAt.getTime() + DAY_MS);

    const now = new Date();
    if (endAt <= now) return fail(res, 400, 'Это время уже прошло');
    if (startAt < new Date(now.getTime() - 60 * 1000)) return fail(res, 400, 'Начало брони уже прошло');
    if (endAt.getTime() - startAt.getTime() > DAY_MS) return fail(res, 400, 'Бронь не может быть дольше 24 часов');

    const upcoming = await prisma.booking.count({
      where: { userId: req.session.userId, clubId: req.club.id, status: 'active', end: { gt: now } }
    });
    if (upcoming >= MAX_UPCOMING_BOOKINGS) {
      return fail(res, 409, 'Слишком много активных броней. Отмените одну из старых.');
    }

    const result = await createBooking(req.club.id, req.session.userId, seatIds, startAt, endAt);
    if (result.status !== 201) return fail(res, result.status, result.message);

    res.status(201).json({ message: 'Место забронировано', booking: result.booking });
  } catch (error) {
    next(error);
  }
});

app.get('/bookings/mine', requireAuth, async (req, res, next) => {
  try {
    const now = new Date();
    const bookings = await prisma.booking.findMany({
      where: { userId: req.session.userId, clubId: req.club.id, status: 'active', end: { gt: now } },
      orderBy: { start: 'asc' },
      include: { seats: { include: { seat: { select: { id: true, name: true, zone: true } } } } }
    });
    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

app.delete('/bookings/:id', requireAuth, async (req, res, next) => {
  try {
    const id = intParam(req.params.id);
    if (id === null) return fail(res, 400, 'Неверный id');

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return fail(res, 404, 'Бронь не найдена');

    const isOwner = booking.userId === req.session.userId;
    const isAdmin = canManageClub(req.session, booking.clubId);
    if (!isOwner && !isAdmin) return fail(res, 403, 'Это не ваша бронь');

    await prisma.booking.delete({ where: { id } });
    res.json({ message: 'Бронь отменена' });
  } catch (error) {
    next(error);
  }
});

app.get('/prices', async (req, res, next) => {
  try {
    res.json(await listCurrentPrices(req.club.id));
  } catch (error) {
    next(error);
  }
});

app.get('/menu', async (req, res, next) => {
  try {
    const items = await prisma.menuItem.findMany({
      where: { clubId: req.club.id, available: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });
    res.json(items);
  } catch (error) {
    next(error);
  }
});

app.get('/tournaments', async (req, res, next) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      where: { clubId: req.club.id, start: { gte: new Date() } },
      orderBy: { start: 'asc' }
    });
    res.json(tournaments);
  } catch (error) {
    next(error);
  }
});

app.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const { login, password, agree } = req.body;

    if (!login || !password) return fail(res, 400, 'Заполните все поля');
    if (String(password).length < 8) return fail(res, 400, 'Пароль должен быть не короче 8 символов');
    if (!agree) return fail(res, 400, 'Нужно принять соглашение');

    const exists = await prisma.user.findUnique({ where: { login: String(login) } });
    if (exists) return fail(res, 409, 'Такой пользователь уже есть');

    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { login: String(login), password: hash } });

    req.session.regenerate((err) => {
      if (err) {
        return res.status(201).json({ message: 'Аккаунт создан. Теперь войдите вручную.', login: user.login });
      }
      req.session.userId = user.id;
      req.session.login = user.login;
      req.session.role = user.role || 'user';
      req.session.clubId = user.clubId || null;
      req.session.save((saveError) => {
        if (saveError) {
          return res.status(201).json({ message: 'Аккаунт создан. Теперь войдите вручную.', login: user.login });
        }
        res.status(201).json({ message: 'Вы зарегистрированы', login: user.login });
      });
    });
  } catch (error) {
    next(error);
  }
});

app.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) return fail(res, 400, 'Заполните все поля');

    const user = await prisma.user.findUnique({ where: { login: String(login) } });
    if (!user) return fail(res, 401, 'Неверный логин или пароль');

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return fail(res, 401, 'Неверный логин или пароль');

    req.session.regenerate((err) => {
      if (err) return fail(res, 500, 'Ошибка создания сессии');
      req.session.userId = user.id;
      req.session.login = user.login;
      req.session.role = user.role || 'user';
      req.session.clubId = user.clubId || null;
      req.session.save((saveError) => {
        if (saveError) return fail(res, 500, 'Не удалось сохранить сессию');
        res.json({ message: 'Добро пожаловать, ' + user.login, login: user.login, role: user.role || 'user' });
      });
    });
  } catch (error) {
    next(error);
  }
});

app.put('/admin/club', requireClubAdmin, async (req, res, next) => {
  try {
    const fields = ['name', 'address', 'phone', 'email', 'hours', 'description'];
    const data = {};
    for (const field of fields) {
      if (req.body[field] !== undefined) data[field] = String(req.body[field]).trim().slice(0, 500);
    }
    if (data.name !== undefined && !data.name) return fail(res, 400, 'Название не может быть пустым');

    const club = await prisma.club.update({ where: { id: req.club.id }, data });
    res.json(publicClub(club));
  } catch (error) {
    next(error);
  }
});

app.put('/admin/plan', requireSuperadmin, async (req, res, next) => {
  try {
    const { plan } = req.body;
    if (!isValidPlan(plan)) return fail(res, 400, 'Неверный тариф');
    const club = await prisma.club.update({ where: { id: req.club.id }, data: { plan } });
    res.json(publicClub(club));
  } catch (error) {
    next(error);
  }
});

app.post('/admin/halls', requireClubAdmin, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const width = intParam(req.body.width) || 16;
    const height = intParam(req.body.height) || 10;
    if (!name) return fail(res, 400, 'Нужно название зала');
    if (width < 4 || width > 50 || height < 3 || height > 40) {
      return fail(res, 400, 'Размер зала: ширина 4-50, высота 3-40');
    }

    const hall = await prisma.hall.create({ data: { clubId: req.club.id, name, width, height } });
    res.status(201).json(hall);
  } catch (error) {
    if (error.code === 'P2002') return fail(res, 409, 'Зал с таким названием уже есть');
    next(error);
  }
});

app.put('/admin/halls/:id', requireClubAdmin, async (req, res, next) => {
  try {
    const id = intParam(req.params.id);
    if (id === null) return fail(res, 400, 'Неверный id');

    const data = {};
    if (req.body.name !== undefined) {
      data.name = String(req.body.name).trim();
      if (!data.name) return fail(res, 400, 'Название не может быть пустым');
    }
    if (req.body.width !== undefined) data.width = intParam(req.body.width);
    if (req.body.height !== undefined) data.height = intParam(req.body.height);
    if (data.width !== undefined && (data.width < 4 || data.width > 50)) return fail(res, 400, 'Ширина 4-50');
    if (data.height !== undefined && (data.height < 3 || data.height > 40)) return fail(res, 400, 'Высота 3-40');

    const hall = await prisma.hall.findFirst({ where: { id, clubId: req.club.id } });
    if (!hall) return fail(res, 404, 'Зал не найден');

    const updated = await prisma.hall.update({ where: { id }, data });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete('/admin/halls/:id', requireClubAdmin, async (req, res, next) => {
  try {
    const id = intParam(req.params.id);
    if (id === null) return fail(res, 400, 'Неверный id');

    const hall = await prisma.hall.findFirst({ where: { id, clubId: req.club.id } });
    if (!hall) return fail(res, 404, 'Зал не найден');

    await prisma.hall.delete({ where: { id } });
    res.json({ message: 'Зал удалён' });
  } catch (error) {
    next(error);
  }
});

app.post('/seats', requireClubAdmin, async (req, res, next) => {
  try {
    const { name, status, zone, x, y } = req.body;
    if (!name || !ALLOWED_STATUSES.includes(status)) {
      return fail(res, 400, 'Нужны name и статус free/maintenance');
    }

    let hallId = intParam(req.body.hallId);
    if (hallId === null) {
      const hall = await prisma.hall.findFirst({ where: { clubId: req.club.id }, orderBy: { id: 'asc' } });
      if (!hall) return fail(res, 400, 'Сначала создайте зал');
      hallId = hall.id;
    }

    const hall = await prisma.hall.findFirst({ where: { id: hallId, clubId: req.club.id } });
    if (!hall) return fail(res, 404, 'Зал не найден');

    const seatZone = ALLOWED_ZONES.includes(zone) ? zone : 'standard';
    const newSeat = await prisma.seat.create({
      data: {
        clubId: req.club.id,
        hallId,
        name: String(name).trim(),
        status,
        zone: seatZone,
        x: intParam(x) || 0,
        y: intParam(y) || 0
      }
    });
    res.status(201).json(newSeat);
  } catch (error) {
    if (error.code === 'P2002') return fail(res, 409, 'Место с таким названием уже есть');
    next(error);
  }
});

app.put('/seats/:id', requireClubAdmin, async (req, res, next) => {
  try {
    const id = intParam(req.params.id);
    if (id === null) return fail(res, 400, 'Неверный id');

    const { name, status, zone, x, y } = req.body;
    if (status !== undefined && !ALLOWED_STATUSES.includes(status)) return fail(res, 400, 'Неверный статус');
    if (zone !== undefined && !ALLOWED_ZONES.includes(zone)) return fail(res, 400, 'Неверная зона');
    if (name !== undefined && !String(name).trim()) return fail(res, 400, 'Название не может быть пустым');

    const seat = await prisma.seat.findFirst({ where: { id, clubId: req.club.id } });
    if (!seat) return fail(res, 404, 'Место не найдено');

    const data = {};
    if (name !== undefined) data.name = String(name).trim();
    if (status !== undefined) data.status = status;
    if (zone !== undefined) data.zone = zone;
    if (x !== undefined) data.x = intParam(x) || 0;
    if (y !== undefined) data.y = intParam(y) || 0;
    if (req.body.hallId !== undefined) {
      const hallId = intParam(req.body.hallId);
      const hall = await prisma.hall.findFirst({ where: { id: hallId, clubId: req.club.id } });
      if (!hall) return fail(res, 404, 'Зал не найден');
      data.hallId = hallId;
    }

    const updated = await prisma.seat.update({ where: { id }, data });
    res.json(updated);
  } catch (error) {
    if (error.code === 'P2002') return fail(res, 409, 'Место с таким названием уже есть');
    next(error);
  }
});

app.delete('/seats/:id', requireClubAdmin, async (req, res, next) => {
  try {
    const id = intParam(req.params.id);
    if (id === null) return fail(res, 400, 'Неверный id');

    const seat = await prisma.seat.findFirst({ where: { id, clubId: req.club.id } });
    if (!seat) return fail(res, 404, 'Место не найдено');

    await prisma.seat.delete({ where: { id } });
    res.json({ message: 'Место удалено' });
  } catch (error) {
    next(error);
  }
});

app.put('/admin/prices', requireClubAdmin, async (req, res, next) => {
  try {
    for (const zone of ALLOWED_ZONES) {
      if (req.body[zone] === undefined) continue;
      const price = Number(req.body[zone]);
      if (!Number.isFinite(price) || price < 0) return fail(res, 400, 'Неверная цена для зоны ' + zone);
      await setPrice(req.club.id, zone, Math.round(price));
    }
    res.json(await listCurrentPrices(req.club.id));
  } catch (error) {
    next(error);
  }
});

app.get('/admin/prices/history', requireClubAdmin, async (req, res, next) => {
  try {
    const rows = await prisma.priceHistory.findMany({
      where: { clubId: req.club.id },
      orderBy: [{ validFrom: 'desc' }, { id: 'desc' }],
      take: 200
    });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get('/admin/menu', requireClubAdmin, async (req, res, next) => {
  try {
    const items = await prisma.menuItem.findMany({
      where: { clubId: req.club.id },
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });
    res.json(items);
  } catch (error) {
    next(error);
  }
});

app.post('/admin/menu', requireClubAdmin, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const category = String(req.body.category || 'Напитки').trim();
    const price = Number(req.body.price);
    if (!name) return fail(res, 400, 'Нужно название');
    if (!Number.isFinite(price) || price < 0) return fail(res, 400, 'Неверная цена');

    const item = await prisma.menuItem.create({
      data: {
        clubId: req.club.id,
        name: name.slice(0, 120),
        category: category.slice(0, 60),
        price: Math.round(price),
        available: req.body.available !== false
      }
    });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

app.put('/admin/menu/:id', requireClubAdmin, async (req, res, next) => {
  try {
    const id = intParam(req.params.id);
    if (id === null) return fail(res, 400, 'Неверный id');

    const item = await prisma.menuItem.findFirst({ where: { id, clubId: req.club.id } });
    if (!item) return fail(res, 404, 'Позиция не найдена');

    const data = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return fail(res, 400, 'Название не может быть пустым');
      data.name = name.slice(0, 120);
    }
    if (req.body.category !== undefined) data.category = String(req.body.category).trim().slice(0, 60);
    if (req.body.price !== undefined) {
      const price = Number(req.body.price);
      if (!Number.isFinite(price) || price < 0) return fail(res, 400, 'Неверная цена');
      data.price = Math.round(price);
    }
    if (req.body.available !== undefined) data.available = Boolean(req.body.available);

    res.json(await prisma.menuItem.update({ where: { id }, data }));
  } catch (error) {
    next(error);
  }
});

app.delete('/admin/menu/:id', requireClubAdmin, async (req, res, next) => {
  try {
    const id = intParam(req.params.id);
    if (id === null) return fail(res, 400, 'Неверный id');

    const item = await prisma.menuItem.findFirst({ where: { id, clubId: req.club.id } });
    if (!item) return fail(res, 404, 'Позиция не найдена');

    await prisma.menuItem.delete({ where: { id } });
    res.json({ message: 'Позиция удалена' });
  } catch (error) {
    next(error);
  }
});

app.post('/admin/tournaments', requireClubAdmin, async (req, res, next) => {
  try {
    const { title, game, description, start, entryFee } = req.body;
    const startAt = new Date(start);
    const fee = Number(entryFee);

    if (!title || !String(title).trim() || !game || !String(game).trim()) {
      return fail(res, 400, 'Нужны название и игра');
    }
    if (isNaN(startAt.getTime())) return fail(res, 400, 'Неверная дата турнира');
    if (startAt <= new Date()) return fail(res, 400, 'Дата турнира должна быть в будущем');
    if (!Number.isFinite(fee) || fee < 0) return fail(res, 400, 'Неверный взнос');

    const created = await prisma.tournament.create({
      data: {
        clubId: req.club.id,
        title: String(title).trim().slice(0, 80),
        game: String(game).trim().slice(0, 40),
        description: description ? String(description).trim().slice(0, 300) : '',
        start: startAt,
        entryFee: Math.round(fee)
      }
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.delete('/admin/tournaments/:id', requireClubAdmin, async (req, res, next) => {
  try {
    const id = intParam(req.params.id);
    if (id === null) return fail(res, 400, 'Неверный id');

    const tournament = await prisma.tournament.findFirst({ where: { id, clubId: req.club.id } });
    if (!tournament) return fail(res, 404, 'Турнир не найден');

    await prisma.tournament.delete({ where: { id } });
    res.json({ message: 'Турнир удалён' });
  } catch (error) {
    next(error);
  }
});

app.get('/admin/bookings', requireClubAdmin, async (req, res, next) => {
  try {
    const now = new Date();
    const bookings = await prisma.booking.findMany({
      where: { clubId: req.club.id, status: 'active', end: { gt: now } },
      orderBy: { start: 'asc' },
      include: {
        user: { select: { login: true } },
        seats: { include: { seat: { select: { id: true, name: true, zone: true } } } }
      }
    });
    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

app.post('/admin/clubs', requireSuperadmin, async (req, res, next) => {
  try {
    const slug = String(req.body.slug || '').trim().toLowerCase();
    const name = String(req.body.name || '').trim();
    const plan = req.body.plan || 'economy';

    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) return fail(res, 400, 'Slug: латиница, цифры, дефис');
    if (!name) return fail(res, 400, 'Нужно название клуба');
    if (!isValidPlan(plan)) return fail(res, 400, 'Неверный тариф');

    const club = await prisma.club.create({
      data: {
        slug,
        name,
        plan,
        address: String(req.body.address || '').trim(),
        phone: String(req.body.phone || '').trim(),
        email: String(req.body.email || '').trim(),
        hours: String(req.body.hours || '').trim(),
        description: String(req.body.description || '').trim()
      }
    });
    res.status(201).json(publicClub(club));
  } catch (error) {
    if (error.code === 'P2002') return fail(res, 409, 'Клуб с таким slug уже есть');
    next(error);
  }
});

app.get('/c/:slug', (req, res) => {
  res.redirect('/club.html?club=' + encodeURIComponent(req.params.slug));
});

app.use((req, res) => {
  fail(res, 404, 'Не найдено');
});

app.use((error, req, res, next) => {
  const status = error.status >= 400 && error.status < 500 ? error.status : 500;
  if (status === 500) console.error(error);
  fail(res, status, status === 400 ? 'Некорректный запрос' : 'Ошибка сервера');
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log('Сервер запущен на http://localhost:' + PORT);
});
