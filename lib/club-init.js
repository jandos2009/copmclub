const { prisma } = require('./db');
const { ZONES, TOURNAMENTS } = require('./plans');

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

async function initializeClubContent(club) {
  const seatCount = await prisma.seat.count({ where: { clubId: club.id } });
  if (seatCount === 0) {
    for (const zone of ZONES) {
      const width = Math.min(5, zone.seats);
      const height = Math.ceil(zone.seats / width);
      const hall = await prisma.hall.create({
        data: { clubId: club.id, name: zone.label, width, height }
      });

      for (let i = 0; i < zone.seats; i += 1) {
        await prisma.seat.create({
          data: {
            clubId: club.id,
            hallId: hall.id,
            name: zone.key.toUpperCase() + '-' + String(i + 1).padStart(2, '0'),
            zone: zone.key,
            status: 'free',
            x: (i % width) + 1,
            y: Math.floor(i / width) + 1
          }
        });
      }
    }
  }

  const priceCount = await prisma.priceHistory.count({ where: { clubId: club.id } });
  if (priceCount === 0) {
    for (const zone of ZONES) {
      await prisma.priceHistory.create({ data: { clubId: club.id, zone: zone.key, price: zone.price } });
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
          entryFee: event.entryFee,
          start
        }
      });
    }
  }
}

module.exports = { initializeClubContent };
