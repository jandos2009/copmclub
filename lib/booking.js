const crypto = require('crypto');
const { prisma } = require('./db');

const locks = new Map();

function withLock(key, task) {
  const previous = locks.get(key) || Promise.resolve();
  const run = previous.then(task, task);
  locks.set(key, run.catch(() => {}));
  return run;
}

function seatView(seat, activeBooking) {
  const maintenance = seat.status === 'maintenance';
  const status = maintenance ? 'maintenance' : (activeBooking ? 'occupied' : 'free');
  return {
    id: seat.id,
    name: seat.name,
    zone: seat.zone,
    hallId: seat.hallId,
    x: seat.x,
    y: seat.y,
    status,
    maintenance,
    activeBookingId: activeBooking ? activeBooking.bookingId : null,
    bookedById: activeBooking ? activeBooking.userId : null
  };
}

async function seatsWithOccupancy(clubId, at) {
  const now = at || new Date();
  const seats = await prisma.seat.findMany({
    where: { clubId },
    orderBy: { id: 'asc' },
    include: {
      bookingSeats: {
        where: {
          booking: { status: 'active', start: { lte: now }, end: { gt: now } }
        },
        select: { bookingId: true, booking: { select: { userId: true } } }
      }
    }
  });

  return seats.map((seat) => {
    const active = seat.bookingSeats[0]
      ? { bookingId: seat.bookingSeats[0].bookingId, userId: seat.bookingSeats[0].booking.userId }
      : null;
    return seatView(seat, active);
  });
}

async function createBooking(clubId, userId, seatIds, startAt, endAt) {
  return withLock('club:' + clubId, async () => {
    try {
      return await prisma.$transaction(async (tx) => {
        const seats = await tx.seat.findMany({ where: { id: { in: seatIds }, clubId } });
        if (seats.length !== seatIds.length) {
          return { status: 404, message: 'Место не найдено' };
        }

        const maintenance = seats.find((seat) => seat.status === 'maintenance');
        if (maintenance) {
          return { status: 409, message: 'Место ' + maintenance.name + ' на обслуживании' };
        }

        const conflict = await tx.bookingSeat.findFirst({
          where: {
            seatId: { in: seatIds },
            booking: { clubId, status: 'active', start: { lt: endAt }, end: { gt: startAt } }
          },
          include: { seat: { select: { name: true } } }
        });
        if (conflict) {
          return { status: 409, message: 'Место ' + conflict.seat.name + ' занято на это время' };
        }

        const booking = await tx.booking.create({
          data: {
            clubId,
            userId,
            groupId: crypto.randomUUID(),
            start: startAt,
            end: endAt,
            seats: {
              create: seatIds.map((seatId) => ({ seatId, start: startAt, end: endAt }))
            }
          },
          include: { seats: { include: { seat: { select: { id: true, name: true, zone: true } } } } }
        });

        return { status: 201, booking };
      });
    } catch (error) {
      const violation = error.code === '23P01'
        || (error.meta && error.meta.code === '23P01')
        || String(error.message || '').includes('23P01');
      if (violation) {
        return { status: 409, message: 'Место уже забронировано на это время' };
      }
      throw error;
    }
  });
}

module.exports = { seatView, seatsWithOccupancy, createBooking };
