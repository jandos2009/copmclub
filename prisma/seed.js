const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'admin12345';

const ZONES = {
  standard: { prefix: 'STD', count: 15, price: 700 },
  comfort: { prefix: 'CMB', count: 10, price: 1000 },
  vip: { prefix: 'VIP', count: 9, price: 1500 }
};

const MENU = [
  { category: 'Напитки', name: 'Cola 0.5', price: 400 },
  { category: 'Напитки', name: 'Энергетик', price: 700 },
  { category: 'Напитки', name: 'Кофе', price: 500 },
  { category: 'Напитки', name: 'Чай', price: 300 },
  { category: 'Еда', name: 'Чипсы', price: 350 },
  { category: 'Еда', name: 'Хот-дог', price: 600 },
  { category: 'Еда', name: 'Пицца 30 см', price: 1200 },
  { category: 'Еда', name: 'Наггетсы', price: 800 }
];

const TOURNAMENTS = [
  { title: 'CS2 Night Cup', game: 'CS2', days: 5, hours: 19, entryFee: 2000, description: '5x5, группы BO1, финал BO3. Призовой фонд 50 000 ₸.' },
  { title: 'Valorant Friday', game: 'Valorant', days: 9, hours: 18, entryFee: 2500, description: '5x5, карты по жеребьёвке, матчи до двух побед.' },
  { title: 'FC 26 PS5 Cup', game: 'EA FC 26', days: 12, hours: 17, entryFee: 1500, description: '1x1 на PS5, 8 участников, плей-офф.' },
  { title: 'Dota 2 Weekend', game: 'Dota 2', days: 16, hours: 16, entryFee: 3000, description: '5x5, single elimination, финал BO3.' }
];

const CLUBS = [
  {
    slug: 'nexus-lux',
    name: 'NEXUS CLUB Lux',
    plan: 'lux',
    address: 'г. Алматы, ул. Абая, 15',
    phone: '+7 (727) 123-45-67',
    email: 'lux@nexus-club.kz',
    hours: 'Круглосуточно, без выходных',
    description: 'Флагманский клуб: VIP-зал, PS5, турниры и полноценная онлайн-бронь с картой мест.',
    admin: 'luxadmin',
    halls: [
      { name: 'Основной зал', width: 16, height: 10, zones: ['standard', 'comfort'] },
      { name: 'VIP-зал', width: 10, height: 6, zones: ['vip'] }
    ]
  },
  {
    slug: 'nexus-standard',
    name: 'NEXUS CLUB Standard',
    plan: 'standard',
    address: 'г. Алматы, ул. Сейфуллина, 42',
    phone: '+7 (727) 234-56-78',
    email: 'standard@nexus-club.kz',
    hours: '10:00 - 02:00',
    description: 'Уютный клуб в центре города: 34 игровых места, бар и регулярные турниры.',
    admin: 'stdadmin',
    halls: [
      { name: 'Основной зал', width: 16, height: 10, zones: ['standard', 'comfort', 'vip'] }
    ]
  },
  {
    slug: 'nexus-economy',
    name: 'NEXUS CLUB Economy',
    plan: 'economy',
    address: 'г. Алматы, ул. Рыскулова, 8',
    phone: '+7 (727) 345-67-89',
    email: 'economy@nexus-club.kz',
    hours: '12:00 - 24:00',
    description: 'Доступный клуб для тренировок и игр с друзьями. Бар и акции каждую неделю.',
    admin: 'ecadmin',
    halls: [
      { name: 'Основной зал', width: 16, height: 10, zones: ['standard', 'comfort', 'vip'] }
    ]
  }
];

function seatPositions(index, hall) {
  const perRow = hall.name === 'VIP-зал' ? 3 : 5;
  return {
    x: (index % perRow) + 1,
    y: Math.floor(index / perRow) + 2
  };
}

async function ensureUser(login, role, clubId) {
  const existing = await prisma.user.findUnique({ where: { login } });
  if (existing) {
    if (existing.role !== role || existing.clubId !== clubId) {
      await prisma.user.update({ where: { login }, data: { role, clubId } });
    }
    return;
  }
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  await prisma.user.create({ data: { login, password: hash, role, clubId } });
}

async function seedClub(config) {
  let club = await prisma.club.findUnique({ where: { slug: config.slug } });
  if (!club) {
    club = await prisma.club.create({
      data: {
        slug: config.slug,
        name: config.name,
        plan: config.plan,
        address: config.address,
        phone: config.phone,
        email: config.email,
        hours: config.hours,
        description: config.description
      }
    });
  }

  const seatCount = await prisma.seat.count({ where: { clubId: club.id } });
  if (seatCount === 0) {
    for (const hallConfig of config.halls) {
      const hall = await prisma.hall.create({
        data: { clubId: club.id, name: hallConfig.name, width: hallConfig.width, height: hallConfig.height }
      });

      let index = 0;
      for (const zone of hallConfig.zones) {
        const info = ZONES[zone];
        for (let i = 1; i <= info.count; i += 1) {
          const pos = seatPositions(index, hallConfig);
          await prisma.seat.create({
            data: {
              clubId: club.id,
              hallId: hall.id,
              name: info.prefix + '-' + String(i).padStart(2, '0'),
              zone,
              status: 'free',
              x: pos.x,
              y: pos.y
            }
          });
          index += 1;
        }
      }
    }
  }

  const priceCount = await prisma.priceHistory.count({ where: { clubId: club.id } });
  if (priceCount === 0) {
    for (const [zone, info] of Object.entries(ZONES)) {
      await prisma.priceHistory.create({ data: { clubId: club.id, zone, price: info.price } });
    }
  }

  const menuCount = await prisma.menuItem.count({ where: { clubId: club.id } });
  if (menuCount === 0) {
    for (const item of MENU) {
      await prisma.menuItem.create({ data: { clubId: club.id, ...item } });
    }
  }

  const tournamentCount = await prisma.tournament.count({ where: { clubId: club.id } });
  if (tournamentCount === 0) {
    for (const event of TOURNAMENTS) {
      const start = new Date();
      start.setDate(start.getDate() + event.days);
      start.setHours(event.hours, 0, 0, 0);
      await prisma.tournament.create({
        data: {
          clubId: club.id,
          title: event.title,
          game: event.game,
          description: event.description,
          start,
          entryFee: event.entryFee
        }
      });
    }
  }

  await ensureUser(config.admin, 'admin', club.id);
  return club;
}

(async () => {
  await ensureUser('admin', 'superadmin', null);

  for (const config of CLUBS) {
    const club = await seedClub(config);
    const [seats, halls, menu, tournaments] = await Promise.all([
      prisma.seat.count({ where: { clubId: club.id } }),
      prisma.hall.count({ where: { clubId: club.id } }),
      prisma.menuItem.count({ where: { clubId: club.id } }),
      prisma.tournament.count({ where: { clubId: club.id } })
    ]);
    console.log(club.slug + ' [' + club.plan + ']: мест ' + seats + ', залов ' + halls + ', меню ' + menu + ', турниров ' + tournaments);
  }

  console.log('Пароль всех админов: ' + DEFAULT_PASSWORD);
  console.log('superadmin: admin');
  for (const config of CLUBS) console.log(config.slug + ' admin: ' + config.admin);

  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
