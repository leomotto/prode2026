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
    updateMe: (b) => api.put('/auth/me', b),
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
  // Grupos privados
  groups: {
    mine:    ()       => api.get('/groups/mine'),
    create:  (b)      => api.post('/groups', b),
    join:    (code)   => api.post('/groups/join', { code }),
    ranking: (id)     => api.get(`/groups/${id}/ranking`),
    leave:   (id)     => api._req('DELETE', `/groups/${id}/leave`),
    delete:  (id)     => api._req('DELETE', `/groups/${id}`),
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
  require()  { if (!this.isLogged()) { window.location.href = '/login'; return false; } return true; },
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

/* ── DATE UTILS (Horario Argentina UTC-3) ───────────────── */
const TZ = 'America/Argentina/Buenos_Aires';
const Fmt = {
  date(iso) {
    return new Date(iso).toLocaleDateString('es-AR', {
      weekday:'short', day:'numeric', month:'short', timeZone: TZ
    });
  },
  time(iso) {
    return new Date(iso).toLocaleTimeString('es-AR', {
      hour:'2-digit', minute:'2-digit', hour12: false, timeZone: TZ
    }) + 'hs';
  },
  datetime(iso) { return `${this.date(iso)} • ${this.time(iso)}`; },
  relativeTime(iso) {
    const diff = new Date(iso) - Date.now();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (diff < 0) return 'Finalizado';
    if (h > 24) return `En ${Math.floor(h/24)} días`;
    if (h > 0)  return `En ${h}h ${m}m`;
    return `¡En ${m} min!`;
  },
};

/* ── NOTIFY (preferencias por partido, localStorage) ────── */
const Notify = {
  KEY: id => `prode_notify_${id}`,
  isOn(matchId)  { return localStorage.getItem(this.KEY(matchId)) === '1'; },
  enable(matchId)  { localStorage.setItem(this.KEY(matchId), '1'); },
  disable(matchId) { localStorage.removeItem(this.KEY(matchId)); },
  toggle(matchId) {
    if (this.isOn(matchId)) { this.disable(matchId); return false; }
    else                    { this.enable(matchId);  return true; }
  },
  allEnabled() {
    const ids = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('prode_notify_')) ids.push(k.replace('prode_notify_', ''));
    }
    return ids;
  },
};

/* ── TWEMOJI — renderiza emojis de banderas en todos los browsers ── */
function renderEmojis(el) {
  if (window.twemoji && el) {
    twemoji.parse(el, {
      base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
      folder: 'svg', ext: '.svg',
      attributes: () => ({ style: 'width:1.4em;height:1.4em;vertical-align:-.2em' })
    });
  }
}

/* ── COUNTRY CODE (ISO2 → FIFA 3 letras) ────────────── */
const FIFA_CODE = {
  'AD':'AND','AE':'UAE','AF':'AFG','AL':'ALB','AM':'ARM','AO':'ANG','AR':'ARG',
  'AT':'AUT','AU':'AUS','AZ':'AZE','BA':'BIH','BE':'BEL','BF':'BFA','BG':'BUL',
  'BH':'BHR','BJ':'BEN','BO':'BOL','BR':'BRA','BT':'BHU','BW':'BOT','BY':'BLR',
  'BZ':'BLZ','CA':'CAN','CD':'COD','CF':'CAF','CG':'CGO','CH':'SUI','CI':'CIV',
  'CL':'CHI','CM':'CMR','CN':'CHN','CO':'COL','CR':'CRC','CU':'CUB','CV':'CPV',
  'CY':'CYP','CZ':'CZE','DE':'GER','DK':'DEN','DO':'DOM','DZ':'ALG','EC':'ECU',
  'EE':'EST','EG':'EGY','ES':'ESP','ET':'ETH','FI':'FIN','FJ':'FIJ','FR':'FRA',
  'GA':'GAB','GB':'ENG','GE':'GEO','GH':'GHA','GM':'GAM','GN':'GUI','GQ':'EQG',
  'GR':'GRE','GT':'GUA','GW':'GNB','GY':'GUY','HN':'HON','HR':'CRO','HT':'HAI',
  'HU':'HUN','ID':'IDN','IE':'IRL','IL':'ISR','IN':'IND','IQ':'IRQ','IR':'IRN',
  'IS':'ISL','IT':'ITA','JM':'JAM','JO':'JOR','JP':'JPN','KE':'KEN','KG':'KGZ',
  'KP':'PRK','KR':'KOR','KW':'KUW','KZ':'KAZ','LB':'LIB','LI':'LIE','LK':'SRI',
  'LR':'LBR','LS':'LES','LT':'LTU','LU':'LUX','LV':'LVA','LY':'LBA','MA':'MAR',
  'MD':'MDA','ME':'MNE','MG':'MAD','MK':'MKD','ML':'MLI','MN':'MNG','MR':'MTN',
  'MT':'MLT','MU':'MRI','MV':'MDV','MW':'MWI','MX':'MEX','MY':'MAS','MZ':'MOZ',
  'NA':'NAM','NE':'NIG','NG':'NGA','NI':'NCA','NL':'NED','NO':'NOR','NP':'NEP',
  'NZ':'NZL','OM':'OMA','PA':'PAN','PE':'PER','PG':'PNG','PH':'PHI','PK':'PAK',
  'PL':'POL','PT':'POR','PY':'PAR','QA':'QAT','RO':'ROU','RS':'SRB','RU':'RUS',
  'RW':'RWA','SA':'KSA','SB':'SOL','SE':'SWE','SG':'SIN','SI':'SVN','SK':'SVK',
  'SL':'SLE','SM':'SMR','SN':'SEN','SO':'SOM','SR':'SUR','SS':'SSD','SV':'SLV',
  'SY':'SYR','SZ':'SWZ','TD':'CHA','TG':'TOG','TH':'THA','TJ':'TJK','TN':'TUN',
  'TO':'TON','TR':'TUR','TT':'TRI','TZ':'TAN','UA':'UKR','UG':'UGA','US':'USA',
  'UY':'URU','UZ':'UZB','VE':'VEN','VN':'VIE','YE':'YEM','ZA':'RSA','ZM':'ZAM','ZW':'ZIM',
};
function teamCode(flag) {
  if (!flag) return '???';
  try {
    const points = [...flag].map(c => c.codePointAt(0));
    // Regional indicator pair: standard country flag (🇦🇷, 🇧🇷, etc.)
    if (points[0] >= 0x1F1E6 && points[0] <= 0x1F1FF) {
      const iso2 = points
        .filter(p => p >= 0x1F1E6 && p <= 0x1F1FF)
        .map(p => String.fromCharCode(p - 0x1F1E6 + 65))
        .join('');
      return FIFA_CODE[iso2] || iso2;
    }
    // Subdivision/tag flag: England 🏴󠁧󠁢󠁥󠁮󠁧󠁿, Scotland 🏴󠁧󠁢󠁳󠁣󠁴󠁿, Wales 🏴󠁧󠁢󠁷󠁬󠁳󠁿
    const tagStr = points
      .filter(p => p >= 0xE0020 && p < 0xE007F)
      .map(p => String.fromCharCode(p - 0xE0000))
      .join('')
      .toLowerCase();
    if (tagStr) {
      const SUBDIV = { 'gbsct':'SCO','gbeng':'ENG','gbwls':'WAL','gbnir':'NIR','gbgsy':'GCI' };
      return SUBDIV[tagStr] || tagStr.slice(2, 5).toUpperCase();
    }
    return '???';
  } catch { return '???'; }
}

/* ── DARK MODE ────────────────────────────────── */
const Theme = {
  init() {
    const saved = localStorage.getItem('prode_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  },
  toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('prode_theme', next);
    return next;
  },
  isDark() { return document.documentElement.getAttribute('data-theme') === 'dark'; },
};
Theme.init();

/* ── LOGOUT GLOBAL ───────────────────────────── */
function doLogout() { Auth.clear(); window.location.href = '/login'; }

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

/* ── MOBILE NAV ──────────────────────────────────────────── */
function toggleMobileMenu() {
  const btn     = document.getElementById('nav-hamburger');
  const drawer  = document.getElementById('mobile-nav-drawer');
  const overlay = document.getElementById('mobile-nav-overlay');
  if (!btn || !drawer) return;
  const open = drawer.classList.toggle('open');
  btn.classList.toggle('open', open);
  if (overlay) overlay.classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
}
function closeMobileMenu() {
  const btn     = document.getElementById('nav-hamburger');
  const drawer  = document.getElementById('mobile-nav-drawer');
  const overlay = document.getElementById('mobile-nav-overlay');
  if (drawer) drawer.classList.remove('open');
  if (btn)    btn.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}
// Cerrar con ESC
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileMenu(); });

