(function () {
  const placeholder = document.getElementById('unifiedNav');
  if (!placeholder) return;

  const params = new URLSearchParams(location.search);
  const slug = params.get('club') || '';
  const links = [
    { href: '/clubs.html', label: 'Все клубы', match: 'clubs.html' },
    { href: '/club.html?club=nexus-economy', label: 'Economy', match: 'nexus-economy' },
    { href: '/club.html?club=nexus-standard', label: 'Standard', match: 'nexus-standard' },
    { href: '/club.html?club=nexus-lux', label: 'Lux', match: 'nexus-lux' },
    { href: '/apply.html', label: 'Подключить клуб', match: 'apply.html' }
  ];

  if (slug) {
    links.push({ href: '/menu.html?club=' + encodeURIComponent(slug), label: 'Меню и бронь', match: 'menu.html' });
  }

  links.forEach((item) => {
    const link = document.createElement('a');
    link.href = item.href;
    link.textContent = item.label;
    const active = location.pathname.endsWith(item.match) || slug === item.match;
    if (active) link.className = 'active';
    placeholder.append(link);
  });
})();
