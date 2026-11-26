const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

function parseTime(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

function buildDateTime(dateOnly, time) {
  const result = new Date(dateOnly);
  result.setHours(time.hours, time.minutes, 0, 0);
  return result;
}

function dayEnd(dateOnly) {
  const result = new Date(dateOnly);
  result.setDate(result.getDate() + 1);
  return result;
}

function hhmm(date, endOfDay) {
  if (endOfDay) return '24:00';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return hours + ':' + minutes;
}

module.exports = { DAY_MS, parseDateOnly, parseTime, buildDateTime, dayEnd, hhmm };
