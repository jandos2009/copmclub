(function () {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = {
    theme: ['system', 'light', 'dark'],
    accent: ['green', 'amber', 'blue'],
    bg: ['photo', 'plain']
  };
  const state = {
    theme: read('club-theme', 'system'),
    accent: read('club-accent', 'green'),
    bg: read('club-bg', 'photo')
  };

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return valid[key.replace('club-', '')].includes(value) ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function save() {
    try {
      localStorage.setItem('club-theme', state.theme);
      localStorage.setItem('club-accent', state.accent);
      localStorage.setItem('club-bg', state.bg);
    } catch (error) {
      return;
    }
  }

  function resolvedTheme() {
    if (state.theme === 'system') return media.matches ? 'dark' : 'light';
    return state.theme;
  }

  function sync() {
    document.querySelectorAll('[data-set-theme]').forEach((input) => {
      input.checked = input.dataset.setTheme === state.theme;
    });
    document.querySelectorAll('[data-set-accent]').forEach((input) => {
      input.checked = input.dataset.setAccent === state.accent;
    });
    document.querySelectorAll('[data-set-bg]').forEach((input) => {
      input.checked = input.dataset.setBg === state.bg;
    });
  }

  function apply() {
    const theme = resolvedTheme();
    root.dataset.theme = theme;
    root.dataset.themeSetting = state.theme;
    root.dataset.accent = state.accent;
    root.dataset.bg = state.bg;
    root.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#101512' : '#f7f5f0';
    sync();
  }

  function setTheme(value) {
    if (!valid.theme.includes(value)) return;
    state.theme = value;
    save();
    apply();
  }

  function setAccent(value) {
    if (!valid.accent.includes(value)) return;
    state.accent = value;
    save();
    apply();
  }

  function setBackground(value) {
    if (!valid.bg.includes(value)) return;
    state.bg = value;
    save();
    apply();
  }

  function bind() {
    document.querySelectorAll('[data-set-theme]').forEach((input) => {
      input.addEventListener('change', () => setTheme(input.dataset.setTheme));
    });
    document.querySelectorAll('[data-set-accent]').forEach((input) => {
      input.addEventListener('change', () => setAccent(input.dataset.setAccent));
    });
    document.querySelectorAll('[data-set-bg]').forEach((input) => {
      input.addEventListener('change', () => setBackground(input.dataset.setBg));
    });
    sync();
  }

  document.addEventListener('DOMContentLoaded', () => {
    bind();
    document.addEventListener('click', (event) => {
      document.querySelectorAll('details.settings[open]').forEach((details) => {
        if (!details.contains(event.target)) details.open = false;
      });
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('details.settings[open]').forEach((details) => {
        details.open = false;
      });
    });
  });

  const onMediaChange = () => {
    if (state.theme === 'system') apply();
  };

  if (media.addEventListener) media.addEventListener('change', onMediaChange);
  else media.addListener(onMediaChange);

  window.CityTheme = {
    apply,
    setTheme,
    setAccent,
    setBackground,
    get: () => ({ ...state, resolvedTheme: resolvedTheme() })
  };

  apply();
})();
