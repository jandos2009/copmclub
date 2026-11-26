(function () {
  const nameNode = document.getElementById('profileName');
  const roleNode = document.getElementById('profileRole');
  const avatarNode = document.getElementById('profileAvatar');
  const messageNode = document.getElementById('profileMessage');
  const bookingListNode = document.getElementById('bookingList');
  const bookingEmptyNode = document.getElementById('bookingEmpty');
  const applicationListNode = document.getElementById('applicationList');
  const applicationEmptyNode = document.getElementById('applicationEmpty');
  const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' });
  const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function roleLabel(role) {
    if (role === 'superadmin') return 'Суперадминистратор';
    if (role === 'owner') return 'Владелец клуба';
    if (role === 'admin') return 'Администратор клуба';
    return 'Пользователь';
  }

  function statusLabel(status) {
    if (status === 'approved') return 'Одобрена';
    if (status === 'rejected') return 'Отклонена';
    return 'На проверке';
  }

  function sameDay(first, second) {
    return first.getFullYear() === second.getFullYear()
      && first.getMonth() === second.getMonth()
      && first.getDate() === second.getDate();
  }

  function formatRange(startValue, endValue) {
    const start = new Date(startValue);
    const end = new Date(endValue);
    if (sameDay(start, end)) {
      return dateFormatter.format(start) + ', ' + timeFormatter.format(start) + '–' + timeFormatter.format(end);
    }
    return dateFormatter.format(start) + ', ' + timeFormatter.format(start) + ' — ' + dateFormatter.format(end) + ', ' + timeFormatter.format(end);
  }

  function showMessage(text) {
    messageNode.textContent = text || '';
  }

  function bookingCard(booking) {
    const card = element('article', 'booking-card');
    const body = element('div');
    body.append(element('h3', '', booking.club ? booking.club.name : 'Клуб'));

    const meta = element('div', 'booking-meta');
    meta.append(element('span', '', formatRange(booking.start, booking.end)));
    const seats = booking.seats.map((item) => item.seat.name).join(', ');
    meta.append(element('span', '', seats ? 'Места: ' + seats : 'Места уточняются'));
    body.append(meta);

    const actions = element('div', 'booking-actions');
    actions.append(element('span', 'status approved', 'Активна'));
    const cancel = element('button', 'button quiet danger', 'Отменить');
    cancel.type = 'button';
    cancel.dataset.cancelBooking = String(booking.id);
    actions.append(cancel);

    card.append(body, actions);
    return card;
  }

  function applicationCard(application) {
    const card = element('article', 'application-card');
    const body = element('div');
    body.append(element('h3', '', application.clubName));

    const meta = element('div', 'application-meta');
    meta.append(element('span', '', 'Тариф: ' + application.plan));
    meta.append(element('span', '', 'Город: ' + application.city));
    meta.append(element('span', '', 'Отправлена: ' + dateFormatter.format(new Date(application.createdAt))));
    body.append(meta);

    if (application.reviewNote) {
      body.append(element('p', 'form-note', application.reviewNote));
    }

    const actions = element('div', 'booking-actions');
    actions.append(element('span', 'status ' + application.status, statusLabel(application.status)));
    if (application.status === 'approved' && application.slug) {
      const link = element('a', 'button quiet', 'Открыть клуб');
      link.href = '/club.html?club=' + encodeURIComponent(application.slug);
      actions.append(link);
    }

    card.append(body, actions);
    return card;
  }

  function renderBookings(bookings) {
    bookingListNode.textContent = '';
    bookings.forEach((booking) => bookingListNode.append(bookingCard(booking)));
    bookingEmptyNode.classList.toggle('hidden', bookings.length > 0);
    document.getElementById('bookingsStat').textContent = String(bookings.length);
  }

  function renderApplications(applications) {
    applicationListNode.textContent = '';
    applications.forEach((application) => applicationListNode.append(applicationCard(application)));
    applicationEmptyNode.classList.toggle('hidden', applications.length > 0);
    document.getElementById('applicationsStat').textContent = String(applications.length);
  }

  async function load() {
    showMessage('');
    try {
      const meResponse = await fetch('/api/session');
      if (!meResponse.ok) throw new Error('Не удалось проверить сессию');
      const user = await meResponse.json();
      if (!user.authenticated) {
        window.location.replace('/login.html?next=' + encodeURIComponent('/profile.html'));
        return;
      }
      nameNode.textContent = user.login;
      roleNode.textContent = roleLabel(user.role);
      avatarNode.textContent = user.login.trim().charAt(0).toUpperCase();

      const [bookingsResponse, applicationsResponse, clubsResponse] = await Promise.all([
        fetch('/api/me/bookings'),
        fetch('/api/applications/mine'),
        fetch('/api/clubs')
      ]);
      if (!bookingsResponse.ok || !applicationsResponse.ok || !clubsResponse.ok) {
        throw new Error('Не удалось загрузить данные кабинета');
      }

      const [bookings, applications, clubs] = await Promise.all([
        bookingsResponse.json(),
        applicationsResponse.json(),
        clubsResponse.json()
      ]);

      renderBookings(bookings);
      renderApplications(applications);
      document.getElementById('clubsStat').textContent = String(clubs.length);
    } catch (error) {
      showMessage(error.message);
    }
  }

  bookingListNode.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-cancel-booking]');
    if (!button) return;
    if (!confirm('Отменить эту бронь?')) return;
    button.disabled = true;
    try {
      const response = await fetch('/bookings/' + encodeURIComponent(button.dataset.cancelBooking), { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Не удалось отменить бронь');
      await load();
    } catch (error) {
      showMessage(error.message);
      button.disabled = false;
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST' });
    window.location.replace('/login.html');
  });

  load();
})();
