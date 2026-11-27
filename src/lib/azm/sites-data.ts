/* Azm — catalog of the simulated web (data only; renderers live in sites-pages.tsx) */

import type { SiteCategory, Lang } from "./types";

export interface CatalogVideo {
  id: string;
  title: Record<Lang, string>;
  channel: string; // handle, e.g. @edulamp
  channelName: Record<Lang, string>;
  durationMin: number;
  views: Record<Lang, string>;
  age: Record<Lang, string>;
  category: SiteCategory;
  gradient: [string, string];
  desc: Record<Lang, string>;
  comments: { author: string; text: Record<Lang, string> }[];
}

export interface CatalogSite {
  id: string;
  host: string;
  name: Record<Lang, string>;
  category: SiteCategory;
}

export const SITE_CATALOG: (CatalogSite & { videos?: CatalogVideo[] })[] = [
  {
    id: "youtube",
    host: "youtube.com",
    name: { ar: "يوتيوب", en: "YouTube" },
    category: "entertainment",
    videos: [
      {
        id: "v-photo1",
        title: {
          ar: "التمثيل الضوئي: شرح شامل خطوة بخطوة | أحياء الثانوية",
          en: "Photosynthesis: Complete Step-by-Step Explanation | High-School Biology",
        },
        channel: "@edulamp",
        channelName: { ar: "مصباح التعليم", en: "EduLamp" },
        durationMin: 14,
        views: { ar: "٤٨٢ ألف مشاهدة", en: "482K views" },
        age: { ar: "قبل 3 أشهر", en: "3 months ago" },
        category: "education",
        gradient: ["#7C3AED", "#34D399"],
        desc: {
          ar: "في هذا الدرس نشرح التمثيل الضوئي بالتفصيل: التفاعلات الضوئية، دورة كالفن، وأهم الفروق بين النباتات C3 وC4 — مع رسم توضيحي متحرك و15 سؤالًا تدريبيًا في نهاية الفيديو.",
          en: "In this lesson we cover photosynthesis in detail: light reactions, the Calvin cycle, and key C3/C4 differences — with an animated diagram and 15 practice questions at the end.",
        },
        comments: [
          { author: "سارة", text: { ar: "حللت الأسئلة الأخيرة وفهمت أخيرًا دورة كالفن، شكرًا!", en: "I solved the final questions and finally understood the Calvin cycle, thanks!" } },
          { author: "Omar", text: { ar: "أفضل شرح شافته لهذا الدرس، المراجعة السريعة في النهاية مفيدة جدًا.", en: "Best explanation out there; the quick recap at the end is very useful." } },
        ],
      },
      {
        id: "v-calc1",
        title: {
          ar: "حيل التكامل: مراجعة مكثفة قبل الاختبار | حساب التفاضل والتكامل 2",
          en: "Integration Tricks — Calculus 2 Crash Review Before the Exam",
        },
        channel: "@matharc",
        channelName: { ar: "قوس الرياضيات", en: "MathArc" },
        durationMin: 22,
        views: { ar: "١.٢ مليون مشاهدة", en: "1.2M views" },
        age: { ar: "قبل سنة", en: "1 year ago" },
        category: "education",
        gradient: ["#8B5CF6", "#C4B5FD"],
        desc: {
          ar: "12 حيلة للتكامل بالأمثلة: التعويض، التجزئة، الكسور الجزئية، والمتتاليات — كل حيلة مع نمط سؤال اختبار مشابه.",
          en: "12 integration techniques with worked examples: substitution, by parts, partial fractions, and sequences — each matched to a typical exam question.",
        },
        comments: [
          { author: "Layla", text: { ar: "الحيلة رقم 7 وفّرت عليّ ساعة كاملة في الاختبار.", en: "Trick #7 saved me a whole hour in the exam." } },
        ],
      },
      {
        id: "v-hist1",
        title: {
          ar: "تاريخ الأندلس: من الفتح إلى السقوط | وثائقي تعليمي",
          en: "Al-Andalus: From Conquest to Fall | Educational Documentary",
        },
        channel: "@tarikhdot",
        channelName: { ar: "نقطة تاريخ", en: "HistoryDot" },
        durationMin: 31,
        views: { ar: "٧٤٥ ألف مشاهدة", en: "745K views" },
        age: { ar: "قبل 7 أشهر", en: "7 months ago" },
        category: "education",
        gradient: ["#A78BFA", "#7C3AED"],
        desc: {
          ar: "رحلة موثقة عبر قرون الأندلس: البناء، العلم، ثم عوامل الانحلال — ملخص مثالي لمادة التاريخ.",
          en: "A documented journey through the centuries of Al-Andalus: construction, science, and the factors of decline — a perfect history summary.",
        },
        comments: [
          { author: "أحمد", text: { ar: "استخدمته لتلخيص الفصل الرابع، ممتاز للمراجعة.", en: "Used it to summarize chapter four — great for revision." } },
        ],
      },
      {
        id: "v-code1",
        title: {
          ar: "ابنِ تطبيق React في 40 دقيقة | مشروع عملي كامل",
          en: "Build a React App in 40 Minutes | Full Practical Project",
        },
        channel: "@devpath",
        channelName: { ar: "مسار المطور", en: "DevPath" },
        durationMin: 41,
        views: { ar: "٩٣٦ ألف مشاهدة", en: "936K views" },
        age: { ar: "قبل 5 أشهر", en: "5 months ago" },
        category: "education",
        gradient: ["#34D399", "#8B5CF6"],
        desc: {
          ar: "مشروع متكامل: مكوّنات، حالة، وأدوات إدارة — مثالي لطلاب البرمجة قبل التسليم.",
          en: "A complete project: components, state, and management tools — ideal for CS students before submission.",
        },
        comments: [
          { author: "Nour", text: { ar: "اتبعته خطوة بخطوة وسلّمت المشروع في الوقت.", en: "Followed it step by step and submitted the project on time." } },
        ],
      },
      {
        id: "v-goals5",
        title: {
          ar: "أهداف لا تُصدق | أجمل 5 أهداف هذا الأسبوع",
          en: "Unbelievable Goals | Top 5 Goals of the Week",
        },
        channel: "@goalszone",
        channelName: { ar: "منطقة الأهداف", en: "GoalsZone" },
        durationMin: 6,
        views: { ar: "٣.٤ مليون مشاهدة", en: "3.4M views" },
        age: { ar: "قبل يومين", en: "2 days ago" },
        category: "entertainment",
        gradient: ["#FB7185", "#FBBF24"],
        desc: {
          ar: "تسجيلات الأهداف الأجمل من مباريات الأسبوع مع تعليق مشوق — لن تطمئن حتى تشاهد حتى النهاية.",
          en: "The best goals of the week with thrilling commentary — you can't look away.",
        },
        comments: [
          { author: "زياد", text: { ar: "الهدف الثالث أسطوري!", en: "The third goal is legendary!" } },
        ],
      },
      {
        id: "v-gaming",
        title: {
          ar: "قضيت 100 يوم في هذه اللعبة... والنتيجة صادمة",
          en: "I Spent 100 Days in This Game... The Result Was Shocking",
        },
        channel: "@pixelfox",
        channelName: { ar: "الثعلب البكسلي", en: "PixelFox" },
        durationMin: 18,
        views: { ar: "٢.١ مليون مشاهدة", en: "2.1M views" },
        age: { ar: "قبل أسبوع", en: "1 week ago" },
        category: "entertainment",
        gradient: ["#FBBF24", "#FB7185"],
        desc: {
          ar: "سلسلة التحديات الشهيرة: 100 يوم من البناء والنقاشات واللحظات المضحكة.",
          en: "The famous challenge series: 100 days of building, drama, and laughs.",
        },
        comments: [{ author: "Kareem", text: { ar: "سلسلة لا تُفوّت!", en: "A must-watch series!" } }],
      },
      {
        id: "v-music",
        title: {
          ar: "Lo-fi beats to relax / study to | ساعة تركيز هادئة",
          en: "Lo-fi beats to relax / study to | One calm focus hour",
        },
        channel: "@chillwave",
        channelName: { ar: "تشيل ويف", en: "ChillWave" },
        durationMin: 60,
        views: { ar: "١٥ مليون مشاهدة", en: "15M views" },
        age: { ar: "قبل سنتين", en: "2 years ago" },
        category: "entertainment",
        gradient: ["#60A5FA", "#A78BFA"],
        desc: {
          ar: "إيقاعات هادئة للدراسة والعمل — قائمة مستمرة بدون إعلانات.",
          en: "Calm beats for study and work — a continuous mix, no ads.",
        },
        comments: [{ author: "Hala", text: { ar: "أدرس معها دائمًا.", en: "I always study with this." } }],
      },
      {
        id: "v-vlog",
        title: {
          ar: "يوم في حياتي | روتين طالب جامعة",
          en: "Day in My Life | University Student Routine",
        },
        channel: "@lifenow",
        channelName: { ar: "الحياة الآن", en: "LifeNow" },
        durationMin: 12,
        views: { ar: "٨٩٠ ألف مشاهدة", en: "890K views" },
        age: { ar: "قبل 4 أيام", en: "4 days ago" },
        category: "entertainment",
        gradient: ["#C4B5FD", "#FB7185"],
        desc: {
          ar: "روتين يومي، مقاهي دراسة، ولحظات عفوية — فيديو تشبيك مثالي.",
          en: "Daily routine, study cafés, and candid moments — perfect procrastination bait.",
        },
        comments: [{ author: "Rana", text: { ar: "أحب هذا النوع من الفيديوهات.", en: "I love this kind of video." } }],
      },
    ],
  },
  { id: "youtube_watch", host: "youtube.com", name: { ar: "يوتيوب", en: "YouTube" }, category: "education" },
  { id: "youtube_channel", host: "youtube.com", name: { ar: "يوتيوب", en: "YouTube" }, category: "education" },
  { id: "youtube_playlist", host: "youtube.com", name: { ar: "يوتيوب", en: "YouTube" }, category: "education" },
  { id: "google", host: "google.com", name: { ar: "جوجل", en: "Google" }, category: "search" },
  { id: "google_results", host: "google.com", name: { ar: "جوجل", en: "Google" }, category: "search" },
  { id: "chatgpt", host: "chatgpt.com", name: { ar: "ChatGPT", en: "ChatGPT" }, category: "ai_tool" },
  { id: "claude", host: "claude.ai", name: { ar: "Claude", en: "Claude" }, category: "ai_tool" },
  {
    id: "coursera",
    host: "coursera.org",
    name: { ar: "Coursera", en: "Coursera" },
    category: "education",
  },
  {
    id: "khanacademy",
    host: "khanacademy.org",
    name: { ar: "أكاديمية خان", en: "Khan Academy" },
    category: "education",
  },
  {
    id: "wikipedia",
    host: "wikipedia.org",
    name: { ar: "ويكيبيديا", en: "Wikipedia" },
    category: "reference",
  },
  { id: "x", host: "x.com", name: { ar: "X (تويتر)", en: "X (Twitter)" }, category: "social" },
  { id: "instagram", host: "instagram.com", name: { ar: "إنستغرام", en: "Instagram" }, category: "social" },
  { id: "tiktok", host: "tiktok.com", name: { ar: "تيك توك", en: "TikTok" }, category: "entertainment" },
  { id: "reddit", host: "reddit.com", name: { ar: "ريديت", en: "Reddit" }, category: "social" },
  { id: "netflix", host: "netflix.com", name: { ar: "نتفليكس", en: "Netflix" }, category: "entertainment" },
  { id: "yallakora", host: "yallakora.com", name: { ar: "يلا كورة", en: "YallaKora" }, category: "sports" },
  { id: "bbc", host: "bbc.com", name: { ar: "BBC عربي", en: "BBC Arabic" }, category: "news" },
  { id: "unknown", host: "", name: { ar: "صفحة غير معروفة", en: "Unknown page" }, category: "unknown" },
];

export const VIDEO_BY_ID = new Map<string, CatalogVideo>(
  (SITE_CATALOG.find((s) => s.id === "youtube")?.videos ?? []).map((v) => [v.id, v])
);

export const RECOMMENDED_TOOLS: {
  id: string;
  url: string;
  name: Record<Lang, string>;
  desc: Record<Lang, string>;
  icon: "sparkles" | "bot" | "search" | "book";
}[] = [
  {
    id: "chatgpt",
    url: "chatgpt.com",
    name: { ar: "ChatGPT", en: "ChatGPT" },
    desc: { ar: "اشرح المفاهيم الصعبة، ولّد أسئلة تدريبية، واطلب تلخيصًا.", en: "Explain hard concepts, generate practice questions, and summarize." },
    icon: "bot",
  },
  {
    id: "claude",
    url: "claude.ai",
    name: { ar: "Claude", en: "Claude" },
    desc: { ar: "مراجعة نصوص طويلة وتلخيص المقالات والمحاضرات.", en: "Review long texts and summarize articles and lectures." },
    icon: "sparkles",
  },
  {
    id: "google",
    url: "google.com",
    name: { ar: "جوجل", en: "Google" },
    desc: { ar: "بحث سريع عن تعريفات ومصادر داعمة — يقيّم عزم كل بحث.", en: "Quick lookups of definitions and supporting sources — Azm evaluates every search." },
    icon: "search",
  },
  {
    id: "wikipedia",
    url: "wikipedia.org",
    name: { ar: "ويكيبيديا", en: "Wikipedia" },
    desc: { ar: "خلفية سريعة عن المصطلحات والأسماء في مادتك.", en: "Quick background on terms and names in your subject." },
    icon: "book",
  },
];

export const SETUP_SUGGESTIONS: { url: string; label: Record<Lang, string> }[] = [
  { url: "https://www.youtube.com/watch?v=v-photo1", label: { ar: "فيديو: التمثيل الضوئي", en: "Video: Photosynthesis" } },
  { url: "https://www.youtube.com/@edulamp", label: { ar: "قناة: مصباح التعليم", en: "Channel: EduLamp" } },
  { url: "https://www.youtube.com/playlist?list=PL-bio-unit3", label: { ar: "قائمة: سلسلة الأحياء", en: "Playlist: Biology series" } },
  { url: "https://coursera.org", label: { ar: "Coursera", en: "Coursera" } },
  { url: "https://khanacademy.org", label: { ar: "أكاديمية خان", en: "Khan Academy" } },
  { url: "https://wikipedia.org", label: { ar: "ويكيبيديا", en: "Wikipedia" } },
  { url: "https://chatgpt.com", label: { ar: "ChatGPT", en: "ChatGPT" } },
  { url: "https://claude.ai", label: { ar: "Claude", en: "Claude" } },
  { url: "https://google.com", label: { ar: "جوجل", en: "Google" } },
];
