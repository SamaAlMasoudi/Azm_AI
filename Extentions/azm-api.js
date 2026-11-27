/* Azm extension API bridge. No provider API keys belong in this file. */
(() => {
  'use strict';
  const CONFIG_KEY = 'azmApiConfig';
  const DEFAULT_BASE = 'http://localhost:3000';
  async function getConfig() {
    const data = await chrome.storage.local.get(CONFIG_KEY);
    const value = data[CONFIG_KEY] && typeof data[CONFIG_KEY] === 'object' ? data[CONFIG_KEY] : {};
    return { baseUrl: String(value.baseUrl || DEFAULT_BASE).replace(/\/+$/, ''), token: String(value.token || '') };
  }
  async function request(path, body) {
    const cfg = await getConfig();
    if (!cfg.token) throw new Error('لم يتم ضبط رمز اقتران الإضافة.');
    const res = await fetch(`${cfg.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-azm-token': cfg.token },
      body: JSON.stringify(body || {})
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
    return payload;
  }
  async function sync(payload) { return request('/api/ext/sync', payload); }
  async function justify(payload) { return request('/api/ext/justify', payload); }
  async function session(payload) { return request('/api/ext/session', payload); }
  async function saveConfig(baseUrl, token) {
    await chrome.storage.local.set({ [CONFIG_KEY]: { baseUrl: String(baseUrl || DEFAULT_BASE).trim(), token: String(token || '').trim() } });
  }
  globalThis.AzmApi = Object.freeze({ getConfig, request, sync, justify, session, saveConfig, CONFIG_KEY, DEFAULT_BASE });
})();
