/**
 * api.js - Dual-Engine Communication Layer
 * 1. Mode Standalone (Offline APK): Diproses langsung di IndexedDB via local-db.js tanpa fetch localhost
 * 2. Mode Server: Fetch HTTP REST API ke server Node.js / Termux
 */

function shouldUseLocalDb() {
  if (typeof window === 'undefined') return false;
  // Jika user secara eksplisit memilih sambung ke server
  if (typeof localStorage !== 'undefined' && localStorage.getItem('warungpro_force_server') === 'true') {
    return false;
  }
  // Di APK WebView (file:///android_asset/...) -> Otomatis 100% Offline Lokal!
  if (typeof location !== 'undefined' && location.protocol === 'file:') {
    return true;
  }
  // Atau jika user memilih mode offline di web browser
  if (typeof localStorage !== 'undefined' && localStorage.getItem('warungpro_mode') === 'local') {
    return true;
  }
  return false;
}

const API_BASE = '/api';

async function request(endpoint, options = {}) {
  // ── Engine 1: Offline Standalone (IndexedDB) ──────────────────────────────
  if (shouldUseLocalDb() && typeof window !== 'undefined' && window.localDb) {
    const method = (options.method || 'GET').toUpperCase();
    let body = null;
    if (options.body) {
      try {
        body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      } catch {
        body = options.body;
      }
    }

    try {
      return await window.localDb.handleRequest(method, endpoint, body);
    } catch (err) {
      if (!options.silent && typeof window !== 'undefined' && window.showToast) {
        window.showToast(err.message || 'Operasi database lokal gagal', 'error');
      }
      throw err;
    }
  }

  // ── Engine 2: Remote / Localhost HTTP Fetch ───────────────────────────────
  const customServer = typeof localStorage !== 'undefined' ? localStorage.getItem('warungpro_server_url') : null;
  const base = (customServer && customServer.trim()) ? customServer.trim().replace(/\/$/, '') : API_BASE;
  const cleanEndpoint = endpoint.startsWith('/api') ? endpoint : `/api${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${base}${cleanEndpoint.replace(/^\/api/, '')}`;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  try {
    const res = await fetch(url, config);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errMsg = (data && data.error) ? data.error : `HTTP ${res.status} ${res.statusText}`;
      const err = new Error(errMsg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    if (!options.silent && typeof window !== 'undefined' && window.showToast) {
      window.showToast(err.message || 'Gagal terhubung ke server', 'error');
    }
    throw err;
  }
}

const api = {
  get: (endpoint, options) => request(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => request(endpoint, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: (endpoint, body, options) => request(endpoint, { method: 'PUT', body: JSON.stringify(body), ...options }),
  patch: (endpoint, body, options) => request(endpoint, { method: 'PATCH', body: JSON.stringify(body), ...options }),
  delete: (endpoint, options) => request(endpoint, { method: 'DELETE', ...options }),
  shouldUseLocalDb
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { api, request, shouldUseLocalDb };
}

if (typeof window !== 'undefined') {
  window.api = api;
}
