/* ── API WRAPPER ─────────────────────────────────────────── */
const API_BASE = '/api';

const api = {
  _token() { return localStorage.getItem('prode_token'); },

  async _req(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this._token();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(API_BASE + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw { status: res.status, message: data.error || 'Error' };
    return data;
  },

  get:    (path)        => api._req('GET',   path),
  post:   (path, body)  => api._req('POST',  path, body),
  put:    (path, body)  => api._req('PUT',   path, body),
  patch:  (path, body)  => api._req('PATCH', path, body),

  // Auth
  auth: {
    register: (b) => api.post('/auth/register', b),
    login:    (b) => api.post('/auth/login', b),
    me:       ()  => api.get('/auth/me'),
    logout:   ()  => api.post('/auth/logout'),
  },
  // Matches
  matches: {
    all:      (q = '') => api.get(`/matches${q}`),
    byId:     (id)     => api.get(`/matches/${id}`),
    upcoming: ()       => api.get('/matches/upcoming'),
  },
  // Predictions
  predictions: {
    mine:    (matchId) => api.get(`/predictions${matchId ? '?matchId=' + matchId : ''}`),
    pending: ()        => api.get('/predictions/pending'),
    create:  (b)       => api.post('/predictions', b),
    update:  (id, b)   => api.put(`/predictions/${id}`, b),
  },
  // Rankings
  rankings: {
    all: (phase) => api.get(`/rankings${phase ? '?phase=' + phase : ''}`),
    me:  ()      => api.get('/rankings/me'),
  },
  // Admin
  admin: {
    matches:      ()        => api.get('/admin/matches'),
    createMatch:  (b)       => api.post('/admin/matches', b),
    setStatus:    (id, s)   => api.patch(`/admin/matches/${id}/status`, { status: s }),
    setFeatured:  (id, f)   => api.patch(`/admin/matches/${id}/featured`, { featured: f }),
    setResult:    (id, b)   => api.post(`/admin/matches/${id}/result`, b),
    users:        ()        => api.get('/admin/users'),
    updateUser:   (id, b)   => api.patch(`/admin/users/${id}`, b),
  },
};

/* ── AUTH HELPERS ────────────────────────────────────────── */
const Auth = {
  save(token, user) {
    localStorage.setItem('prode_token', token);
    localStorage.setItem('prode_user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('prode_token');
    localStorage.removeItem('prode_user');
  },
  getUser() {
    try { return JSON.parse(localStorage.getItem('prode_user')); } catch { return null; }
  },
  isLogged() { return !!localStorage.getItem('prode_token'); },
  isAdmin()  { return this.getUser()?.isAdmin === true; },
  require()  { if (!this.isLogged()) { window.location.href = '/login.html'; return false; } return true; },
};

/* ── TOAST ───────────────────────────────────────────────── */
const Toast = {
  _el: null,
  _get() {
    if (!this._el) {
      this._el = document.createElement('div');
      this._el.className = 'toast-container';
      document.body.appendChild(this._el);
    }
    return this._el;
  },
  show(title, msg, type = 'info', duration = 5000) {
    const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <div class="toast-body"><div class="toast-title">${title}</div>${msg ? `<div class="toast-msg">${msg}</div>` : ''}</div>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
    this._get().appendChild(t);
    if (duration > 0) setTimeout(() => t.remove(), duration);
  },
  success: (t, m) => Toast.show(t, m, 'success'),
  error:   (t, m) => Toast.show(t, m, 'error'),
  warn:    (t, m) => Toast.show(t, m, 'warning'),
};

/* ── DATE UTILS ──────────────────────────────────────────── */
const Fmt = {
  date(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'short' });
  },
  time(iso) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });
  },
  datetime(iso) { return `${this.date(iso)} • ${this.time(iso)}`; },
  relativeTime(iso) {
    const diff = new Date(iso) - Date.now();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (diff < 0) return 'Hace un momento';
    if (h > 24) return `En ${Math.floor(h/24)} días`;
    if (h > 0)  return `En ${h}h ${m}m`;
    return `En ${m} minutos`;
  },
};

/* ── MODAL HELPER ────────────────────────────────────────── */
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

/* ── NAV ACTIVE STATE ────────────────────────────────────── */
function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === path ||
      (path === '/' && a.getAttribute('href') === '/index.html'));
  });
}

/* ── HANDLE GOOGLE OAUTH TOKEN REDIRECT ──────────────────── */
(function handleOAuthRedirect() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    localStorage.setItem('prode_token', token);
    // Cargar datos del usuario
    api.auth.me().then(user => {
      Auth.save(token, user);
      window.history.replaceState({}, '', '/');
      Toast.success('¡Bienvenido!', `Sesión iniciada con Google`);
    }).catch(() => {});
  }
})();
