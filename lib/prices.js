const { prisma } = require('./db');

const ZONES = ['standard', 'comfort', 'vip'];

async function currentPrices(clubId) {
  const rows = await prisma.priceHistory.findMany({
    where: { clubId, validFrom: { lte: new Date() } },
    orderBy: [{ zone: 'asc' }, { validFrom: 'desc' }, { id: 'desc' }]
  });

  const result = {};
  for (const row of rows) {
    if (!(row.zone in result)) result[row.zone] = row.price;
  }
  return result;
}

async function listCurrentPrices(clubId) {
  const prices = await currentPrices(clubId);
  return ZONES
    .filter((zone) => zone in prices)
    .map((zone) => ({ zone, price: prices[zone] }));
}

async function setPrice(clubId, zone, price) {
  const current = await currentPrices(clubId);
  if (current[zone] === price) return null;
  return prisma.priceHistory.create({ data: { clubId, zone, price } });
}

module.exports = { ZONES, currentPrices, listCurrentPrices, setPrice };
