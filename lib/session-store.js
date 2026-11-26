const session = require('express-session');
const { prisma } = require('./db');

const DEFAULT_TTL = 30 * 24 * 60 * 60 * 1000;

class PrismaSessionStore extends session.Store {
  constructor(options) {
    super();
    const opts = options || {};
    this.ttlMs = opts.ttlMs || DEFAULT_TTL;
  }

  get(sid, callback) {
    prisma.session.findUnique({ where: { id: sid } })
      .then((row) => {
        if (!row) return callback(null, null);
        if (row.expiresAt <= new Date()) {
          return prisma.session.delete({ where: { id: sid } })
            .catch(() => {})
            .then(() => callback(null, null));
        }
        let data;
        try {
          data = JSON.parse(row.data);
        } catch (error) {
          return callback(null, null);
        }
        callback(null, data);
      })
      .catch((error) => callback(error));
  }

  set(sid, sess, callback) {
    const data = JSON.stringify(sess);
    const expiresAt = new Date(Date.now() + this.ttlMs);
    prisma.session.upsert({
      where: { id: sid },
      update: { data, expiresAt },
      create: { id: sid, data, expiresAt }
    })
      .then(() => callback && callback(null))
      .catch((error) => callback && callback(error));
  }

  destroy(sid, callback) {
    prisma.session.delete({ where: { id: sid } })
      .catch(() => {})
      .then(() => callback && callback(null));
  }

  touch(sid, sess, callback) {
    const expiresAt = new Date(Date.now() + this.ttlMs);
    prisma.session.updateMany({ where: { id: sid }, data: { expiresAt } })
      .catch(() => {})
      .then(() => callback && callback(null));
  }

  clearExpired() {
    return prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  }

  startCleanup(intervalMs) {
    const timer = setInterval(() => {
      this.clearExpired().catch(() => {});
    }, intervalMs || 60 * 60 * 1000);
    if (timer.unref) timer.unref();
    return timer;
  }
}

module.exports = { PrismaSessionStore };
