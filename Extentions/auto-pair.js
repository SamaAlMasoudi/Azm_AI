/* Azm — Auto-pairing content script */
(() => {
  'use strict';
  const CONFIG_KEY = 'azmApiConfig';

  async function autoPair() {
    try {
      const res = await fetch('/api/profile', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const token = data?.profile?.pairingToken;
      if (!token) return;

      const baseUrl = window.location.origin.replace(/\/+$/, '');
      const stored = await chrome.storage.local.get(CONFIG_KEY);
      const current = stored[CONFIG_KEY] || {};

      // احفظ فقط إذا كان الرابط أو الرمز جديداً
      if (current.baseUrl !== baseUrl || current.token !== token) {
        await chrome.storage.local.set({
          [CONFIG_KEY]: { baseUrl, token }
        });
      }
    } catch {
      // تجاهل أي خطأ شبكة مؤقت
    }
  }

  autoPair();
})();