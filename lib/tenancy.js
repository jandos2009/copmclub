const { prisma } = require('./db');

const STAFF_ROLES = ['admin', 'owner', 'superadmin'];

function subdomainSlug(hostname) {
  if (!hostname) return null;
  const host = String(hostname).split(':')[0].toLowerCase();
  if (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  const parts = host.split('.');
  if (parts.length < 3) return null;
  if (parts[0] === 'www') return null;
  return parts[0];
}

async function resolveClub(req, res, next) {
  try {
    const slug = String(req.query.club || req.get('x-club') || subdomainSlug(req.hostname) || '');
    const club = slug
      ? await prisma.club.findUnique({ where: { slug } })
      : await prisma.club.findFirst({ orderBy: { id: 'asc' } });
    if (!club) {
      return res.status(404).json({ message: 'Клуб не найден' });
    }
    req.club = club;
    next();
  } catch (error) {
    next(error);
  }
}

function isStaff(session) {
  return Boolean(session && session.userId && STAFF_ROLES.includes(session.role));
}

function canManageClub(session, clubId) {
  if (!isStaff(session)) return false;
  if (session.role === 'superadmin') return true;
  return session.clubId === clubId;
}

module.exports = { STAFF_ROLES, resolveClub, isStaff, canManageClub, subdomainSlug };
