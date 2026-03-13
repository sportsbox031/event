import { API_URL, REQUEST_TIMEOUT_MS } from './config.js';

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, timeoutId };
}

async function requestJSON(url, options = {}) {
  const { timeoutId, signal } = createTimeoutSignal(options.timeoutMs ?? REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (payload && payload.success === false) {
      throw new Error(payload.error || 'Request failed');
    }

    return payload;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function apiGet(action, params = {}) {
  const query = new URLSearchParams({ action, ...params });
  return requestJSON(`${API_URL}?${query.toString()}`);
}

export async function apiPost(action, data = {}) {
  return requestJSON(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, data }),
  });
}
