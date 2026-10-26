const API_PREFIX = '/api';

function getCookie(name) {
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    const [key, ...value] = cookie.split('=');
    if (key === name) {
      return decodeURIComponent(value.join('='));
    }
  }
  return null;
}

function clearAuthTokens() {
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  } catch (e) {
    // ignore storage errors
  }

  try {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
  } catch (e) {
    // ignore storage errors
  }

  try {
    delete window.__KUKUTA_AUTH__;
  } catch (e) {
    // ignore storage errors
  }
}

export function storeAuthTokens(accessToken, refreshToken) {
  const auth = {
    accessToken: accessToken || '',
    refreshToken: refreshToken || '',
  };

  try {
    window.__KUKUTA_AUTH__ = auth;
  } catch (e) {
    // ignore storage errors
  }

  for (const [key, value] of Object.entries({ accessToken: auth.accessToken, refreshToken: auth.refreshToken })) {
    if (!value) continue;
    try { localStorage.setItem(key, value); } catch (e) {}
    try { sessionStorage.setItem(key, value); } catch (e) {}
  }
}

function getStoredAccessToken() {
  try {
    const value = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || (window.__KUKUTA_AUTH__ && window.__KUKUTA_AUTH__.accessToken);
    return value && value !== 'undefined' && value !== 'null' && value.trim() !== '' ? value : null;
  } catch (e) {
    return null;
  }
}

function getStoredRefreshToken() {
  try {
    const value = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken') || (window.__KUKUTA_AUTH__ && window.__KUKUTA_AUTH__.refreshToken);
    return value && value !== 'undefined' && value !== 'null' && value.trim() !== '' ? value : null;
  } catch (e) {
    return null;
  }
}

async function refreshAccess() {
  const refresh = getStoredRefreshToken();
  if (!refresh) return false;

  try {
    const response = await fetch(`${API_PREFIX}/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
      credentials: 'include',
    });
    if (!response.ok) {
      clearAuthTokens();
      return false;
    }
    const data = await response.json();
    if (data.access) {
      storeAuthTokens(data.access, refresh);
      return true;
    }
  } catch (error) {
    return false;
  }

  clearAuthTokens();
  return false;
}

export async function apiFetch(path, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body = null,
    auth = true,
    retry = true,
  } = options;

  const url = path.startsWith('http') ? path : `${API_PREFIX}${path.startsWith('/') ? '' : '/'}${path}`;
  const requestHeaders = { ...headers };
  let requestBody = body;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isFormData && body && typeof body === 'object' && !(body instanceof ArrayBuffer)) {
    requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json';
    requestBody = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const shouldRetry = auth && retry && !['/login/', '/signup/', '/token/refresh/'].some((prefix) => path.includes(prefix));
  let access = auth ? getStoredAccessToken() : null;
  if (shouldRetry && !access && getStoredRefreshToken()) {
    await refreshAccess();
    access = getStoredAccessToken();
  }
  if (access) {
    requestHeaders['Authorization'] = `Bearer ${access}`;
  }

  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method.toUpperCase()) && !requestHeaders['X-CSRFToken']) {
    let csrfToken = getCookie('csrftoken');
    if (!csrfToken) {
      await fetch(`${API_PREFIX}/csrf/`, {
        method: 'GET',
        credentials: 'include',
      });
      csrfToken = getCookie('csrftoken');
    }
    if (csrfToken) {
      requestHeaders['X-CSRFToken'] = csrfToken;
    }
  }

  const fetchOptions = {
    method,
    headers: requestHeaders,
    body: requestBody,
    credentials: 'include',
  };

  let response = await fetch(url, fetchOptions);

  if (shouldRetry && response.status === 401) {
    const refreshed = await refreshAccess();
    if (refreshed) {
      const access = getStoredAccessToken();
      if (access) {
        requestHeaders['Authorization'] = `Bearer ${access}`;
      }
      response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: requestBody,
        credentials: 'include',
      });
      if (response.status === 401) {
        clearAuthTokens();
      }
    } else {
      clearAuthTokens();
    }
  }

  return response;
}

export default apiFetch;
