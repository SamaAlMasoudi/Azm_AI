/* عزم - AZM AI | background.js (Manifest V3 service worker)
 *
 * مراقبة التبويبات أثناء الجلسة الجارية وتحويل أي تصفّح خارج الموارد المعتمدة
 * إلى صفحة التدخّل intercept.html.
 *
 * ملاحظة MV3: الـ service worker ينام ويُوقَظ مع كل حدث، لذلك لا نعتمد على
 * متغيّرات في الذاكرة كمصدر للحقيقة — الحالة تُقرأ من chrome.storage.local
 * عند كل حدث. (الخريطة recent أدناه مجرد تخفيف تكرار خلال أجزاء من الثانية.)
 */
'use strict';

// المقيّم المشترك (تقييم الروابط مقابل هدف الجلسة) — نفس الملف الذي تستخدمه اللوحة وصفحة التدخّل
importScripts('azm-api.js', 'evaluator.js');

const KEYS = Object.freeze({
  active: 'activeSession',
  settings: 'settings',
  stats: 'weeklyStats'
});

const INTERCEPT_PAGE = 'intercept.html';
const BREAK_ALARM = 'azm-break-end';
const DEDUPE_MS = 2500;

/* ============================================================
 * أدوات
 * ============================================================ */
const pad2 = (n) => String(n).padStart(2, '0');

/** نفس منطق dashboard.js: بداية الأسبوع = الأحد (بالتوقيت المحلي). */
function weekStartKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function isActiveSession(session) {
  return Boolean(session)
    && typeof session === 'object'
    && typeof session.endTimestamp === 'number'
    && Date.now() < session.endTimestamp;
}

/** يُرجع كائن URL لروابط http/https فقط، وإلا null (يتجاهل chrome:// و about: وغيرها). */
function parseWebUrl(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

const normalizeHost = (host) => host.replace(/^www\./, '').toLowerCase();
const trimTrailingSlash = (path) => path.replace(/\/+$/, '');

/**
 * هل الرابط المزار ضمن الروابط المسموحة؟
 * - المقارنة بالنطاق (بدون www).
 * - إن كان المسموح نطاقًا فقط (بدون مسار) فكل مساراته مسموحة.
 * - إن كان المسموح يتضمن مسارًا محددًا فيُسمح بنفس المسار ومساراته الفرعية فقط.
 */
function isAllowed(visited, allowedUrls) {
  const host = normalizeHost(visited.hostname);
  const path = trimTrailingSlash(visited.pathname);

  for (const entry of allowedUrls) {
    const allowed = parseWebUrl(entry);
    if (!allowed || normalizeHost(allowed.hostname) !== host) continue;

    const allowedPath = trimTrailingSlash(allowed.pathname);
    if (!allowedPath) return true;
    if (path === allowedPath || path.startsWith(`${allowedPath}/`)) return true;
  }
  return false;
}

/* ============================================================
 * التخزين
 * ============================================================ */
async function readState() {
  const res = await chrome.storage.local.get([KEYS.active, KEYS.settings]);
  return {
    session: res[KEYS.active] ?? null,
    settings: res[KEYS.settings] && typeof res[KEYS.settings] === 'object' ? res[KEYS.settings] : {}
  };
}

/* تسلسل الكتابات لتجنّب سباق قراءة-تعديل-كتابة عند وصول أحداث متقاربة */
let statsQueue = Promise.resolve();
let sessionQueue = Promise.resolve();

/** يزيد عدّادات الأسبوع الحالي: bumpStats({ interventions: 1, distracting: 1 }) */
function bumpStats(delta) {
  statsQueue = statsQueue
    .then(async () => {
      const res = await chrome.storage.local.get(KEYS.stats);
      const weekStart = weekStartKey();
      let stats = res[KEYS.stats];

      if (!stats || typeof stats !== 'object' || stats.weekStart !== weekStart) {
        stats = { weekStart, supportive: 0, distracting: 0, uncertain: 0, interventions: 0 };
      }
      for (const key of ['supportive', 'distracting', 'uncertain', 'interventions']) {
        stats[key] = (Number(stats[key]) || 0) + (delta[key] || 0);
      }
      await chrome.storage.local.set({ [KEYS.stats]: stats });
    })
    .catch((err) => console.error('[AZM] تعذّر تحديث الإحصاءات', err));
  return statsQueue;
}

/** يضيف رابطًا معتمدًا إلى الجلسة الجارية (قراءة-تعديل-كتابة متسلسلة). */
function addAllowedEntry(entry) {
  sessionQueue = sessionQueue
    .then(async () => {
      const res = await chrome.storage.local.get(KEYS.active);
      const session = res[KEYS.active];
      if (!isActiveSession(session)) return;
      const urls = Array.isArray(session.urls) ? session.urls : [];
      if (urls.includes(entry)) return;
      urls.push(entry);
      session.urls = urls;
      await chrome.storage.local.set({ [KEYS.active]: session });
    })
    .catch((err) => console.error('[AZM] تعذّر إضافة الرابط', err));
  return sessionQueue;
}

/* ============================================================
 * فحص التبويب
 * ============================================================ */
const recent = new Map(); // "tabId|url" -> وقت آخر معالجة

function rememberRecently(key) {
  const now = Date.now();
  for (const [k, t] of recent) if (now - t > DEDUPE_MS) recent.delete(k);
  if (recent.has(key)) return false;
  recent.set(key, now);
  return true;
}

async function inspectTab(tabId, url) {
  if (typeof tabId !== 'number' || tabId < 0 || !url) return;

  // صفحات الإضافة والمتصفح (chrome://, chrome-extension://, about:, edge:// ...) مسموحة دائمًا
  const visited = parseWebUrl(url);
  if (!visited) return;

  const { session } = await readState();
  // The backend is authoritative. The local evaluator remains only as an offline fallback.
  try {
    const remote = await AzmApi.sync({
      activity: { url: visited.href, domain: visited.hostname, title: '' },
      tabId,
      lang: 'ar'
    });
    if (!remote.sessionActive) return;
    if (remote.onBreak) return;
    const command = Array.isArray(remote.commands) && remote.commands.find((c) => c && c.type === 'intervene' && c.tabId === tabId);
    if (command) {
      const target = `${chrome.runtime.getURL(INTERCEPT_PAGE)}?blocked=${encodeURIComponent(url)}&tabId=${tabId}&challengeId=${encodeURIComponent(command.id || '')}`;
      await chrome.tabs.update(tabId, { url: target });
      return;
    }
    return;
  } catch (err) {
    console.warn('[AZM] Backend sync unavailable; using offline evaluator', err);
  }
  if (!isActiveSession(session)) return;

  const allowedUrls = Array.isArray(session.urls) ? session.urls : [];
  if (isAllowed(visited, allowedUrls)) return;

  // استراحة قصيرة مسموحة: لا تدخّل حتى تنتهي مدتها (ينبّه المنبّه عند انتهائها)
  if (typeof session.breakUntil === 'number' && Date.now() < session.breakUntil) return;

  // أكثر من حدث (onUpdated/onCommitted/...) قد يصل لنفس التنقّل: نعالجه مرة واحدة
  const key = `${tabId}|${visited.href}`;
  if (!rememberRecently(key)) return;

  // تقييم محلي: هل الرابط يخدم هدف/مهمة/نتيجة الجلسة؟
  const ev = AzmEval.evaluateLinkAgainstSession(visited.href, session);

  if (ev.verdict === 'allow') {
    // متوافق مع الهدف: يُسمح به، ويُضاف للجلسة إن كان الدليل من النطاق/المسار (وليس من نص بحث عابر)
    if (ev.persist && ev.entry) await addAllowedEntry(ev.entry);
    await bumpStats({ supportive: 1 });
    return;
  }

  const target = `${chrome.runtime.getURL(INTERCEPT_PAGE)}?blocked=${encodeURIComponent(url)}&tabId=${tabId}`;
  try {
    await chrome.tabs.update(tabId, { url: target });
    await bumpStats(
      ev.verdict === 'block'
        ? { interventions: 1, distracting: 1 }
        : { interventions: 1, uncertain: 1 }
    );
  } catch (err) {
    // التبويب أُغلق أو لا يمكن تعديله
    recent.delete(key);
  }
}

/* ============================================================
 * المستمعون (يجب تسجيلها بشكل متزامن في المستوى الأعلى)
 * ============================================================ */
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId)
    .then((tab) => inspectTab(tabId, tab.url || tab.pendingUrl))
    .catch(() => { /* التبويب لم يعد موجودًا */ });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) inspectTab(tabId, changeInfo.url);
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) inspectTab(details.tabId, details.url);
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId === 0) inspectTab(details.tabId, details.url);
});

/* عند انتهاء الاستراحة: نفحص التبويب النشط في كل نافذة (البقية تُفحص عند تفعيلها) */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== BREAK_ALARM) return;
  try {
    const tabs = await chrome.tabs.query({ active: true });
    for (const tab of tabs) await inspectTab(tab.id, tab.url || tab.pendingUrl);
  } catch (err) {
    console.warn('[AZM] تعذّر فحص التبويبات بعد الاستراحة', err);
  }
});
