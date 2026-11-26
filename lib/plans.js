const CLUB_DEFAULTS = {
  name: 'NEXUS CLUB',
  hours: 'Круглосуточно, без выходных',
  address: 'г. Москва, ул. Профсоюзная, 15',
  phone: '+7 (495) 123-45-67',
  email: 'hello@nexus-club.ru'
};

const ZONES = [
  { key: 'standard', label: 'Стандарт', seats: 15, price: 150, monitor: '24″, 144 Гц', gpu: 'RTX 3060' },
  { key: 'comfort', label: 'Комфорт', seats: 10, price: 250, monitor: '27″, 165 Гц', gpu: 'RTX 4060' },
  { key: 'vip', label: 'VIP', seats: 9, price: 400, monitor: '27″, 240 Гц', gpu: 'RTX 4070' }
];

const RULES = [
  'Приходите за 10–15 минут до начала брони — так мы успеем всё подготовить.',
  'Занимайте только своё место и не меняйте компьютер без согласования.',
  'Не приносите свою еду и напитки: всё есть в баре клуба.',
  'Не устанавливайте сторонний софт и не меняйте настройки системы.',
  'Не курите в помещении — курилка находится на улице у входа.',
  'Гостям младше 14 лет — только в сопровождении взрослых.',
  'Уважайте других гостей: без громкой музыки и споров на повышенных тонах.',
  'Бережно относитесь к технике. За повреждения отвечает гость.'
];

const TOURNAMENTS = [
  { title: 'CS2 Night Cup', game: 'CS2', days: 5, hours: 19, entryFee: 300, description: '5x5, группы BO1, финал BO3. Призовой фонд — 10 000 ₽.' },
  { title: 'Valorant Friday', game: 'Valorant', days: 9, hours: 18, entryFee: 400, description: '5x5, карты по жеребьёвке, матчи до двух побед.' },
  { title: 'FC 25 PS5 Cup', game: 'EA FC 25', days: 12, hours: 17, entryFee: 200, description: '1x1 на PlayStation 5, 8 участников, плей-офф.' },
  { title: 'Dota 2 Weekend', game: 'Dota 2', days: 16, hours: 16, entryFee: 500, description: '5x5, single elimination, финал BO3.' }
];

const BASE_REQUIREMENTS = ['Название и адрес клуба', 'Телефон и email', 'Режим работы', 'Описание залов и цен'];
const BASE_SETTINGS = ['Залы и места', 'Цены по зонам', 'Меню бара', 'Афиша турниров', 'Правила клуба'];

const PLANS = {
  economy: {
    booking: false,
    seatMap: false,
    groupBooking: false,
    title: 'Economy',
    tier: 'ЭКОНОМ',
    tagline: 'Играй рядом. Плати по-честному.',
    intro: 'Доступный клуб с тремя залами, 34 игровыми местами и честным железом. Работаем круглосуточно, без выходных и скрытых доплат.',
    advantages: ['Доступные цены от 150 ₽/час', 'Честное железо RTX 3060–4070', 'Круглосуточно, без выходных', 'Турниры каждую неделю'],
    restrictions: ['Без онлайн-брони', 'Без интерактивной карты зала'],
    requirements: BASE_REQUIREMENTS,
    settings: ['Статическая схема помещений', ...BASE_SETTINGS],
    bookingNote: 'Онлайн-бронирование недоступно: запись по телефону или на ресепшене.',
    limits: { activeBookings: 0, groupSeats: 0 },
    colors: { bg: '#f5f8f4', surface: '#ffffff', ink: '#16231b', muted: '#58685e', accent: '#16a34a', accentHover: '#0f7a37', border: '#dfe8e1', radius: '16px' }
  },
  standard: {
    booking: true,
    seatMap: false,
    groupBooking: false,
    title: 'Standard',
    tier: 'STANDARD',
    tagline: 'Три зала, онлайн-бронь без звонков и интерактивных карт.',
    intro: 'Выберите зал, дату и время — свободное место найдётся за пару кликов. Бронь закрепляется за вашим аккаунтом.',
    advantages: ['Всё из Economy', 'Онлайн-бронь мест по времени', 'Свободные места списком — без карты', 'До 5 активных броней'],
    restrictions: ['Без карты зала', 'Без брони компанией'],
    requirements: [...BASE_REQUIREMENTS, 'Аккаунт гостя для брони', 'Список мест по залам'],
    settings: [...BASE_SETTINGS, 'Онлайн-бронирование', 'Мои брони', 'Лимит 5 активных сессий'],
    bookingNote: 'Зарегистрируйтесь, выберите зал и время. Система покажет свободные места списком — без карты помещения.',
    limits: { activeBookings: 5, groupSeats: 1 },
    colors: { bg: '#0e1015', surface: '#171b25', ink: '#eef1f7', muted: '#99a2b3', accent: '#f5a524', accentHover: '#ffb84d', border: 'rgba(255,255,255,0.09)', radius: '16px' }
  },
  lux: {
    booking: true,
    seatMap: true,
    groupBooking: true,
    title: 'Lux',
    tier: 'LUX',
    tagline: 'Карта зала и бронь компанией.',
    intro: 'Флагманский клуб: интерактивная карта зала, бронь до 10 мест одной компанией и полный контроль рассадки.',
    advantages: ['Всё из Standard', 'Карта зала по координатам', 'Бронь до 10 мест компанией', 'Редактор расстановки мест'],
    restrictions: [],
    requirements: [...BASE_REQUIREMENTS, 'Координаты мест на схеме'],
    settings: [...BASE_SETTINGS, 'Карта зала и редактор', 'Групповые брони до 10 мест'],
    bookingNote: 'Выберите места на карте зала — можно забронировать до 10 мест одной компанией.',
    limits: { activeBookings: 5, groupSeats: 10 },
    colors: { bg: '#0a0a0f', surface: '#1a1a24', ink: '#e8e8f0', muted: '#6b6b80', accent: '#00d4aa', accentHover: '#00f5c4', border: '#2a2a3a', radius: '8px' }
  }
};

function planFeatures(plan) {
  return PLANS[plan] || PLANS.economy;
}

function planInfo(plan) {
  return planFeatures(plan);
}

function allPlans() {
  return PLANS;
}

function isValidPlan(plan) {
  return Object.prototype.hasOwnProperty.call(PLANS, plan);
}

module.exports = { CLUB_DEFAULTS, ZONES, RULES, TOURNAMENTS, PLANS, planFeatures, planInfo, allPlans, isValidPlan };
