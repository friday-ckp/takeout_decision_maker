/**
 * Story 8.5 — 前端登录/注册页面
 * 职责：登录、注册、登出、JWT 存储、topnav 用户状态
 */

const AUTH_TOKEN_KEY = 'authToken';
const AUTH_USER_KEY  = 'authUser';

// ── Token 管理 ────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function saveAuth(token, user) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY));
  } catch {
    return null;
  }
}

// ── 守卫：未登录跳转 ──────────────────────────────────────────────────────────

function checkAuth() {
  if (!getToken()) {
    navigate('login');
    return false;
  }
  return true;
}

// ── API 调用 ──────────────────────────────────────────────────────────────────

async function authRegister(name, email, password) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || '注册失败');
  saveAuth(data.data.token, data.data.user);
  updateNavUserState();
  navigate('home');
}

async function authLogin(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || '登录失败');
  saveAuth(data.data.token, data.data.user);
  updateNavUserState();
  navigate('home');
}

function logout() {
  clearAuth();
  updateNavUserState();
  navigate('login');
}

// ── Topnav 用户状态 ───────────────────────────────────────────────────────────

function updateNavUserState() {
  const user = getUser();
  const authArea = document.getElementById('nav-auth-area');
  if (!authArea) return;

  if (user) {
    authArea.innerHTML = `
      <span class="nav-username">${escapeHtml(user.name || user.email)}</span>
      <button class="btn btn--ghost btn--sm" id="logout-btn">退出</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', logout);
  } else {
    authArea.innerHTML = `
      <button class="btn btn--ghost btn--sm" id="go-login-btn">登录</button>
    `;
    document.getElementById('go-login-btn').addEventListener('click', () => navigate('login'));
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 页面注册（登录 & 注册） ────────────────────────────────────────────────────

function initAuthPages() {
  // ── 登录页 ──
  registerPage('login', {
    onEnter() {
      if (getToken()) {
        navigate('home');
        return;
      }
      const form = document.getElementById('login-form');
      if (!form) return;
      form.onsubmit = null;
      form.onsubmit = async (e) => {
        e.preventDefault();
        const email    = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const errEl    = document.getElementById('login-error');
        const btn      = form.querySelector('button[type=submit]');
        errEl.textContent = '';
        btn.disabled = true;
        try {
          await authLogin(email, password);
        } catch (err) {
          errEl.textContent = err.message;
        } finally {
          btn.disabled = false;
        }
      };
    },
  });

  // ── 注册页 ──
  registerPage('register', {
    onEnter() {
      if (getToken()) {
        navigate('home');
        return;
      }
      const form = document.getElementById('register-form');
      if (!form) return;
      form.onsubmit = null;
      form.onsubmit = async (e) => {
        e.preventDefault();
        const name     = document.getElementById('register-name').value.trim();
        const email    = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        const confirm  = document.getElementById('register-confirm').value;
        const errEl    = document.getElementById('register-error');
        const btn      = form.querySelector('button[type=submit]');
        errEl.textContent = '';
        if (password !== confirm) {
          errEl.textContent = '两次密码不一致';
          return;
        }
        btn.disabled = true;
        try {
          await authRegister(name, email, password);
        } catch (err) {
          errEl.textContent = err.message;
        } finally {
          btn.disabled = false;
        }
      };
    },
  });
}
