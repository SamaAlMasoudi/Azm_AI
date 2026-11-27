/* عزم - AZM AI | dashboard.js
 * Vanilla JS، بدون مكتبات خارجية أو خوادم أو مفاتيح مضمّنة.
 * الحالة تُحفظ في chrome.storage.local (مع localStorage كخيار احتياطي).
 * المؤقّت يُحسب دائمًا من endTimestamp، لذلك يستمر بعد إعادة التحميل
 * وبدون الحاجة إلى service worker.
 */
(() => {
  'use strict';

  /* ============================================================
   * الثوابت
   * ============================================================ */
  const KEYS = Object.freeze({
    active: 'activeSession',
    groups: 'savedSessions',
    history: 'sessionHistory',
    stats: 'weeklyStats',
    settings: 'settings',
    preferred: 'preferredDomains'
  });
const isPopup = new URLSearchParams(location.search).get("popup") === "1";
const btnOpenTab = document.getElementById("btnOpenTab");

if (isPopup) {
  document.documentElement.classList.add("popup");
  if (btnOpenTab) {
    btnOpenTab.hidden = false;
    btnOpenTab.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("https://azm-ai.onrender.com") });
    });
  }
}
  const LS_PREFIX = 'azm_';
  const HISTORY_LIMIT = 100;
  const MIN_MINUTES = 1;
  const MAX_MINUTES = 360;

  const TOOLS = Object.freeze([
    { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', icon: 'bot', desc: 'اشرح المفاهيم الصعبة، ولّد أسئلة تدريبية، واطلب تلخيصًا.' },
    { id: 'claude', name: 'Claude', url: 'https://claude.ai', icon: 'sparkle', desc: 'مراجعة نصوص طويلة وتلخيص المقالات والمحاضرات.' },
    { id: 'google', name: 'جوجل', url: 'https://www.google.com', icon: 'search', desc: 'بحث سريع عن تعريفات ومصادر داعمة — يقيّم عزم كل بحث.' },
    { id: 'wikipedia', name: 'ويكيبيديا', url: 'https://ar.wikipedia.org', icon: 'book', desc: 'خلفية سريعة عن المصطلحات والأسماء في مادّتك.' }
  ]);
  const QUICK_LINKS = TOOLS.slice(0, 3); // ChatGPT, Claude, Google

  const TECHNIQUES = Object.freeze({
    pomodoro: { label: 'بومودورو 25/5', minutes: 25 },
    '52-17': { label: 'قاعدة 52/17', minutes: 52 },
    custom: { label: 'مخصص', minutes: null }
  });

  const PERSONAS = Object.freeze({
    strict: 'المدرب الصارم',
    supportive: 'الصديق الداعم',
    philosopher: 'الفيلسوف المنطقي'
  });

  const STAT_DEFS = Object.freeze([
    { key: 'supportive', label: 'أنشطة داعمة', tone: 'success', icon: 'check-circle' },
    { key: 'distracting', label: 'أنشطة مشتتة', tone: 'danger', icon: 'x-circle' },
    { key: 'uncertain', label: 'غير مؤكدة', tone: 'warning', icon: 'help-circle' },
    { key: 'interventions', label: 'التدخلات', tone: 'accent', icon: 'shield' }
  ]);

  const DEFAULT_SETTINGS = Object.freeze({
    simulatedBrowsing: false,
    spaceIsolation: true,
    smartAgent: true
  });

  /* ============================================================
   * أدوات مساعدة
   * ============================================================ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** إنشاء عنصر DOM بأمان (النصوص تُدرج دائمًا كنص وليس HTML). */
  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, val] of Object.entries(props)) {
      if (val === null || val === undefined || val === false) continue;
      if (key === 'class') node.className = val;
      else if (key === 'text') node.textContent = val;
      else if (key.startsWith('on') && typeof val === 'function') node.addEventListener(key.slice(2), val);
      else node.setAttribute(key, val === true ? '' : String(val));
    }
    for (const child of children.flat()) {
      if (child !== null && child !== undefined) node.append(child);
    }
    return node;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';

  /** أيقونة SVG من الـ sprite الموجود في dashboard.html */
  function icon(name, extra = '') {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', `icon ${extra}`.trim());
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.append(use);
    return svg;
  }

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  const pad2 = (n) => String(n).padStart(2, '0');

  function formatCountdown(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    return `${pad2(Math.floor(totalSeconds / 60))}:${pad2(totalSeconds % 60)}`;
  }

  function formatDate(ts) {
    try {
      return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts));
    } catch {
      return new Date(ts).toLocaleString();
    }
  }

  function weekStartKey(date = new Date()) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - d.getDay()); // بداية الأسبوع: الأحد
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  const freshStats = () => ({ weekStart: weekStartKey(), supportive: 0, distracting: 0, uncertain: 0, interventions: 0 });

  /* ---------- الروابط ---------- */
  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return String(url).toLowerCase();
    }
  }

  /** يتحقق من الرابط ويُرجع { url } أو { error }. يُقبل http/https فقط. */
  function normalizeUrl(raw) {
    let value = String(raw || '').trim();
    if (!value) return { error: 'أدخل رابطًا أولًا.' };
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`;

    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      return { error: 'الرابط غير صالح. مثال: https://example.com' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { error: 'يُسمح بروابط http و https فقط.' };
    }
    if (!parsed.hostname.includes('.')) {
      return { error: 'اكتب نطاقًا كاملًا، مثل example.com' };
    }
    const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
    return { url: parsed.origin + path };
  }

  const hasHost = (list, url) => list.some((u) => hostOf(u) === hostOf(url));

  /** يضيف رابطًا إلى قائمة (مع منع التكرار حسب النطاق). */
  function addUrlToList(list, raw) {
    const result = normalizeUrl(raw);
    if (result.error) return result;
    if (hasHost(list, result.url)) return { error: 'هذا النطاق مضاف بالفعل.' };
    list.push(result.url);
    return { url: result.url };
  }

  function toggleInList(list, url) {
    const idx = list.findIndex((u) => hostOf(u) === hostOf(url));
    if (idx >= 0) list.splice(idx, 1);
    else list.push(url);
  }

  /* ============================================================
   * التخزين: chrome.storage.local مع localStorage كاحتياط
   * ============================================================ */
  const hasChromeStorage = (() => {
    try {
      return Boolean(chrome && chrome.storage && chrome.storage.local);
    } catch {
      return false;
    }
  })();

  const storage = {
    async get(key, fallback) {
      if (hasChromeStorage) {
        try {
          const res = await chrome.storage.local.get(key);
          return res[key] === undefined ? fallback : res[key];
        } catch (err) {
          console.warn('[AZM] chrome.storage.get failed, using localStorage', err);
        }
      }
      try {
        const raw = localStorage.getItem(LS_PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },

    async set(key, value) {
      if (hasChromeStorage) {
        try {
          await chrome.storage.local.set({ [key]: value });
          return;
        } catch (err) {
          console.warn('[AZM] chrome.storage.set failed, using localStorage', err);
        }
      }
      try {
        localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
      } catch (err) {
        console.error('[AZM] تعذّر حفظ البيانات', err);
      }
    },

    async remove(key) {
      if (hasChromeStorage) {
        try {
          await chrome.storage.local.remove(key);
          return;
        } catch (err) {
          console.warn('[AZM] chrome.storage.remove failed, using localStorage', err);
        }
      }
      try { localStorage.removeItem(LS_PREFIX + key); } catch { /* تجاهل */ }
    },

    async clear() {
      if (hasChromeStorage) {
        try { await chrome.storage.local.clear(); } catch (err) { console.warn('[AZM] clear failed', err); }
      }
      try {
        Object.keys(localStorage).filter((k) => k.startsWith(LS_PREFIX)).forEach((k) => localStorage.removeItem(k));
      } catch { /* تجاهل */ }
    }
  };

  /* ============================================================
   * الحالة
   * ============================================================ */
  const state = {
    view: 'home',
    active: null,
    groups: [],
    history: [],
    stats: freshStats(),
    settings: { ...DEFAULT_SETTINGS },
    preferred: [],      // نطاقات مفضّلة تُضاف تلقائيًا للجلسات الجديدة
    draftUrls: [],      // روابط نموذج الجلسة الجديدة
    draftTouched: false
  };

  const isActive = () =>
    Boolean(state.active) && typeof state.active.endTimestamp === 'number' && Date.now() < state.active.endTimestamp;

  async function loadState() {
    const [active, groups, history, stats, settings, preferred] = await Promise.all([
      storage.get(KEYS.active, null),
      storage.get(KEYS.groups, []),
      storage.get(KEYS.history, []),
      storage.get(KEYS.stats, null),
      storage.get(KEYS.settings, {}),
      storage.get(KEYS.preferred, [])
    ]);

    state.active = active && typeof active === 'object' && typeof active.endTimestamp === 'number' ? active : null;
    if (state.active && !Array.isArray(state.active.urls)) state.active.urls = [];
    state.groups = Array.isArray(groups) ? groups : [];
    state.history = Array.isArray(history) ? history : [];
    state.settings = { ...DEFAULT_SETTINGS, ...(settings && typeof settings === 'object' ? settings : {}) };
    state.preferred = Array.isArray(preferred) ? preferred.filter((u) => typeof u === 'string') : [];

    const thisWeek = weekStartKey();
    if (stats && typeof stats === 'object' && stats.weekStart === thisWeek) {
      const base = freshStats();
      for (const { key } of STAT_DEFS) base[key] = Number(stats[key]) || 0;
      state.stats = base;
    } else {
      state.stats = freshStats();
      await storage.set(KEYS.stats, state.stats);
    }
  }

  /* ============================================================
   * التنبيهات (Toast)
   * ============================================================ */
  let toastTimer = null;
  function toast(message, tone = 'info') {
    const node = $('#toast');
    node.textContent = message;
    node.dataset.tone = tone;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 3200);
  }

  /* ============================================================
   * الواجهة: التنقل
   * ============================================================ */
  function setView(name) {
    state.view = name;
    $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
    $$('.tab').forEach((t) => {
      const on = t.dataset.view === name;
      t.classList.toggle('is-active', on);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    $('#btnNewSession').classList.toggle('is-current', name === 'new');

    if (name === 'new') {
      if (!state.draftTouched) state.draftUrls = [...state.preferred];
      $('#activeWarning').hidden = !isActive();
      renderDraft();
    }
    window.scrollTo({ top: 0 });
  }

  /* ============================================================
   * الواجهة: العرض
   * ============================================================ */
  function renderStats(container) {
    container.replaceChildren(
      ...STAT_DEFS.map(({ key, label, tone, icon: ic }) =>
        el('article', { class: `stat-card tone-${tone}` },
          el('span', { class: 'stat-icon' }, icon(ic)),
          el('div', { class: 'stat-body' },
            el('span', { class: 'stat-label', text: label }),
            el('strong', { class: 'stat-value', text: String(state.stats[key] || 0) })
          )
        )
      )
    );
  }

  function renderAllStats() {
    renderStats($('#statsHome'));
    renderStats($('#statsView'));
  }

  /**
   * بطاقات الأدوات الموصى بها.
   * lockAdded: عند true لا يمكن إزالة النطاق بعد إضافته (أثناء الجلسة الجارية).
   */
  function renderTools(container, list, onToggle, lockAdded = false) {
    container.replaceChildren(
      ...TOOLS.map((tool) => {
        const added = hasHost(list, tool.url);
        return el('article', { class: `tool-card tool-${tool.id}` },
          el('div', { class: 'tool-head' },
            el('span', { class: 'tool-logo', 'aria-hidden': 'true' }, icon(tool.icon)),
            el('div', {},
              el('h4', { text: tool.name }),
              el('span', { class: 'tool-host', text: hostOf(tool.url) })
            )
          ),
          el('p', { text: tool.desc }),
          el('button', {
            type: 'button',
            class: `btn btn-sm ${added ? 'btn-success' : 'btn-outline'}`,
            'aria-pressed': String(added),
            disabled: added && lockAdded,
            onclick: () => onToggle(tool)
          }, icon(added ? 'check' : 'plus'), el('span', { text: added ? 'مضافة' : 'إضافة للنطاق' }))
        );
      })
    );
  }

  function renderHomeTools() {
    const active = isActive();
    const list = active ? state.active.urls : state.preferred;
    renderTools($('#toolsHome'), list, toggleHomeTool, active);
  }

  function renderGroups() {
    const container = $('#groupsList');
    if (!state.groups.length) {
      container.replaceChildren(
        el('div', { class: 'empty-state', text: 'لا توجد مجموعات محفوظة بعد. أنشئ جلسة واضغط «حفظ كمجموعة» لتعود إليها لاحقًا.' })
      );
      return;
    }
    container.replaceChildren(
      ...state.groups.map((g) => {
        const tech = TECHNIQUES[g.technique] ? TECHNIQUES[g.technique].label : '';
        const meta = [g.goal, `${g.durationMinutes} دقيقة`, tech, `${(g.urls || []).length} رابط`].filter(Boolean).join(' · ');
        return el('article', { class: 'row-card' },
          el('span', { class: 'row-icon', 'aria-hidden': 'true' }, icon('folder')),
          el('div', { class: 'row-main' },
            el('strong', { text: g.name }),
            el('span', { text: meta })
          ),
          el('div', { class: 'inline-actions' },
            el('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => launchGroup(g.id) }, icon('play', 'icon-fill'), el('span', { text: 'إطلاق' })),
            el('button', { type: 'button', class: 'btn btn-danger-outline btn-sm', onclick: () => deleteGroup(g.id) }, icon('trash'), el('span', { text: 'حذف' }))
          )
        );
      })
    );
  }

  function renderHistory() {
    const container = $('#historyList');
    if (!state.history.length) {
      container.replaceChildren(el('div', { class: 'empty-state', text: 'لا توجد جلسات مكتملة بعد.' }));
      return;
    }
    container.replaceChildren(
      ...state.history.map((s) => {
        const completed = s.status === 'completed';
        return el('article', { class: 'row-card' },
          el('span', { class: 'row-icon', 'aria-hidden': 'true' }, icon('target')),
          el('div', { class: 'row-main' },
            el('strong', { text: s.goal }),
            el('span', { text: s.task }),
            el('span', { text: `${formatDate(s.startedAt)} · ${s.actualMinutes} من ${s.durationMinutes} دقيقة` })
          ),
          el('span', { class: `status ${completed ? 'status-completed' : 'status-ended'}` }, icon(completed ? 'check-circle' : 'clock'), completed ? 'مكتملة' : 'أُنهيت مبكرًا')
        );
      })
    );
  }

  function renderSettings() {
    $$('[data-setting]').forEach((input) => {
      input.checked = Boolean(state.settings[input.dataset.setting]);
    });
  }

  /* ---------- الجلسة النشطة ---------- */
  function renderLinkChip(url, { removable, onRemove } = {}) {
    const host = hostOf(url);
    const children = [icon('link'), el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', title: url, text: host })];
    if (removable) {
      children.push(el('button', {
        type: 'button', class: 'chip-x', 'aria-label': `إزالة ${host}`, onclick: onRemove
      }, icon('x')));
    }
    return el('li', { class: `link-chip${removable ? '' : ' is-locked'}` }, ...children);
  }

  function renderLiveLinks() {
    if (!state.active) return;
    const urls = state.active.urls;
    $('#liveLinks').replaceChildren(
      ...(urls.length
        ? urls.map((u) => renderLinkChip(u))
        : [el('li', { class: 'empty-inline', text: 'لم تُضف روابط بعد.' })])
    );

    $('#liveQuick').replaceChildren(
      ...QUICK_LINKS.map((tool) => {
        const added = hasHost(urls, tool.url);
        return el('button', {
          type: 'button', class: 'chip', disabled: added, onclick: () => addLiveUrl(tool.url)
        }, icon(added ? 'check' : 'plus'), el('span', { text: tool.name }));
      })
    );
  }

  function renderHero() {
    const active = isActive();
    $('#heroIdle').hidden = active;
    $('#heroActive').hidden = !active;
    $('#hero').classList.toggle('is-active', active);
    if (!active) return;

    const a = state.active;
    const tech = TECHNIQUES[a.technique] ? TECHNIQUES[a.technique].label : '';
    const persona = PERSONAS[a.persona] || '';
    $('#activeMeta').textContent = [tech, `${a.durationMinutes} دقيقة`, persona].filter(Boolean).join(' · ');
    $('#activeGoal').textContent = a.goal;
    $('#activeTask').textContent = a.task;
    $('#activeOutcome').textContent = a.outcome;
    renderLiveLinks();
    tick();
  }

  function renderDraft() {
    // روابط المسودة
    const list = $('#draftUrls');
    list.replaceChildren(
      ...state.draftUrls.map((u) =>
        renderLinkChip(u, {
          removable: true,
          onRemove: () => { state.draftTouched = true; toggleInList(state.draftUrls, u); renderDraft(); }
        })
      )
    );

    // اقتراحات سريعة
    $('#quickLinks').replaceChildren(
      ...QUICK_LINKS.map((tool) => {
        const added = hasHost(state.draftUrls, tool.url);
        return el('button', {
          type: 'button', class: 'chip', disabled: added,
          onclick: () => { state.draftTouched = true; addUrlToList(state.draftUrls, tool.url); renderDraft(); }
        }, icon(added ? 'check' : 'plus'), el('span', { text: tool.name }));
      })
    );

    renderTools($('#toolsNew'), state.draftUrls, (tool) => {
      state.draftTouched = true;
      toggleInList(state.draftUrls, tool.url);
      renderDraft();
    });
  }

  function renderAll() {
    renderHero();
    renderAllStats();
    renderHomeTools();
    renderGroups();
    renderHistory();
    renderSettings();
    if (state.view === 'new') {
      $('#activeWarning').hidden = !isActive();
      renderDraft();
    }
  }

  /* ============================================================
   * المؤقّت (محسوب من endTimestamp)
   * ============================================================ */
  function tick() {
    const a = state.active;
    if (!a) return;
    const remaining = a.endTimestamp - Date.now();
    if (remaining <= 0) {
      finishSession('completed');
      return;
    }
    const total = a.endTimestamp - a.startedAt;
    $('#timer').textContent = formatCountdown(remaining);
    const ts = window.AzmEval.timeStats(a);
    $('#elapsedInfo').textContent = `مضى ${ts.elapsedMinutes} دقيقة · متبقٍ ${ts.remainingMinutes} دقيقة`;
    const onBreak = typeof a.breakUntil === 'number' && Date.now() < a.breakUntil;
    $('#breakBanner').hidden = !onBreak;
    if (onBreak) {
      $('#breakText').textContent = `تنتهي بعد ${formatCountdown(a.breakUntil - Date.now())} — ثم عُد إلى «${a.task}» لتحقق «${a.outcome}».`;
    }
    $('#timerBar').style.width = `${Math.min(100, Math.max(0, ((total - remaining) / total) * 100))}%`;
    document.title = `${formatCountdown(remaining)} · عزم - AZM AI`;
  }

  async function finishSession(status) {
    const a = state.active;
    if (!a) return;
    try { await AzmApi.session({ action: 'end' }); } catch (err) { console.warn('[AZM] remote session end failed', err); }
    state.active = null; // يمنع التنفيذ المزدوج

    const endedAt = status === 'completed' ? a.endTimestamp : Date.now();
    state.history.unshift({
      id: a.id || uid(),
      goal: a.goal,
      task: a.task,
      outcome: a.outcome,
      technique: a.technique,
      persona: a.persona,
      durationMinutes: a.durationMinutes,
      startedAt: a.startedAt,
      endedAt,
      actualMinutes: Math.max(0, Math.round((endedAt - a.startedAt) / 60000)),
      status
    });
    state.history = state.history.slice(0, HISTORY_LIMIT);

    document.title = 'عزم - AZM AI';
    await Promise.all([storage.remove(KEYS.active), storage.set(KEYS.history, state.history)]);
    renderAll();
    toast(status === 'completed' ? 'أحسنت! اكتملت الجلسة 🎉' : 'تم إنهاء الجلسة.', status === 'completed' ? 'success' : 'info');
  }

  /* ============================================================
   * الجلسات
   * ============================================================ */
  async function startSession(cfg) {
    if (state.active) await finishSession('ended'); // استبدال الجلسة الحالية

    const now = Date.now();
    let remoteId = null;
    try {
      const remote = await AzmApi.session({ action: 'start', goal: cfg.goal, task: cfg.task, outcome: cfg.outcome, durationMinutes: cfg.durationMinutes, persona: cfg.persona, urls: cfg.urls });
      remoteId = remote.id || null;
    } catch (err) { console.warn('[AZM] remote session start failed; continuing offline', err); }
    state.active = {
      id: remoteId || uid(),
      startedAt: now,
      endTimestamp: now + cfg.durationMinutes * 60000,
      durationMinutes: cfg.durationMinutes,
      goal: cfg.goal,
      task: cfg.task,
      outcome: cfg.outcome,
      technique: cfg.technique,
      persona: cfg.persona,
      urls: [...cfg.urls]
    };
    await storage.set(KEYS.active, state.active);

    resetForm();
    setView('home');
    renderAll();
    toast('بدأت الجلسة. بالتوفيق!', 'success');
  }

  async function addLiveUrl(raw) {
    const errorBox = $('#liveUrlError');
    if (!isActive()) return;

    const showError = (msg) => { errorBox.textContent = msg; errorBox.hidden = false; };

    const normalized = normalizeUrl(raw);
    if (normalized.error) return showError(normalized.error);
    if (state.active.urls.includes(normalized.url)) return showError('هذا الرابط مضاف بالفعل.');
    try {
      const remote = await AzmApi.sync({ activity: { url: normalized.url, domain: hostOf(normalized.url), title: state.active.task }, tabId: null, lang: 'ar' });
      if (remote.sessionActive === false) return showError('لا توجد جلسة Backend نشطة. ابدأ الجلسة من جديد.');
    } catch (err) { console.warn('[AZM] remote URL check failed; using offline evaluator', err); }

    // تقييم محلي مقابل هدف الجلسة ومهمتها ونتيجتها المتوقعة
    const ev = window.AzmEval.evaluateLinkAgainstSession(normalized.url, state.active);
    if (ev.verdict !== 'allow') {
      const prefix = ev.verdict === 'block' ? 'لا يمكن إضافة هذا الرابط: ' : 'لم أتأكد من صلة هذا الرابط بجلستك: ';
      return showError(`${prefix}${ev.reason} إن كنت تحتاجه فعلًا، افتحه وسيطلب منك عزم تبريرًا.`);
    }

    errorBox.hidden = true;
    $('#liveUrlInput').value = '';
    state.active.urls.push(normalized.url);
    await storage.set(KEYS.active, state.active);
    renderLiveLinks();
    renderHomeTools();
    toast('أُضيف الرابط: ' + (ev.reason || 'يخدم هدف جلستك'), 'success');
  }

  async function toggleHomeTool(tool) {
    if (isActive()) {
      // أثناء الجلسة: إضافة فقط (لا يمكن إزالة رابط حتى لا تُضعف التزامك)
      if (!hasHost(state.active.urls, tool.url)) await addLiveUrl(tool.url);
    } else {
      toggleInList(state.preferred, tool.url);
      state.draftTouched = false; // لتنعكس التفضيلات في الجلسة القادمة
      await storage.set(KEYS.preferred, state.preferred);
    }
    renderHomeTools();
    if (isActive()) renderLiveLinks();
  }

  /* ---------- مجموعات الجلسات ---------- */
  async function launchGroup(id) {
    const g = state.groups.find((x) => x.id === id);
    if (!g) return;
    if (isActive()) {
      toast('أنهِ الجلسة الحالية أولًا قبل إطلاق مجموعة.', 'warning');
      return;
    }
    await startSession(g);
  }

  async function deleteGroup(id) {
    state.groups = state.groups.filter((g) => g.id !== id);
    await storage.set(KEYS.groups, state.groups);
    renderGroups();
    toast('تم حذف المجموعة.');
  }

  /* ============================================================
   * النموذج: القراءة والتحقق
   * ============================================================ */
  function readForm() {
    const technique = ($('input[name="technique"]:checked') || {}).value || 'pomodoro';
    const persona = ($('input[name="persona"]:checked') || {}).value || 'supportive';
    return {
      goal: $('#goal').value.trim(),
      task: $('#task').value.trim(),
      outcome: $('#outcome').value.trim(),
      technique,
      persona,
      duration: Number($('#durationMinutes').value)
    };
  }

  function validate(f) {
    const errors = {};
    if (f.goal.length < 3) errors.goal = 'اكتب هدف الدراسة (3 أحرف على الأقل).';
    if (f.task.length < 3) errors.task = 'اكتب المهمة الحالية (3 أحرف على الأقل).';
    if (f.outcome.length < 3) errors.outcome = 'اكتب النتيجة المتوقعة (3 أحرف على الأقل).';
    if (!Number.isInteger(f.duration) || f.duration < MIN_MINUTES || f.duration > MAX_MINUTES) {
      errors.custom = `أدخل مدة صحيحة بين ${MIN_MINUTES} و${MAX_MINUTES} دقيقة.`;
    }
    return errors;
  }

  const FIELD_IDS = { goal: '#goal', task: '#task', outcome: '#outcome', custom: '#durationMinutes' };

  function showErrors(errors) {
    let firstInvalid = null;
    for (const key of Object.keys(FIELD_IDS)) {
      const box = $(`#err-${key}`);
      const input = $(FIELD_IDS[key]);
      if (errors[key]) {
        box.textContent = errors[key];
        box.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        firstInvalid = firstInvalid || input;
      } else {
        box.hidden = true;
        input.removeAttribute('aria-invalid');
      }
    }
    if (firstInvalid) firstInvalid.focus();
  }

  /** يُرجع إعدادات الجلسة إن كانت صالحة، وإلا يعرض الأخطاء ويُرجع null. */
  function buildConfig() {
    const f = readForm();
    const errors = validate(f);
    showErrors(errors);
    if (Object.keys(errors).length) return null;

    const durationMinutes = f.duration;
    return {
      goal: f.goal,
      task: f.task,
      outcome: f.outcome,
      technique: f.technique,
      persona: f.persona,
      durationMinutes,
      urls: [...state.draftUrls]
    };
  }

  function resetForm() {
    $('#sessionForm').reset();
    $('#groupCard').hidden = true;
    $('#err-group').hidden = true;
    $('#err-url').hidden = true;
    showErrors({});
    state.draftTouched = false;
    state.draftUrls = [...state.preferred];
  }

  /* ---------- حفظ كمجموعة ---------- */
  async function confirmGroup() {
    const name = $('#groupName').value.trim();
    const err = $('#err-group');
    if (!name) {
      err.textContent = 'اكتب اسمًا للمجموعة.';
      err.hidden = false;
      $('#groupName').focus();
      return;
    }
    const cfg = buildConfig();
    if (!cfg) { $('#groupCard').hidden = true; return; }

    state.groups.unshift({ id: uid(), name, createdAt: Date.now(), ...cfg });
    await storage.set(KEYS.groups, state.groups);

    err.hidden = true;
    $('#groupName').value = '';
    $('#groupCard').hidden = true;
    renderGroups();
    toast(`تم حفظ المجموعة «${name}».`, 'success');
  }

  function cancelGroup() {
    $('#groupName').value = '';
    $('#err-group').hidden = true;
    $('#groupCard').hidden = true;
  }

  /* ============================================================
   * الإعدادات ومسح البيانات
   * ============================================================ */
  async function clearAllData() {
    await storage.clear();
    state.active = null;
    state.groups = [];
    state.history = [];
    state.stats = freshStats();
    state.settings = { ...DEFAULT_SETTINGS };
    state.preferred = [];
    resetForm();
    $('#clearConfirm').hidden = true;
    $('#btnClear').hidden = false;
    document.title = 'عزم - AZM AI';
    renderAll();
    setView('home');
    toast('تم مسح كل البيانات.', 'success');
  }

  /* ============================================================
   * ربط الأحداث
   * ============================================================ */
  function bindEvents() {
    // التنقل (التبويبات + زر الجلسة الجديدة + أي زر يحمل data-view)
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-view]');
      if (trigger) setView(trigger.dataset.view);
    });

    // أمثلة الهدف
    $$('[data-fill]').forEach((chip) =>
      chip.addEventListener('click', () => {
        $('#goal').value = chip.dataset.fill;
        $('#goal').focus();
      })
    );

    // تقنيات التركيز تملأ المدة، والمدة المكتوبة مباشرة تحوّل التقنية إلى «مخصص»
    const durationInput = $('#durationMinutes');
    const selectTechnique = (value) => {
      const radio = $(`input[name="technique"][value="${value}"]`);
      if (radio) radio.checked = true;
    };
    $$('input[name="technique"]').forEach((r) =>
      r.addEventListener('change', () => {
        const preset = TECHNIQUES[r.value] && TECHNIQUES[r.value].minutes;
        if (preset) durationInput.value = String(preset);
        else { durationInput.focus(); durationInput.select(); }
        showErrors({});
      })
    );
    durationInput.addEventListener('input', () => {
      const current = ($('input[name="technique"]:checked') || {}).value;
      const preset = TECHNIQUES[current] && TECHNIQUES[current].minutes;
      if (preset && Number(durationInput.value) !== preset) selectTechnique('custom');
    });
    $$('[data-minutes]').forEach((chip) =>
      chip.addEventListener('click', () => {
        durationInput.value = chip.dataset.minutes;
        durationInput.dispatchEvent(new Event('input'));
      })
    );

    // إضافة رابط في نموذج الجلسة الجديدة
    const addDraftUrl = () => {
      const err = $('#err-url');
      const res = addUrlToList(state.draftUrls, $('#urlInput').value);
      if (res.error) {
        err.textContent = res.error;
        err.hidden = false;
        return;
      }
      err.hidden = true;
      state.draftTouched = true;
      $('#urlInput').value = '';
      renderDraft();
    };
    $('#btnAddUrl').addEventListener('click', addDraftUrl);
    $('#urlInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addDraftUrl(); }
    });

    // إرسال النموذج: انطلق – ابدأ الجلسة (لا يتطلب اسم مجموعة)
    $('#sessionForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const cfg = buildConfig();
      if (cfg) startSession(cfg);
    });

    // حفظ كمجموعة: يُظهر بطاقة الاسم فقط عند الضغط
    $('#btnSaveGroup').addEventListener('click', () => {
      if (!buildConfig()) return;
      $('#groupCard').hidden = false;
      $('#groupName').focus();
    });
    $('#btnGroupConfirm').addEventListener('click', confirmGroup);
    $('#btnGroupCancel').addEventListener('click', cancelGroup);
    $('#groupName').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); confirmGroup(); }
      if (e.key === 'Escape') cancelGroup();
    });

    // الجلسة النشطة
    $('#btnEnd').addEventListener('click', () => finishSession('ended'));
    $('#liveUrlForm').addEventListener('submit', (e) => {
      e.preventDefault();
      addLiveUrl($('#liveUrlInput').value);
    });

    // الإعدادات
    $('#btnSaveApi').addEventListener('click', async () => {
      const base = $('#apiBaseUrl').value.trim() || AzmApi.DEFAULT_BASE;
      const token = $('#apiToken').value.trim();
      await AzmApi.saveConfig(base, token);
      const status = $('#apiStatus');
      try { await AzmApi.sync({ lang: 'ar' }); status.textContent = 'تم الاتصال بالخادم بنجاح.'; }
      catch (err) { status.textContent = `تعذر الاتصال: ${err.message}`; }
      status.hidden = false;
    });
    $$('[data-setting]').forEach((input) =>
      input.addEventListener('change', async () => {
        state.settings[input.dataset.setting] = input.checked;
        await storage.set(KEYS.settings, state.settings);
        toast('تم حفظ الإعداد.');
      })
    );

    // مسح كل البيانات مع تأكيد
    $('#btnClear').addEventListener('click', () => {
      $('#clearConfirm').hidden = false;
      $('#btnClear').hidden = true;
      $('#btnClearNo').focus();
    });
    $('#btnClearNo').addEventListener('click', () => {
      $('#clearConfirm').hidden = true;
      $('#btnClear').hidden = false;
    });
    $('#btnClearYes').addEventListener('click', clearAllData);

    // تحديث المؤقّت عند العودة إلى النافذة
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  }

  /* ---------- وضع النافذة المنبثقة وفتح تبويب ---------- */
  function setupPopupMode() {
    let inExtension = false;
    try { inExtension = Boolean(chrome && chrome.runtime && chrome.runtime.id); } catch { /* ليس داخل إضافة */ }

    const isTab = new URLSearchParams(location.search).get('mode') === 'tab';
    if (!inExtension || isTab) return;

    document.documentElement.classList.add('popup');
    const btn = $('#btnOpenTab');
    btn.hidden = false;
    btn.addEventListener('click', async () => {
      try {
        await chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html?mode=tab') });
        window.close();
      } catch (err) {
        console.warn('[AZM] تعذّر فتح التبويب', err);
        toast('تعذّر فتح تبويب جديد.', 'danger');
      }
    });
  }

  /* مزامنة بين النافذة المنبثقة والتبويب (وأي كتابة لاحقة من سكربتات أخرى) */
  function watchStorage() {
    if (!hasChromeStorage || !chrome.storage.onChanged) return;
    chrome.storage.onChanged.addListener(async (_changes, area) => {
      if (area !== 'local') return;
      await loadState();
      renderAll();
    });
  }

  /* ============================================================
   * التشغيل
   * ============================================================ */
  async function init() {
    setupPopupMode();
    bindEvents();
    await loadState();
    try {
      const cfg = await AzmApi.getConfig();
      $('#apiBaseUrl').value = cfg.baseUrl;
      $('#apiToken').value = cfg.token;
    } catch { /* page may be opened outside Chrome */ }

    // جلسة انتهى وقتها أثناء إغلاق اللوحة تُسجَّل كمكتملة
    if (state.active && Date.now() >= state.active.endTimestamp) {
      await finishSession('completed');
    }

    state.draftUrls = [...state.preferred];
    renderAll();
    setView('home');

    setInterval(tick, 1000);
    watchStorage();
  }

  init().catch((err) => console.error('[AZM] فشل التشغيل', err));
})();
