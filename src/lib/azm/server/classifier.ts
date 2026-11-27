/* Azm — deterministic intent classifier (no network, <1ms).
 * Ported + adapted from azm-ai v0.2.2 (classifier/fallback.ts + triage.ts).
 *
 * Scores the relationship between the study goal and the active navigation:
 *   - declared resources of the session (strongest signal)
 *   - known productive / educational domains
 *   - known entertainment / social domains
 *   - keyword overlap between goal text and the destination title
 *     (Arabic <-> English via glossary topic clusters)
 *   - an optional catalog hint from the simulated web (per-video category)
 *
 * It only labels activity (relevant / unrelated / uncertain) — what happens
 * next is decided by the policy and the agent. A mixed platform is never
 * judged by its domain alone: YouTube with a lesson title is relevant;
 * YouTube with an entertainment title is uncertain.
 */

import { tokenize, keywordOverlap } from "./text";
import { expandTokensWithGlossary, sharesGlossaryCluster } from "./glossary";
import type { IntentCategory } from "../policy";

/* ---------------------------- domain triage ------------------------------ */

const PRODUCTIVE_DOMAINS = [
  "notion.so", "notion.site", "obsidian.md", "evernote.com", "onenote.com", "coda.io", "craft.do",
  "docs.google.com", "drive.google.com", "sheets.google.com", "slides.google.com", "classroom.google.com",
  "scholar.google.com", "office.com", "office365.com", "sharepoint.com", "overleaf.com",
  "github.com", "gitlab.com", "bitbucket.org", "stackoverflow.com", "stackexchange.com",
  "developer.mozilla.org", "readthedocs.io", "devdocs.io", "w3schools.com", "leetcode.com",
  "replit.com", "codesandbox.io", "codepen.io", "figma.com", "canva.com", "miro.com",
  "trello.com", "asana.com", "linear.app", "clickup.com", "todoist.com", "monday.com", "atlassian.net",
  "wikipedia.org", "wikibooks.org", "wiktionary.org", "khanacademy.org", "coursera.org", "edx.org",
  "udemy.com", "quizlet.com", "brilliant.org", "openstax.org", "ck12.org", "arxiv.org", "jstor.org",
  "researchgate.net", "sciencedirect.com", "moodle.org", "blackboard.com", "instructure.com",
  "desmos.com", "geogebra.org", "wolframalpha.com", "duolingo.com",
  "classcentral.com", "canvas.net", "study.com", "brainly.com", "almanahj.com", "nourhomma.com",
];

const DISTRACTION_DOMAINS = [
  "facebook.com", "instagram.com", "tiktok.com", "x.com", "twitter.com", "snapchat.com",
  "reddit.com", "tumblr.com", "pinterest.com", "threads.net", "vk.com", "likee.video",
  "netflix.com", "hulu.com", "disneyplus.com", "primevideo.com", "max.com", "crunchyroll.com",
  "twitch.tv", "kick.com", "shahid.net", "shahid.mbc.net", "elcinema.com", "egybest.com",
  "9gag.com", "buzzfeed.com", "imgur.com", "ifunny.co", "knowyourmeme.com",
  "roblox.com", "steampowered.com", "epicgames.com", "poki.com", "y8.com", "miniclip.com", "crazygames.com",
  "espn.com", "kooora.com", "yallakora.com", "filgoal.com",
];

const SEARCH_DOMAINS = ["google.com", "bing.com", "duckduckgo.com", "yandex.com", "ecosia.org", "startpage.com"];

function matchesDomain(domain: string, list: string[]): boolean {
  for (const d of list) {
    if (domain === d || domain.endsWith("." + d)) return true;
  }
  return false;
}

export function triageDomain(domain: string): "productive" | "distracting" | "search" | "unknown" {
  const d = domain.toLowerCase().replace(/^www\./, "");
  if (matchesDomain(d, PRODUCTIVE_DOMAINS)) return "productive";
  if (matchesDomain(d, DISTRACTION_DOMAINS)) return "distracting";
  if (matchesDomain(d, SEARCH_DOMAINS)) return "search";
  return "unknown";
}

/** Extract bare domains from the session's declared scope entries. */
function scopeDomains(allowedSites: Array<{ pattern: string; kind: string }>): string[] {
  const out: string[] = [];
  for (const s of allowedSites) {
    if (s.kind === "domain" || s.kind === "url") {
      const raw = s.pattern.replace(/^(domain|url):/, "");
      const host = raw.split("/")[0].replace(/^www\./, "").toLowerCase();
      if (host) out.push(host);
    } else {
      out.push("youtube.com");
    }
  }
  return out;
}

function matchesDeclared(domain: string, declared: string[]): boolean {
  for (const d of declared) {
    if (domain === d || domain.endsWith("." + d) || d.endsWith("." + domain)) return true;
  }
  return false;
}

/* -------------------------- entertainment titles -------------------------- */

const ENTERTAINMENT_TITLE_SIGNALS = [
  "funny", "meme", "memes", "prank", "pranks", "reaction", "vlog", "roast", "fails", "fail",
  "trailer", "movie", "series", "episode", "highlights", "goals", "skills", "gameplay", "lets play",
  "مضحك", "طريف", "كوميدي", "مقلب", "مقالب", "هبل", "تحدي", "دراما", "مسلسل", "فيلم",
  "أهداف", "اهداف", "ملخص مباراة", "لقطات", "اضحك", "ضحك", "ريلز",
];

const STUDY_TITLE_SIGNALS = [
  "شرح", "درس", "محاضرة", "مراجعة", "تلخيص", "حل", "تمارين", "امتحان", "اختبار", "دورة",
  "lesson", "lecture", "explained", "tutorial", "course", "review", "summary", "exam", "practice", "crash course",
];

function titleIsEntertaining(title: string): boolean {
  const t = title.toLowerCase();
  return ENTERTAINMENT_TITLE_SIGNALS.some((s) => t.includes(s));
}

function titleIsStudy(title: string): boolean {
  const t = title.toLowerCase();
  return STUDY_TITLE_SIGNALS.some((s) => t.includes(s));
}

/* ------------------------------ classifier -------------------------------- */

export interface ClassifyInput {
  /** normalized url, e.g. youtube.com/watch?v=abc */
  url: string;
  domain: string;
  title: string;
  /** destination category hint from the simulated catalog (may be "unknown") */
  catalogCategory?: string;
  /** true when the destination matches one of the session's declared scope entries */
  inDeclaredScope: boolean;
  session: {
    goal: string;
    task: string;
    expectedOutcome: string;
    allowedSites: Array<{ pattern: string; kind: string }>;
    /** AI memory texts about this student */
    memory: string[];
  };
}

export interface Classification {
  category: IntentCategory;
  confidence: number;
  reasonAr: string;
  reasonEn: string;
  source: "declared" | "intent" | "hint";
}

export function classifyIntent(input: ClassifyInput): Classification {
  const { domain, title } = input;
  const declared = scopeDomains(input.session.allowedSites);
  const declaredHit = input.inDeclaredScope || matchesDeclared(domain, declared);

  const goalText = `${input.session.goal} ${input.session.task} ${input.session.expectedOutcome}`;
  const goalTokens = tokenize(goalText);
  const expanded = [...new Set([...goalTokens, ...expandTokensWithGlossary(goalTokens)])];
  const titleTokens = tokenize(title);
  const memText = input.session.memory.join(" ");
  const memTokens = tokenize(memText);

  const direct = keywordOverlap(expanded, titleTokens);
  const coreMatch = keywordOverlap(goalTokens, titleTokens);
  const memMatch = keywordOverlap(memTokens, titleTokens);
  const cluster = sharesGlossaryCluster(goalTokens, titleTokens);

  let score = 0;
  const evidAr: string[] = [];
  const evidEn: string[] = [];

  const triage = triageDomain(domain);
  if (triage === "productive") {
    score += 0.4;
    evidAr.push("موقع تعليمي أو أداة عمل");
    evidEn.push("educational site or work tool");
  } else if (triage === "distracting") {
    score -= 0.45;
    evidAr.push("موقع ترفيهي أو اجتماعي");
    evidEn.push("entertainment / social site");
  } else if (triage === "search") {
    score += 0.1;
    evidAr.push("محرك بحث");
    evidEn.push("search engine");
  }

  const matched = direct.matched.length;
  if (matched > 0) {
    score += Math.min(0.6, matched * 0.35);
    evidAr.push(`عنوان الصفحة يخدم هدفك (${matched} كلمة مفتاحية)`);
    evidEn.push(`page title matches your goal (${matched} keyword${matched > 1 ? "s" : ""})`);
  }
  if (coreMatch.matched.length > 0 && matched > 0) score += 0.2;
  if (matched === 0 && cluster) {
    score += 0.3;
    evidAr.push("الموضوع مرتبط بمجال هدفك الدراسي");
    evidEn.push("topic is related to your study field");
  }
  if (memMatch.matched.length > 0) {
    score += 0.15;
    evidAr.push("مرتبط بما يعرفه عزم عنك");
    evidEn.push("related to what Azm remembers about you");
  }
  if (titleIsStudy(title)) {
    score += 0.15;
    evidAr.push("عنوان الصفحة يوحي بمحتوى دراسي");
    evidEn.push("title suggests study content");
  }
  if (titleIsEntertaining(title)) {
    score -= 0.4;
    evidAr.push("عنوان الصفحة يوحي بمحتوى ترفيهي");
    evidEn.push("title suggests entertainment content");
  }

  // catalog hint from the simulated web (per-video category is reliable there)
  const hint = input.catalogCategory ?? "unknown";
  if (hint === "education" || hint === "reference" || hint === "ai_tool") {
    score += 0.2;
    evidAr.push("محتوى تعليمي");
    evidEn.push("educational content");
  } else if (hint === "entertainment" || hint === "social" || hint === "sports" || hint === "news") {
    score -= 0.35;
    evidAr.push("محتوى ترفيهي أو تسلية");
    evidEn.push("entertainment / pastime content");
  }

  // Declared resource: strong positive, but never a license for clearly
  // entertaining titles (intent-based, not list-based).
  if (declaredHit) {
    score += 0.5;
    evidAr.push("ضمن الموارد التي أعلنتها لجلستك");
    evidEn.push("within the resources you declared for this session");
  }

  if (!title.trim()) {
    score -= 0.1;
    evidAr.push("لا يوجد عنوان واضح للصفحة");
    evidEn.push("page has no clear title");
  }

  // A declared platform with a clearly entertaining title can never be
  // auto-labelled relevant — it lands on "uncertain" so the policy decides.
  if (declaredHit && score < 0.55) {
    return {
      category: "uncertain",
      confidence: Math.min(0.55, Math.max(0.3, 0.3 + Math.abs(score))),
      reasonAr: evidAr.length ? evidAr.join("؛ ") + "." : "الأمر غير واضح داخل نطاقك المعلن.",
      reasonEn: evidEn.length ? evidEn.join("; ") + "." : "Unclear within your declared scope.",
      source: "declared",
    };
  }

  score = Math.round(score * 100) / 100;

  let category: IntentCategory;
  if (score >= 0.45) category = "relevant";
  else if (score <= -0.25) category = "unrelated";
  else category = "uncertain";

  const confidence =
    category === "relevant"
      ? Math.min(0.95, 0.55 + (score - 0.45))
      : category === "unrelated"
        ? Math.min(0.95, 0.55 + Math.abs(score + 0.25))
        : Math.min(0.55, 0.3 + Math.abs(score));

  return {
    category,
    confidence: Math.max(0.05, confidence),
    reasonAr: evidAr.length ? evidAr.join("؛ ") + "." : "لا توجد مؤشرات كافية لتحديد علاقة هذه الصفحة بهدفك.",
    reasonEn: evidEn.length
      ? evidEn.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("; ") + "."
      : "Not enough information to relate this activity to your goal.",
    source: "intent",
  };
}

/* ------------------- justification keyword helpers ------------------------- */

const REST_WORDS = [
  "tired", "rest", "eyes", "eye", "hungry", "water", "thirsty", "headache", "stretch", "pray", "prayer", "toilet", "bathroom", "snack", "eat", "lunch", "dinner",
  "تعب", "تعبت", "راحه", "راحة", "عيني", "عيون", "جوع", "جائع", "ماء", "عطش", "صداع", "صلاه", "صلاة", "اكل", "أكل", "غداء", "عشاء", "حمام", "تمدد",
];

const LAZY_WORDS = ["bored", "boring", "funny", "meme", "reel", "reels", "fun", "ملل", "مملل", "زهقت", "اضحك", "مضحك", "ريلز"];

/** Offline break-request triage used when no LLM is configured. */
export function restRequestLooksHonest(text: string): boolean {
  const words = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const wants = words.some((w) => REST_WORDS.includes(w));
  const lazy = words.some((w) => LAZY_WORDS.includes(w));
  return wants && !lazy;
}

export function justificationLooksLazy(text: string): boolean {
  const words = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.some((w) => LAZY_WORDS.includes(w));
}
