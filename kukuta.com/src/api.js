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
}

async function refreshAccess() {
  const refresh = localStorage.getItem('refreshToken');
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
      try {
        localStorage.setItem('accessToken', data.access);
      } catch (e) {
        // ignore storage errors
      }
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

  if (auth) {
    const access = localStorage.getItem('accessToken');
    if (access) {
      requestHeaders['Authorization'] = `Bearer ${access}`;
    }
  }

  const shouldRetry = auth && retry && !['/login/', '/signup/', '/token/refresh/'].some((prefix) => path.includes(prefix));

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
      const access = localStorage.getItem('accessToken');
      if (access) {
        requestHeaders['Authorization'] = `Bearer ${access}`;
      }
      response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: requestBody,
        credentials: 'include',
      });
    } else {
      clearAuthTokens();
    }
  }

  return response;
}

export default apiFetch;
