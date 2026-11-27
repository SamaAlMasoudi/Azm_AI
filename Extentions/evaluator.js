/* عزم - AZM AI | evaluator.js
 *
 * منطق محلي بالكامل (بدون شبكة أو مفاتيح) يُستخدم في ثلاثة أماكن:
 *   - dashboard.js  : عند إضافة رابط أثناء الجلسة
 *   - background.js : عند تصفّح تبويب خارج session.urls   (عبر importScripts)
 *   - intercept.js  : عند تقييم تبرير المستخدم
 *
 * يُصدّر كائنًا عامًا AzmEval (window / service worker / Node للاختبار).
 */
(function (root) {
  'use strict';

  /* ============================================================
   * 1) التطبيع والتقطيع
   * ============================================================ */
  const DIACRITICS = /[ً-ٰٟـ]/g;

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(DIACRITICS, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ئ/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ة/g, 'ه')
      .replace(/c\+\+/g, 'cpp')
      .replace(/c#/g, 'csharp')
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  }

  const rawTokens = (text) => normalize(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const isLatin = (w) => /^[a-z0-9]+$/.test(w);

  /** تجذير خفيف (عربي + إنجليزي) كافٍ للمطابقة دون مكتبات لغوية. */
  function stem(word) {
    let w = word;
    if (isLatin(w)) {
      if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
      return w;
    }
    w = w.replace(/^(وال|بال|كال|فال|لل|ال)/, '');
    if (w.length > 5) w = w.replace(/(ات|ون|ين|ان)$/, '');
    if (w.length > 3) w = w.replace(/(ها|ه|ي)$/, '');
    return w;
  }

  /** مطابقة رمزين (بعد التجذير). البادئة مسموحة للكلمات اللاتينية الطويلة فقط (databases ≈ database). */
  function matchTok(a, b) {
    if (a === b) return true;
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    return isLatin(short) && short.length >= 6 && long.startsWith(short) && long.length - short.length <= 3;
  }

  const toSet = (str) => {
    const s = new Set();
    for (const w of str.split(/\s+/).filter(Boolean)) {
      const n = normalize(w);
      s.add(n);
      s.add(stem(n));
    }
    return s;
  };

  /* ============================================================
   * 2) كلمات الإيقاف والكلمات العامة
   * ============================================================ */
  const STOP = toSet(`
    في من الى إلى على عن مع هذا هذه هذي ذلك تلك هو هي هم هن انا أنا انت أنت نحن ان أن إن انه إنه انها إنها
    كان كانت يكون تكون ما ماذا لماذا كيف متى اين أين لا لم لن قد او أو ثم بل حتى كل بعض غير عند عندي لدي
    ايضا أيضا فقط جدا جداً هل لكن لكني اي أي الذي التي الذين هناك هنا بعد قبل بين حول خلال اجل أجل بدون
    ضد مثل اذا إذا لو يا ابي ابغى ابغا اريد أريد ابا بس شي شيء كذا ليش وش ايش علشان عشان لان لأن لانه لأنه
    لانني لأنني لاني لأني نفسي احتاج أحتاج محتاج بدي ابغي يبغى لازم ضروري مهم الان الآن حاليا اليوم الي اللي
    ان انني اني معي لي لك له لها منه منها فيه فيها به بها وانا
    the an is are was were to of and or in on for with my me this that it be as at by from how what why
    about want need im can could would should will just so but if not no do does did have has had you your we
    our they them he she his her its
  `);

  /** كلمات دراسية عامة: لا تُعدّ دليلًا على موضوع محدد. */
  const GENERIC_STUDY = toSet(`
    مراجعة فصل فصول حل مسألة مسائل تمارين تمرين درس دروس دراسة اختبار امتحان نهائي مشروع تخرج بحث تعلم
    مسار محاضرة محاضرات واجب تسليم نتيجة انهاء إنهاء انجاز إنجاز كتابة قراءة تلخيص ملخص شرح
    study exam final project chapter review solve problem problems lesson learn learning course lecture
    lectures assignment summary homework coursera udemy complete finish write read section unit week part
    tutorial tutorials intro introduction basics
  `);

  /** كلمات شائعة في الروابط لا تحمل معنى موضوعيًا. */
  const GENERIC_URL = toSet(`
    wiki www com net org html htm php asp aspx jsp index page main home search watch learn courses docs doc
    en ar article articles post posts blog view id app url results w https http amp utm ref share list
    playlist channel user users profile login signin signup auth oauth accounts new chat chats conversation recents
  `);

  /* ============================================================
   * 3) خريطة المواضيع
   * ============================================================ */
  const SUBJECT_DEFS = [
    { id: 'databases', name: 'قواعد البيانات', related: [], kw: [
      'قاعدة بيانات', 'قواعد بيانات', 'قواعد البيانات', 'قاعدة البيانات', 'database', 'databases', 'sql', 'mysql',
      'postgres', 'postgresql', 'sqlite', 'nosql', 'mongodb', 'mariadb', 'dbms', 'oracle', 'relational', 'علائقية',
      'استعلام', 'استعلامات', 'query', 'queries', 'normalization', 'تطبيع', 'erd', 'primary key', 'foreign key',
      'مفتاح اساسي', 'مفتاح اجنبي', 'join', 'joins', 'redis'] },
    { id: 'data_structures', name: 'هياكل البيانات والخوارزميات', related: [], kw: [
      'هياكل بيانات', 'هياكل البيانات', 'هيكل بيانات', 'data structure', 'data structures', 'datastructures',
      'linked list', 'linkedlist', 'قائمة مرتبطة', 'stack', 'queue', 'tree', 'شجرة', 'heap', 'hashtable', 'hash table',
      'algorithm', 'algorithms', 'خوارزمية', 'خوارزميات', 'sorting', 'binary search', 'recursion', 'dynamic programming',
      'bst', 'graph'] },
    { id: 'programming', name: 'البرمجة', related: ['web', 'ai_ml', 'os'], kw: [
      'برمجة', 'البرمجة', 'برمجيات', 'python', 'بايثون', 'javascript', 'جافاسكربت', 'جافا', 'java', 'cpp', 'csharp',
      'golang', 'rust', 'typescript', 'kotlin', 'swift', 'php', 'code', 'coding', 'كود', 'oop', 'programming',
      'compiler', 'ruby'] },
    { id: 'web', name: 'تطوير الويب', related: ['programming'], kw: [
      'html', 'css', 'react', 'vue', 'angular', 'frontend', 'backend', 'nodejs', 'bootstrap', 'tailwind', 'webdev',
      'django', 'laravel', 'تطوير ويب', 'تطوير مواقع', 'web development'] },
    { id: 'math', name: 'الرياضيات', related: ['statistics', 'physics', 'ai_ml'], kw: [
      'رياضيات', 'math', 'maths', 'mathematics', 'calculus', 'تفاضل', 'تكامل', 'جبر', 'algebra', 'هندسة', 'geometry',
      'trigonometry', 'مثلثات', 'معادلة', 'معادلات', 'equation', 'equations', 'linear algebra', 'مصفوفات', 'matrix',
      'derivative', 'integral', 'مشتقة'] },
    { id: 'statistics', name: 'الإحصاء', related: ['math', 'ai_ml'], kw: [
      'احصاء', 'إحصاء', 'statistics', 'probability', 'احتمالات', 'احتمال', 'regression', 'انحدار', 'hypothesis', 'spss'] },
    { id: 'physics', name: 'الفيزياء', related: ['math'], kw: [
      'فيزياء', 'physics', 'كهرباء', 'ميكانيكا', 'mechanics', 'thermodynamics', 'quantum', 'نيوتن', 'magnetism',
      'optics', 'بصريات', 'kinematics'] },
    { id: 'chemistry', name: 'الكيمياء', related: ['biology'], kw: [
      'كيمياء', 'chemistry', 'organic', 'عضوية', 'molecule', 'جزيء', 'periodic table', 'الجدول الدوري', 'stoichiometry'] },
    { id: 'biology', name: 'الأحياء', related: ['chemistry', 'medicine'], kw: [
      'احياء', 'أحياء', 'biology', 'خلية', 'cell', 'genetics', 'وراثة', 'dna', 'anatomy', 'تشريح', 'ecology', 'microbiology'] },
    { id: 'medicine', name: 'الطب', related: ['biology'], kw: [
      'طب', 'medicine', 'medical', 'pharmacology', 'صيدلة', 'pathology', 'physiology', 'فسيولوجي', 'nursing', 'تمريض'] },
    { id: 'history', name: 'التاريخ', related: [], kw: ['تاريخ', 'history', 'حضارة', 'civilization'] },
    { id: 'languages', name: 'اللغات والأدب', related: [], kw: [
      'انجليزي', 'انجليزية', 'english', 'grammar', 'قواعد اللغة', 'vocabulary', 'مفردات', 'ielts', 'toefl', 'نحو',
      'بلاغة', 'أدب', 'literature', 'لغة', 'french', 'فرنسي'] },
    { id: 'networks', name: 'الشبكات', related: ['os'], kw: [
      'شبكات', 'network', 'networks', 'networking', 'tcp', 'ip', 'dns', 'routing', 'osi', 'cisco', 'ccna', 'subnet'] },
    { id: 'os', name: 'أنظمة التشغيل', related: ['programming', 'networks'], kw: [
      'نظم تشغيل', 'نظام تشغيل', 'operating system', 'linux', 'kernel', 'scheduling', 'deadlock', 'semaphore'] },
    { id: 'ai_ml', name: 'الذكاء الاصطناعي', related: ['programming', 'math', 'statistics'], kw: [
      'ذكاء اصطناعي', 'الذكاء الاصطناعي', 'machine learning', 'تعلم الة', 'تعلم الي', 'التعلم الالي', 'deep learning',
      'neural', 'شبكات عصبية', 'tensorflow', 'pytorch', 'nlp', 'ai'] },
    { id: 'economics', name: 'الاقتصاد والإدارة', related: [], kw: [
      'اقتصاد', 'economics', 'محاسبة', 'accounting', 'تسويق', 'marketing', 'ادارة', 'management', 'finance', 'تمويل'] },
    { id: 'law', name: 'القانون', related: [], kw: ['قانون', 'law', 'legal', 'حقوق', 'شريعة', 'فقه'] },
    { id: 'electronics', name: 'الإلكترونيات', related: ['physics'], kw: ['دوائر', 'circuits', 'electronics', 'الكترونيات'] },

    // مواضيع ترفيهية: تُعامل كتشتيت ما لم يكن موضوع الجلسة نفسه
    { id: 'entertainment', name: 'الترفيه', distraction: true, related: [], kw: [
      'مسلسل', 'مسلسلات', 'فيلم', 'افلام', 'movie', 'movies', 'netflix', 'اغنية', 'اغاني', 'song', 'songs', 'music',
      'موسيقى', 'كورة', 'كرة القدم', 'football', 'soccer', 'messi', 'ميسي', 'ronaldo', 'رونالدو', 'مباراة', 'مباريات',
      'celebrity', 'مشاهير', 'meme', 'memes', 'ميمز', 'funny', 'مضحك', 'prank', 'مقالب', 'anime', 'انمي', 'كرتون',
      'cartoon', 'vlog', 'فلوق'] },
    { id: 'gaming', name: 'الألعاب', distraction: true, related: [], kw: [
      'العاب', 'لعبة', 'game', 'games', 'gaming', 'gameplay', 'minecraft', 'fortnite', 'pubg', 'gta', 'fifa', 'roblox',
      'playstation', 'xbox', 'steam', 'valorant', 'warzone'] }
  ];

  const SUBJECTS = SUBJECT_DEFS.map((s) => {
    const singles = [];
    const phrases = [];
    for (const k of s.kw) {
      const words = normalize(k).split(/\s+/).filter(Boolean).map(stem);
      if (words.length === 1) singles.push(words[0]);
      else phrases.push(` ${words.join(' ')} `);
    }
    return { ...s, singles, phrases };
  });
  const SUBJECT_BY_ID = new Map(SUBJECTS.map((s) => [s.id, s]));

  /** يُرجع مصفوفة {id, name, distraction, matched} للمواضيع الظاهرة في الرموز. */
  function detectSubjects(tokens) {
    const stems = tokens.map(stem);
    const joined = ` ${stems.join(' ')} `;
    const found = [];
    for (const s of SUBJECTS) {
      const matched = [];
      for (const kw of s.singles) if (stems.some((t) => matchTok(t, kw))) matched.push(kw);
      for (const ph of s.phrases) if (joined.includes(ph)) matched.push(ph.trim());
      if (matched.length) found.push({ id: s.id, name: s.name, distraction: Boolean(s.distraction), matched });
    }
    return found;
  }

  function relatedSubjectIds(ids) {
    const out = new Set(ids);
    for (const id of ids) (SUBJECT_BY_ID.get(id)?.related || []).forEach((r) => out.add(r));
    return out;
  }

  /* ============================================================
   * 4) تصنيف النطاقات
   * ============================================================ */
  const DOMAIN_RULES = [
    { cat: 'distraction', type: 'social', hosts: ['facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com',
      'tiktok.com', 'snapchat.com', 'reddit.com', 'threads.net', 'pinterest.com', 'tumblr.com', '9gag.com'] },
    { cat: 'distraction', type: 'entertainment', hosts: ['netflix.com', 'shahid.net', 'shahid.mbc.net', 'disneyplus.com',
      'primevideo.com', 'twitch.tv', 'imdb.com', 'spotify.com', 'anghami.com', 'soundcloud.com', 'dailymotion.com',
      'music.youtube.com', 'cimaclub.com', 'egybest.com'] },
    { cat: 'distraction', type: 'gaming', hosts: ['steampowered.com', 'steamcommunity.com', 'epicgames.com', 'roblox.com',
      'miniclip.com', 'poki.com', 'y8.com', 'crazygames.com', 'ea.com', 'playstation.com', 'xbox.com', 'minecraft.net'] },
    { cat: 'distraction', type: 'shopping', hosts: ['aliexpress.com', 'noon.com', 'temu.com', 'shein.com', 'ebay.com'] },

    { cat: 'learning', hosts: ['coursera.org', 'edx.org', 'khanacademy.org', 'udemy.com', 'udacity.com', 'futurelearn.com',
      'edraak.org', 'rwaq.org', 'almentor.net', 'ocw.mit.edu', 'brilliant.org', 'codecademy.com', 'freecodecamp.org',
      'w3schools.com', 'tutorialspoint.com', 'geeksforgeeks.org', 'javatpoint.com', 'sololearn.com', 'hackerrank.com',
      'datacamp.com', 'pluralsight.com', 'classroom.google.com'] },
    { cat: 'learning', hosts: ['sqlzoo.net', 'sqlbolt.com'], hint: ['databases'] },
    { cat: 'learning', hosts: ['leetcode.com'], hint: ['data_structures', 'programming'] },

    { cat: 'reference', hosts: ['wikipedia.org', 'wikibooks.org', 'britannica.com', 'scholar.google.com', 'arxiv.org',
      'researchgate.net', 'jstor.org', 'ncbi.nlm.nih.gov', 'pubmed.gov', 'stackoverflow.com', 'stackexchange.com',
      'developer.mozilla.org', 'github.com', 'gitlab.com', 'learn.microsoft.com', 'almaany.com', 'wolframalpha.com',
      'desmos.com', 'geogebra.org', 'react.dev', 'nodejs.org'] },
    { cat: 'reference', hosts: ['postgresql.org', 'mysql.com', 'mongodb.com', 'sqlite.org'], hint: ['databases'] },
    { cat: 'reference', hosts: ['python.org', 'docs.python.org'], hint: ['programming'] },

    { cat: 'tool', hosts: ['chatgpt.com', 'openai.com', 'auth.openai.com', 'claude.ai', 'gemini.google.com',
      'perplexity.ai', 'copilot.microsoft.com', 'google.com', 'bing.com', 'duckduckgo.com', 'translate.google.com',
      'docs.google.com', 'drive.google.com', 'accounts.google.com'] },

    { cat: 'video', hosts: ['youtube.com', 'youtu.be'] }
  ];

  // أطول مضيف أولًا ليتقدّم scholar.google.com على google.com
  const DOMAIN_INDEX = DOMAIN_RULES
    .flatMap((r) => r.hosts.map((h) => ({ host: h, rule: r })))
    .sort((a, b) => b.host.length - a.host.length);

  const normalizeHost = (h) => String(h || '').replace(/^www\./, '').toLowerCase();

  function lookupDomain(host) {
    for (const { host: h, rule } of DOMAIN_INDEX) {
      if (host === h || host.endsWith(`.${h}`)) return { cat: rule.cat, type: rule.type || null, hint: rule.hint || [] };
    }
    if (/(^|\.)amazon\./.test(host)) return { cat: 'distraction', type: 'shopping', hint: [] };
    if (/\.edu(\.[a-z]{2})?$/.test(host) || /\.ac\.[a-z]{2}$/.test(host)) return { cat: 'learning', type: null, hint: [] };
    if (/^(docs|developer|developers|learn)\./.test(host)) return { cat: 'reference', type: null, hint: [] };
    return { cat: 'unknown', type: null, hint: [] };
  }

  const TYPE_AR = { social: 'تواصل اجتماعي', entertainment: 'ترفيه', gaming: 'ألعاب', shopping: 'تسوّق' };

  const BRAND_ALIASES = {
    facebook: ['facebook', 'فيسبوك'], instagram: ['instagram', 'انستغرام', 'انستقرام'], youtube: ['youtube', 'يوتيوب'],
    twitter: ['twitter', 'تويتر'], x: [], tiktok: ['tiktok', 'تيك'], snapchat: ['snapchat', 'سناب'], reddit: ['reddit', 'ريديت'],
    netflix: ['netflix', 'نتفلكس']
  };

  /* ============================================================
   * 5) تحليل الجلسة والرابط
   * ============================================================ */
  function analyzeSession(session) {
    const text = [session.goal, session.task, session.outcome].filter(Boolean).join(' ');
    const toks = rawTokens(text);
    const content = toks.filter((t) => t.length >= 2 && !STOP.has(t) && !STOP.has(stem(t)));
    const allStems = [...new Set(content.map(stem))];
    const keywords = allStems.filter((s) => !GENERIC_STUDY.has(s));
    const subjects = detectSubjects(toks);
    const ids = subjects.map((s) => s.id);
    return {
      tokens: toks,
      allStems,
      keywords,
      subjects,
      subjectIds: new Set(ids),
      relatedIds: relatedSubjectIds(ids.filter((id) => !SUBJECT_BY_ID.get(id).distraction))
    };
  }

  const QUERY_KEYS = new Set(['q', 'query', 'search_query', 's', 'text', 'p', 'k', 'term', 'terms', 'keyword', 'keywords', 'search', 'wd', 'w']);
  const TLD_LIKE = new Set(['www', 'com', 'net', 'org', 'edu', 'gov', 'io', 'co', 'ac', 'info', 'app', 'dev', 'me', 'tv', 'ai', 'sa', 'ae', 'eg', 'uk']);

  const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
  const looksLikeId = (t) => /^\d+$/.test(t) || (t.length >= 10 && /\d/.test(t) && /[a-z]/.test(t));

  function analyzeUrl(url, dom) {
    const host = normalizeHost(url.hostname);
    const items = []; // { t, src }

    host.split('.').slice(0, -1).filter((l) => !TLD_LIKE.has(l))
      .forEach((l) => rawTokens(l.replace(/-/g, ' ')).forEach((t) => items.push({ t, src: 'host' })));

    url.pathname.split('/').map(safeDecode)
      .forEach((seg) => rawTokens(seg).forEach((t) => { if (!looksLikeId(t)) items.push({ t, src: 'path' }); }));

    for (const [k, v] of url.searchParams) {
      if (QUERY_KEYS.has(k.toLowerCase())) rawTokens(v).forEach((t) => items.push({ t, src: 'query' }));
    }

    const signal = items.filter(({ t }) => t.length >= 2 && !STOP.has(t) && !STOP.has(stem(t)) && !GENERIC_URL.has(t) && !GENERIC_URL.has(stem(t)));

    // مواضيع الرابط مع مصدر الدليل
    const subjMap = new Map();
    const addSubj = (s, src) => {
      const cur = subjMap.get(s.id) || { ...s, srcs: new Set() };
      cur.srcs.add(src);
      subjMap.set(s.id, cur);
    };
    for (const src of ['host', 'path', 'query']) {
      detectSubjects(signal.filter((i) => i.src === src).map((i) => i.t)).forEach((s) => addSubj(s, src));
    }
    // أدلة عبر الرموز المجمّعة (عبارات متعددة الكلمات)
    detectSubjects(signal.map((i) => i.t)).forEach((s) => { if (!subjMap.has(s.id)) addSubj(s, 'path'); });
    for (const id of dom.hint) {
      const def = SUBJECT_BY_ID.get(id);
      if (def) addSubj({ id, name: def.name, distraction: false, matched: ['domain'] }, 'host');
    }
    return { host, items, signal, subjects: [...subjMap.values()] };
  }

  const trimPath = (p) => p.replace(/\/+$/, '');
  const entryFor = (url) => url.origin + trimPath(url.pathname);

  /* ============================================================
   * 6) تقييم الرابط مقابل الجلسة
   * ============================================================ */
  function parseWeb(raw) {
    try {
      const u = new URL(raw);
      return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
    } catch {
      return null;
    }
  }

  const names = (list) => list.map((s) => s.name).join('، ');

  function reasonText(code, c) {
    switch (code) {
      case 'distraction_domain': return `الموقع ${c.host} مصنّف كموقع ${TYPE_AR[c.type] || 'ترفيه'} ولا علاقة له بهدف جلستك.`;
      case 'distraction_topic': return `محتوى الرابط يتعلق بـ(${c.urlNames}) وليس بهدف جلستك.`;
      case 'subject_conflict': return `الرابط يخص مادة مختلفة (${c.urlNames}) بينما جلستك عن (${c.sessNames}).`;
      case 'aligned_keywords': return `الرابط يتوافق مع هدفك: يتضمن «${c.matched}».`;
      case 'aligned_subject': return `الرابط متعلق بمجال جلستك (${c.urlNames}).`;
      case 'trusted_tool': return 'أداة مساعدة معتمدة للدراسة.';
      case 'trusted_platform': return 'منصة تعليمية أو مرجعية معروفة، ولا يظهر في الرابط ما يتعارض مع هدفك.';
      case 'goal_mentions_site': return 'هدفك يذكر هذا الموقع صراحةً.';
      case 'video_unverified': return 'رابط فيديو: لا يظهر منه ما يثبت صلته بهدفك أو مهمتك.';
      case 'unknown_domain': return 'موقع غير معروف ولا يظهر في رابطه ما يربطه بهدفك أو مهمتك.';
      case 'no_signal_match': return 'الرابط يحتوي كلمات لا تظهر أي صلة بهدفك أو مهمتك.';
      default: return '';
    }
  }

  /**
   * يقيّم رابطًا مقابل هدف/مهمة/نتيجة الجلسة (محليًا).
   * @returns {{verdict:'allow'|'block'|'uncertain', reasonCode:string, reason:string, category:string,
   *            host:string, persist:boolean, entry:string, matched:string[]}}
   */
  function evaluateLinkAgainstSession(urlString, session) {
    const url = parseWeb(urlString);
    const base = { category: 'unknown', host: '', persist: false, entry: '', matched: [] };
    if (!url) return { ...base, verdict: 'allow', reasonCode: 'not_web', reason: '' };

    session = session || {};
    const host = normalizeHost(url.hostname);
    const dom = lookupDomain(host);
    const sess = analyzeSession(session);
    const sig = analyzeUrl(url, dom);
    const out = (verdict, reasonCode, extra = {}) => ({
      ...base, host, category: dom.cat, verdict, reasonCode,
      reason: reasonText(reasonCode, { host, type: dom.type, ...extra.ctx }),
      persist: Boolean(extra.persist), entry: extra.persist ? (extra.entry || entryFor(url)) : '', matched: extra.matched || []
    });

    const brand = host.split('.').slice(-2, -1)[0] || host;
    const mentionsBrand = (BRAND_ALIASES[brand] || [brand]).some((alias) => alias && sess.tokens.includes(normalize(alias)));

    // 1) نطاق مشتّت صريح
    if (dom.cat === 'distraction') {
      if (mentionsBrand) return out('allow', 'goal_mentions_site', { persist: true });
      return out('block', 'distraction_domain');
    }

    // 2) موضوع ترفيهي داخل الرابط (بحث عن مباراة، لعبة...)
    const urlDistraction = sig.subjects.filter((s) => s.distraction && !sess.subjectIds.has(s.id));
    if (urlDistraction.length) return out('block', 'distraction_topic', { ctx: { urlNames: names(urlDistraction) } });

    // 3) تطابق مع الجلسة
    const urlTopics = sig.subjects.filter((s) => !s.distraction);
    const kwMatches = [];
    for (const it of sig.signal) {
      const st = stem(it.t);
      const hit = sess.keywords.find((k) => matchTok(st, k));
      if (hit) kwMatches.push({ kw: it.t, src: it.src });
    }
    const subjMatches = urlTopics.filter((s) => sess.relatedIds.has(s.id));
    const aligned = kwMatches.length > 0 || subjMatches.length > 0;

    if (aligned) {
      const evidenceSrcs = new Set([...kwMatches.map((m) => m.src), ...subjMatches.flatMap((s) => [...s.srcs])]);
      const persist = evidenceSrcs.has('host') || evidenceSrcs.has('path');
      const matched = [...new Set([...kwMatches.map((m) => m.kw), ...subjMatches.map((s) => s.name)])];
      return kwMatches.length
        ? out('allow', 'aligned_keywords', { persist, matched, ctx: { matched: kwMatches[0].kw } })
        : out('allow', 'aligned_subject', { persist, matched, ctx: { urlNames: names(subjMatches) } });
    }

    // 4) تعارض مادة
    const sessTopics = sess.subjects.filter((s) => !s.distraction);
    if (urlTopics.length && sessTopics.length) {
      return out('block', 'subject_conflict', { ctx: { urlNames: names(urlTopics), sessNames: names(sessTopics) } });
    }

    // 5) لا دليل إيجابي ولا تعارض: القرار حسب نوع النطاق
    const hasSignal = sig.signal.some((i) => i.src !== 'host'); // اسم النطاق نفسه ليس إشارة
    if (dom.cat === 'tool') {
      return hasSignal ? out('uncertain', 'no_signal_match') : out('allow', 'trusted_tool', { persist: true, entry: url.origin });
    }
    if (dom.cat === 'learning' || dom.cat === 'reference') {
      // نتحقق أن الإشارات ليست مجرد اسم النطاق نفسه
      const pathOrQuery = sig.signal.filter((i) => i.src !== 'host');
      return pathOrQuery.length ? out('uncertain', 'no_signal_match') : out('allow', 'trusted_platform', { persist: true });
    }
    if (dom.cat === 'video') {
      return mentionsBrand ? out('allow', 'goal_mentions_site', { persist: false }) : out('uncertain', 'video_unverified');
    }
    return out('uncertain', 'unknown_domain');
  }

  /* ============================================================
   * 7) الوقت والاستراحة
   * ============================================================ */
  const MIN_REASON_CHARS = 8;
  const COOLDOWN_SECONDS = 8;
  const BREAK_MINUTES = 5;

  function timeStats(session, now = Date.now()) {
    const startedAt = Number(session.startedAt) || now;
    const end = Number(session.endTimestamp) || now;
    const durationMinutes = Math.max(1, Number(session.durationMinutes) || Math.round((end - startedAt) / 60000) || 1);
    return {
      elapsedMinutes: Math.max(0, Math.floor((now - startedAt) / 60000)),
      remainingMinutes: Math.max(0, Math.ceil((end - now) / 60000)),
      durationMinutes
    };
  }

  const PERSONA_CFG = {
    supportive: { minWords: 2, minMeaningful: 1, connectorForUncertain: false, minSince: 15 },
    strict: { minWords: 5, minMeaningful: 2, connectorForUncertain: true, minSince: 20 },
    philosopher: { minWords: 4, minMeaningful: 2, connectorForUncertain: true, minSince: 20 }
  };
  const personaOf = (session) => (PERSONA_CFG[session.persona] ? session.persona : 'supportive');

  /**
   * هل يحق للطالب استراحة قصيرة الآن؟
   * القاعدة: مرّ ≥ 15 د (20 د مع الصارم/الفيلسوف) منذ بداية الجلسة أو آخر استراحة،
   * و(≥ 20 د أو ≥ 50% من مدة الجلسة)، وبقي أكثر من 5 دقائق على نهايتها.
   */
  function breakEligibility(session, now = Date.now()) {
    if (session.breakUntil && now < session.breakUntil) return { ok: false, code: 'break_active', waitMinutes: 0 };
    const cfg = PERSONA_CFG[personaOf(session)];
    const ts = timeStats(session, now);
    const lastMark = Number(session.lastBreakEndAt) || Number(session.startedAt) || now;
    const since = Math.max(0, Math.floor((now - lastMark) / 60000));
    const halfDuration = Math.ceil(ts.durationMinutes * 0.5);

    const okNow = since >= cfg.minSince && (since >= 20 || ts.elapsedMinutes >= halfDuration);
    if (ts.remainingMinutes <= BREAK_MINUTES) return { ok: false, code: 'near_end', waitMinutes: 0, since };
    if (okNow) return { ok: true, code: 'ok', waitMinutes: 0, since };

    const d1 = Math.max(0, cfg.minSince - since);
    const d2 = Math.min(Math.max(0, 20 - since), Math.max(0, halfDuration - ts.elapsedMinutes));
    const wait = Math.max(d1, d2, 1);
    if (wait >= ts.remainingMinutes - BREAK_MINUTES) return { ok: false, code: 'near_end', waitMinutes: wait, since };
    return { ok: false, code: 'too_early', waitMinutes: wait, since };
  }

  /* ============================================================
   * 8) تحليل نص التبرير
   * ============================================================ */
  const FATIGUE = toSet(`
    زهق زهقت زهقان زهقنا تعب تعبت تعبان تعبانة متعب مرهق مرهقة ارهاق إرهاق ارهقت استراحة استراحه استريح ارتاح
    أرتاح ارتاحة راحة بريك break tired bored boring ملل مليت ممل طفشت طفشان اجهاد إجهاد مجهد انهكت منهك
  `);

  const ENTERTAINMENT_WORDS = toSet(`
    اتفرج تفرج فرجة العب لعب العاب ألعاب اتسلى تسلية تسلى ترفيه فيلم افلام أفلام مسلسل مسلسلات اغاني أغاني
    موسيقى ميمز نكت ضحك مضحك سوشيال تيك تويتر انستا انستغرام فيسبوك سناب مباراة مباريات
    movie movies game games funny meme memes entertainment
  `);

  const FILLER = toSet('ضروري مهم شي شيء بس فقط عادي كذا اشوف شوي دقيقة لحظة ممكن طيب اوكي ok please plz pls just only maybe رابط الرابط موقع الموقع');

  const EVASIVE = [
    'بدون سبب', 'ما في سبب', 'مافي سبب', 'لا شي', 'لا شيء', 'عادي', 'بس كذا', 'مجرد فضول', 'فضول', 'ما ادري', 'مدري',
    'لا اعرف', 'no reason', 'idk', 'nothing', 'just because', 'just want', 'just checking', 'بس اشوف', 'بس ابغى اشوف',
    'ابي اشوف بس', 'دقيقة وارجع', 'لحظة وارجع'
  ].map(normalize);

  const CONNECTOR_TOKENS = new Set(['حتي', 'لكي', 'كي', 'بسبب', 'عشان', 'علشان', 'لاجل', 'because']);
  const CONNECTOR_PREFIX = /^(لان|لفهم|لحل|لمراجع|لاكمل|لتلخيص|لاتمام|لانجاز|لتعلم|لاتعلم|لاكتب|لاراجع|لافهم|لفحص)/;

  function detectFatigue(tokens) {
    return tokens.some((t) => FATIGUE.has(t) || FATIGUE.has(stem(t)));
  }

  const hasEntertainmentIntent = (tokens) => tokens.some((t) => ENTERTAINMENT_WORDS.has(t) || ENTERTAINMENT_WORDS.has(stem(t)));

  const hasConnector = (norm, tokens) =>
    tokens.some((t) => CONNECTOR_TOKENS.has(t) || CONNECTOR_PREFIX.test(t)) || norm.includes('من اجل') || norm.includes('so that');

  const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'ضصثقفغعهخحجد', 'شسيبلاتنمكط', 'ئءؤرلاىةوزظ'].map(normalize);

  /** نص عشوائي: تكرار حروف، ضرب لوحة مفاتيح، لاتيني بلا حروف علة... */
  function isGibberish(raw) {
    const letters = normalize(raw).replace(/[^\p{L}]/gu, '');
    if (letters.length < 4) return true;
    if (/(.)\1{3,}/u.test(letters)) return true;
    if (letters.length >= 8 && new Set(letters).size / letters.length < 0.3) return true;
    if (letters.length >= 6 && /^(.{2,4})\1+$/u.test(letters)) return true;
    for (const row of KEYBOARD_ROWS) {
      for (let i = 0; i + 5 <= row.length; i++) {
        const seg = row.slice(i, i + 5);
        if (letters.includes(seg) || letters.includes([...seg].reverse().join(''))) return true;
      }
    }
    if (/^[a-z]+$/.test(letters) && letters.length >= 6 && !/[aeiou]/.test(letters)) return true;
    const words = rawTokens(raw);
    if (words.length >= 3 && new Set(words).size === 1) return true;
    return false;
  }

  function isVague(norm, tokens, cfg) {
    if (EVASIVE.some((p) => norm.includes(p))) return true;
    const meaningful = tokens.filter((t) => t.length >= 3 && !STOP.has(t) && !STOP.has(stem(t)) && !FILLER.has(t) && !FILLER.has(stem(t)));
    return meaningful.length < cfg.minMeaningful;
  }

  function computeTies(tokens, sess) {
    const pool = sess.keywords.length ? sess.keywords : sess.allStems;
    const ties = new Set();
    for (const t of tokens) {
      if (STOP.has(t) || STOP.has(stem(t))) continue;
      const st = stem(t);
      if (pool.some((k) => matchTok(st, k))) ties.add(st);
    }
    for (const s of detectSubjects(tokens)) if (!s.distraction && sess.relatedIds.has(s.id)) ties.add(`subject:${s.id}`);
    return [...ties];
  }

  /* ============================================================
   * 9) الرسائل (حسب الشخصية)
   * ============================================================ */
  const MESSAGES = {
    too_short: { _: `اكتب تبريرًا أوضح: ${MIN_REASON_CHARS} أحرف على الأقل تشرح لماذا تحتاج هذا الرابط.` },
    too_few_words: { _: 'تبريرك قصير جدًا. اكتب جملة كاملة تشرح كيف يخدم الرابط مهمتك.',
      strict: 'جملة كاملة من {minWords} كلمات على الأقل. لا أقبل أعذارًا مختصرة.' },
    gibberish: {
      strict: 'هذا ليس تبريرًا. اكتب سببًا حقيقيًا أو عُد إلى «{task}» فورًا.',
      supportive: 'لم أستطع فهم ما كتبته. اكتب جملة قصيرة وواضحة تشرح لماذا تحتاج هذا الرابط.',
      philosopher: 'نصٌّ بلا معنى لا يصلح حجّة. صُغ سببًا منطقيًا يربط هذا الرابط بهدفك: «{goal}».'
    },
    vague: {
      strict: 'عذر غامض. قل بدقة ماذا ستأخذ من هذا الرابط لمهمتك: «{task}».',
      supportive: 'تبريرك عام بعض الشيء. أخبرني ما الذي ستستفيده من هذا الرابط لمهمتك: «{task}».',
      philosopher: 'ما الدليل على أن هذا الرابط ضروري؟ «لأنني أريد» ليست حجّة — اربطه بمهمتك: «{task}».'
    },
    entertainment: {
      strict: 'الترفيه ليس مبررًا. أمامك {remainingText} لإنهاء «{task}».',
      supportive: 'أفهم رغبتك في التسلية، لكنها تنتظر. أنهِ «{task}» أولًا وكافئ نفسك بعدها.',
      philosopher: 'هل يخدم الترفيه الآن نتيجتك المتوقعة «{outcome}»؟ الجواب لا — أجّله.'
    },
    distraction_domain: { _: 'الموقع {host} مصنّف مشتّتًا، ولا يمكن إضافته كمورد دراسي مهما كان التبرير. إن كنت متعبًا فاذكر ذلك صراحةً بعد أن تقضي وقتًا كافيًا في الدراسة.' },
    no_tie: {
      strict: 'تبريرك لا يذكر أي صلة بهدفك «{goal}». قل بوضوح كيف يخدم هذا الرابط «{task}».',
      supportive: 'لم أجد في تبريرك صلة بهدفك «{goal}». اذكر كيف يساعدك الرابط في «{task}».',
      philosopher: 'تبريرك لا يربط الرابط بهدفك «{goal}». حجّة بلا مقدّمة لا تُقبل: اربط الرابط بمهمتك «{task}».'
    },
    no_reasoning: { _: 'اشرح السبب بصيغة تعليل (لأن… / حتى… / لكي…) توضّح كيف يخدم هذا الرابط مهمتك «{task}».' },
    too_early: {
      supportive: 'مضى {elapsedText} فقط من أصل {durationText}. أنت قادر على الاستمرار قليلًا — أكمل «{task}» نحو «{outcome}»، وتُتاح لك استراحة قصيرة بعد نحو {waitText}.',
      strict: 'التعب ليس سببًا للتوقف الآن: مضى {elapsedText} فقط. عُد إلى «{task}»، والاستراحة بعد {waitText}.',
      philosopher: 'التعب إحساس لا دليل. بعد {elapsedText} فقط لا يبرّر التوقف. تأمّل: ما الذي تبقّى لتنجز «{outcome}»؟ تُتاح الاستراحة بعد {waitText}.'
    },
    near_end: { _: 'تبقّى {remainingText} فقط! أكمل «{task}» حتى النهاية، ثم ارتح كما تشاء.' },
    break_ok: {
      supportive: 'تستحق استراحة قصيرة: {breakText}. بعدها عُد إلى «{task}» لتحقق «{outcome}». لن يُضاف هذا الموقع إلى موارد جلستك.',
      strict: 'استراحة {breakText} فقط، لا دقيقة زائدة. بعدها «{task}» فورًا. الموقع لن يُضاف إلى موارد الجلسة.',
      philosopher: 'الاستراحة المحسوبة جزء من الدراسة الجيدة: {breakText}، ثم تعود إلى «{task}». لن يُضاف الموقع إلى موارد الجلسة.'
    },
    add_ok: { _: 'تم قبول تبريرك وإضافة الرابط إلى جلستك.' }
  };

  /** مطابقة العدد والمعدود: دقيقة واحدة / دقيقتان / 3 دقائق / 11 دقيقة */
  function arMin(n) {
    n = Math.max(0, Math.round(Number(n) || 0));
    if (n === 0) return 'أقل من دقيقة';
    if (n === 1) return 'دقيقة واحدة';
    if (n === 2) return 'دقيقتان';
    return n <= 10 ? `${n} دقائق` : `${n} دقيقة`;
  }

  function fill(tpl, ctx) {
    return tpl.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] !== undefined && ctx[k] !== '' ? ctx[k] : '—'));
  }

  function messageFor(code, persona, ctx) {
    const entry = MESSAGES[code] || {};
    return fill(entry[persona] || entry._ || entry.supportive || '', ctx);
  }

  /* ============================================================
   * 10) تقييم التبرير
   * ============================================================ */
  /**
   * @returns {{decision:'reject'|'encourage'|'break'|'add', code:string, message:string, minutes?:number, waitMinutes?:number}}
   */
  function evaluateJustification({ text, session, linkEval, now = Date.now() }) {
    session = session || {};
    const persona = personaOf(session);
    const cfg = PERSONA_CFG[persona];
    const ts = timeStats(session, now);
    const ctx = {
      ...ts, goal: session.goal, task: session.task, outcome: session.outcome,
      host: (linkEval && linkEval.host) || '', breakMinutes: BREAK_MINUTES, minWords: cfg.minWords,
      elapsedText: arMin(ts.elapsedMinutes), durationText: arMin(ts.durationMinutes),
      remainingText: arMin(ts.remainingMinutes), breakText: arMin(BREAK_MINUTES)
    };
    const res = (decision, code, extra = {}) => ({
      decision, code, ...extra,
      message: messageFor(code, persona, { ...ctx, ...extra, waitText: arMin(extra.waitMinutes) })
    });

    const raw = String(text || '').trim();
    if (raw.length < MIN_REASON_CHARS) return res('reject', 'too_short');
    if (isGibberish(raw)) return res('reject', 'gibberish');

    const norm = normalize(raw);
    const toks = rawTokens(raw);

    // تعب / ملل / طلب استراحة: يُعالَج بصدق ودون إضافة الرابط للجلسة
    if (detectFatigue(toks)) {
      const el = breakEligibility(session, now);
      if (el.ok) return res('break', 'break_ok', { minutes: BREAK_MINUTES });
      if (el.code === 'near_end') return res('encourage', 'near_end');
      return res('encourage', 'too_early', { waitMinutes: el.waitMinutes });
    }

    if (isVague(norm, toks, cfg)) return res('reject', 'vague');
    if (hasEntertainmentIntent(toks)) return res('reject', 'entertainment');
    if (linkEval && linkEval.verdict === 'block' && /^distraction/.test(linkEval.reasonCode)) return res('reject', 'distraction_domain');

    const words = norm.split(/\s+/).filter((w) => w.length >= 2).length;
    if (words < cfg.minWords) return res('reject', 'too_few_words');

    const sess = analyzeSession(session);
    if (computeTies(toks, sess).length === 0) return res('reject', 'no_tie');

    const verdict = linkEval ? linkEval.verdict : 'uncertain';
    const needConnector = verdict === 'block' || (verdict === 'uncertain' && cfg.connectorForUncertain);
    if (needConnector && !hasConnector(norm, toks)) return res('reject', 'no_reasoning');

    return res('add', 'add_ok');
  }

  /* ============================================================
   * التصدير
   * ============================================================ */
  const api = {
    evaluateLinkAgainstSession,
    evaluateJustification,
    breakEligibility,
    timeStats,
    detectFatigue: (text) => detectFatigue(rawTokens(text)),
    isGibberish,
    normalize,
    MIN_REASON_CHARS,
    COOLDOWN_SECONDS,
    BREAK_MINUTES
  };

  root.AzmEval = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
