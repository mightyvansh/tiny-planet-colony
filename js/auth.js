/* =============================================================
   auth.js — login / signup / leaderboard client.
   All API calls go to /api/* (Vercel serverless functions).
   When the game is played locally (file://) the auth features
   gracefully degrade — login shows a "server offline" note.
   ============================================================= */

const Auth = {
  token: null,
  user:  null,

  init() {
    this.token = localStorage.getItem('tpc.token') || null;
    try {
      const u = localStorage.getItem('tpc.user');
      this.user = u ? JSON.parse(u) : null;
    } catch { this.user = null; }
    this._refreshAuthBtn();
    this._bindModal();
    this._bindLeaderboard();
  },

  /* ---------------- modal open/close ---------------- */
  openAuth(tab = 'login') {
    document.getElementById('auth-modal').classList.remove('hidden');
    this._switchTab(tab);
  },

  _closeAuth() {
    document.getElementById('auth-modal').classList.add('hidden');
    document.getElementById('auth-error').textContent = '';
  },

  _switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.auth-form').forEach(f =>
      f.classList.toggle('hidden', f.dataset.form !== tab));
    document.getElementById('auth-error').textContent = '';
  },

  /* ---------------- signup / login / logout ---------------- */
  async signup(username, email, password) {
    const res = await this._post('/api/auth/signup', { username, email, password });
    if (res.error) return res.error;
    this._saveSession(res.token, res.user);
    this._closeAuth();
    if (typeof UI !== 'undefined')
      UI.toast('good', '🎉', 'Account created!', `Welcome to the colony, ${username}!`);
    return null;
  },

  async login(username, password) {
    const res = await this._post('/api/auth/login', { username, password });
    if (res.error) return res.error;
    this._saveSession(res.token, res.user);
    this._closeAuth();
    if (typeof UI !== 'undefined')
      UI.toast('good', '👤', 'Logged in', `Welcome back, ${username}!`);
    return null;
  },

  logout() {
    this.token = null;
    this.user  = null;
    localStorage.removeItem('tpc.token');
    localStorage.removeItem('tpc.user');
    this._refreshAuthBtn();
    if (typeof UI !== 'undefined')
      UI.toast('info', '👋', 'Logged out', 'See you next time!');
  },

  /* Called from UI.showOverlay() when the player wins. */
  async submitScore(timeSecs, greenPct, population) {
    if (!this.token) return;
    try {
      await this._post(
        '/api/leaderboard/submit',
        { completionTime: timeSecs, greenPct, population },
        this.token
      );
    } catch { /* non-critical */ }
  },

  /* ---------------- leaderboard panel ---------------- */
  openLeaderboard() {
    document.getElementById('leaderboard-modal').classList.remove('hidden');
    this._loadLeaderboard('leaderboard-list');
  },

  _closeLeaderboard() {
    document.getElementById('leaderboard-modal').classList.add('hidden');
  },

  async loadIntoOverlay() {
    await this._loadLeaderboard('overlay-lb-list');
  },

  async _loadLeaderboard(targetId) {
    const el = document.getElementById(targetId);
    if (!el) return;
    el.innerHTML = '<p class="lb-loading">Loading…</p>';
    try {
      const res  = await fetch('/api/leaderboard/get?limit=10');
      const data = await res.json();
      const entries = data.entries || [];
      if (!entries.length) {
        el.innerHTML = '<p class="lb-empty">No scores yet — be the first to win!</p>';
        return;
      }
      el.innerHTML = entries.map(e => `
        <div class="lb-row">
          <span class="lb-rank">#${e.rank}</span>
          <span class="lb-name">${e.username}</span>
          <span class="lb-time">${fmtTime(e.completionTime)}</span>
          <span class="lb-green">🌱 ${Math.round(e.greenPct * 100)}%</span>
        </div>`).join('');
    } catch {
      el.innerHTML = '<p class="lb-empty">Could not reach the server.</p>';
    }
  },

  /* ---------------- helpers ---------------- */
  _saveSession(token, user) {
    this.token = token;
    this.user  = user;
    localStorage.setItem('tpc.token', token);
    localStorage.setItem('tpc.user', JSON.stringify(user));
    this._refreshAuthBtn();
  },

  _refreshAuthBtn() {
    const btn = document.getElementById('btn-auth');
    if (!btn) return;
    btn.textContent = this.user ? `👤 ${this.user.username}` : '🔑 Login';
  },

  async _post(url, body, token = null) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      return await res.json();
    } catch {
      return { error: 'Network error — is the server reachable?' };
    }
  },

  /* ---------------- bind DOM events ---------------- */
  _bindModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    document.getElementById('auth-close').addEventListener('click', () => this._closeAuth());
    modal.addEventListener('click', e => { if (e.target === modal) this._closeAuth(); });

    document.querySelectorAll('.auth-tab').forEach(tab =>
      tab.addEventListener('click', () => this._switchTab(tab.dataset.tab)));

    // Login form
    document.getElementById('form-login').addEventListener('submit', async e => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      const err = await this.login(username, password);
      if (err) document.getElementById('auth-error').textContent = err;
    });

    // Signup form
    document.getElementById('form-signup').addEventListener('submit', async e => {
      e.preventDefault();
      const username = document.getElementById('signup-username').value.trim();
      const email    = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const err = await this.signup(username, email, password);
      if (err) document.getElementById('auth-error').textContent = err;
    });

    // Auth button (HUD): logged in → show logout menu, else → open login
    document.getElementById('btn-auth').addEventListener('click', () => {
      if (this.user) {
        if (confirm(`Log out as ${this.user.username}?`)) this.logout();
      } else {
        this.openAuth('login');
      }
    });
  },

  _bindLeaderboard() {
    const modal = document.getElementById('leaderboard-modal');
    if (!modal) return;
    document.getElementById('leaderboard-close').addEventListener('click', () => this._closeLeaderboard());
    modal.addEventListener('click', e => { if (e.target === modal) this._closeLeaderboard(); });
    document.getElementById('btn-leaderboard').addEventListener('click', () => this.openLeaderboard());
  },
};
