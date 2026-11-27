/* عزم - AZM AI | intercept.js
 * صفحة «الاحتكاك الإيجابي»: تعرض سياق الجلسة والوقت المنقضي، وتقيّم تبرير المستخدم
 * محليًا (evaluator.js) قبل أن تقرر: رفض / تشجيع على الاستمرار / استراحة قصيرة / إضافة الرابط.
 * كل القراءة والكتابة عبر chrome.storage.local (الصفحة تعمل دائمًا داخل الإضافة).
 */
(() => {
  'use strict';

  const E = window.AzmEval;
  const SESSION_KEY = 'activeSession';
  const BREAK_ALARM = 'azm-break-end';
  const MAX_JUSTIFICATIONS = 20;

  const PERSONAS = Object.freeze({
    strict: {
      name: 'المدرب الصارم',
      message: 'هذا ليس هدفك الآن. عُد إلى مهمتك فورًا، فالوقت يمضي.'
    },
    supportive: {
      name: 'الصديق الداعم',
      message: 'لا بأس، لحظة شرود تحدث للجميع. لنعد معًا إلى هدفك — أنت أقرب مما تظن.'
    },
    philosopher: {
      name: 'الفيلسوف المنطقي',
      message: 'اسأل نفسك بصدق: هل يخدم هذا الرابط هدفك فعلًا، أم أنه مجرد هروب مريح؟'
    }
  });

  const $ = (sel) => document.querySelector(sel);
  const pad2 = (n) => String(n).padStart(2, '0');

  /* ---------- قراءة المعاملات ---------- */
  const params = new URLSearchParams(location.search);
  const tabIdParam = Number.parseInt(params.get('tabId'), 10);

  function parseWebUrl(raw) {
    try {
      const u = new URL(raw);
      return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
    } catch {
      return null;
    }
  }

  // نقبل http/https فقط حتى لا تُستخدم الصفحة لتحويل المستخدم إلى مخططات أخرى
  const blocked = parseWebUrl(params.get('blocked'));

  /** نفس تطبيع dashboard.js: الأصل + المسار بدون الاستعلام والشرطة الأخيرة. */
  function normalizeForSession(url) {
    const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
    return url.origin + path;
  }

  const isActiveSession = (s) =>
    Boolean(s) && typeof s === 'object' && typeof s.endTimestamp === 'number' && Date.now() < s.endTimestamp;

  const getSession = async () => (await chrome.storage.local.get(SESSION_KEY))[SESSION_KEY] ?? null;

  /* ---------- العرض ---------- */
  let session = null;
  let timerId = null;
  let pendingBreak = null; // قرار الاستراحة بانتظار تأكيد المستخدم

  function formatCountdown(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
  }

  function renderBlocked() {
    if (!blocked) {
      $('#blockedHost').textContent = '—';
      $('#blockedUrl').textContent = '';
      return;
    }
    $('#blockedHost').textContent = blocked.hostname.replace(/^www\./, '');
    $('#blockedUrl').textContent = blocked.href;
    $('#blockedUrl').title = blocked.href;
  }

  /** وسم ولون سبب التدخّل حسب نتيجة التقييم المحلي. */
  function renderVerdict() {
    const tag = $('#verdictTag');
    const box = $('#verdictBox');
    if (!blocked) { box.hidden = true; return; }

    const ev = E.evaluateLinkAgainstSession(blocked.href, session);
    box.hidden = false;
    $('#verdictReason').textContent = ev.reason || '';

    if (ev.verdict === 'allow') {
      tag.textContent = 'مناسب لجلستك';
      tag.className = 'verdict-tag tag-ok';
    } else if (ev.verdict === 'uncertain') {
      tag.textContent = 'غير مؤكد';
      tag.className = 'verdict-tag tag-warn';
    } else {
      tag.textContent = ev.reasonCode === 'subject_conflict' ? 'مادة مختلفة' : 'مشتّت';
      tag.className = 'verdict-tag';
    }
  }

  function renderActive() {
    $('#panelActive').hidden = false;
    $('#panelEnded').hidden = true;

    const key = PERSONAS[session.persona] ? session.persona : 'supportive';
    $('#personaName').textContent = PERSONAS[key].name;
    $('#personaBadge').className = `persona-badge persona-${key}`;
    $('#personaMsg').textContent = PERSONAS[key].message;
    $('#sGoal').textContent = session.goal || '—';
    $('#sTask').textContent = session.task || '—';
    $('#sOutcome').textContent = session.outcome || '—';
    renderBlocked();
    renderVerdict();
    tick();
  }

  function renderEnded() {
    stopTimer();
    $('#panelActive').hidden = true;
    $('#panelEnded').hidden = false;
    $('#btnContinue').hidden = !blocked;
    if (!blocked) $('#endedText').textContent = 'لا توجد جلسة دراسة جارية حاليًا.';
  }

  function tick() {
    if (!isActiveSession(session)) {
      renderEnded();
      return;
    }
    const ts = E.timeStats(session);
    $('#timer').textContent = formatCountdown(session.endTimestamp - Date.now());
    $('#sTime').textContent = `مضى ${ts.elapsedMinutes} دقيقة · متبقٍ ${ts.remainingMinutes} دقيقة`;
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  /* ---------- الرجوع إلى الجلسة ---------- */
  async function goBackToSession() {
    const dashboard = chrome.runtime.getURL('dashboard.html');
    try {
      const me = Number.isInteger(tabIdParam) ? tabIdParam : (await chrome.tabs.getCurrent())?.id;
      const tabs = await chrome.tabs.query({ url: `${dashboard}*` });
      const other = tabs.find((t) => t.id !== me);
      if (other) {
        // لوحة عزم مفتوحة في تبويب آخر: ننتقل إليها ونغلق هذا التبويب
        await chrome.tabs.update(other.id, { active: true });
        await chrome.windows.update(other.windowId, { focused: true });
        if (typeof me === 'number') await chrome.tabs.remove(me);
        return;
      }
    } catch (err) {
      console.warn('[AZM] تعذّر الانتقال إلى تبويب اللوحة', err);
    }
    location.replace('dashboard.html?mode=tab');
  }

  /* ---------- بطاقة التبرير ---------- */
  let cooldownLeft = 0;
  let cooldownId = null;

  function showFeedback(message, tone) {
    const box = $('#feedback');
    box.className = `feedback tone-${tone}`;
    $('#feedbackText').textContent = message;
    $('#feedbackIcon').firstElementChild.setAttribute('href', tone === 'ok' ? '#i-coffee' : '#i-alert');
    box.hidden = false;
  }

  function hideFeedback() {
    $('#feedback').hidden = true;
  }

  function openJustify() {
    $('#justifyCard').hidden = false;
    $('#btnJustify').disabled = true;
    $('#reason').value = '';
    $('#reason').disabled = false;
    $('#justifyError').hidden = true;
    $('#justifyActions').hidden = false;
    $('#breakOffer').hidden = true;
    pendingBreak = null;
    hideFeedback();
    startCooldown();
    updateConfirmState();
    $('#reason').focus();
  }

  function closeJustify() {
    stopCooldown();
    pendingBreak = null;
    $('#justifyCard').hidden = true;
    $('#btnJustify').disabled = false;
  }

  function startCooldown() {
    stopCooldown();
    cooldownLeft = E.COOLDOWN_SECONDS;
    cooldownId = setInterval(() => {
      cooldownLeft = Math.max(0, cooldownLeft - 1);
      if (cooldownLeft === 0) stopCooldown();
      updateConfirmState();
    }, 1000);
  }

  function stopCooldown() {
    clearInterval(cooldownId);
    cooldownId = null;
    cooldownLeft = 0;
  }

  function updateConfirmState() {
    const length = $('#reason').value.trim().length;
    const reasonOk = length >= E.MIN_REASON_CHARS;
    const waiting = cooldownLeft > 0;

    const reasonHint = $('#reasonHint');
    reasonHint.textContent = reasonOk ? 'طول التبرير كافٍ ✓' : `اكتب ${E.MIN_REASON_CHARS} أحرف على الأقل (${length}/${E.MIN_REASON_CHARS})`;
    reasonHint.className = `hint${reasonOk ? ' ok' : ''}`;

    const cooldownHint = $('#cooldownHint');
    cooldownHint.textContent = waiting ? `فكّر لحظة… ${cooldownLeft} ث` : 'انتهت مهلة التفكير';
    cooldownHint.className = `hint${waiting ? ' wait' : ' ok'}`;

    $('#confirmLabel').textContent = waiting ? `إرسال بعد ${cooldownLeft} ث` : 'إرسال التبرير';
    $('#btnConfirm').disabled = waiting || !reasonOk;
  }

  /* ---------- قرارات التبرير ---------- */
  function pushLog(fresh, kind, reason, url) {
    const log = Array.isArray(fresh.justifications) ? fresh.justifications : [];
    log.push({ kind, url, reason, at: Date.now() });
    fresh.justifications = log.slice(-MAX_JUSTIFICATIONS);
  }

  async function addLinkAndGo(fresh, reason) {
    const entry = normalizeForSession(blocked);
    const urls = Array.isArray(fresh.urls) ? fresh.urls : [];
    if (!urls.includes(entry)) urls.push(entry);
    fresh.urls = urls;
    pushLog(fresh, 'link', reason, entry);

    try {
      await chrome.storage.local.set({ [SESSION_KEY]: fresh });
    } catch (err) {
      console.error('[AZM] تعذّر حفظ الرابط', err);
      $('#justifyError').textContent = 'تعذّر حفظ الرابط. حاول مرة أخرى.';
      $('#justifyError').hidden = false;
      return;
    }
    // replace: حتى لا يعود زر الرجوع إلى صفحة التدخّل
    location.replace(blocked.href);
  }

  async function submitJustification() {
    const reason = $('#reason').value.trim();
    if (cooldownLeft > 0 || reason.length < E.MIN_REASON_CHARS || !blocked) return;

    // نقرأ الجلسة من جديد: قد تكون انتهت أو تغيّرت أثناء الكتابة
    const fresh = await getSession();
    if (!isActiveSession(fresh)) {
      session = fresh;
      renderEnded();
      return;
    }

    // The backend owns the decision; evaluator.js is only an offline fallback.
    try {
      const challengeId = params.get('challengeId');
      if (challengeId) {
        const remote = await AzmApi.justify({ id: challengeId, text: reason, lang: 'ar' });
        if (remote.status === 'granted') {
          showFeedback(remote.message || 'تم قبول التبرير مؤقتًا.', 'ok');
          location.replace(blocked.href);
          return;
        }
        if (['asking', 'denied', 'timeout'].includes(remote.status)) {
          showFeedback(remote.message || 'لم يُقبل التبرير.', remote.status === 'asking' ? 'warn' : 'danger');
          startCooldown();
          updateConfirmState();
          return;
        }
      }
    } catch (err) {
      console.warn('[AZM] Backend justification unavailable; using offline evaluator', err);
    }
    const linkEval = E.evaluateLinkAgainstSession(blocked.href, fresh);
    const result = E.evaluateJustification({ text: reason, session: fresh, linkEval, now: Date.now() });

    switch (result.decision) {
      case 'add':
        await addLinkAndGo(fresh, reason);
        return;

      case 'break':
        // نعرض رسالة الاستراحة ونطلب تأكيدًا صريحًا قبل بدئها
        pendingBreak = { reason };
        showFeedback(result.message, 'ok');
        $('#reason').disabled = true;
        $('#justifyActions').hidden = true;
        $('#breakOffer').hidden = false;
        stopCooldown();
        $('#btnStartBreak').focus();
        return;

      case 'encourage':
        showFeedback(result.message, 'warn');
        break;

      default: // reject
        showFeedback(result.message, 'danger');
    }

    // كل محاولة غير مقبولة تعيد مهلة التفكير، حتى لا يتحول التبرير إلى تجريب عشوائي
    startCooldown();
    updateConfirmState();
    $('#reason').focus();
  }

  async function startBreak() {
    if (!pendingBreak || !blocked) return;

    const fresh = await getSession();
    if (!isActiveSession(fresh)) {
      session = fresh;
      renderEnded();
      return;
    }

    const now = Date.now();
    const eligibility = E.breakEligibility(fresh, now);
    if (!eligibility.ok) {
      showFeedback('تغيّرت حالة الجلسة ولم تعد الاستراحة متاحة الآن. عُد إلى مهمتك.', 'warn');
      $('#breakOffer').hidden = true;
      return;
    }

    const until = Math.min(now + E.BREAK_MINUTES * 60000, fresh.endTimestamp);
    fresh.breakUntil = until;
    fresh.lastBreakEndAt = until;
    fresh.breaksTaken = (Number(fresh.breaksTaken) || 0) + 1;
    pushLog(fresh, 'break', pendingBreak.reason, blocked.origin);

    try {
      await chrome.storage.local.set({ [SESSION_KEY]: fresh });
      // منبّه ينبّه الخلفية عند انتهاء الاستراحة لإعادة فحص التبويب النشط
      await chrome.alarms.create(BREAK_ALARM, { when: until + 1000 });
    } catch (err) {
      console.error('[AZM] تعذّر بدء الاستراحة', err);
    }
    // لا يُضاف الرابط إلى موارد الجلسة: الاستراحة مؤقتة فقط
    location.replace(blocked.href);
  }

  /* ---------- التشغيل ---------- */
  async function init() {
    $('#btnBack').addEventListener('click', goBackToSession);
    $('#btnBreakBack').addEventListener('click', goBackToSession);
    $('#btnJustify').addEventListener('click', openJustify);
    $('#btnCancel').addEventListener('click', closeJustify);
    $('#btnConfirm').addEventListener('click', submitJustification);
    $('#btnStartBreak').addEventListener('click', startBreak);
    $('#reason').addEventListener('input', () => { $('#justifyError').hidden = true; updateConfirmState(); });
    $('#btnContinue').addEventListener('click', () => { if (blocked) location.replace(blocked.href); });
    $('#btnDashboard').addEventListener('click', () => location.replace('dashboard.html?mode=tab'));

    session = await getSession();
    if (isActiveSession(session)) {
      renderActive();
      timerId = setInterval(tick, 1000);
    } else {
      renderEnded();
    }

    // إن أُنهيت الجلسة من مكان آخر تتحدّث الصفحة فورًا
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[SESSION_KEY]) return;
      session = changes[SESSION_KEY].newValue ?? null;
      if (isActiveSession(session)) {
        renderVerdict();
        if (!timerId) timerId = setInterval(tick, 1000);
      } else {
        renderEnded();
      }
    });
  }

  init().catch((err) => console.error('[AZM] فشل تشغيل صفحة التدخّل', err));
})();
