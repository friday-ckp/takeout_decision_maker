/**
 * apiFetch — 统一 API 请求工具（Story 8.6）
 * 自动注入 Authorization: Bearer <token>，401 自动跳转登录页
 *
 * @param {string} path - API 路径，如 '/api/restaurants'
 * @param {RequestInit} options - fetch 选项（method, body 等）
 * @returns {Promise<any>} - 响应体中的 data 字段
 * @throws {{ code: number, message: string }} - 业务错误或网络错误
 */
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('authToken');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  let response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch (networkErr) {
    throw { code: 0, message: '网络连接异常，请检查后重试' };
  }

  // 401 → 清除 token，跳转登录页
  if (response.status === 401) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    if (typeof navigate === 'function') navigate('login');
    throw { code: 40101, message: '登录已过期，请重新登录' };
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw { code: 50000, message: '响应解析失败' };
  }

  if (!response.ok || body.code !== 0) {
    throw {
      code: body.code ?? response.status,
      message: body.message ?? '请求失败',
    };
  }

  return body.data;
}

// 便捷方法
const api = {
  get: (path, options = {}) =>
    apiFetch(path, { ...options, method: 'GET' }),

  post: (path, data, options = {}) =>
    apiFetch(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    }),

  put: (path, data, options = {}) =>
    apiFetch(path, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (path, options = {}) =>
    apiFetch(path, { ...options, method: 'DELETE' }),

  patch: (path, data, options = {}) =>
    apiFetch(path, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
