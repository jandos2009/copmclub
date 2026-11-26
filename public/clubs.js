(function () {
  const listNode = document.getElementById('clubsList');
  const emptyNode = document.getElementById('clubsEmpty');
  const countNode = document.getElementById('clubsCount');
  const searchNode = document.getElementById('clubSearch');
  const planCardsNode = document.getElementById('planCards');
  const clubsFactNode = document.getElementById('clubsFact');
  let clubs = [];
  let plans = {};
  let activePlan = 'all';

  function plural(value, one, few, many) {
    const mod10 = value % 10;
    const mod100 = value % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function planTitle(value) {
    return (plans[value] && plans[value].title) || value;
  }

  function planInfo(club) {
    return club.planInfo || plans[club.plan] || null;
  }

  function renderPlans() {
    planCardsNode.textContent = '';
    Object.keys(plans).forEach((key) => {
      const plan = plans[key];
      const card = element('article', 'plan-card');
      card.style.setProperty('--plan-color', plan.colors && plan.colors.accent ? plan.colors.accent : 'var(--accent)');

      const title = element('h3', '', plan.title);
      const tagline = element('p', '', plan.tagline);
      const list = element('ul', 'plan-list');
      plan.advantages.forEach((item) => {
        list.append(element('li', '', item));
      });

      const notes = [];
      if (plan.requirements && plan.requirements.length) notes.push('Нужно: ' + plan.requirements.join(', '));
      if (plan.restrictions && plan.restrictions.length) notes.push('Ограничения: ' + plan.restrictions.join(' · '));
      const note = element('p', 'plan-note', notes.join('. '));

      card.append(title, tagline, list, note);
      planCardsNode.append(card);
    });
  }

  function metaRow(label, value) {
    const row = element('div', 'meta-row');
    row.append(element('dt', '', label), element('dd', '', value));
    return row;
  }

  function renderClub(club) {
    const info = planInfo(club);
    const card = element('article', 'club-card');

    const head = element('div', 'club-card-head');
    head.append(element('h3', '', club.name));

    const badge = element('span', 'badge', planTitle(club.plan));
    if (info && info.colors && info.colors.accent) {
      badge.style.setProperty('--plan-color', info.colors.accent);
    }
    head.append(badge);

    const meta = element('dl', 'club-meta');
    meta.append(metaRow('Адрес', club.address || 'Уточняется'));
    meta.append(metaRow('Режим', club.hours || 'Уточняется'));
    if (club.phone) meta.append(metaRow('Телефон', club.phone));

    const features = element('div', 'club-features');
    if (info && Array.isArray(info.advantages)) {
      info.advantages.slice(0, 3).forEach((item) => {
        features.append(element('span', 'feature', item));
      });
    }

    const actions = element('div', 'club-actions');
    const site = element('a', 'button quiet', 'Открыть клуб');
    site.href = '/club.html?club=' + encodeURIComponent(club.slug);
    const menu = element('a', 'button', 'Меню и бронь');
    menu.href = '/menu.html?club=' + encodeURIComponent(club.slug);
    actions.append(site, menu);

    card.append(head, meta, features, actions);
    return card;
  }

  function render() {
    const query = searchNode.value.trim().toLowerCase();
    const filtered = clubs.filter((club) => {
      const matchesPlan = activePlan === 'all' || club.plan === activePlan;
      const haystack = [club.name, club.address, club.phone, club.hours, planTitle(club.plan)].join(' ').toLowerCase();
      return matchesPlan && haystack.includes(query);
    });

    listNode.textContent = '';
    filtered.forEach((club) => listNode.append(renderClub(club)));
    emptyNode.classList.toggle('hidden', filtered.length > 0);
    countNode.textContent = filtered.length + ' ' + plural(filtered.length, 'клуб', 'клуба', 'клубов');
    clubsFactNode.textContent = String(clubs.length);
  }

  document.querySelectorAll('[data-plan]').forEach((button) => {
    button.addEventListener('click', () => {
      activePlan = button.dataset.plan;
      document.querySelectorAll('[data-plan]').forEach((item) => {
        item.classList.toggle('active', item === button);
      });
      render();
    });
  });

  searchNode.addEventListener('input', render);

  async function loadAuth() {
    try {
      const response = await fetch('/api/session');
      if (!response.ok) return;
      const user = await response.json();
      if (!user.authenticated) return;
      const authLink = document.getElementById('authLink');
      const adminLink = document.getElementById('adminLink');
      authLink.textContent = 'Кабинет';
      authLink.href = '/profile.html';
      if (['admin', 'owner', 'superadmin'].includes(user.role)) {
        adminLink.classList.remove('hidden');
        adminLink.href = '/menu.html';
      }
    } catch (error) {
      return;
    }
  }

  async function init() {
    try {
      const [clubsResponse, plansResponse] = await Promise.all([fetch('/api/clubs'), fetch('/api/plans')]);
      if (!clubsResponse.ok) throw new Error('Не удалось загрузить клубы');
      clubs = await clubsResponse.json();
      plans = await plansResponse.json();
      renderPlans();
      render();
      loadAuth();
    } catch (error) {
      listNode.textContent = '';
      emptyNode.classList.remove('hidden');
      emptyNode.querySelector('strong').textContent = 'Не удалось загрузить каталог';
      emptyNode.lastChild.textContent = 'Обновите страницу или попробуйте позже.';
      countNode.textContent = '';
      clubsFactNode.textContent = '—';
    }
  }

  init();
})();
